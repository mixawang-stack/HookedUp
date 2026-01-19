-- Create enum for novel reactions
DO $$ BEGIN
  CREATE TYPE "NovelReactionType" AS ENUM ('LIKE', 'DISLIKE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create NovelReaction table
CREATE TABLE IF NOT EXISTS "NovelReaction" (
  "id" TEXT NOT NULL,
  "novelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NovelReactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NovelReaction_pkey" PRIMARY KEY ("id")
);

-- Unique per user per novel
CREATE UNIQUE INDEX IF NOT EXISTS "NovelReaction_novelId_userId_key"
  ON "NovelReaction"("novelId", "userId");

-- Foreign keys
ALTER TABLE "NovelReaction"
  ADD CONSTRAINT "NovelReaction_novelId_fkey"
  FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NovelReaction"
  ADD CONSTRAINT "NovelReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "NovelReaction_novelId_idx" ON "NovelReaction"("novelId");
CREATE INDEX IF NOT EXISTS "NovelReaction_userId_idx" ON "NovelReaction"("userId");
