import { Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2026-02-25.clover',
  });
}

export const createPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mediaId } = req.body;
    const userId = req.user.id;
    const stripe = getStripeClient();

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      res.status(404).json({ message: 'Media not found' });
      return;
    }

    if (media.priceType !== 'PREMIUM') {
      res.status(400).json({ message: 'This media is free. No payment required.' });
      return;
    }

    const priceAmount = 999; 

    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceAmount,
      currency: 'usd',
      metadata: { userId, mediaId },
    });

    const purchase = await prisma.purchase.create({
      data: {
        amount: priceAmount / 100,
        paymentStatus: 'PENDING',
        userId,
        mediaId,
      },
    });

    res.status(200).json({
      message: 'Payment intent created successfully',
      clientSecret: paymentIntent.client_secret,
      purchaseId: purchase.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'STRIPE_SECRET_KEY is not set') {
      res.status(500).json({ message: 'Stripe is not configured on the server.' });
      return;
    }

    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { purchaseId } = req.body;

    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: { paymentStatus: 'COMPLETED' },
    });

    res.status(200).json({
      message: 'Payment confirmed successfully. You can now stream this media.',
      purchase: updatedPurchase,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
