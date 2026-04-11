import express from 'express';
import { getRecommendations, getReviewSummary, postAiChat } from '../controllers/ai.controller';
import { attachUserIfPresent } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/recommendations', attachUserIfPresent, getRecommendations);
router.get('/review-summary/:mediaId', attachUserIfPresent, getReviewSummary);
router.post('/chat', attachUserIfPresent, postAiChat);

export default router;
