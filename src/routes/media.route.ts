import express from 'express';
import { createMedia, getAllMedia, updateMedia, deleteMedia, searchMedia,getHomepageMedia, getMediaById } from '../controllers/media.controller';
import { attachUserIfPresent, authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = express.Router();

// Only Admins can create media
router.post('/', authenticate, isAdmin, createMedia);

// Advanced search with filters (public access, no auth required)
router.get('/search', searchMedia);

// Anyone can view all media (no middleware needed for now)
router.get('/', getAllMedia);
router.get('/home', getHomepageMedia);

router.put('/:id', authenticate, isAdmin, updateMedia);
router.delete('/:id', authenticate, isAdmin, deleteMedia);
router.get('/:id', attachUserIfPresent, getMediaById);

export default router;
