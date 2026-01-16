import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaModule } from "../prisma.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, CryptoService, AuditService]
})
export class ReportsModule {}
