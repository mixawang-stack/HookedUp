import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { STORAGE_DIR } from "./uploads/uploads.constants";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
    origin: (origin, callback) => {
      const defaultAllowedOrigins = [
        "https://hooked-up.vercel.app",
        "https://hooked-up-admin.vercel.app"
      ];
      const allowedOrigins = (process.env.CORS_ORIGIN ?? "*")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const combinedOrigins = [...defaultAllowedOrigins, ...allowedOrigins];
      if (!origin || combinedOrigins.includes("*") || combinedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    exposedHeaders: ["Authorization"]
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on port ${port}`);
}

bootstrap();
