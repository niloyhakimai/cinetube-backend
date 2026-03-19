import express from 'express';
import { getDashboardStats } from '../controllers/admin.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

// Get aggregated dashboard stats
router.get('/dashboard', authenticate, getDashboardStats);

export default router;