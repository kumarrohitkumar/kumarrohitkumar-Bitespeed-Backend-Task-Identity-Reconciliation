import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';

export const identifyUser = async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Email or phoneNumber required' });
    }

    const userRepo = AppDataSource.getRepository(User);

    // Step 1: Find all users with matching email or phone
    const matchingUsers = await userRepo.find({
      where: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ],
      withDeleted: true,
    });

    const linkedIds = new Set<number>();

    // Collect linked ids (cluster roots)
    for (const user of matchingUsers) {
      if (user.linkPrecedence === 'primary') {
        linkedIds.add(user.id);
      } else if (user.linkedId) {
        linkedIds.add(user.linkedId);
      }
    }

    // Step 2: Gather all related users by linkedId and id
    let allRelatedUsers = [...matchingUsers];
    for (const id of linkedIds) {
      const related = await userRepo.find({
        where: [
          { id },
          { linkedId: id }
        ],
        withDeleted: true,
      });
      allRelatedUsers.push(...related);
    }

    // Remove duplicate users by ID
    const userMap = new Map<number, User>();
    allRelatedUsers.forEach(user => userMap.set(user.id, user));
    const users = Array.from(userMap.values());

    // Step 3: Find the primary user (earliest created with linkPrecedence = 'primary')
    let primaryUser = users
      .filter(u => u.linkPrecedence === 'primary')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    // If no primary user, choose the oldest one and set it as primary
    if (!primaryUser && users.length > 0) {
      primaryUser = users.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      primaryUser.linkPrecedence = 'primary';
      primaryUser.linkedId = null;
      await userRepo.save(primaryUser);
    }

    // If no users at all (fresh), create a primary user
    if (!primaryUser) {
      const newUser = userRepo.create({
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: 'primary',
        linkedId: null,
      });
      await userRepo.save(newUser);
      primaryUser = newUser;
      return res.json({
        contact: {
          primaryContactId: primaryUser.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // Step 4: Make all other users secondary
    const updates = users.filter(
      u => u.id !== primaryUser.id && u.linkPrecedence !== 'secondary'
    );
    for (const user of updates) {
      user.linkPrecedence = 'secondary';
      user.linkedId = primaryUser.id;
    }
    if (updates.length > 0) {
      await userRepo.save(updates);
    }

    // Step 5: Add new secondary record if a new email or phone is introduced
    const knownEmails = new Set(users.map(u => u.email).filter(Boolean));
    const knownPhones = new Set(users.map(u => u.phoneNumber).filter(Boolean));

    let newSecondaryUser = null;

    if (email && !knownEmails.has(email)) {
      newSecondaryUser = userRepo.create({
        email,
        phoneNumber: null,
        linkPrecedence: 'secondary',
        linkedId: primaryUser.id,
      });
    }

    if (phoneNumber && !knownPhones.has(phoneNumber)) {
      // Only create another user if one wasn't already created with email
      if (!newSecondaryUser) {
        newSecondaryUser = userRepo.create({
          phoneNumber,
          email: null,
          linkPrecedence: 'secondary',
          linkedId: primaryUser.id,
        });
      } else {
        newSecondaryUser.phoneNumber = phoneNumber;
      }
    }

    if (newSecondaryUser) {
      await userRepo.save(newSecondaryUser);
    }

    // Step 6: Final response
    const finalRelated = await userRepo.find({
      where: [
        { id: primaryUser.id },
        { linkedId: primaryUser.id }
      ],
      withDeleted: true,
    });

    const emails = [...new Set(finalRelated.map(u => u.email).filter(Boolean))];
    const phoneNumbers = [...new Set(finalRelated.map(u => u.phoneNumber).filter(Boolean))];
    const secondaryContactIds = finalRelated
      .filter(u => u.linkPrecedence === 'secondary')
      .map(u => u.id);

    return res.json({
      contact: {
        primaryContactId: primaryUser.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
