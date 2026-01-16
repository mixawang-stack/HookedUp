-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "RoomMembershipMode" AS ENUM ('PARTICIPANT', 'OBSERVER');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tagsJson" JSONB,
    "status" "RoomStatus" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "allowSpectators" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMembership" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "RoomMembershipMode" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "content" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceReply" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "mutedAt" TIMESTAMP(3)
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomMembership_roomId_userId_key" ON "RoomMembership"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceReply" ADD CONSTRAINT "TraceReply_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceReply" ADD CONSTRAINT "TraceReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data migration: create conversations for existing matches
INSERT INTO "Conversation" ("id", "matchId", "createdAt")
SELECT 'conv_' || "id", "id", "matchedAt"
FROM "Match"
WHERE NOT EXISTS (
    SELECT 1 FROM "Conversation" WHERE "Conversation"."matchId" = "Match"."id"
);

INSERT INTO "ConversationParticipant" ("conversationId", "userId", "isMuted", "mutedAt")
SELECT 'conv_' || "id", "user1Id", false, NULL
FROM "Match"
WHERE NOT EXISTS (
    SELECT 1 FROM "ConversationParticipant"
    WHERE "conversationId" = 'conv_' || "Match"."id"
      AND "userId" = "Match"."user1Id"
);

INSERT INTO "ConversationParticipant" ("conversationId", "userId", "isMuted", "mutedAt")
SELECT 'conv_' || "id", "user2Id", false, NULL
FROM "Match"
WHERE NOT EXISTS (
    SELECT 1 FROM "ConversationParticipant"
    WHERE "conversationId" = 'conv_' || "Match"."id"
      AND "userId" = "Match"."user2Id"
);
