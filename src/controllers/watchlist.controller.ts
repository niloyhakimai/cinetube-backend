import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';

export const toggleWatchlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mediaId } = req.body;
    const userId = req.user.id;

    if (!mediaId || typeof mediaId !== 'string') {
      res.status(400).json({ message: 'A valid mediaId is required.' });
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

    // Check if the movie is already in the user's watchlist
    const existingEntry = await prisma.watchlist.findUnique({
      where: {
        userId_mediaId: {
          userId,
          mediaId,
        },
      },
    });

    if (existingEntry) {
      // If it exists, remove it
      await prisma.watchlist.delete({
        where: { id: existingEntry.id },
      });
      res.status(200).json({ message: 'Media removed from watchlist' });
    } else {
      // If it does not exist, add it
      const newEntry = await prisma.watchlist.create({
        data: {
          userId,
          mediaId,
        },
      });
      res.status(201).json({ 
        message: 'Media added to watchlist', 
        watchlistEntry: newEntry 
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(400).json({ message: 'Invalid mediaId. Watchlist could not be updated.' });
      return;
    }

    console.error('Error toggling watchlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUserWatchlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;

    const watchlist = await prisma.watchlist.findMany({
      where: { userId },
      include: {
        media: {
          select: { id: true, title: true, genre: true, releaseYear: true, priceType: true }
        }
      },
      orderBy: { id: 'desc' }
    });

    res.status(200).json({ watchlist });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
