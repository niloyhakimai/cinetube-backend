import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';

type ReviewMediaParams = {
  mediaId: string;
};

type ReviewIdParams = {
  id: string;
};

export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, content, tags, isSpoiler, mediaId } = req.body;
    const userId = req.user.id;

    if (!mediaId || typeof mediaId !== 'string') {
      res.status(400).json({ message: 'A valid mediaId is required.' });
      return;
    }

    if (rating < 1 || rating > 10) {
      res.status(400).json({ message: 'Rating must be between 1 and 10' });
      return;
    }

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true },
    });

    if (!media) {
      res.status(404).json({ message: 'Media not found.' });
      return;
    }

    const newReview = await prisma.review.create({
      data: {
        rating,
        content,
        tags,
        isSpoiler,
        mediaId,
        userId,
      },
    });

    res.status(201).json({
      message: 'Review submitted successfully. Waiting for admin approval.',
      review: newReview,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(400).json({ message: 'Invalid mediaId. Review could not be created.' });
      return;
    }

    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getApprovedReviews = async (
  req: AuthRequest<ReviewMediaParams>,
  res: Response,
): Promise<void> => {
  try {
    const { mediaId } = req.params;

    const reviews = await prisma.review.findMany({
      where: {
        mediaId,
        isApproved: true,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const approveReview = async (
  req: AuthRequest<ReviewIdParams>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { isApproved: true },
    });

    res.status(200).json({
      message: 'Review approved successfully',
      review: updatedReview,
    });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
