import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import authRoutes from './routes/auth.route';
import mediaRoutes from './routes/media.route';
import reviewRoutes from './routes/review.route';
import interactionRoutes from './routes/interaction.route';
import paymentRoutes from './routes/payment.route';
import watchlistRoutes from './routes/watchlist.route';
import subscriptionRoutes from './routes/subscription.route';
import adminRoutes from './routes/admin.route';
import tmdbRoutes from './routes/tmdb.route';
import catalogRoutes from './routes/catalog.route';
import aiRoutes from './routes/ai.route';
import { getSubscriptionPlanFromPriceId } from './constants/subscription';
import { sendPremiumWelcomeEmail } from './utils/email';
import { recordSubscriptionPayment } from './utils/subscription-payment';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const app = express();

const adapter = new PrismaPg({ connectionString: databaseUrl } as any);
export const prisma = new PrismaClient({ adapter });

const PORT = Number(process.env.PORT) || 5000;

app.use(cors());

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2024-12-18.acacia' as any,
  });
  const sig = req.headers['stripe-signature'] as string;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event;
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      const customerEmail = invoice.customer_email;
      const priceId = invoice.lines?.data?.[0]?.price?.id;
      const billingPeriod = invoice.lines?.data?.[0]?.period;
      const billingPeriodStart = billingPeriod?.start
        ? new Date(billingPeriod.start * 1000)
        : null;
      const billingPeriodEnd = billingPeriod?.end
        ? new Date(billingPeriod.end * 1000)
        : null;
      const plan = getSubscriptionPlanFromPriceId(priceId);
      const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      const paymentIntentId =
        typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent?.id;

      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (!user) {
        console.warn(`Subscription webhook received for unknown customer ${customerId}`);
        res.status(200).send('Webhook Handled');
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionPlan: plan,
          subscriptionStatus: 'ACTIVE',
          subscriptionEndDate: billingPeriodEnd,
        },
      });

      if (typeof invoice.amount_paid === 'number' && invoice.amount_paid > 0) {
        await recordSubscriptionPayment({
          userId: user.id,
          plan,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: paymentIntentId,
          billingPeriodStart,
          billingPeriodEnd,
          createdAt: invoice.created ? new Date(invoice.created * 1000) : null,
        });
      }

      console.log(`[WEBHOOK] User ${updatedUser.name} upgraded to ${plan} Premium.`);

      if (customerEmail) {
        try {
          await sendPremiumWelcomeEmail(customerEmail, updatedUser.name, plan);
          console.log(`[MAIL] Confirmation email sent to ${customerEmail}`);
        } catch (mailErr) {
          console.error('[MAIL] Failed to send confirmation email:', mailErr);
        }
      }
    }

    res.status(200).send('Webhook Handled');
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/ai', aiRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('CineTube Server is running...');
});

async function startServer() {
  try {
    console.log('Starting CineTube server...');
    console.log(`Connecting to database: ${process.env.DATABASE_URL?.substring(0, 50)}...`);

    await prisma.$connect();
    console.log('Connected to database');

    const server = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log('Ready to accept requests...');
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
