import express from 'express';
import { createPaymentIntent, confirmPayment, getPurchaseHistory } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/create-intent', authenticate, createPaymentIntent);
router.post('/confirm', authenticate, confirmPayment);
router.get('/history', authenticate, getPurchaseHistory);
export default router;