import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CreemController } from "./creem.controller";
import { CreemService } from "./creem.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CreemController],
  providers: [CreemService]
})
export class BillingModule {}
