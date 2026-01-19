import { Injectable } from "@nestjs/common";
import { Prisma, RoomStatus, Novel } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class HallService {
  constructor(private readonly prisma: PrismaService) {}

  async getHall(userId?: string) {
    type HallRoom = {
      id: string;
      title: string;
      description: string | null;
      tagsJson: Prisma.JsonValue;
      status: RoomStatus;
      startsAt: Date | null;
      endsAt: Date | null;
      isOfficial: boolean;
      allowSpectators: boolean;
      capacity: number;
      createdAt: Date;
    };

    let rooms: HallRoom[] = [];
    try {
      rooms = await this.prisma.room.findMany({
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
    } catch (error) {
      console.warn("[hall] rooms query failed, fallback to empty list", error);
      rooms = [];
    }

    type HallTrace = {
      id: string;
      content: string;
      imageUrl: string | null;
      imageWidth: number | null;
      imageHeight: number | null;
      createdAt: Date;
      authorId: string | null;
      novel?: { id: string } | null;
      author: {
        id: string;
        maskName: string | null;
        maskAvatarUrl: string | null;
        role: string;
        gender: string | null;
        dob: Date | null;
        preference: {
          gender: string | null;
          lookingForGender: string | null;
          smPreference: string | null;
          tagsJson: string[] | null;
        } | null;
      } | null;
      _count: { replies: number; likes: number };
      likes?: { id: string }[];
    };

    let tracesRaw: HallTrace[] = [];
    try {
      tracesRaw = (await this.prisma.trace.findMany({
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
          novel: {
            select: { id: true }
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
      })) as HallTrace[];
    } catch (error) {
      console.warn("[hall] traces query failed, fallback to empty list", error);
      tracesRaw = [];
    }

    const traces = tracesRaw.map((trace) => ({
      id: trace.id,
      content: trace.content,
      imageUrl: trace.imageUrl,
      imageWidth: trace.imageWidth,
      imageHeight: trace.imageHeight,
      createdAt: trace.createdAt,
      novelId: trace.novel?.id ?? null,
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

    const normalizeCoverUrl = (value?: string | null) => {
      if (!value) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    let novels: (Novel & {
      myReaction?: "LIKE" | "DISLIKE" | null;
      hallTrace?: { imageUrl: string | null } | null;
      room?: { id: string; title: string; _count: { memberships: number } } | null;
    })[] = [];
    try {
      novels = await this.prisma.novel.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 10,
        include: {
          hallTrace: { select: { imageUrl: true } },
          room: {
            select: {
              id: true,
              title: true,
              _count: { select: { memberships: true } }
            }
          }
        }
      });
      if (userId && novels.length > 0) {
        const reactions = await this.prisma.novelReaction.findMany({
          where: { userId, novelId: { in: novels.map((novel) => novel.id) } }
        });
        const reactionMap = new Map(
          reactions.map((reaction) => [reaction.novelId, reaction.type])
        );
        novels = novels.map((novel) => ({
          ...novel,
          myReaction: reactionMap.get(novel.id) ?? null,
          coverImageUrl:
            normalizeCoverUrl(novel.coverImageUrl) ??
            normalizeCoverUrl(novel.hallTrace?.imageUrl) ??
            null
        }));
      } else {
        novels = novels.map((novel) => ({
          ...novel,
          coverImageUrl:
            normalizeCoverUrl(novel.coverImageUrl) ??
            normalizeCoverUrl(novel.hallTrace?.imageUrl) ??
            null
        }));
      }
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
