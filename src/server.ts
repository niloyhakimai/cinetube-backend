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


const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const app = express();
const adapter = new PrismaPg({ connectionString: databaseUrl });
export const prisma = new PrismaClient({ adapter });
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());


app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/watchlist', watchlistRoutes);

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
