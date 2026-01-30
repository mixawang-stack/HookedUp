import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { STORAGE_DIR } from "./uploads/uploads.constants";
import { buildCorsOrigin } from "./cors/origin";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use("/webhooks/creem", bodyParser.raw({ type: "*/*" }));
  app.use(cookieParser());
  app.useStaticAssets(STORAGE_DIR, { prefix: "/uploads" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.enableCors({
    origin: buildCorsOrigin(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Accept",
      "Origin",
      "X-Requested-With",
      "Cache-Control",
      "Pragma"
    ],
    exposedHeaders: ["Authorization"],
    optionsSuccessStatus: 204
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on port ${port}`);
}

bootstrap();
