import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { CryptoService } from "../crypto.service";
import { PrismaModule } from "../prisma.module";
import { PrivateController } from "./private.controller";
import { PrivateService } from "./private.service";

@Module({
  imports: [PrismaModule, ChatModule, AuthModule],
  controllers: [PrivateController],
  providers: [PrivateService, CryptoService]
})
export class PrivateModule {}
