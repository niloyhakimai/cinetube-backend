import prisma from '../prisma/client';
import { SUBSCRIPTION_AMOUNT_BY_PLAN } from '../constants/subscription';
import { completeWithGroq, groqIsConfigured } from './ai-provider.service';

type ReplyStyle = 'english' | 'bangla' | 'banglish';

function detectReplyStyle(message: string): ReplyStyle {
  if (/[\u0980-\u09FF]/.test(message)) {
    return 'bangla';
  }

  if (/\b(ami|amar|tumi|tumake|ki|kisu|kivabe|chai|lagbe|dibe|parbe|dekhao|dekhte|bhalo|movie|series)\b/i.test(message)) {
    return 'banglish';
  }

  return 'english';
}

function localizeText(style: ReplyStyle, variants: { english: string; bangla: string; banglish: string }) {
  return variants[style];
}

function formatGenreMap(entries: string[]): string {
  return entries.slice(0, 3).join(', ');
}

async function getUserPreferenceSignals(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      watchlist: {
        include: {
          media: {
            select: {
              id: true,
              genre: true,
            },
          },
        },
      },
      reviews: {
        select: {
          rating: true,
          media: {
            select: {
              id: true,
              genre: true,
            },
          },
        },
      },
    },
  });

  const positiveGenres = new Map<string, number>();
  const negativeGenres = new Map<string, number>();
  const excludedMediaIds = new Set<string>();

  user?.favoriteGenres.forEach((genre) => {
    positiveGenres.set(genre, (positiveGenres.get(genre) || 0) + 2);
  });

  user?.watchlist.forEach((entry) => {
    excludedMediaIds.add(entry.media.id);
    entry.media.genre.forEach((genre) => {
      positiveGenres.set(genre, (positiveGenres.get(genre) || 0) + 3);
    });
  });

  user?.reviews.forEach((review) => {
    excludedMediaIds.add(review.media.id);

    review.media.genre.forEach((genre) => {
      if (review.rating >= 8) {
        positiveGenres.set(genre, (positiveGenres.get(genre) || 0) + 4);
      } else if (review.rating <= 5) {
        negativeGenres.set(genre, (negativeGenres.get(genre) || 0) + 3);
      }
    });
  });

  return {
    user,
    positiveGenres,
    negativeGenres,
    excludedMediaIds,
  };
}

function summarizeTaste(preferences: Map<string, number>): string[] {
  return [...preferences.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([genre]) => genre);
}

