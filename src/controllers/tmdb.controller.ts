import { Request, Response } from 'express';
import {
  ExternalMediaType,
  getPopularMovies,
  getTmdbHomeFeed,
  getTmdbMediaDetail,
  getTrendingSeries,
  searchCatalog,
} from '../services/tmdb.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { protectMediaForViewer } from '../utils/media-access';

function getSafePage(rawPage: unknown): number {
  const parsedPage = Number.parseInt(String(rawPage || '1'), 10);
  return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function getDetailParams(req: Request): { mediaType: ExternalMediaType; tmdbId: number } | null {
  const rawMediaType = Array.isArray(req.params.mediaType) ? req.params.mediaType[0] : req.params.mediaType;
  const rawTmdbId = Array.isArray(req.params.tmdbId) ? req.params.tmdbId[0] : req.params.tmdbId;
  const mediaType = rawMediaType as ExternalMediaType;
  const tmdbId = Number.parseInt(rawTmdbId, 10);

  if (!['movie', 'tv'].includes(mediaType) || !Number.isFinite(tmdbId)) {
    return null;
  }

  return { mediaType, tmdbId };
}

export const getTmdbHome = async (req: Request, res: Response): Promise<void> => {
  try {
    const homeFeed = await getTmdbHomeFeed();
    res.status(200).json(homeFeed);
  } catch (error) {
    console.error('TMDB home feed error:', error);
    res.status(500).json({ message: 'Failed to fetch TMDB home feed' });
  }
};

export const getTmdbPopularMovies = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await getPopularMovies({
      page: getSafePage(req.query.page),
      q: typeof req.query.q === 'string' ? req.query.q : '',
      genre: typeof req.query.genre === 'string' ? req.query.genre : '',
      year: typeof req.query.year === 'string' ? req.query.year : '',
      rating: typeof req.query.rating === 'string' ? req.query.rating : '',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'popularity',
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('TMDB movies error:', error);
    res.status(500).json({ message: 'Failed to fetch TMDB movies' });
  }
};

export const getTmdbTrendingSeries = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await getTrendingSeries({
      page: getSafePage(req.query.page),
      q: typeof req.query.q === 'string' ? req.query.q : '',
      genre: typeof req.query.genre === 'string' ? req.query.genre : '',
      year: typeof req.query.year === 'string' ? req.query.year : '',
      rating: typeof req.query.rating === 'string' ? req.query.rating : '',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'popularity',
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('TMDB series error:', error);
    res.status(500).json({ message: 'Failed to fetch TMDB TV series' });
  }
};

export const searchTmdbCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await searchCatalog({
      page: getSafePage(req.query.page),
      q: typeof req.query.q === 'string' ? req.query.q : '',
      genre: typeof req.query.genre === 'string' ? req.query.genre : '',
      year: typeof req.query.year === 'string' ? req.query.year : '',
      rating: typeof req.query.rating === 'string' ? req.query.rating : '',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'popularity',
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('TMDB search error:', error);
    res.status(500).json({ message: 'Failed to search TMDB catalog' });
  }
};

export const getTmdbMediaById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const detailParams = getDetailParams(req);

    if (!detailParams) {
      res.status(400).json({ message: 'Invalid TMDB media identifier' });
      return;
    }

    const response = await getTmdbMediaDetail(detailParams.mediaType, detailParams.tmdbId);
    const media = await protectMediaForViewer(req.user?.id, response.media);

    res.status(200).json({
      success: true,
      media,
      similarMedia: response.similarMedia,
    });
  } catch (error) {
    console.error('TMDB detail error:', error);
    res.status(500).json({ message: 'Failed to fetch TMDB media details' });
  }
};
