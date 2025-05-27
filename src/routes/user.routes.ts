// src/routes/user.routes.ts
import { Router } from 'express';
import { getAllUsers } from '../controllers/user.controller';

const router = Router();

router.get('/users', getAllUsers);  // GET /users to fetch all users

export default router;
