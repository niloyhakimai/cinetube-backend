import { PriceType } from '@prisma/client';
import prisma from '../prisma/client';
import { getPopularMovies, getTrendingSeries, searchCatalog } from './tmdb.service';

type CatalogSort = 'latest' | 'highest-rated' | 'most-reviewed' | 'popularity';
type CatalogMediaType = 'MOVIE' | 'TV' | 'ALL';

type ExploreParams = {
  q?: string;
  genre?: string;
  platform?: string;
  year?: string;
  rating?: string;
  sort?: string;
  mediaType?: string;
  page?: string | number;
  limit?: string | number;
};

export interface ExploreItem {
  id: string;
  href: string;
  title: string;
  synopsis: string;
  streamingPlatform?: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseYear: number;
  genre: string[];
  averageRating: number;
  reviewCount: number;
  viewCount: number;
  mediaType: 'MOVIE' | 'TV';
  priceType: PriceType;
  source: 'MANUAL' | 'TMDB';
}

const MAX_LIMIT = 24;

function parseYearFilter(yearFilter?: string): { minYear: number; maxYear: number } | null {
  if (!yearFilter) {
    return null;
  }

  if (/^\d{4}$/.test(yearFilter)) {
    const year = Number.parseInt(yearFilter, 10);
    return { minYear: year, maxYear: year };
  }

  if (/^\d{4}-\d{4}$/.test(yearFilter)) {
    const [startYear, endYear] = yearFilter.split('-').map((value) => Number.parseInt(value, 10));
    return { minYear: startYear, maxYear: endYear };
  }

  if (/^\d{3}0s$/.test(yearFilter)) {
    const decade = Number.parseInt(yearFilter.slice(0, 4), 10);
    return { minYear: decade, maxYear: decade + 9 };
  }

  if (yearFilter === 'classic') {
    return { minYear: 1900, maxYear: 2009 };
  }

  return null;
}

