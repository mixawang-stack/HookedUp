import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MatchController],
  providers: [MatchService]
})
export class MatchModule {}
