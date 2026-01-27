import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { CreemController } from "./creem.controller";
import { CreemService } from "./creem.service";

@Module({
  imports: [PrismaModule],
  controllers: [CreemController],
  providers: [CreemService]
})
export class BillingModule {}
