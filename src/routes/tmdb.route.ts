import express from 'express';
import {
  getTmdbHome,
  getTmdbMediaById,
  getTmdbPopularMovies,
  getTmdbTrendingSeries,
  searchTmdbCatalog,
} from '../controllers/tmdb.controller';
import { attachUserIfPresent } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/home', getTmdbHome);
router.get('/movies', getTmdbPopularMovies);
router.get('/series', getTmdbTrendingSeries);
router.get('/search', searchTmdbCatalog);
router.get('/media/:mediaType/:tmdbId', attachUserIfPresent, getTmdbMediaById);

export default router;
