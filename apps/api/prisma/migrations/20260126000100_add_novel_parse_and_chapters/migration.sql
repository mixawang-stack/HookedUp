DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NovelParseStatus') THEN
    CREATE TYPE "NovelParseStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED');
  END IF;
END $$;

ALTER TABLE "Novel"
  ADD COLUMN IF NOT EXISTS "parseStatus" "NovelParseStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "parseError" TEXT,
  ADD COLUMN IF NOT EXISTS "needsChapterReview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "NovelChapter"
  ADD COLUMN IF NOT EXISTS "contentRaw" TEXT,
  ADD COLUMN IF NOT EXISTS "contentClean" TEXT,
  ADD COLUMN IF NOT EXISTS "contentHtml" TEXT,
  ADD COLUMN IF NOT EXISTS "wordCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "NovelFile" (
  "id" TEXT PRIMARY KEY,
  "novelId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "parseStatus" "NovelParseStatus" NOT NULL DEFAULT 'PENDING',
  "parseError" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "NovelFile_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "NovelFile_novelId_idx" ON "NovelFile"("novelId");

CREATE TABLE IF NOT EXISTS "ChapterVersion" (
  "id" TEXT PRIMARY KEY,
  "chapterId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "contentClean" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedBy" TEXT,
  CONSTRAINT "ChapterVersion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "NovelChapter"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChapterVersion_chapterId_idx" ON "ChapterVersion"("chapterId");

CREATE TABLE IF NOT EXISTS "ChapterSplitMarker" (
  "id" TEXT PRIMARY KEY,
  "novelId" TEXT NOT NULL,
  "markerPosStart" INTEGER NOT NULL,
  "markerPosEnd" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  CONSTRAINT "ChapterSplitMarker_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChapterSplitMarker_novelId_idx" ON "ChapterSplitMarker"("novelId");
