-- CreateEnum
CREATE TYPE "NovelPricingMode" AS ENUM ('BOOK', 'CHAPTER');

-- AlterTable
ALTER TABLE "Novel"
ADD COLUMN     "pricingMode" "NovelPricingMode" NOT NULL DEFAULT 'BOOK',
ADD COLUMN     "bookPrice" DECIMAL(10,2),
ADD COLUMN     "bookPromoPrice" DECIMAL(10,2),
ADD COLUMN     "currency" VARCHAR(8) NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "NovelChapter"
ADD COLUMN     "price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "NovelPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chapterId" TEXT,
    "pricingMode" "NovelPricingMode" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovelPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovelPurchase_userId_idx" ON "NovelPurchase"("userId");

-- CreateIndex
CREATE INDEX "NovelPurchase_novelId_idx" ON "NovelPurchase"("novelId");

-- CreateIndex
CREATE INDEX "NovelPurchase_chapterId_idx" ON "NovelPurchase"("chapterId");

-- AddForeignKey
ALTER TABLE "NovelPurchase" ADD CONSTRAINT "NovelPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelPurchase" ADD CONSTRAINT "NovelPurchase_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelPurchase" ADD CONSTRAINT "NovelPurchase_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "NovelChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
