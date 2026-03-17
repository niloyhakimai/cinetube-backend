import express from 'express';
import { addComment, toggleLike } from '../controllers/interaction.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/comment', authenticate, addComment);
router.post('/like', authenticate, toggleLike);

export default router;