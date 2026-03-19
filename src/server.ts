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
import Stripe from 'stripe';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const app = express();

// Global Prisma Database Connection
// (If you ever get adapter errors, remember PrismaPg usually expects a 'pg' Pool object)
const adapter = new PrismaPg({ connectionString: databaseUrl } as any);
export const prisma = new PrismaClient({ adapter });

const PORT = Number(process.env.PORT) || 5000;

app.use(cors());

// --- STRIPE WEBHOOK (Must be BEFORE express.json) ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });
  const sig = req.headers['stripe-signature'] as string;
  
  try {
    // Note: To test locally, you need Stripe CLI. For now, we are safely parsing the event.
    // If you don't have a Webhook Secret yet, we will bypass the signature check for testing purposes.
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || ""; 
    
    let event;
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Fallback for local testing without CLI
      event = JSON.parse(req.body.toString()); 
    }

    // Listen for successful payments
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;
      const customerId = invoice.customer;
      const priceId = invoice.lines?.data[0]?.price?.id;

      // Determine plan based on Price ID
      let plan = 'MONTHLY';
      if (priceId && priceId !== 'price_1TCaiWFwDBmk8OA2LVygiDbL') {
        plan = 'YEARLY';
      }

      // Update the Database using the global 'prisma' instance!
      await prisma.user.update({
        where: { stripeCustomerId: customerId },
        data: { 
          subscriptionPlan: plan, 
          subscriptionStatus: 'ACTIVE' 
        }
      });
      console.log(`✅ [WEBHOOK] User upgraded to ${plan} Premium!`);
    }

    res.status(200).send('Webhook Handled');
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
// ----------------------------------------------------

// Regular JSON body parser for all other routes
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('CineTube Server is running...');
});

async function startServer() {
  try {
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();