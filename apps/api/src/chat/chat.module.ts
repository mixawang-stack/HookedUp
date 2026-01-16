import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { JWT_ACCESS_SECRET } from "../auth/auth.constants";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { CryptoService } from "../crypto.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.register({
      secret: JWT_ACCESS_SECRET
    })
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, CryptoService],
  exports: [ChatService]
})
export class ChatModule {}
