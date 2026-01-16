-- CreateTable
CREATE TABLE "RoomGameState" (
    "roomId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "stateJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomGameState_pkey" PRIMARY KEY ("roomId")
);

-- AddForeignKey
ALTER TABLE "RoomGameState" ADD CONSTRAINT "RoomGameState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