function getSafePage(rawPage: string | number | undefined): number {
  const page = Number.parseInt(String(rawPage || '1'), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getSafeLimit(rawLimit: string | number | undefined): number {
  const limit = Number.parseInt(String(rawLimit || '12'), 10);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : 12;
}

function getMediaTypeFilter(rawMediaType: string | undefined): CatalogMediaType {
  if (rawMediaType === 'MOVIE' || rawMediaType === 'TV') {
    return rawMediaType;
  }

  return 'ALL';
}

function getSort(sort?: string): CatalogSort {
  if (sort === 'highest-rated' || sort === 'most-reviewed' || sort === 'latest' || sort === 'popularity') {
    return sort;
  }

  return 'popularity';
}

function matchesFilters(
  item: ExploreItem,
  filters: { genre?: string; rating?: string; year?: string; platform?: string },
) {
  const normalizedGenre = filters.genre?.trim().toLowerCase();
  const minRating = filters.rating ? Number.parseFloat(filters.rating) : NaN;
  const yearRange = parseYearFilter(filters.year?.trim());
  const normalizedPlatform = filters.platform?.trim().toLowerCase();

  const genreMatch =
    !normalizedGenre ||
    item.genre.some((entry) => entry.toLowerCase() === normalizedGenre);

  const ratingMatch = Number.isNaN(minRating) || item.averageRating >= minRating;
  const yearMatch =
    !yearRange ||
    (item.releaseYear >= yearRange.minYear && item.releaseYear <= yearRange.maxYear);

  const platformMatch =
    !normalizedPlatform ||
    (item.streamingPlatform || []).some((entry) => entry.toLowerCase() === normalizedPlatform);

  return genreMatch && ratingMatch && yearMatch && platformMatch;
}

function sortItems(items: ExploreItem[], sort: CatalogSort): ExploreItem[] {
  return [...items].sort((left, right) => {
    switch (sort) {
      case 'highest-rated':
        return right.averageRating - left.averageRating;
      case 'most-reviewed':
        return right.reviewCount - left.reviewCount;
      case 'latest':
        return right.releaseYear - left.releaseYear;
      case 'popularity':
      default:
        return right.viewCount - left.viewCount || right.averageRating - left.averageRating;
    }
  });
}

async function getLocalCatalog(params: ExploreParams, mediaType: CatalogMediaType): Promise<ExploreItem[]> {
  const where: any = {
    source: 'MANUAL',
  };

  if (mediaType !== 'ALL') {
    where.mediaType = mediaType;
  }

  if (params.q?.trim()) {
    where.OR = [
      { title: { contains: params.q.trim(), mode: 'insensitive' } },
      { director: { contains: params.q.trim(), mode: 'insensitive' } },
      { cast: { hasSome: [params.q.trim()] } },
    ];
  }

  if (params.genre?.trim()) {
    where.genre = { hasSome: [params.genre.trim()] };
  }

  if (params.platform?.trim()) {
    where.streamingPlatform = { hasSome: [params.platform.trim()] };
  }

  const yearRange = parseYearFilter(params.year?.trim());
  if (yearRange) {
    where.releaseYear = {
      gte: yearRange.minYear,
      lte: yearRange.maxYear,
    };
  }

  const media = await prisma.media.findMany({
    where,
    include: {
      reviews: {
        where: { isApproved: true },
        select: { rating: true },
      },
    },
  });

  return media.map((item) => {
    const reviewCount = item.reviews.length;
    const averageRating = reviewCount > 0
      ? Number((item.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
      : 0;

    return {
      id: item.id,
      href: `/movies/${item.id}`,
      title: item.title,
      synopsis: item.synopsis,
      streamingPlatform: item.streamingPlatform,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      releaseYear: item.releaseYear,
      genre: item.genre,
      averageRating,
      reviewCount,
      viewCount: item.viewCount || 0,
      mediaType: item.mediaType,
      priceType: item.priceType,
      source: item.source,
    } satisfies ExploreItem;
  });
}

async function getTmdbCatalog(params: ExploreParams, mediaType: CatalogMediaType): Promise<ExploreItem[]> {
  const tmdbParams = {
    page: getSafePage(params.page),
    q: params.q,
    genre: params.genre,
    year: params.year,
    rating: params.rating,
    sort: params.sort,
  };

  try {
    if (mediaType === 'MOVIE') {
      const response = await getPopularMovies(tmdbParams);
      return response.results.map((item) => ({
        ...item,
        streamingPlatform: [],
        reviewCount: item.voteCount,
        viewCount: Math.round(item.popularity),
        priceType: 'PREMIUM',
        source: 'TMDB',
      }));
    }

    if (mediaType === 'TV') {
      const response = await getTrendingSeries(tmdbParams);
      return response.results.map((item) => ({
        ...item,
        streamingPlatform: [],
        reviewCount: item.voteCount,
        viewCount: Math.round(item.popularity),
        priceType: 'PREMIUM',
        source: 'TMDB',
      }));
    }

    const response = params.q?.trim()
      ? await searchCatalog(tmdbParams)
      : await Promise.all([
          getPopularMovies(tmdbParams),
          getTrendingSeries(tmdbParams),
        ]).then(([movies, series]) => ({
          results: [...movies.results, ...series.results],
        }));

    return response.results.map((item: any) => ({
      ...item,
      streamingPlatform: [],
      reviewCount: item.voteCount,
      viewCount: Math.round(item.popularity),
      priceType: 'PREMIUM',
      source: 'TMDB',
    }));
  } catch (error) {
    return [];
  }
}

export async function getExploreCatalog(params: ExploreParams) {
  const page = getSafePage(params.page);
  const limit = getSafeLimit(params.limit);
  const mediaType = getMediaTypeFilter(typeof params.mediaType === 'string' ? params.mediaType.toUpperCase() : undefined);
  const sort = getSort(params.sort);

  const [localItems, tmdbItems] = await Promise.all([
    getLocalCatalog(params, mediaType),
    getTmdbCatalog(params, mediaType),
  ]);

  const seen = new Set<string>();
  const merged = [...localItems, ...tmdbItems].filter((item) => {
    const key = `${item.title.toLowerCase()}-${item.releaseYear}-${item.mediaType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const filtered = merged.filter((item) => matchesFilters(item, params));
  const sorted = sortItems(filtered, sort);
  const total = sorted.length;
  const start = (page - 1) * limit;
  const items = sorted.slice(start, start + limit);

  return {
    success: true,
    filters: {
      q: params.q || '',
      genre: params.genre || '',
      platform: params.platform || '',
      year: params.year || '',
      rating: params.rating || '',
      sort,
      mediaType,
    },
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    items,
  };
}
