import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../server';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Security Check: Only ADMIN can access
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({ message: 'Access denied. Admins only.' });
      return;
    }

    // 1. Get overall counts
    const totalUsers = await prisma.user.count();
    const totalMedia = await prisma.media.count();
    const totalReviews = await prisma.review.count({ where: { isApproved: true } });
    const pendingReviewCount = await prisma.review.count({ where: { isApproved: false } });

    // 2. Get Pending Reviews with User & Media details
    const pendingReviews = await prisma.review.findMany({
      where: { isApproved: false },
      include: {
        user: { select: { id: true, name: true, email: true } },
        media: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Media Analytics (Aggregated Reports for Top Rated & Most Reviewed)
    const allMedia = await prisma.media.findMany({
      include: { 
        reviews: { 
          where: { isApproved: true }, 
          select: { rating: true } 
        } 
      }
    });

    // Calculate average ratings and review counts for all media
    const mediaStats = allMedia.map((m: any) => {
      const reviewCount = m.reviews.length;
      const avgRating = reviewCount > 0
        ? (m.reviews.reduce((acc: number, rev: any) => acc + rev.rating, 0) / reviewCount).toFixed(1)
        : '0.0';
        
      return {
        id: m.id,
        title: m.title,
        type: m.type,
        viewCount: m.viewCount || 0,
        reviewCount,
        avgRating: Number(avgRating)
      };
    });

    // Sort for Most Reviewed (Top 5)
    const mostReviewed = [...mediaStats].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5);
    
    // Sort for Top Rated (Top 5)
    const topRated = [...mediaStats].sort((a, b) => b.avgRating - a.avgRating).slice(0, 5);

    // Send Response
    res.status(200).json({
      stats: { totalUsers, totalMedia, totalReviews, pendingReviewCount },
      pendingReviews,
      reports: {
        topRated,
        mostReviewed
      }
    });
  } catch (error: any) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch admin stats' });
  }
};