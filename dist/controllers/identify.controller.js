"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.identifyUser = void 0;
const data_source_1 = require("../data-source");
const User_1 = require("../entity/User");
const identifyUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, phoneNumber } = req.body;
        if (!email && !phoneNumber) {
            return res.status(400).json({ error: 'Email or phoneNumber required' });
        }
        const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
        // Step 1: Find all users with matching email or phone
        const matchingUsers = yield userRepo.find({
            where: [
                ...(email ? [{ email }] : []),
                ...(phoneNumber ? [{ phoneNumber }] : [])
            ],
            withDeleted: true,
        });
        const linkedIds = new Set();
        // Collect linked ids (cluster roots)
        for (const user of matchingUsers) {
            if (user.linkPrecedence === 'primary') {
                linkedIds.add(user.id);
            }
            else if (user.linkedId) {
                linkedIds.add(user.linkedId);
            }
        }
        // Step 2: Gather all related users by linkedId and id
        let allRelatedUsers = [...matchingUsers];
        for (const id of linkedIds) {
            const related = yield userRepo.find({
                where: [
                    { id },
                    { linkedId: id }
                ],
                withDeleted: true,
            });
            allRelatedUsers.push(...related);
        }
        // Remove duplicate users by ID
        const userMap = new Map();
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
            yield userRepo.save(primaryUser);
        }
        // If no users at all (fresh), create a primary user
        if (!primaryUser) {
            const newUser = userRepo.create({
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkPrecedence: 'primary',
                linkedId: null,
            });
            yield userRepo.save(newUser);
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
        const updates = users.filter(u => u.id !== primaryUser.id && u.linkPrecedence !== 'secondary');
        for (const user of updates) {
            user.linkPrecedence = 'secondary';
            user.linkedId = primaryUser.id;
        }
        if (updates.length > 0) {
            yield userRepo.save(updates);
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
            }
            else {
                newSecondaryUser.phoneNumber = phoneNumber;
            }
        }
        if (newSecondaryUser) {
            yield userRepo.save(newSecondaryUser);
        }
        // Step 6: Final response
        const finalRelated = yield userRepo.find({
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong' });
    }
});
exports.identifyUser = identifyUser;
