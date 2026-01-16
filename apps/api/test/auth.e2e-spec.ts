import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Auth e2e", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    await app.init();

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it("register -> verify -> login -> refresh -> logout", async () => {
    const email = `test_${Date.now()}@example.com`;
    const password = "Str0ngPass!";
    const dob = "1995-01-01";
    const country = "DE";

    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, dob, country, agreeTerms: true })
      .expect(201);

    userId = registerRes.body.userId;
    expect(userId).toBeDefined();
    expect(registerRes.body.verificationToken).toBeDefined();

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${registerRes.body.verificationToken}`)
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();
    const loginCookie = loginRes.headers["set-cookie"]?.[0];
    expect(loginCookie).toBeDefined();

    const refreshRes = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", loginCookie)
      .expect(200);

    expect(refreshRes.body.accessToken).toBeDefined();
    const refreshCookie = refreshRes.headers["set-cookie"]?.[0];
    expect(refreshCookie).toBeDefined();

    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", refreshCookie)
      .expect(200);
  });
});
