import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaModule } from "../prisma.module";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UserController],
  providers: [UserService, CryptoService, AuditService]
})
export class UserModule {}
