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


export const getPendingReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reviews = await prisma.review.findMany({
      where: { isApproved: false },
      include: {
        user: { select: { name: true, email: true } },
        media: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ reviews });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Fetch reviews created by the logged-in user
export const getUserReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const reviews = await prisma.review.findMany({
      where: { userId },
      include: {
        media: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ reviews });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete a review (Admin can delete any, User can delete only their own unapproved ones)
export const deleteReview = async (
  req: AuthRequest<ReviewIdParams>,
  res: Response,
): Promise<void> => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role; 

    // Find the review
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    const isAdmin = userRole === 'ADMIN';

    if (!isAdmin) {
      // Check if the user owns the review
      if (review.userId !== userId) {
        res.status(403).json({ message: 'Not authorized to delete this review' });
        return;
      }

      // Check if the review is already approved
      if (review.isApproved) {
        res.status(400).json({ message: 'Cannot delete an approved review' });
        return;
      }
    }

    // Delete the review 
    await prisma.review.delete({
      where: { id: reviewId },
    });

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Edit an unpublished review
export const updateReview = async (
  req: AuthRequest<ReviewIdParams>,
  res: Response,
): Promise<void> => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.id;
    const { rating, content } = req.body;

    const review = await prisma.review.findUnique({ where: { id: reviewId } });

    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }
    if (review.userId !== userId) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }
    if (review.isApproved) {
      res.status(400).json({ message: 'Cannot edit an approved review' });
      return;
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: { rating: Number(rating), content },
    });

    res.status(200).json({ message: 'Review updated successfully', review: updatedReview });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// --- TOGGLE LIKE ON A REVIEW ---
export const toggleLike = async (req: any, res: any): Promise<void> => {
  try {
    const reviewId = req.params.id;
    const userId = req.user?.id; // Auth middleware 

    if (!userId) {
      return res.status(401).json({ message: 'You must be logged in to like a review.' });
    }


    const existingLike = await prisma.like.findUnique({
      where: {
        userId_reviewId: { userId, reviewId }
      }
    });

    if (existingLike) {
  
      await prisma.like.delete({ where: { id: existingLike.id } });
      res.status(200).json({ message: 'Review unliked', liked: false });
    } else {

      await prisma.like.create({ data: { userId, reviewId } });
      res.status(200).json({ message: 'Review liked', liked: true });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// --- ADD A COMMENT TO A REVIEW ---
export const addComment = async (req: any, res: any): Promise<void> => {
  try {
    const reviewId = req.params.id;
    const userId = req.user?.id; // Auth middleware 
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'You must be logged in to comment.' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment cannot be empty.' });
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        userId,
        reviewId
      },
      include: {
        user: { select: { id: true, name: true } } 
      }
    });

    res.status(201).json({ message: 'Comment added successfully', comment: newComment });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};