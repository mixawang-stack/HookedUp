import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JWT_ACCESS_SECRET } from "./auth.constants";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: JWT_ACCESS_SECRET
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule]
})
export class AuthModule {}
