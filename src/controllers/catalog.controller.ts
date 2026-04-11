import { Request, Response } from 'express';
import { getExploreCatalog } from '../services/catalog.service';

export const getCatalogExplore = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await getExploreCatalog({
      q: typeof req.query.q === 'string' ? req.query.q : '',
      genre: typeof req.query.genre === 'string' ? req.query.genre : '',
      platform: typeof req.query.platform === 'string' ? req.query.platform : '',
      year: typeof req.query.year === 'string' ? req.query.year : '',
      rating: typeof req.query.rating === 'string' ? req.query.rating : '',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'popularity',
      mediaType: typeof req.query.mediaType === 'string' ? req.query.mediaType : 'ALL',
      page: typeof req.query.page === 'string' ? req.query.page : '1',
      limit: typeof req.query.limit === 'string' ? req.query.limit : '12',
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Catalog Explore Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch catalog explore results.' });
  }
};
