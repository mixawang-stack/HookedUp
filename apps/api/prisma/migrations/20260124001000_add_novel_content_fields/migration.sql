-- Create enum for novel content source type
CREATE TYPE "NovelContentSourceType" AS ENUM ('DOCX', 'TXT', 'MD', 'PDF');

-- Add content fields to Novel
ALTER TABLE "Novel"
  ADD COLUMN IF NOT EXISTS "contentSourceType" "NovelContentSourceType" NOT NULL DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS "contentRawText" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "wordCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "chapterCount" INTEGER NOT NULL DEFAULT 0;
