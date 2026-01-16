import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { IntentController } from "./intent.controller";
import { IntentService } from "./intent.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [IntentController],
  providers: [IntentService]
})
export class IntentModule {}
