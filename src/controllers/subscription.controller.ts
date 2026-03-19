import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../prisma/client';
import Stripe from 'stripe';

// Initialize Stripe (Make sure STRIPE_SECRET_KEY is in your backend .env file)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16', // Use the latest stable version you have
});

// Define your pricing model IDs from Stripe Dashboard here
// Note: You must create these products/prices in your Stripe Dashboard and paste the Price IDs here.
const STRIPE_PRICES = {
  monthly: 'price_YOUR_MONTHLY_PRICE_ID_HERE', 
  yearly: 'price_YOUR_YEARLY_PRICE_ID_HERE',
};

export const createSubscriptionIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { planId } = req.body; // 'monthly' or 'yearly'

    if (planId !== 'monthly' && planId !== 'yearly') {
      res.status(400).json({ message: 'Invalid plan selected' });
      return;
    }

    // 1. Get the user from DB
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // 2. Create or retrieve Stripe Customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      // Save customer ID in DB
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // 3. Create the subscription with payment_behavior: 'default_incomplete'
    // This creates an invoice but waits for the frontend to confirm the payment
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: STRIPE_PRICES[planId as keyof typeof STRIPE_PRICES] }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    // 4. Send the client secret back to the frontend
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    res.status(200).json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Subscription Intent Error:', error);
    res.status(500).json({ message: error.message || 'Failed to create subscription intent' });
  }
};