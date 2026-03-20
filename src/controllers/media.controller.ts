import { Request, Response } from 'express';
import { prisma } from '../server';

type MediaParams = {
  id: string;
};

export const createMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      synopsis,
      genre,
      releaseYear,
      director,
      cast,
      streamingPlatform,
      priceType,
      streamingLink,
      isFeatured, 
    } = req.body;

    const newMedia = await prisma.media.create({
      data: {
        title,
        synopsis,
        genre,
        releaseYear,
        director,
        cast,
        streamingPlatform,
        priceType,
        streamingLink,
        isFeatured: isFeatured || false,
      },
    });

    res.status(201).json({
      message: 'Media created successfully',
      media: newMedia,
    });
  } catch (error) {
    console.error('Error creating media:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const mediaList = await prisma.media.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    res.status(200).json({ media: mediaList });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const updateMedia = async (req: Request<MediaParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedMedia = await prisma.media.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      message: 'Media updated successfully',
      media: updatedMedia,
    });
  } catch (error) {
    console.error('Error updating media:', error);
    res.status(500).json({ message: 'Error updating media. Ensure the ID is correct.' });
  }
};

export const deleteMedia = async (req: Request<MediaParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.media.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ message: 'Error deleting media. Ensure the ID is correct.' });
  }
};

// Helper function to parse year filter and return year range
const parseYearFilter = (yearFilter: string): { minYear: number; maxYear: number } | null => {
  if (!yearFilter) return null;

  const currentYear = new Date().getFullYear();

  // Handle exact year (e.g., '2024')
  if (/^\d{4}$/.test(yearFilter)) {
    const year = parseInt(yearFilter, 10);
    return { minYear: year, maxYear: year };
  }

  // Handle year range (e.g., '2020-2022')
  if (/^\d{4}-\d{4}$/.test(yearFilter)) {
    const [startStr, endStr] = yearFilter.split('-');
    return { minYear: parseInt(startStr, 10), maxYear: parseInt(endStr, 10) };
  }

  // Handle decade (e.g., '2010s')
  if (/^\d{3}0s$/.test(yearFilter)) {
    const decade = parseInt(yearFilter.slice(0, 3), 10);
    return { minYear: decade, maxYear: decade + 9 };
  }

  // Handle 'classic' (pre-2010)
  if (yearFilter === 'classic') {
    return { minYear: 1900, maxYear: 2009 };
  }

  return null;
};

