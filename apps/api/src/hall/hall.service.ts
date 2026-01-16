import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class HallService {
  constructor(private readonly prisma: PrismaService) {}

  async getHall() {
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
        _count: { select: { replies: true } }
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

    return {
      rooms: {
        live: rooms.filter((room) => room.status === "LIVE"),
        scheduled: rooms.filter((room) => room.status === "SCHEDULED")
      },
      traces
    };
  }
}
