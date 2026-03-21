import express from 'express';
import { createSubscriptionIntent, cancelSubscription, confirmSubscription } from '../controllers/subscription.controller'; // <-- cancelSubscription ইমপোর্ট করো
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

// Create route
router.post('/create-intent', authenticate, createSubscriptionIntent);
// confirm route
router.post('/confirm', authenticate, confirmSubscription);
// Cancel route 
router.post('/cancel', authenticate, cancelSubscription); 

export default router;