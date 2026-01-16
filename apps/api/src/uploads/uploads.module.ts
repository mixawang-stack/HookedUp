import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService]
})
export class UploadsModule {}
