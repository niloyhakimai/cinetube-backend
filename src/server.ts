import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.route';
import mediaRoutes from './routes/media.route';
import reviewRoutes from './routes/review.route';
import interactionRoutes from './routes/interaction.route';
import paymentRoutes from './routes/payment.route';
import watchlistRoutes from './routes/watchlist.route';
import subscriptionRoutes from './routes/subscription.route';
import adminRoutes from './routes/admin.route';
import Stripe from 'stripe';
import { sendPremiumWelcomeEmail } from './utils/email';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const app = express();

const adapter = new PrismaPg({ connectionString: databaseUrl } as any);
export const prisma = new PrismaClient({ adapter });

const PORT = Number(process.env.PORT) || 5000;

app.use(cors());

// --- STRIPE WEBHOOK ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-12-18.acacia' as any });
  const sig = req.headers['stripe-signature'] as string;
  
  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || ""; 
    
    let event;
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = JSON.parse(req.body.toString()); 
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;
      const customerId = invoice.customer;
      const customerEmail = invoice.customer_email;
      const priceId = invoice.lines?.data[0]?.price?.id;

      let plan = 'MONTHLY';
      if (priceId && priceId !== 'price_1TCaiWFwDBmk8OA2LVygiDbL') {
        plan = 'YEARLY';
      }

   
      const updatedUser = await prisma.user.update({
        where: { stripeCustomerId: customerId },
        data: { 
          subscriptionPlan: plan, 
          subscriptionStatus: 'ACTIVE' 
        }
      });

      console.log(`✅ [WEBHOOK] User ${updatedUser.name} upgraded to ${plan} Premium!`);

      if (customerEmail) {
        try {
          await sendPremiumWelcomeEmail(customerEmail, updatedUser.name, plan);
          console.log(`📧 Confirmation email sent to ${customerEmail}`);
        } catch (mailErr) {
          console.error('❌ Failed to send confirmation email:', mailErr);
        }
      }
    }

    res.status(200).send('Webhook Handled');
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
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

app.get('/', (req: Request, res: Response) => {
  res.send('CineTube Server is running...');
});

async function startServer() {
  try {
    console.log('🚀 Starting CineTube server...');
    console.log(`📦 Connecting to database: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
    
    await prisma.$connect();
    console.log('✅ Connected to database');
    
    const server = app.listen(PORT, () => {
      console.log(`🌐 Server is running on http://localhost:${PORT}`);
      console.log('📡 Ready to accept requests...');
    });

    // Keep the process alive
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();