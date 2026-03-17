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
