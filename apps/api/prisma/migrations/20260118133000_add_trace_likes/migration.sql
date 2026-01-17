-- Create TraceLike table for trace likes
CREATE TABLE IF NOT EXISTS "TraceLike" (
  "id" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TraceLike_pkey" PRIMARY KEY ("id")
);

-- Unique per user per trace
CREATE UNIQUE INDEX IF NOT EXISTS "TraceLike_traceId_userId_key"
  ON "TraceLike"("traceId", "userId");

-- Foreign keys
ALTER TABLE "TraceLike"
  ADD CONSTRAINT "TraceLike_traceId_fkey"
  FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TraceLike"
  ADD CONSTRAINT "TraceLike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "TraceLike_traceId_idx" ON "TraceLike"("traceId");
CREATE INDEX IF NOT EXISTS "TraceLike_userId_idx" ON "TraceLike"("userId");
