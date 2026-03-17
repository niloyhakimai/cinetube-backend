import express from 'express';
import { 
  createReview, 
  getApprovedReviews, 
  approveReview 
} from '../controllers/review.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = express.Router();

// Users can submit a review
router.post('/', authenticate, createReview);

// Anyone can view approved reviews for a specific media
router.get('/:mediaId', getApprovedReviews);

// Only Admins can approve a review
router.put('/:id/approve', authenticate, isAdmin, approveReview);

export default router;