import { MediaSource, MediaType as PrismaMediaType } from '@prisma/client';
import { prisma } from '../server';

export type ExternalMediaType = 'movie' | 'tv';
type CatalogSort = 'latest' | 'highest-rated' | 'most-reviewed' | 'popularity';

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  created_by?: Array<{ name: string }>;
}

interface TmdbCreditsResponse {
  cast?: Array<{ name: string }>;
  crew?: Array<{ job?: string; name: string }>;
}

interface TmdbVideosResponse {
  results?: Array<{
    key?: string;
    official?: boolean;
    site?: string;
    type?: string;
  }>;
}

interface TmdbPagedResponse<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

interface GenreCacheEntry {
  expiresAt: number;
  genreMap: Map<number, string>;
}

export interface TmdbCatalogItem {
  id: string;
  href: string;
  tmdbId: number;
  mediaType: 'MOVIE' | 'TV';
  title: string;
  synopsis: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseYear: number;
  genre: string[];
  averageRating: number;
  voteCount: number;
  popularity: number;
}

export interface TmdbCatalogResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbCatalogItem[];
}

const TMDB_BASE_URL = (process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3').replace(/\/$/, '');
const TMDB_IMAGE_BASE_URL = (process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p/w500').replace(/\/$/, '');
const TMDB_BACKDROP_BASE_URL = (process.env.TMDB_BACKDROP_BASE_URL || 'https://image.tmdb.org/t/p/original').replace(/\/$/, '');
const genreCache: Partial<Record<ExternalMediaType, GenreCacheEntry>> = {};

function getTmdbToken(): string {
  const token =
    process.env.TMDB_API_READ_TOKEN ||
    process.env.TMDB_READ_TOKEN ||
    process.env.TMDB_BEARER_TOKEN;

  if (!token) {
    throw new Error('TMDB API read token is not configured');
  }

  return token;
}

async function fetchTmdbJson<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}/${path.replace(/^\//, '')}`);

  url.searchParams.set('language', 'en-US');

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getTmdbToken()}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TMDB request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

function buildPosterUrl(path?: string | null): string | null {
  return path ? `${TMDB_IMAGE_BASE_URL}${path}` : null;
}

function buildBackdropUrl(path?: string | null): string | null {
  return path ? `${TMDB_BACKDROP_BASE_URL}${path}` : null;
}

function toPrismaMediaType(mediaType: ExternalMediaType): PrismaMediaType {
  return mediaType === 'movie' ? 'MOVIE' : 'TV';
}

function toRouteSlug(mediaType: ExternalMediaType, tmdbId: number): string {
  return `${mediaType}-${tmdbId}`;
}

function getReleaseYear(item: Pick<TmdbListItem, 'release_date' | 'first_air_date'>): number {
  const rawDate = item.release_date || item.first_air_date;
  const year = rawDate ? Number.parseInt(rawDate.slice(0, 4), 10) : NaN;
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

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

function getSortBy(sort: string | undefined, mediaType: ExternalMediaType): string {
  switch (sort) {
    case 'highest-rated':
      return 'vote_average.desc';
    case 'most-reviewed':
      return 'vote_count.desc';
    case 'latest':
      return mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
    case 'popularity':
    default:
      return 'popularity.desc';
  }
}

function applyLocalFilters(
  items: TmdbCatalogItem[],
  options: { genre?: string; rating?: string; year?: string; sort?: string },
): TmdbCatalogItem[] {
  const genreFilter = options.genre?.trim().toLowerCase();
  const minRating = options.rating ? Number.parseFloat(options.rating) : NaN;
  const yearRange = parseYearFilter(options.year?.trim());

  const filteredItems = items.filter((item) => {
    const matchesGenre =
      !genreFilter ||
      item.genre.some((genreName) => genreName.toLowerCase() === genreFilter);

    const matchesRating = Number.isNaN(minRating) || item.averageRating >= minRating;

    const matchesYear =
      !yearRange ||
      (item.releaseYear >= yearRange.minYear && item.releaseYear <= yearRange.maxYear);

    return matchesGenre && matchesRating && matchesYear;
  });

  const sort = options.sort as CatalogSort | undefined;

  filteredItems.sort((left, right) => {
    switch (sort) {
      case 'highest-rated':
        return right.averageRating - left.averageRating;
      case 'most-reviewed':
        return right.voteCount - left.voteCount;
      case 'latest':
        return right.releaseYear - left.releaseYear;
      case 'popularity':
      default:
        return right.popularity - left.popularity;
    }
  });

  return filteredItems;
}

async function getGenreMap(mediaType: ExternalMediaType): Promise<Map<number, string>> {
  const cached = genreCache[mediaType];

  if (cached && cached.expiresAt > Date.now()) {
    return cached.genreMap;
  }

  const payload = await fetchTmdbJson<{ genres: TmdbGenre[] }>(`genre/${mediaType}/list`);
  const genreMap = new Map<number, string>(payload.genres.map((genre) => [genre.id, genre.name]));

  genreCache[mediaType] = {
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    genreMap,
  };

  return genreMap;
}

async function normalizeCatalogItems(
  items: TmdbListItem[],
  mediaType: ExternalMediaType,
): Promise<TmdbCatalogItem[]> {
  const genreMap = await getGenreMap(mediaType);

  return items.map((item) => {
    const genreNames =
      item.genres?.map((genre) => genre.name).filter(Boolean) ||
      (item.genre_ids || [])
        .map((genreId) => genreMap.get(genreId))
        .filter((genreName): genreName is string => Boolean(genreName));

    const tmdbId = item.id;
    const routeSlug = toRouteSlug(mediaType, tmdbId);

    return {
      id: routeSlug,
      href: `/movies/${routeSlug}`,
      tmdbId,
      mediaType: toPrismaMediaType(mediaType),
      title: item.title || item.name || 'Untitled',
      synopsis: item.overview || 'Synopsis coming soon.',
      posterUrl: buildPosterUrl(item.poster_path),
      backdropUrl: buildBackdropUrl(item.backdrop_path),
      releaseYear: getReleaseYear(item),
      genre: genreNames.length > 0 ? genreNames : ['Uncategorized'],
      averageRating: Number((item.vote_average || 0).toFixed(1)),
      voteCount: item.vote_count || 0,
      popularity: item.popularity || 0,
    };
  });
}

async function fetchCatalogPage(
  mediaType: ExternalMediaType,
  params: {
    page?: number;
    q?: string;
    genre?: string;
    year?: string;
    rating?: string;
    sort?: string;
  },
): Promise<TmdbCatalogResponse> {
  const page = Math.max(1, params.page || 1);
  const hasSearch = Boolean(params.q?.trim());

  const endpoint = hasSearch ? `search/${mediaType}` : `discover/${mediaType}`;
  const queryParams: Record<string, string | number | undefined> = hasSearch
    ? {
        query: params.q?.trim(),
        page,
        include_adult: 'false',
      }
    : {
        page,
        sort_by: getSortBy(params.sort, mediaType),
      };

  const payload = await fetchTmdbJson<TmdbPagedResponse<TmdbListItem>>(endpoint, queryParams);
  const normalizedItems = await normalizeCatalogItems(payload.results || [], mediaType);
  const filteredItems = applyLocalFilters(normalizedItems, params);

  return {
    page: payload.page,
    totalPages: payload.total_pages,
    totalResults: payload.total_results,
    results: filteredItems,
  };
}

function getPreferredTrailerUrl(videos: TmdbVideosResponse): string | null {
  const candidates = (videos.results || []).filter(
    (video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser') && video.key,
  );

  const preferredVideo =
    candidates.find((video) => video.official && video.type === 'Trailer') ||
    candidates.find((video) => video.type === 'Trailer') ||
    candidates[0];

  return preferredVideo?.key ? `https://www.youtube.com/watch?v=${preferredVideo.key}` : null;
}

function getDirectorName(
  mediaType: ExternalMediaType,
  detail: TmdbListItem,
  credits: TmdbCreditsResponse,
): string {
  if (mediaType === 'movie') {
    return credits.crew?.find((member) => member.job === 'Director')?.name || 'Unknown';
  }

  const creators = detail.created_by?.map((creator) => creator.name).filter(Boolean) || [];
  return creators.length > 0 ? creators.join(', ') : 'Unknown';
}

function getCastNames(credits: TmdbCreditsResponse): string[] {
  return (credits.cast || [])
    .map((person) => person.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 8);
}

async function getLocalMediaWithReviews(id: string) {
  return prisma.media.findUnique({
    where: { id },
    include: {
      reviews: {
        where: { isApproved: true },
        include: {
          user: { select: { id: true, name: true, email: true } },
          likes: true,
          comments: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

async function syncRemoteMediaToLocal(
  mediaType: ExternalMediaType,
  tmdbId: number,
  detail: TmdbListItem,
  credits: TmdbCreditsResponse,
  videos: TmdbVideosResponse,
) {
  const prismaMediaType = toPrismaMediaType(mediaType);
  const existingMedia = await prisma.media.findFirst({
    where: {
      tmdbId,
      mediaType: prismaMediaType,
    },
  });

  const trailerUrl = getPreferredTrailerUrl(videos);
  const normalizedPriceType =
    existingMedia?.source === MediaSource.TMDB
      ? existingMedia.priceType === 'FREE'
        ? 'PREMIUM'
        : existingMedia.priceType
      : 'PREMIUM';
  const data = {
    source: MediaSource.TMDB,
    tmdbId,
    mediaType: prismaMediaType,
    title: detail.title || detail.name || 'Untitled',
    synopsis: detail.overview || 'Synopsis coming soon.',
    genre: detail.genres?.map((genre) => genre.name).filter(Boolean) || ['Uncategorized'],
    releaseYear: getReleaseYear(detail),
    director: getDirectorName(mediaType, detail, credits),
    cast: getCastNames(credits),
    posterUrl: buildPosterUrl(detail.poster_path),
    backdropUrl: buildBackdropUrl(detail.backdrop_path),
    priceType: normalizedPriceType,
  };

  if (existingMedia) {
    return prisma.media.update({
      where: { id: existingMedia.id },
      data: {
        ...data,
        streamingLink: existingMedia.streamingLink || trailerUrl,
      },
    });
  }

  return prisma.media.create({
    data: {
      ...data,
      streamingPlatform: [],
      streamingLink: trailerUrl,
      isFeatured: false,
    },
  });
}

function toDetailedMediaResponse(
  localMedia: NonNullable<Awaited<ReturnType<typeof getLocalMediaWithReviews>>>,
  mediaType: ExternalMediaType,
  detail: TmdbListItem,
) {
  return {
    ...localMedia,
    mediaType: localMedia.mediaType,
    averageRating: Number((detail.vote_average || 0).toFixed(1)),
    voteCount: detail.vote_count || 0,
    backdropUrl: localMedia.backdropUrl || buildBackdropUrl(detail.backdrop_path),
    posterUrl: localMedia.posterUrl || buildPosterUrl(detail.poster_path),
    tmdbRouteId: toRouteSlug(mediaType, detail.id),
  };
}

async function fetchDetailBundle(mediaType: ExternalMediaType, tmdbId: number) {
  const [detail, credits, videos, similar] = await Promise.all([
    fetchTmdbJson<TmdbListItem>(`${mediaType}/${tmdbId}`),
    fetchTmdbJson<TmdbCreditsResponse>(`${mediaType}/${tmdbId}/credits`),
    fetchTmdbJson<TmdbVideosResponse>(`${mediaType}/${tmdbId}/videos`),
    fetchTmdbJson<TmdbPagedResponse<TmdbListItem>>(`${mediaType}/${tmdbId}/similar`, { page: 1 }),
  ]);

  return { detail, credits, videos, similar };
}

export async function getTmdbHomeFeed() {
  const [popularMovies, trendingSeries] = await Promise.all([
    fetchCatalogPage('movie', { page: 1, sort: 'popularity' }),
    fetchTmdbJson<TmdbPagedResponse<TmdbListItem>>('trending/tv/week', { page: 1 }),
  ]);

  const normalizedTrendingSeries = applyLocalFilters(
    await normalizeCatalogItems(trendingSeries.results || [], 'tv'),
    { sort: 'popularity' },
  );

  return {
    featured: popularMovies.results[0] || normalizedTrendingSeries[0] || null,
    popularMovies: popularMovies.results.slice(0, 12),
    trendingSeries: normalizedTrendingSeries.slice(0, 12),
  };
}

export async function getPopularMovies(params: {
  page?: number;
  q?: string;
  genre?: string;
  year?: string;
  rating?: string;
  sort?: string;
}) {
  return fetchCatalogPage('movie', params);
}

export async function getTrendingSeries(params: {
  page?: number;
  q?: string;
  genre?: string;
  year?: string;
  rating?: string;
  sort?: string;
}) {
  return fetchCatalogPage('tv', params);
}

export async function searchCatalog(params: {
  page?: number;
  q?: string;
  genre?: string;
  year?: string;
  rating?: string;
  sort?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const query = params.q?.trim();

  const [movies, series] = await Promise.all([
    fetchCatalogPage('movie', { ...params, page, q: query }),
    fetchCatalogPage('tv', { ...params, page, q: query }),
  ]);

  const combinedResults = applyLocalFilters([...movies.results, ...series.results], params);

  return {
    page,
    totalPages: Math.max(movies.totalPages, series.totalPages),
    totalResults: movies.totalResults + series.totalResults,
    results: combinedResults,
  };
}

export async function getTmdbMediaDetail(mediaType: ExternalMediaType, tmdbId: number) {
  const { detail, credits, videos, similar } = await fetchDetailBundle(mediaType, tmdbId);
  const syncedMedia = await syncRemoteMediaToLocal(mediaType, tmdbId, detail, credits, videos);
  const localMedia = await getLocalMediaWithReviews(syncedMedia.id);

  if (!localMedia) {
    throw new Error('Failed to load synced media record');
  }

  return {
    media: toDetailedMediaResponse(localMedia, mediaType, detail),
    similarMedia: (await normalizeCatalogItems(similar.results || [], mediaType)).slice(0, 10),
  };
}

export async function refreshStoredTmdbMedia(localMediaId: string) {
  const storedMedia = await prisma.media.findUnique({
    where: { id: localMediaId },
    select: {
      id: true,
      tmdbId: true,
      mediaType: true,
    },
  });

  if (!storedMedia?.tmdbId) {
    return null;
  }

  const mediaType: ExternalMediaType = storedMedia.mediaType === 'TV' ? 'tv' : 'movie';
  return getTmdbMediaDetail(mediaType, storedMedia.tmdbId);
}
