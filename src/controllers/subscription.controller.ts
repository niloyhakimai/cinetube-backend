import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../prisma/client';
import Stripe from 'stripe';

// 1. Force a stable Stripe API version and bypass TypeScript strict check
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any, 
});

const STRIPE_PRICES = {
  monthly: 'price_1TCaiWFwDBmk8OA2LVygiDbL', 
  yearly: 'price_1TCauyFwDBmk8OA2qLc9zE1a',
};

export const createSubscriptionIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (planId !== 'monthly' && planId !== 'yearly') {
      res.status(400).json({ message: 'Invalid plan selected' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // 2. Simplified subscription creation to force Payment Intent generation
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: STRIPE_PRICES[planId as keyof typeof STRIPE_PRICES] }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    let invoice: any = subscription.latest_invoice;

    if (typeof invoice === 'string') {
      invoice = await stripe.invoices.retrieve(invoice, {
        expand: ['payment_intent'],
      });
    }

    if (!invoice) {
      res.status(400).json({ message: 'No invoice generated for this subscription.' });
      return;
    }

    if (invoice.amount_due === 0) {
      res.status(200).json({
        subscriptionId: subscription.id,
        clientSecret: 'free_trial_no_payment_intent', 
      });
      return;
    }

    const paymentIntent = invoice.payment_intent;

    if (!paymentIntent) {
      throw new Error('Payment intent missing even with stable API version.');
    }

    let clientSecret = '';
    if (typeof paymentIntent === 'string') {
      const pi = await stripe.paymentIntents.retrieve(paymentIntent);
      clientSecret = pi.client_secret as string;
    } else {
      clientSecret = paymentIntent.client_secret;
    }

    res.status(200).json({
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
    });
  } catch (error: any) {
    console.error('Subscription Intent Error:', error);
    res.status(500).json({ message: error.message || 'Failed to create subscription intent' });
  }
};