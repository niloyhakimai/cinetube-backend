import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../prisma/client';
import { getCapabilitiesForRole } from '../middlewares/auth.middleware';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildMonthBuckets(size = 6) {
  const now = new Date();

  return Array.from({ length: size }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (size - index - 1), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
      movieRevenue: 0,
      subscriptionRevenue: 0,
      approved: 0,
      pending: 0,
    };
  });
}

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No user found in token.' });
      return;
    }

    const [users, media, reviews, purchases, subscriptionPayments, pendingReviews] = await Promise.all([
      prisma.user.findMany({
        include: {
          reviews: { select: { id: true } },
          watchlist: { select: { id: true } },
          purchases: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.media.findMany({
        include: {
          reviews: {
            where: { isApproved: true },
            select: { rating: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({
        include: {
          media: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchase.findMany({
        where: { paymentStatus: 'COMPLETED' },
        include: {
          media: { select: { id: true, title: true } },
        },
      }),
      prisma.subscriptionPayment.findMany({
        where: { paymentStatus: 'COMPLETED' },
      }),
      prisma.review.findMany({
        where: { isApproved: false },
        include: {
          user: { select: { id: true, name: true, email: true } },
          media: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalUsers = users.length;
    const totalMedia = media.length;
    const totalReviews = reviews.filter((review) => review.isApproved).length;
    const pendingReviewCount = pendingReviews.length;
    const activeUsers = users.filter((user) => (
      user.reviews.length > 0 ||
      user.watchlist.length > 0 ||
      user.purchases.length > 0
    )).length;

    const mediaStats = media.map((item) => {
      const reviewCount = item.reviews.length;
      const avgRating = reviewCount > 0
        ? item.reviews.reduce((acc, review) => acc + review.rating, 0) / reviewCount
        : 0;

      return {
        id: item.id,
        title: item.title,
        mediaType: item.mediaType,
        viewCount: item.viewCount || 0,
        reviewCount,
        avgRating: Number(avgRating.toFixed(1)),
        priceType: item.priceType,
        isFeatured: item.isFeatured,
      };
    });

    const mostReviewed = [...mediaStats].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5);
    const topRated = [...mediaStats].sort((a, b) => b.avgRating - a.avgRating).slice(0, 5);
    const featuredMedia = mediaStats.filter((item) => item.isFeatured).slice(0, 8);
    const monthlyBuckets = buildMonthBuckets();

    purchases.forEach((purchase) => {
      const key = `${purchase.createdAt.getFullYear()}-${purchase.createdAt.getMonth()}`;
      const bucket = monthlyBuckets.find((entry) => entry.key === key);
      if (bucket) {
        bucket.movieRevenue += purchase.amount;
      }
    });

    subscriptionPayments.forEach((payment) => {
      const key = `${payment.createdAt.getFullYear()}-${payment.createdAt.getMonth()}`;
      const bucket = monthlyBuckets.find((entry) => entry.key === key);
      if (bucket) {
        bucket.subscriptionRevenue += payment.amount;
      }
    });

    reviews.forEach((review) => {
      const key = `${review.createdAt.getFullYear()}-${review.createdAt.getMonth()}`;
      const bucket = monthlyBuckets.find((entry) => entry.key === key);
      if (!bucket) {
        return;
      }

      if (review.isApproved) {
        bucket.approved += 1;
      } else {
        bucket.pending += 1;
      }
    });

    const subscriptionMixMap = new Map<string, number>();
    subscriptionPayments.forEach((payment) => {
      subscriptionMixMap.set(payment.plan, (subscriptionMixMap.get(payment.plan) || 0) + 1);
    });

    res.status(200).json({
      role: req.user.role,
      capabilities: getCapabilitiesForRole(req.user.role),
      stats: { totalUsers, totalMedia, totalReviews, pendingReviewCount, activeUsers },
      pendingReviews,
      analytics: {
        revenueByMonth: monthlyBuckets.map((entry) => ({
          label: entry.label,
          revenue: Number((entry.movieRevenue + entry.subscriptionRevenue).toFixed(2)),
          movieRevenue: Number(entry.movieRevenue.toFixed(2)),
          subscriptionRevenue: Number(entry.subscriptionRevenue.toFixed(2)),
        })),
        reviewTrends: monthlyBuckets.map((entry) => ({
          label: entry.label,
          approved: entry.approved,
          pending: entry.pending,
        })),
        subscriptionMix: [...subscriptionMixMap.entries()].map(([plan, count]) => ({
          plan,
          count,
        })),
        featuredMedia,
      },
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
