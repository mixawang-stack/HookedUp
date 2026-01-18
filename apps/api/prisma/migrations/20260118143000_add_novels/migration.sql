-- Create enum for novel status
DO $$ BEGIN
  CREATE TYPE "NovelStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Novel table
CREATE TABLE IF NOT EXISTS "Novel" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "description" TEXT,
  "tagsJson" JSONB,
  "status" "NovelStatus" NOT NULL DEFAULT 'DRAFT',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Novel_pkey" PRIMARY KEY ("id")
);

-- Create NovelChapter table
CREATE TABLE IF NOT EXISTS "NovelChapter" (
  "id" TEXT NOT NULL,
  "novelId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "isFree" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NovelChapter_pkey" PRIMARY KEY ("id")
);

-- Unique order per novel
CREATE UNIQUE INDEX IF NOT EXISTS "NovelChapter_novelId_orderIndex_key"
  ON "NovelChapter"("novelId", "orderIndex");

CREATE INDEX IF NOT EXISTS "NovelChapter_novelId_idx" ON "NovelChapter"("novelId");

ALTER TABLE "NovelChapter"
  ADD CONSTRAINT "NovelChapter_novelId_fkey"
  FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
