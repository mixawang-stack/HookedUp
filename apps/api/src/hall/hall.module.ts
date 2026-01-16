import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { HallController } from "./hall.controller";
import { HallService } from "./hall.service";

@Module({
  controllers: [HallController],
  providers: [HallService, PrismaService]
})
export class HallModule {}