export const searchMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract query parameters
    const q = req.query.q as string | undefined;
    const genre = req.query.genre as string | undefined;
    const platform = req.query.platform as string | undefined;
    const year = req.query.year as string | undefined;
    const rating = req.query.rating as string | undefined;
    const sort = (req.query.sort as string) || 'latest';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    // Build dynamic where clause
    const whereConditions: any = {};

    // Search filter - case-insensitive across title, director, and cast
    if (q && q.trim()) {
      whereConditions.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { director: { contains: q.trim(), mode: 'insensitive' } },
        { cast: { hasSome: [q.trim()] } }, // Exact match in cast array
      ];
    }

    // Genre filter - exact match in genre array
    if (genre && genre.trim()) {
      whereConditions.genre = { hasSome: [genre.trim()] };
    }

    // Platform filter - exact match in streamingPlatform array
    if (platform && platform.trim()) {
      whereConditions.streamingPlatform = { hasSome: [platform.trim()] };
    }

    // Year filter - handle various formats
    if (year && year.trim()) {
      const yearRange = parseYearFilter(year.trim());
      if (yearRange) {
        whereConditions.releaseYear = {
          gte: yearRange.minYear,
          lte: yearRange.maxYear,
        };
      }
    }

    // Fetch media with reviews for rating calculation
    const mediaWithReviews = await prisma.media.findMany({
      where: whereConditions,
      include: {
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { createdAt: 'desc' }, // Default order (will be overridden by sort)
    });

    // Calculate average rating for each media item
    const mediaWithAverageRating = mediaWithReviews.map((media) => {
      const averageRating =
        media.reviews.length > 0
          ? media.reviews.reduce((sum: number, rev: { rating: number }) => sum + rev.rating, 0) / media.reviews.length
          : 0;
      return { ...media, averageRating, reviewCount: media.reviews.length };
    });

    // Apply rating filter
    let filteredMedia = mediaWithAverageRating;
    if (rating) {
      const minRating = parseFloat(rating);
      if (!isNaN(minRating)) {
        filteredMedia = mediaWithAverageRating.filter(
          (media) => media.averageRating >= minRating
        );
      }
    }

    // Apply sorting
    switch (sort) {
      case 'latest':
        filteredMedia.sort((a, b) => b.releaseYear - a.releaseYear);
        break;
      case 'highest-rated':
        filteredMedia.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'most-reviewed':
        filteredMedia.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case 'popularity':
        filteredMedia.sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      default:
        filteredMedia.sort((a, b) => b.releaseYear - a.releaseYear);
    }

    // Apply pagination
    const total = filteredMedia.length;
    const startIndex = (page - 1) * limit;
    const paginatedMedia = filteredMedia.slice(startIndex, startIndex + limit);

    // Remove sensitive data (reviews details) before sending response
    const responseMedia = paginatedMedia.map((media) => {
      const { reviews, ...rest } = media;
      return {
        ...rest,
        averageRating: media.averageRating.toFixed(1),
        reviewCount: media.reviewCount,
      };
    });

    res.status(200).json({
      success: true,
      data: responseMedia,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error searching media:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- NEW FUNCTION FOR HOMEPAGE DATA ---
export const getHomepageMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Get Featured Media (for Hero Section - takes only 1)
    const featuredMediaList = await prisma.media.findMany({
      where: { isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { reviews: { select: { rating: true } } }
    });

    let featuredMedia = null;
    if (featuredMediaList.length > 0) {
      const m = featuredMediaList[0];
      const avgRating = m.reviews.length > 0 ? (m.reviews.reduce((a, b) => a + b.rating, 0) / m.reviews.length).toFixed(1) : '0';
      featuredMedia = { ...m, averageRating: Number(avgRating) };
    }

    // 2. Get Editor's Picks (For Slider - takes up to 10)
    const editorsPicksList = await prisma.media.findMany({
      where: { isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { reviews: { select: { rating: true } } }
    });

    const editorsPicks = editorsPicksList.map(m => ({
      ...m, 
      averageRating: m.reviews.length > 0 ? Number((m.reviews.reduce((a, b) => a + b.rating, 0) / m.reviews.length).toFixed(1)) : 0 
    }));

    // 3. Get Newly Added (Latest 10 items)
    const newlyAdded = await prisma.media.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { reviews: { select: { rating: true } } }
    });

    // 4. Get Top Rated (Highest average rating)
    const allMedia = await prisma.media.findMany({
      include: { reviews: { select: { rating: true } } }
    });
    
    const topRated = allMedia
      .map(m => {
        const avg = m.reviews.length > 0 ? (m.reviews.reduce((a, b) => a + b.rating, 0) / m.reviews.length) : 0;
        return { ...m, averageRating: Number(avg.toFixed(1)) };
      })
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 10); 

    res.status(200).json({
      featured: featuredMedia,
      editorsPicks: editorsPicks, 
      newlyAdded: newlyAdded.map(m => ({ ...m, averageRating: m.reviews?.length > 0 ? Number((m.reviews.reduce((a:any, b:any) => a + b.rating, 0) / m.reviews.length).toFixed(1)) : 0 })),
      topRated
    });
  } catch (error: any) {
    console.error('Homepage API Error:', error);
    res.status(500).json({ message: 'Failed to fetch homepage data' });
  }
};

// --- GET SINGLE MEDIA DETAILS (WITH REVIEWS & SIMILAR MEDIA) ---
export const getMediaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        reviews: {
          where: { isApproved: true },
          include: {
            user: { select: { id: true, name: true, email: true } },
            likes: true, 
            comments: {
              include: { user: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!media) {
      res.status(404).json({ message: 'Media not found' });
      return;
    }

   
    await prisma.media.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    });

   
    const similarMediaRaw = await prisma.media.findMany({
      where: {
        genre: { hasSome: media.genre }, 
        id: { not: id } 
      },
      take: 10, 
      include: { reviews: { select: { rating: true } } }
    });

    const similarMedia = similarMediaRaw.map(m => {
      const avgRating = m.reviews.length > 0 ? (m.reviews.reduce((a, b) => a + b.rating, 0) / m.reviews.length).toFixed(1) : '0';
      return { ...m, averageRating: Number(avgRating) };
    });

    res.status(200).json({ success: true, media, similarMedia });
  } catch (error) {
    console.error('Error fetching single media:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};