import { PaymentStatus } from '@prisma/client';
import prisma from '../prisma/client';
import {
  SUBSCRIPTION_AMOUNT_BY_PLAN,
  SubscriptionPlan,
} from '../constants/subscription';

interface RecordSubscriptionPaymentInput {
  userId: string;
  plan: SubscriptionPlan;
  stripeSubscriptionId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  billingPeriodStart?: Date | null;
  billingPeriodEnd?: Date | null;
  amount?: number | null;
  currency?: string | null;
  paymentStatus?: PaymentStatus;
  createdAt?: Date | null;
}

const buildSubscriptionPaymentData = (input: RecordSubscriptionPaymentInput) => ({
  amount: input.amount ?? SUBSCRIPTION_AMOUNT_BY_PLAN[input.plan],
  currency: input.currency ?? 'usd',
  paymentStatus: input.paymentStatus ?? PaymentStatus.COMPLETED,
  plan: input.plan,
  stripeSubscriptionId: input.stripeSubscriptionId ?? null,
  stripeInvoiceId: input.stripeInvoiceId ?? null,
  stripePaymentIntentId: input.stripePaymentIntentId ?? null,
  billingPeriodStart: input.billingPeriodStart ?? null,
  billingPeriodEnd: input.billingPeriodEnd ?? null,
  userId: input.userId,
  createdAt: input.createdAt ?? undefined,
});

export const recordSubscriptionPayment = async (input: RecordSubscriptionPaymentInput) => {
  const data = buildSubscriptionPaymentData(input);

  if (input.stripeInvoiceId) {
    return prisma.subscriptionPayment.upsert({
      where: { stripeInvoiceId: input.stripeInvoiceId },
      update: data,
      create: data,
    });
  }

  if (input.stripePaymentIntentId) {
    return prisma.subscriptionPayment.upsert({
      where: { stripePaymentIntentId: input.stripePaymentIntentId },
      update: data,
      create: data,
    });
  }

  return prisma.subscriptionPayment.create({ data });
};
