import express from 'express';
import { getDashboardStats } from '../controllers/admin.controller';
import { authenticate, requireAnyRole } from '../middlewares/auth.middleware';

const router = express.Router();

// Get aggregated dashboard stats
router.get('/dashboard', authenticate, requireAnyRole(['ADMIN', 'MODERATOR', 'CURATOR']), getDashboardStats);

export default router;