export async function getAiRecommendations(userId?: string, limit = 12) {
  const signals = userId ? await getUserPreferenceSignals(userId) : null;
  const user = signals?.user;

  const media = await prisma.media.findMany({
    include: {
      reviews: {
        where: { isApproved: true },
        select: { rating: true },
      },
    },
  });

  const scoredItems = media
    .filter((item) => !signals?.excludedMediaIds.has(item.id))
    .map((item) => {
      const reviewCount = item.reviews.length;
      const averageRating = reviewCount > 0
        ? item.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
        : 0;

      let score = averageRating * 3 + Math.min(item.viewCount, 1000) / 30;

      if (item.isFeatured) {
        score += 5;
      }

      item.genre.forEach((genre) => {
        score += signals?.positiveGenres.get(genre) || 0;
        score -= signals?.negativeGenres.get(genre) || 0;
      });

      if (user?.subscriptionStatus !== 'ACTIVE' && item.priceType === 'PREMIUM') {
        score -= 4;
      }

      return {
        id: item.id,
        href: `/movies/${item.id}`,
        title: item.title,
        posterUrl: item.posterUrl,
        releaseYear: item.releaseYear,
        genre: item.genre,
        averageRating: Number(averageRating.toFixed(1)),
        priceType: item.priceType,
        mediaType: item.mediaType,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const favoriteGenres = summarizeTaste(signals?.positiveGenres || new Map<string, number>());
  const fallbackHeadline = user
    ? favoriteGenres.length > 0
      ? `Because you enjoy ${formatGenreMap(favoriteGenres)}`
      : 'Fresh picks based on your CineTube activity'
    : 'Popular picks for movie night';
  const fallbackSummary = user
    ? favoriteGenres.length > 0
      ? `We blended your watchlist, ratings, and saved genres to surface ${formatGenreMap(favoriteGenres)} titles first.`
      : 'We used your recent activity to surface a balanced mix of crowd favorites and featured titles.'
    : 'These picks lean on ratings, popularity, and featured titles so guests still get strong discovery results.';

  let headline = fallbackHeadline;
  let summary = fallbackSummary;
  let source: 'groq' | 'fallback' = 'fallback';

  if (groqIsConfigured() && scoredItems.length > 0) {
    const groqResult = await completeWithGroq([
      {
        role: 'system',
        content: 'You write one short recommendation headline and one short explanation for a movie streaming homepage. Respond in exactly two lines: headline then summary.',
      },
      {
        role: 'user',
        content: `User favorite genres: ${favoriteGenres.join(', ') || 'None'}\nTitles:\n${scoredItems
          .slice(0, 5)
          .map((item) => `${item.title} (${item.releaseYear}) - ${item.genre.join(', ')}`)
          .join('\n')}`,
      },
    ], { temperature: 0.5, maxTokens: 120 });

    if (groqResult) {
      const lines = groqResult.text.split('\n').map((entry) => entry.trim()).filter(Boolean);
      if (lines[0]) {
        headline = lines[0].replace(/^headline[:\-]\s*/i, '');
      }
      if (lines[1]) {
        summary = lines[1].replace(/^summary[:\-]\s*/i, '');
      }
      source = 'groq';
    }
  }

  return {
    source,
    headline,
    summary,
    items: scoredItems,
  };
}

export async function getAiReviewSummary(mediaId: string) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      reviews: {
        where: { isApproved: true },
        select: {
          rating: true,
          content: true,
          tags: true,
          isSpoiler: true,
        },
      },
    },
  });

  if (!media) {
    return null;
  }

  const approvedReviews = media.reviews;

  if (approvedReviews.length < 2) {
    return {
      source: 'fallback' as const,
      summary: 'Not enough approved reviews yet to generate a strong audience snapshot.',
      sentiment: 'emerging',
      highlights: ['As more viewers rate this title, the summary will get sharper.'],
      reviewCount: approvedReviews.length,
      averageRating: approvedReviews.length === 1 ? approvedReviews[0].rating : 0,
    };
  }

  const reviewCount = approvedReviews.length;
  const averageRating = Number((
    approvedReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
  ).toFixed(1));
  const positive = approvedReviews.filter((review) => review.rating >= 7).length;
  const negative = approvedReviews.filter((review) => review.rating <= 4).length;
  const spoilerCount = approvedReviews.filter((review) => review.isSpoiler).length;
  const tagCounts = new Map<string, number>();

  approvedReviews.forEach((review) => {
    review.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const topTags = [...tagCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  const sentiment = averageRating >= 7.5
    ? 'positive'
    : averageRating >= 5.5
      ? 'mixed'
      : 'negative';

  let summary = sentiment === 'positive'
    ? `Viewers are responding well to ${media.title}, especially for its ${topTags.length > 0 ? topTags.join(', ') : 'overall entertainment value'}.`
    : sentiment === 'mixed'
      ? `Audience reactions to ${media.title} are mixed, with praise and criticism split across the review set.`
      : `Approved reviews lean critical on ${media.title}, with repeated concerns appearing across the audience feedback.`;

  const highlights = [
    topTags.length > 0 ? `Common tags: ${topTags.join(', ')}.` : 'A broader set of opinions is still forming.',
    `${positive} positive vs ${negative} critical reviews in the approved pool.`,
    spoilerCount > 0 ? `${spoilerCount} approved review${spoilerCount > 1 ? 's include spoilers' : ' includes spoilers'}.` : 'No approved spoiler-heavy review cluster detected.',
  ];

  let source: 'groq' | 'fallback' = 'fallback';

  if (groqIsConfigured()) {
    const groqResult = await completeWithGroq([
      {
        role: 'system',
        content: 'You summarize audience reviews for a streaming platform. Respond with 2 concise sentences only.',
      },
      {
        role: 'user',
        content: `Title: ${media.title}
Average rating: ${averageRating}
Top tags: ${topTags.join(', ') || 'None'}
Positive reviews: ${positive}
Negative reviews: ${negative}
Spoiler reviews: ${spoilerCount}
Review excerpts:
${approvedReviews.slice(0, 6).map((review) => `- (${review.rating}/10) ${review.content}`).join('\n')}`,
      },
    ], { temperature: 0.3, maxTokens: 140 });

    if (groqResult) {
      summary = groqResult.text.trim();
      source = 'groq';
    }
  }

  return {
    source,
    summary,
    sentiment,
    highlights,
    reviewCount,
    averageRating,
  };
}

function getPlanHelp(style: ReplyStyle) {
  const monthly = SUBSCRIPTION_AMOUNT_BY_PLAN.MONTHLY.toFixed(2);
  const yearly = SUBSCRIPTION_AMOUNT_BY_PLAN.YEARLY.toFixed(2);

  return {
    message: localizeText(style, {
      english: `CineTube Premium gives you premium titles and an ad-free experience. Monthly is $${monthly}, while yearly is $${yearly} and works best if you plan to stay active all year.`,
      bangla: `CineTube Premium নিলে তুমি premium titles আর ad-free experience পাবে। Monthly plan $${monthly}, আর yearly plan $${yearly}; সারা বছর active থাকলে yearly plan বেশি value দেয়।`,
      banglish: `CineTube Premium nile tumi premium titles ar ad-free experience pabe. Monthly plan $${monthly}, ar yearly plan $${yearly}; sara bochor active thakle yearly plan beshi value dey.`,
    }),
    suggestions: ['/subscribe/monthly', '/subscribe/yearly', '/#pricing'],
  };
}

function getNavigationHelp(style: ReplyStyle) {
  return {
    message: localizeText(style, {
      english: 'For quick browsing, start with Explore for filters, Movies for film-only browsing, Series for TV discovery, and Profile for your personal activity.',
      bangla: 'দ্রুত browse করতে চাইলে Explore থেকে filters use করো, Movies থেকে films, Series থেকে TV titles, আর Profile থেকে নিজের activity দেখো।',
      banglish: 'Druto browse korte chaile Explore theke filters use koro, Movies theke films, Series theke TV titles, ar Profile theke nijer activity dekho.',
    }),
    suggestions: ['/explore', '/movies', '/series', '/profile'],
  };
}

export async function getAiChatResponse(input: {
  message: string;
  userId?: string;
  context?: {
    pathname?: string;
    mediaId?: string;
    mediaTitle?: string;
  };
}) {
  const style = detectReplyStyle(input.message);
  const message = input.message.trim();
  const lower = message.toLowerCase();

  if (/plan|price|pricing|subscription|premium/.test(lower)) {
    return {
      source: 'fallback' as const,
      ...getPlanHelp(style),
      recommendations: [],
      reviewSummary: null,
    };
  }

  if (/where|navigate|page|route|kothay|kothae|jabo/.test(lower)) {
    return {
      source: 'fallback' as const,
      ...getNavigationHelp(style),
      recommendations: [],
      reviewSummary: null,
    };
  }

  if ((/summary|review|audience|opinion|ki bolche/.test(lower)) && input.context?.mediaId) {
    const reviewSummary = await getAiReviewSummary(input.context.mediaId);
    const reply = reviewSummary
      ? localizeText(style, {
          english: `Here is the current audience snapshot for ${input.context.mediaTitle || 'this title'}: ${reviewSummary.summary}`,
          bangla: `${input.context.mediaTitle || 'এই title'}-এর audience snapshot হলো: ${reviewSummary.summary}`,
          banglish: `${input.context.mediaTitle || 'ei title'}-er audience snapshot holo: ${reviewSummary.summary}`,
        })
      : localizeText(style, {
          english: 'I could not load a review snapshot for that title yet.',
          bangla: 'এই title-এর review snapshot এখনই load করা গেল না।',
          banglish: 'Ei title-er review snapshot ekhuni load kora gelo na.',
        });

    return {
      source: reviewSummary?.source || 'fallback',
      message: reply,
      suggestions: [input.context?.pathname || '/movies', '/explore'],
      recommendations: [],
      reviewSummary,
    };
  }

  const recommendationBundle = await getAiRecommendations(input.userId, 6);
  const topGenres = recommendationBundle.items[0]?.genre?.slice(0, 2).join(', ') || 'popular genres';
  const fallbackMessage = localizeText(style, {
    english: `I picked a fresh watchlist for you around ${topGenres}. ${recommendationBundle.summary}`,
    bangla: `আমি তোমার জন্য ${topGenres} ঘিরে নতুন কিছু picks বের করেছি। ${recommendationBundle.summary}`,
    banglish: `Ami tomar jonno ${topGenres} ghire notun kichu picks ber korechi. ${recommendationBundle.summary}`,
  });

  let source = recommendationBundle.source;
  let finalMessage = fallbackMessage;

  if (groqIsConfigured() && recommendationBundle.items.length > 0) {
    const groqResult = await completeWithGroq([
      {
        role: 'system',
        content: `You are a concise streaming assistant. Reply in ${style}. Keep it warm and under 90 words.`,
      },
      {
        role: 'user',
        content: `User asked: ${message}
Homepage summary: ${recommendationBundle.summary}
Recommendation titles: ${recommendationBundle.items.map((item) => `${item.title} (${item.releaseYear})`).join(', ')}`,
      },
    ], { temperature: 0.5, maxTokens: 180 });

    if (groqResult) {
      finalMessage = groqResult.text;
      source = groqResult.source;
    }
  }

  return {
    source,
    message: finalMessage,
    suggestions: ['/explore', '/movies', '/#pricing'],
    recommendations: recommendationBundle.items,
    reviewSummary: null,
  };
}
