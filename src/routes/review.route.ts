import express from 'express';
import { 
  createReview, 
  getApprovedReviews, 
  approveReview,
  getPendingReviews,
  getUserReviews,
  deleteReview,
  updateReview,
  addComment,
  toggleLike
} from '../controllers/review.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = express.Router();

// Users can submit a review
router.post('/', authenticate, createReview);
// Like Toggle Route
router.post('/:id/like', authenticate, toggleLike);

// Comment Route
router.post('/:id/comment', authenticate, addComment);
router.get('/admin/pending', authenticate, isAdmin, getPendingReviews);
router.get('/me', authenticate, getUserReviews);
// Anyone can view approved reviews for a specific media
router.get('/:mediaId', getApprovedReviews);

// Only Admins can approve a review
router.put('/:id/approve', authenticate, isAdmin, approveReview);
router.put('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);
export default router;