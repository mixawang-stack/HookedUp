-- CreateEnum
CREATE TYPE "EntitlementScope" AS ENUM ('BOOK', 'CHAPTER');

-- AlterTable
CREATE INDEX "Novel_creemProductId_idx" ON "Novel"("creemProductId");

-- CreateTable
CREATE TABLE "CreemOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "creemEventId" VARCHAR(120) NOT NULL,
    "creemOrderId" VARCHAR(120),
    "creemCheckoutId" VARCHAR(120),
    "creemProductId" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreemOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "scope" "EntitlementScope" NOT NULL,
    "chapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreemOrder_creemEventId_key" ON "CreemOrder"("creemEventId");

-- CreateIndex
CREATE INDEX "CreemOrder_userId_novelId_idx" ON "CreemOrder"("userId", "novelId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_userId_novelId_scope_key" ON "Entitlement"("userId", "novelId", "scope");

-- CreateIndex
CREATE INDEX "Entitlement_userId_novelId_idx" ON "Entitlement"("userId", "novelId");

-- AddForeignKey
ALTER TABLE "CreemOrder" ADD CONSTRAINT "CreemOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreemOrder" ADD CONSTRAINT "CreemOrder_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "NovelChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
