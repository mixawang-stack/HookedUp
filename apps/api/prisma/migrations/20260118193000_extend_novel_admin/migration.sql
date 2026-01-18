-- Extend NovelStatus enum
DO $$ BEGIN
  ALTER TYPE "NovelStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
  ALTER TYPE "NovelStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create NovelAudience enum
DO $$ BEGIN
  CREATE TYPE "NovelAudience" AS ENUM ('ALL', 'MATURE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create NovelSourceType enum
DO $$ BEGIN
  CREATE TYPE "NovelSourceType" AS ENUM ('TEXT', 'MARKDOWN', 'PDF');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new fields to Novel table
ALTER TABLE "Novel"
  ADD COLUMN IF NOT EXISTS "authorName" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "contentWarningsJson" JSONB,
  ADD COLUMN IF NOT EXISTS "audience" "NovelAudience" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "sourceType" "NovelSourceType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "autoHallPost" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hallTraceId" TEXT,
  ADD COLUMN IF NOT EXISTS "roomId" TEXT,
  ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "favoriteCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dislikeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shareCount" INTEGER NOT NULL DEFAULT 0;

-- Link novel to hall trace / room when used
ALTER TABLE "Novel"
  ADD CONSTRAINT "Novel_hallTraceId_fkey"
  FOREIGN KEY ("hallTraceId") REFERENCES "Trace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Novel"
  ADD CONSTRAINT "Novel_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
