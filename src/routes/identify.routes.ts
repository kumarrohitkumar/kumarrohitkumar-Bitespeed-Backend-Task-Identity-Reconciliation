import { Router } from 'express';
import { identifyUser } from '../controllers/identify.controller';

const router = Router();

router.post('/identify', identifyUser);

export default router;
