import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";
import { HallController } from "./hall.controller";
import { HallService } from "./hall.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [HallController],
  providers: [HallService, PrismaService]
})
export class HallModule {}
