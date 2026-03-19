import express from 'express';
import { createSubscriptionIntent, cancelSubscription } from '../controllers/subscription.controller'; // <-- cancelSubscription ইমপোর্ট করো
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

// Create route
router.post('/create-intent', authenticate, createSubscriptionIntent);
// Cancel route 
router.post('/cancel', authenticate, cancelSubscription); 

export default router;