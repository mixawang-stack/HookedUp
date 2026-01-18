import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma.module";
import { UserModule } from "./user/user.module";
import { UploadsModule } from "./uploads/uploads.module";
import { VerificationsModule } from "./verifications/verifications.module";
import { AdminModule } from "./admin/admin.module";
import { MatchModule } from "./match/match.module";
import { ChatModule } from "./chat/chat.module";
import { ConsentModule } from "./consent/consent.module";
import { ReportsModule } from "./reports/reports.module";
import { ConfigController } from "./config.controller";
import { RoomsModule } from "./rooms/rooms.module";
import { TracesModule } from "./traces/traces.module";
import { HallModule } from "./hall/hall.module";
import { PrivateModule } from "./private/private.module";
import { IntentModule } from "./intent/intent.module";
import { NovelsModule } from "./novels/novels.module";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 20
        }
      ]
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    UploadsModule,
    VerificationsModule,
    AdminModule,
    MatchModule,
    ChatModule,
    ConsentModule,
    ReportsModule,
    RoomsModule,
    TracesModule,
    HallModule,
    PrivateModule,
    IntentModule,
    NovelsModule
  ],
  controllers: [HealthController, ConfigController]
})
export class AppModule {}
