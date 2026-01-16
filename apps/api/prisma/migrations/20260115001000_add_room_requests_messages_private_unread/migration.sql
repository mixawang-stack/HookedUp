-- CreateEnum
CREATE TYPE "RoomJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RoomJoinRequest" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RoomJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "RoomJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomJoinRequest_roomId_userId_key" ON "RoomJoinRequest"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RoomJoinRequest_roomId_status_idx" ON "RoomJoinRequest"("roomId", "status");

-- CreateIndex
CREATE INDEX "RoomMessage_roomId_createdAt_idx" ON "RoomMessage"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
