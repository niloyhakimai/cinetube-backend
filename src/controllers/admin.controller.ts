import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();
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
    const totalReviews = await prisma.review.count();
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

    // 3. Get Media Stats (Top 5 by views with average rating)
    const topMedia = await prisma.media.findMany({
      take: 5,
      orderBy: { viewCount: 'desc' },
      include: {
        reviews: {
          where: { isApproved: true },
          select: { rating: true }
        }
      }
    });

    // Calculate average ratings
    const mediaStats = topMedia.map((m: any) => {
      const avgRating = m.reviews.length > 0
        ? (m.reviews.reduce((acc: number, rev: any) => acc + rev.rating, 0) / m.reviews.length).toFixed(1)
        : '0.0';
        
      return {
        id: m.id,
        title: m.title,
        type: m.type,
        viewCount: m.viewCount,
        reviewCount: m.reviews.length,
        avgRating
      };
    });

    res.status(200).json({
      stats: { totalUsers, totalMedia, totalReviews, pendingReviewCount },
      pendingReviews,
      mediaStats
    });
  } catch (error: any) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch admin stats' });
  }
};