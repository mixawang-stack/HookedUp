import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaModule } from "../prisma.module";
import { AdminController } from "./admin.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminService } from "./admin.service";
import { AdminUsersService } from "./admin-users.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminController, AdminUsersController],
  providers: [AdminService, AdminUsersService, CryptoService, AuditService]
})
export class AdminModule {}
