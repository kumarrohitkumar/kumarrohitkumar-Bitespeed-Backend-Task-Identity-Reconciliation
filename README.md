# BiteSpeed - Backend Task: Identity Reconciliation

## Problem Statement

FluxKart.com wants to reward loyal customers and personalize their experience. However, some customers (like the brilliant Dr. Emmett Brown) use multiple emails and phone numbers for purchases. Your task is to design a backend system that reconciles these identities and returns a consolidated view.

## 🛠️ Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** TypeORM
- **Database:** PostgreSQL
- **Dev Tools:** ts-node-dev, dotenv

## API Endpoints

### `POST /identify`

**URL**:  
`https://kumarrohitkumar-bitespeed-backend-task.onrender.com/identify`

**Request Body**:
```json
{
  "email": "example@example.com",
  "phoneNumber": "1234567890"
}
```
### `GET /users`
**URL**
`https://kumarrohitkumar-bitespeed-backend-task.onrender.com/users`

**Description:**
Fetches all user data stored in the database, returning a list of all users with their associated emails, phone numbers, and linkage information.
