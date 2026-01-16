import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditService } from "../audit.service";
import { PrismaModule } from "../prisma.module";
import { TracesController } from "./traces.controller";
import { TracesService } from "./traces.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TracesController],
  providers: [TracesService, AuditService]
})
export class TracesModule {}
