import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { ConsentController } from "./consent.controller";
import { ConsentService } from "./consent.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ConsentController],
  providers: [ConsentService]
})
export class ConsentModule {}
