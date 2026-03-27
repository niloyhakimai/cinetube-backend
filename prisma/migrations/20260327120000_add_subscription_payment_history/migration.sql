-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "plan" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_stripeInvoiceId_key" ON "SubscriptionPayment"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_stripePaymentIntentId_key" ON "SubscriptionPayment"("stripePaymentIntentId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
