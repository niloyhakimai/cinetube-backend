import { Response } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reviewId, content } = req.body;
    const userId = req.user.id;

    const newComment = await prisma.comment.create({
      data: {
        content,
        reviewId,
        userId,
      },
      include: {
        user: { select: { name: true } }
      }
    });

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reviewId } = req.body;
    const userId = req.user.id;

    const existingLike = await prisma.like.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      res.status(200).json({ message: 'Like removed' });
    } else {
      await prisma.like.create({
        data: {
          userId,
          reviewId,
        },
      });
      res.status(201).json({ message: 'Review liked' });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};