-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateTable
CREATE TABLE "IntentOffline" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "status" "IntentStatus" NOT NULL DEFAULT 'PENDING',
    "termsVersion" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterConfirmedAt" TIMESTAMP(3),
    "responderConfirmedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentOffline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntentOffline_conversationId_key" ON "IntentOffline"("conversationId");

-- CreateIndex
CREATE INDEX "IntentOffline_requesterId_idx" ON "IntentOffline"("requesterId");

-- CreateIndex
CREATE INDEX "IntentOffline_responderId_idx" ON "IntentOffline"("responderId");

-- AddForeignKey
ALTER TABLE "IntentOffline" ADD CONSTRAINT "IntentOffline_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentOffline" ADD CONSTRAINT "IntentOffline_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentOffline" ADD CONSTRAINT "IntentOffline_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
