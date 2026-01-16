-- CreateEnum
CREATE TYPE "RoomMembershipRole" AS ENUM ('OWNER', 'MEMBER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "RoomInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RoomGameSelectionType" AS ENUM ('NONE', 'DICE', 'ONE_THING');

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'LIVE';
ALTER TABLE "Room" ALTER COLUMN "capacity" SET DEFAULT 3;
UPDATE "Room" SET "capacity" = 3 WHERE "capacity" IS NULL;
ALTER TABLE "Room" ALTER COLUMN "capacity" SET NOT NULL;

-- AlterTable
ALTER TABLE "RoomMembership" ADD COLUMN "role" "RoomMembershipRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "RoomInvite" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "RoomInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "RoomInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomShareLink" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RoomShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomGameSelection" (
    "roomId" TEXT NOT NULL,
    "selectedGame" "RoomGameSelectionType" NOT NULL DEFAULT 'NONE',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedById" TEXT NOT NULL,

    CONSTRAINT "RoomGameSelection_pkey" PRIMARY KEY ("roomId")
);

-- CreateIndex
CREATE INDEX "RoomInvite_roomId_idx" ON "RoomInvite"("roomId");

-- CreateIndex
CREATE INDEX "RoomInvite_inviteeId_idx" ON "RoomInvite"("inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomShareLink_token_key" ON "RoomShareLink"("token");

-- CreateIndex
CREATE INDEX "RoomShareLink_roomId_idx" ON "RoomShareLink"("roomId");

-- CreateIndex
CREATE INDEX "RoomGameSelection_selectedById_idx" ON "RoomGameSelection"("selectedById");

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomShareLink" ADD CONSTRAINT "RoomShareLink_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomShareLink" ADD CONSTRAINT "RoomShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGameSelection" ADD CONSTRAINT "RoomGameSelection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGameSelection" ADD CONSTRAINT "RoomGameSelection_selectedById_fkey" FOREIGN KEY ("selectedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
