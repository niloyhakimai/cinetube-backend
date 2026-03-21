import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../prisma/client';
import Stripe from 'stripe';
import { serializeUser } from '../utils/serialize-user';

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

export const cancelSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;

    // 1. Get user from database
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !user.stripeCustomerId) {
      res.status(404).json({ message: 'No active Stripe customer found.' });
      return;
    }

    // 2. Fetch the active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
    });

    if (subscriptions.data.length === 0) {
      res.status(404).json({ message: 'No active subscription found to cancel.' });
      return;
    }

    // 3. Cancel the subscription on Stripe (cancels the first active one it finds)
    const subscriptionId = subscriptions.data[0].id;
    await stripe.subscriptions.cancel(subscriptionId);

    // 4. Update the database to reflect the cancellation
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'CANCELED',
      },
    });

    res.status(200).json({ message: 'Subscription successfully canceled.' });
  } catch (error: any) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ message: error.message || 'Failed to cancel subscription' });
  }
};

export const confirmSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { planId, subscriptionId } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Access denied. No user found in token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    let plan: 'MONTHLY' | 'YEARLY';
    let subscriptionEndDate: Date | null = null;

    if (subscriptionId) {
      if (!user.stripeCustomerId) {
        res.status(400).json({ message: 'Stripe customer is missing for this user.' });
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const stripeSubscription = subscription as Stripe.Subscription & {
        current_period_end?: number;
      };

      if (stripeSubscription.customer !== user.stripeCustomerId) {
        res.status(403).json({ message: 'Subscription does not belong to the authenticated user.' });
        return;
      }

      if (!['active', 'trialing'].includes(stripeSubscription.status)) {
        res.status(400).json({
          message: `Subscription is not active yet. Current status: ${stripeSubscription.status}`,
        });
        return;
      }

      const priceId = stripeSubscription.items.data[0]?.price?.id;
      plan = priceId === STRIPE_PRICES.yearly ? 'YEARLY' : 'MONTHLY';
      subscriptionEndDate = stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000)
        : null;
    } else {
      if (planId !== 'monthly' && planId !== 'yearly') {
        res.status(400).json({ message: 'Invalid plan selected.' });
        return;
      }

      plan = planId === 'yearly' ? 'YEARLY' : 'MONTHLY';
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: plan,
        subscriptionEndDate,
      },
    });

    res.status(200).json({
      message: 'Subscription activated successfully',
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error('Error confirming subscription:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};
