import express from 'express';
import { createMedia, getAllMedia, updateMedia, deleteMedia, searchMedia } from '../controllers/media.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = express.Router();

// Only Admins can create media
router.post('/', authenticate, isAdmin, createMedia);

// Advanced search with filters (public access, no auth required)
router.get('/search', searchMedia);

// Anyone can view all media (no middleware needed for now)
router.get('/', getAllMedia);

router.put('/:id', authenticate, isAdmin, updateMedia);
router.delete('/:id', authenticate, isAdmin, deleteMedia);

export default router;