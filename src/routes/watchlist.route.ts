import express from 'express';
import { toggleWatchlist, getUserWatchlist } from '../controllers/watchlist.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/toggle', authenticate, toggleWatchlist);
router.get('/', authenticate, getUserWatchlist);

export default router;