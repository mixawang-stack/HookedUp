import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JWT_ACCESS_SECRET } from "../auth/auth.constants";
import { AuditService } from "../audit.service";
import { PrismaService } from "../prisma.service";
import { RoomGateway } from "./room.gateway";
import { RoomOwnerGuard } from "./room-owner.guard";
import { RoomShareController } from "./room-share.controller";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  controllers: [RoomsController, RoomShareController],
  imports: [
    JwtModule.register({
      secret: JWT_ACCESS_SECRET
    })
  ],
  providers: [RoomsService, PrismaService, AuditService, RoomGateway, RoomOwnerGuard]
})
export class RoomsModule {}
