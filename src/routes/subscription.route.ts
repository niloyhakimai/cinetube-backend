import express from 'express';
import { createSubscriptionIntent } from '../controllers/subscription.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

// Route to initialize the subscription and get the client secret
router.post('/create-intent', authenticate, createSubscriptionIntent);

export default router;