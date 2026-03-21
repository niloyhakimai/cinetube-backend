type SerializableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndDate?: Date | null;
};

export const serializeUser = (user: SerializableUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  subscriptionPlan: user.subscriptionPlan ?? 'FREE',
  subscriptionStatus: user.subscriptionStatus ?? 'INACTIVE',
  subscriptionEndDate: user.subscriptionEndDate ?? null,
});
