import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OFFICIAL_EMAIL = "official@hookedup.local";
const OFFICIAL_PASSWORD = "ChangeMe123!";
const MEMBER_EMAIL = "member@hookedup.local";
const MEMBER_PASSWORD = "ChangeMe123!";

async function main() {
  const now = new Date();
  const officialUser = await prisma.user.upsert({
    where: { email: OFFICIAL_EMAIL },
    update: {
      role: "OFFICIAL",
      status: "ACTIVE",
      maskName: "Official",
      emailVerifiedAt: now
    },
    create: {
      email: OFFICIAL_EMAIL,
      passwordHash: await argon2.hash(OFFICIAL_PASSWORD),
      role: "OFFICIAL",
      status: "ACTIVE",
      maskName: "Official",
      emailVerifiedAt: now,
      country: "US"
    }
  });
  const memberUser = await prisma.user.upsert({
    where: { email: MEMBER_EMAIL },
    update: {
      role: "USER",
      status: "ACTIVE",
      maskName: "Member",
      emailVerifiedAt: now
    },
    create: {
      email: MEMBER_EMAIL,
      passwordHash: await argon2.hash(MEMBER_PASSWORD),
      role: "USER",
      status: "ACTIVE",
      maskName: "Member",
      emailVerifiedAt: now,
      country: "US"
    }
  });

  const ensureRoom = async (data: {
    title: string;
    description: string;
    tagsJson: string[];
    status: "SCHEDULED" | "LIVE";
    startsAt: Date;
    endsAt: Date;
    createdById: string;
    isOfficial: boolean;
    allowSpectators: boolean;
    capacity: number;
  }) => {
    const existing = await prisma.room.findFirst({
      where: {
        title: data.title,
        createdById: data.createdById,
        isOfficial: data.isOfficial
      }
    });
    if (existing) {
      return existing;
    }
    return prisma.room.create({ data });
  };

  const ensureTrace = async (data: { authorId: string; content: string }) => {
    const existing = await prisma.trace.findFirst({
      where: {
        authorId: data.authorId,
        content: data.content
      }
    });
    if (existing) {
      return existing;
    }
    return prisma.trace.create({ data });
  };

  const scheduledStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1000);
  const liveStart = new Date(now.getTime() - 60 * 60 * 1000);
  const liveEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const scheduledRoom = await ensureRoom({
    title: "Official: Dawn Gathering",
    description: "A scheduled hall session to set intentions and meet the room.",
    tagsJson: ["official", "welcome"],
    status: "SCHEDULED",
    startsAt: scheduledStart,
    endsAt: scheduledEnd,
    createdById: officialUser.id,
    isOfficial: true,
    allowSpectators: true,
    capacity: 120
  });

  const liveRoom = await ensureRoom({
    title: "Official: Live Hall Pulse",
    description: "The hall is open for live conversation and gentle pacing.",
    tagsJson: ["official", "live"],
    status: "LIVE",
    startsAt: liveStart,
    endsAt: liveEnd,
    createdById: officialUser.id,
    isOfficial: true,
    allowSpectators: true,
    capacity: 200
  });

  await prisma.roomMembership.upsert({
    where: {
      roomId_userId: {
        roomId: liveRoom.id,
        userId: officialUser.id
      }
    },
    update: {
      role: "OWNER",
      mode: "PARTICIPANT",
      joinedAt: now,
      leftAt: null
    },
    create: {
      roomId: liveRoom.id,
      userId: officialUser.id,
      role: "OWNER",
      mode: "PARTICIPANT",
      joinedAt: now,
      leftAt: null
    }
  });

  await prisma.roomMembership.upsert({
    where: {
      roomId_userId: {
        roomId: liveRoom.id,
        userId: memberUser.id
      }
    },
    update: {
      role: "MEMBER",
      mode: "PARTICIPANT",
      joinedAt: now,
      leftAt: null
    },
    create: {
      roomId: liveRoom.id,
      userId: memberUser.id,
      role: "MEMBER",
      mode: "PARTICIPANT",
      joinedAt: now,
      leftAt: null
    }
  });

  const existingInvite = await prisma.roomInvite.findFirst({
    where: {
      roomId: liveRoom.id,
      inviterId: officialUser.id,
      inviteeId: memberUser.id
    }
  });
  if (!existingInvite) {
    await prisma.roomInvite.create({
      data: {
        roomId: liveRoom.id,
        inviterId: officialUser.id,
        inviteeId: memberUser.id,
        status: "PENDING"
      }
    });
  }

  await prisma.roomShareLink.upsert({
    where: { token: "seed-room-share-link" },
    update: {
      roomId: liveRoom.id,
      createdById: officialUser.id,
      expiresAt: null,
      revokedAt: null
    },
    create: {
      roomId: liveRoom.id,
      createdById: officialUser.id,
      token: "seed-room-share-link",
      expiresAt: null,
      revokedAt: null
    }
  });

  await prisma.roomGameSelection.upsert({
    where: { roomId: liveRoom.id },
    update: {
      selectedGame: "NONE",
      selectedAt: now,
      selectedById: officialUser.id
    },
    create: {
      roomId: liveRoom.id,
      selectedGame: "NONE",
      selectedAt: now,
      selectedById: officialUser.id
    }
  });

  await ensureTrace({
    authorId: officialUser.id,
    content: "Welcome to the Grand Hall. Leave a trace when you are ready."
  });

  await ensureTrace({
    authorId: officialUser.id,
    content: "Rooms open later. Keep it respectful in private threads."
  });

  await prisma.article.upsert({
    where: { slug: "safety-consent-basics" },
    update: {},
    create: {
      slug: "safety-consent-basics",
      title: "Safety & Consent Basics",
      content:
        "Core safety guidance and consent principles for HookedUp? MVP users.",
      publishedAt: new Date()
    }
  });

  await prisma.article.upsert({
    where: { slug: "privacy-gdpr-overview" },
    update: {},
    create: {
      slug: "privacy-gdpr-overview",
      title: "Privacy & GDPR Overview",
      content:
        "How we handle data, user rights, and compliance expectations in the EU.",
      publishedAt: new Date()
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
