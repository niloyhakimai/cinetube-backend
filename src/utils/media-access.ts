import { prisma } from '../server';

type PremiumAwareMedia = {
  id: string;
  priceType: string;
  streamingLink?: string | null;
};

function getPublicPreviewLink(streamingLink: string | null | undefined): string | null {
  if (!streamingLink) {
    return null;
  }

  try {
    const parsedUrl = new URL(streamingLink);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (
      hostname.includes('youtube.com') ||
      hostname.includes('youtu.be') ||
      hostname.includes('youtube-nocookie.com')
    ) {
      return streamingLink;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function isPremiumMedia(priceType: string | null | undefined): boolean {
  return String(priceType || 'FREE').toUpperCase() === 'PREMIUM';
}

export async function canUserAccessMedia(
  userId: string | undefined,
  media: Pick<PremiumAwareMedia, 'id' | 'priceType'>,
): Promise<boolean> {
  if (!isPremiumMedia(media.priceType)) {
    return true;
  }

  if (!userId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true },
  });

  if (user?.subscriptionStatus === 'ACTIVE') {
    return true;
  }

  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      mediaId: media.id,
      paymentStatus: 'COMPLETED',
      OR: [
        { purchaseType: 'BUY' },
        {
          purchaseType: 'RENT',
          expiresAt: { gt: new Date() },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(purchase);
}

export async function protectMediaForViewer<T extends PremiumAwareMedia>(
  userId: string | undefined,
  media: T,
): Promise<T & { hasAccess: boolean; previewLink: string | null }> {
  const hasAccess = await canUserAccessMedia(userId, media);
  const previewLink = getPublicPreviewLink(media.streamingLink);

  return {
    ...media,
    hasAccess,
    previewLink,
    streamingLink: hasAccess ? (media.streamingLink ?? null) : null,
  };
}
