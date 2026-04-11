import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getAiChatResponse, getAiRecommendations, getAiReviewSummary } from '../services/ai.service';

export const getRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Number.parseInt(String(req.query.limit || '12'), 10);
    const response = await getAiRecommendations(req.user?.id, Number.isFinite(limit) ? limit : 12);

    res.status(200).json(response);
  } catch (error) {
    console.error('AI Recommendations Error:', error);
    res.status(500).json({ message: 'Failed to generate AI recommendations.' });
  }
};

export const getReviewSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mediaId = Array.isArray(req.params.mediaId) ? req.params.mediaId[0] : req.params.mediaId;
    const response = await getAiReviewSummary(mediaId);

    if (!response) {
      res.status(404).json({ message: 'Media not found.' });
      return;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('AI Review Summary Error:', error);
    res.status(500).json({ message: 'Failed to generate an AI review summary.' });
  }
};

export const postAiChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const excludeMediaIds = Array.isArray(req.body?.excludeMediaIds)
      ? req.body.excludeMediaIds
          .filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .slice(-12)
      : [];
    const excludeTitles = Array.isArray(req.body?.excludeTitles)
      ? req.body.excludeTitles
          .filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .slice(-20)
      : [];
    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .filter((entry: unknown): entry is { role: 'user' | 'assistant'; text: string } => {
            return Boolean(
              entry &&
              typeof entry === 'object' &&
              'role' in entry &&
              'text' in entry &&
              ((entry as { role?: string }).role === 'user' || (entry as { role?: string }).role === 'assistant') &&
              typeof (entry as { text?: unknown }).text === 'string',
            );
          })
          .slice(-6)
      : [];

    if (!message) {
      res.status(400).json({ message: 'Message is required.' });
      return;
    }

    const response = await getAiChatResponse({
      message,
      userId: req.user?.id,
      history,
      excludeMediaIds,
      excludeTitles,
      context: req.body?.context,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ message: 'Failed to generate a chatbot response.' });
  }
};
