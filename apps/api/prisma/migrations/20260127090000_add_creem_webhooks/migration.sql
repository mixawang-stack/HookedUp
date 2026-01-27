-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CREEM');

-- AlterTable
ALTER TABLE "NovelPurchase"
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'CREEM',
ADD COLUMN     "providerOrderId" VARCHAR(120),
ADD COLUMN     "providerEventId" VARCHAR(120),
ADD COLUMN     "providerCheckoutId" VARCHAR(120);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" VARCHAR(120) NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NovelPurchase_provider_providerOrderId_key" ON "NovelPurchase"("provider", "providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "NovelPurchase_provider_providerEventId_key" ON "NovelPurchase"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");
