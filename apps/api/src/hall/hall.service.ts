import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class HallService {
  constructor(private readonly prisma: PrismaService) {}

  async getHall(userId?: string) {
    const rooms = await this.prisma.room.findMany({
      where: { isOfficial: true },
      select: {
        id: true,
        title: true,
        description: true,
        tagsJson: true,
        status: true,
        startsAt: true,
        endsAt: true,
        isOfficial: true,
        allowSpectators: true,
        capacity: true,
        createdAt: true
      },
      orderBy: [{ status: "asc" }, { startsAt: "asc" }, { createdAt: "desc" }]
    });

    const tracesRaw = await this.prisma.trace.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        author: {
          select: {
            id: true,
            maskName: true,
            maskAvatarUrl: true,
            role: true,
            gender: true,
            dob: true,
            preference: {
              select: {
                gender: true,
                lookingForGender: true,
                smPreference: true,
                tagsJson: true
              }
            }
          }
        },
        _count: { select: { replies: true, likes: true } },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true }
              }
            }
          : {})
      }
    });

    const traces = tracesRaw.map((trace) => ({
      id: trace.id,
      content: trace.content,
      imageUrl: trace.imageUrl,
      imageWidth: trace.imageWidth,
      imageHeight: trace.imageHeight,
      createdAt: trace.createdAt,
      replyCount: trace._count.replies,
      likeCount: trace._count.likes,
      likedByMe: userId
        ? ((trace as { likes?: { id: string }[] }).likes?.length ?? 0) > 0
        : false,
      author: trace.author
        ? {
            id: trace.author.id,
            maskName: trace.author.maskName,
            maskAvatarUrl: trace.author.maskAvatarUrl,
            role: trace.author.role,
            gender: trace.author.gender,
            dob: trace.author.dob,
            preference: trace.author.preference
          }
        : null
    }));

    let novels = [];
    try {
      novels = await this.prisma.novel.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 6
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        novels = [];
      } else {
        throw error;
      }
    }

    return {
      rooms: {
        live: rooms.filter((room) => room.status === "LIVE"),
        scheduled: rooms.filter((room) => room.status === "SCHEDULED")
      },
      traces,
      novels
    };
  }
}
