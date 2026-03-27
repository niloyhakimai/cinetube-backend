export const STRIPE_PRICES = {
  monthly: 'price_1TCaiWFwDBmk8OA2LVygiDbL',
  yearly: 'price_1TCauyFwDBmk8OA2qLc9zE1a',
} as const;

export type SubscriptionPlan = 'MONTHLY' | 'YEARLY';

export const SUBSCRIPTION_AMOUNT_BY_PLAN: Record<SubscriptionPlan, number> = {
  MONTHLY: 9.99,
  YEARLY: 99.99,
};

export const getSubscriptionPlanFromPlanId = (planId: string): SubscriptionPlan | null => {
  if (planId === 'monthly') {
    return 'MONTHLY';
  }

  if (planId === 'yearly') {
    return 'YEARLY';
  }

  return null;
};

export const getSubscriptionPlanFromPriceId = (priceId?: string | null): SubscriptionPlan => (
  priceId === STRIPE_PRICES.yearly ? 'YEARLY' : 'MONTHLY'
);
