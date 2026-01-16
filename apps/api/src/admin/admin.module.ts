import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaModule } from "../prisma.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, CryptoService, AuditService]
})
export class AdminModule {}
