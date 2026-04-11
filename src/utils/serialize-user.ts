type SerializableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  favoriteGenres?: string[] | null;
  communicationOptIn?: boolean | null;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndDate?: Date | null;
};

export const serializeUser = (user: SerializableUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
  favoriteGenres: user.favoriteGenres ?? [],
  communicationOptIn: user.communicationOptIn ?? true,
  subscriptionPlan: user.subscriptionPlan ?? 'FREE',
  subscriptionStatus: user.subscriptionStatus ?? 'INACTIVE',
  subscriptionEndDate: user.subscriptionEndDate ?? null,
});
