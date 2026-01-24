-- Create enum for novel category
CREATE TYPE "NovelCategory" AS ENUM ('DRAMA', 'AFTER_DARK');

-- Add new field to Novel
ALTER TABLE "Novel"
  ADD COLUMN IF NOT EXISTS "category" "NovelCategory" NOT NULL DEFAULT 'DRAMA';
