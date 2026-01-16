-- DropForeignKey
ALTER TABLE "IntentOffline" DROP CONSTRAINT "IntentOffline_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "IntentOffline" DROP CONSTRAINT "IntentOffline_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "IntentOffline" DROP CONSTRAINT "IntentOffline_responderId_fkey";

-- DropForeignKey
ALTER TABLE "RoomGameSelection" DROP CONSTRAINT "RoomGameSelection_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomGameSelection" DROP CONSTRAINT "RoomGameSelection_selectedById_fkey";

-- DropForeignKey
ALTER TABLE "RoomGameState" DROP CONSTRAINT "RoomGameState_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomInvite" DROP CONSTRAINT "RoomInvite_inviteeId_fkey";

-- DropForeignKey
ALTER TABLE "RoomInvite" DROP CONSTRAINT "RoomInvite_inviterId_fkey";

-- DropForeignKey
ALTER TABLE "RoomInvite" DROP CONSTRAINT "RoomInvite_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomJoinRequest" DROP CONSTRAINT "RoomJoinRequest_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomJoinRequest" DROP CONSTRAINT "RoomJoinRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMessage" DROP CONSTRAINT "RoomMessage_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMessage" DROP CONSTRAINT "RoomMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "RoomShareLink" DROP CONSTRAINT "RoomShareLink_createdById_fkey";

-- DropForeignKey
ALTER TABLE "RoomShareLink" DROP CONSTRAINT "RoomShareLink_roomId_fkey";

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomShareLink" ADD CONSTRAINT "RoomShareLink_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomShareLink" ADD CONSTRAINT "RoomShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGameSelection" ADD CONSTRAINT "RoomGameSelection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGameSelection" ADD CONSTRAINT "RoomGameSelection_selectedById_fkey" FOREIGN KEY ("selectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGameState" ADD CONSTRAINT "RoomGameState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentOffline" ADD CONSTRAINT "IntentOffline_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentOffline" ADD CONSTRAINT "IntentOffline_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentOffline" ADD CONSTRAINT "IntentOffline_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
