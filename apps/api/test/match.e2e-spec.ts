import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { PrismaClient, SwipeAction } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Match e2e", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const userIds: string[] = [];

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
    if (userIds.length > 0) {
      await prisma.match.deleteMany({
        where: {
          OR: [
            { user1Id: { in: userIds } },
            { user2Id: { in: userIds } }
          ]
        }
      });
      await prisma.swipe.deleteMany({
        where: { OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }] }
      });      await prisma.recommendationExposure.deleteMany({
        where: {
          OR: [{ viewerId: { in: userIds } }, { targetId: { in: userIds } }]
        }
      });
      await prisma.preference.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it("mutual like creates match", async () => {
    const now = new Date();
    const userA = {
      email: `match_a_${Date.now()}@example.com`,
      password: "Str0ngPass!",
      dob: "1995-01-01",
      country: "DE"
    };
    const userB = {
      email: `match_b_${Date.now()}@example.com`,
      password: "Str0ngPass!",
      dob: "1996-01-01",
      country: "DE"
    };

    const registerA = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ ...userA, agreeTerms: true })
      .expect(201);
    const tokenA = registerA.body.verificationToken as string;
    userIds.push(registerA.body.userId as string);

    const registerB = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ ...userB, agreeTerms: true })
      .expect(201);
    const tokenB = registerB.body.verificationToken as string;
    userIds.push(registerB.body.userId as string);

    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${tokenA}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${tokenB}`)
      .expect(200);

    await prisma.user.update({
      where: { id: registerA.body.userId },
      data: { ageVerifiedAt: now, healthVerifiedAt: now }
    });
    await prisma.user.update({
      where: { id: registerB.body.userId },
      data: { ageVerifiedAt: now, healthVerifiedAt: now }
    });

    await prisma.preference.upsert({
      where: { userId: registerA.body.userId },
      create: {
        userId: registerA.body.userId,
        gender: "male",
        lookingForGender: "female",
        tagsJson: ["adventure", "kink"]
      },
      update: {
        gender: "male",
        lookingForGender: "female",
        tagsJson: ["adventure", "kink"]
      }
    });

    await prisma.preference.upsert({
      where: { userId: registerB.body.userId },
      create: {
        userId: registerB.body.userId,
        gender: "female",
        lookingForGender: "male",
        tagsJson: ["adventure"]
      },
      update: {
        gender: "female",
        lookingForGender: "male",
        tagsJson: ["adventure"]
      }
    });

    const loginA = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: userA.email, password: userA.password })
      .expect(200);
    const accessA = loginA.body.accessToken as string;

    const loginB = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: userB.email, password: userB.password })
      .expect(200);
    const accessB = loginB.body.accessToken as string;

    const recA = await request(app.getHttpServer())
      .get("/match/recommendations")
      .set("Authorization", `Bearer ${accessA}`)
      .expect(200);

    const recItems = Array.isArray(recA.body) ? recA.body : recA.body.items;
    const recIds = recItems.map((item: { id: string }) => item.id);
    expect(recIds).toContain(registerB.body.userId as string);

    const swipeA = await request(app.getHttpServer())
      .post("/match/swipe")
      .set("Authorization", `Bearer ${accessA}`)
      .send({ toUserId: registerB.body.userId, action: SwipeAction.LIKE })
      .expect(201);

    expect(swipeA.body.matchCreated).toBe(false);

    const swipeB = await request(app.getHttpServer())
      .post("/match/swipe")
      .set("Authorization", `Bearer ${accessB}`)
      .send({ toUserId: registerA.body.userId, action: SwipeAction.LIKE })
      .expect(201);

    expect(swipeB.body.matchCreated).toBe(true);

    const matchesA = await request(app.getHttpServer())
      .get("/match/list")
      .set("Authorization", `Bearer ${accessA}`)
      .expect(200);

    const matchItems = Array.isArray(matchesA.body)
      ? matchesA.body
      : matchesA.body.items;
    expect(matchItems.length).toBe(1);
  });
});
