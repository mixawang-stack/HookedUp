import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaModule } from "../prisma.module";
import { UploadsModule } from "../uploads/uploads.module";
import { VerificationsController } from "./verifications.controller";
import { VerificationsService } from "./verifications.service";

@Module({
  imports: [PrismaModule, AuthModule, UploadsModule],
  controllers: [VerificationsController],
  providers: [VerificationsService, CryptoService, AuditService]
})
export class VerificationsModule {}
