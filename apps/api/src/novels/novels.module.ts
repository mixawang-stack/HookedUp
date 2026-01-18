import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";
import { NovelsController } from "./novels.controller";
import { AdminNovelsController } from "./admin-novels.controller";
import { NovelsService } from "./novels.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [NovelsController, AdminNovelsController],
  providers: [NovelsService, PrismaService]
})
export class NovelsModule {}
