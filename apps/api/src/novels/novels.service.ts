import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { NovelStatus, Prisma, Role } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma.service";
import { AdminNovelDto } from "./dto/admin-novel.dto";
import { AdminChapterDto } from "./dto/admin-chapter.dto";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NovelsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(role: string) {
    if (role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }
  }

  async listAdminNovels(role: string) {
    this.ensureAdmin(role);
    return this.prisma.novel.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { chapters: true } },
        room: {
          select: {
            id: true,
            title: true,
            _count: { select: { memberships: true } }
          }
        }
      }
    });
  }

  async createAdminNovel(role: string, dto: AdminNovelDto) {
    this.ensureAdmin(role);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const shouldPublish = dto.status === "PUBLISHED";
    const shouldSchedule = dto.status === "SCHEDULED";
    const shouldArchive = dto.status === "ARCHIVED";
    const autoHallPost = dto.autoHallPost ?? true;
    const autoRoom = dto.autoRoom ?? true;
    const data: Prisma.NovelCreateInput = {
      title: dto.title.trim(),
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      description: dto.description?.trim() || null,
      authorName: dto.authorName?.trim() || null,
      language: dto.language?.trim() || null,
      tagsJson: dto.tagsJson ?? [],
      contentWarningsJson: dto.contentWarningsJson ?? [],
      status: (dto.status as NovelStatus | undefined) ?? "DRAFT",
      audience: dto.audience ?? "ALL",
      sourceType: dto.sourceType ?? "TEXT",
      isFeatured: dto.isFeatured ?? false,
      autoHallPost,
      autoRoom,
      scheduledAt: shouldSchedule ? scheduledAt ?? new Date() : null,
      publishedAt: shouldPublish ? new Date() : null,
      archivedAt: shouldArchive ? new Date() : null
    };
    return this.prisma.$transaction(async (tx) => {
      let hallTraceId: string | null = null;
      let roomId: string | null = null;

      if (shouldPublish && autoHallPost) {
        const officialUser = await this.ensureOfficialUser(tx);
        const hallTrace = await tx.trace.create({
          data: {
            authorId: officialUser.id,
            content: this.buildHallPostContent(
              {
                title: dto.title,
                description: dto.description ?? null,
                tagsJson: dto.tagsJson ?? []
              },
              dto
            ),
            imageUrl: dto.coverImageUrl?.trim() || null
          }
        });
        hallTraceId = hallTrace.id;
      }

      if (shouldPublish && autoRoom) {
        const room = await this.createNovelRoom(tx, dto);
        roomId = room.id;
      }

      return tx.novel.create({
        data: {
          ...data,
          hallTraceId,
          roomId
        }
      });
    });
  }

  async updateAdminNovel(role: string, id: string, dto: AdminNovelDto) {
    this.ensureAdmin(role);
    const existing = await this.prisma.novel.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }

    const nextStatus = (dto.status as NovelStatus | undefined) ?? existing.status;
    const nextAutoHallPost = dto.autoHallPost ?? existing.autoHallPost;
    const nextAutoRoom = dto.autoRoom ?? existing.autoRoom;
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const shouldPublish = existing.status !== "PUBLISHED" && nextStatus === "PUBLISHED";
    const isPublished = nextStatus === "PUBLISHED";
    const shouldUnpublish = existing.status === "PUBLISHED" && nextStatus !== "PUBLISHED";
    const shouldSchedule = nextStatus === "SCHEDULED";
    const shouldArchive = nextStatus === "ARCHIVED";

    const data: Prisma.NovelUpdateInput = {
      title: dto.title?.trim(),
      coverImageUrl:
        dto.coverImageUrl !== undefined
          ? dto.coverImageUrl.trim() || null
          : undefined,
      description:
        dto.description !== undefined ? dto.description.trim() || null : undefined,
      authorName:
        dto.authorName !== undefined ? dto.authorName.trim() || null : undefined,
      language: dto.language !== undefined ? dto.language.trim() || null : undefined,
      tagsJson: dto.tagsJson ?? undefined,
      contentWarningsJson: dto.contentWarningsJson ?? undefined,
      status: dto.status as NovelStatus | undefined,
      audience: dto.audience ?? undefined,
      sourceType: dto.sourceType ?? undefined,
      isFeatured: dto.isFeatured,
      autoHallPost: dto.autoHallPost,
      autoRoom: dto.autoRoom,
      scheduledAt: shouldSchedule ? scheduledAt ?? existing.scheduledAt ?? new Date() : undefined,
      publishedAt: shouldPublish ? new Date() : undefined,
      archivedAt: shouldArchive ? new Date() : undefined
    };

    return this.prisma.$transaction(async (tx) => {
      let hallTraceId = existing.hallTraceId ?? null;
      let roomId = existing.roomId ?? null;

      if (shouldUnpublish && existing.hallTraceId) {
        await tx.trace.delete({ where: { id: existing.hallTraceId } }).catch(() => undefined);
        hallTraceId = null;
      }

      if (isPublished && nextAutoHallPost && hallTraceId) {
        await tx.trace.update({
          where: { id: hallTraceId },
          data: {
            content: this.buildHallPostContent(existing, dto),
            imageUrl: dto.coverImageUrl?.trim() || existing.coverImageUrl || null
          }
        });
      }

      if (isPublished && !nextAutoHallPost && hallTraceId) {
        await tx.trace.delete({ where: { id: hallTraceId } }).catch(() => undefined);
        hallTraceId = null;
      }

      if (isPublished && nextAutoHallPost && !hallTraceId) {
        const officialUser = await this.ensureOfficialUser(tx);
        const hallTrace = await tx.trace.create({
          data: {
            authorId: officialUser.id,
            content: this.buildHallPostContent(existing, dto),
            imageUrl: dto.coverImageUrl?.trim() || existing.coverImageUrl || null
          }
        });
        hallTraceId = hallTrace.id;
      }

      if (isPublished && nextAutoRoom && !roomId) {
        const room = await this.createNovelRoom(tx, {
          ...existing,
          ...dto
        });
        roomId = room.id;
      }

      return tx.novel.update({
        where: { id },
        data: {
          ...data,
          hallTraceId,
          roomId
        }
      });
    });
  }

  async deleteAdminNovel(role: string, id: string) {
    this.ensureAdmin(role);
    return this.prisma.novel.delete({ where: { id } });
  }

  async listAdminChapters(role: string, novelId: string) {
    this.ensureAdmin(role);
    return this.prisma.novelChapter.findMany({
      where: { novelId },
      orderBy: { orderIndex: "asc" }
    });
  }

  async createAdminChapter(role: string, novelId: string, dto: AdminChapterDto) {
    this.ensureAdmin(role);
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true }
    });
    if (!novel) {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }
    return this.prisma.novelChapter.create({
      data: {
        novelId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        orderIndex: dto.orderIndex,
        isFree: dto.isFree ?? false,
        isPublished: dto.isPublished ?? true
      }
    });
  }

  async updateAdminChapter(
    role: string,
    novelId: string,
    chapterId: string,
    dto: AdminChapterDto
  ) {
    this.ensureAdmin(role);
    return this.prisma.novelChapter.update({
      where: { id: chapterId },
      data: {
        novelId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        orderIndex: dto.orderIndex,
        isFree: dto.isFree ?? false,
        isPublished: dto.isPublished ?? true
      }
    });
  }

  async deleteAdminChapter(role: string, chapterId: string) {
    this.ensureAdmin(role);
    return this.prisma.novelChapter.delete({ where: { id: chapterId } });
  }

  async listNovels(limit?: number, featured?: boolean) {
    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.novel.findMany({
      where: {
        status: "PUBLISHED",
        ...(featured !== undefined ? { isFeatured: featured } : {})
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take
    });
  }

  async previewNovel(novelId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      include: {
        chapters: {
          where: { isPublished: true },
          orderBy: { orderIndex: "asc" }
        }
      }
    });
    if (!novel || novel.status !== "PUBLISHED") {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }

    const chapters = novel.chapters.map((chapter) => {
      if (chapter.isFree) {
        return { ...chapter, isLocked: false };
      }
      return {
        ...chapter,
        isLocked: true,
        content: chapter.content.slice(0, 400)
      };
    });

    return {
      id: novel.id,
      title: novel.title,
      coverImageUrl: novel.coverImageUrl,
      description: novel.description,
      tagsJson: novel.tagsJson,
      chapters
    };
  }

  async recommendNovels(userId?: string) {
    if (!userId) {
      return this.listNovels(6);
    }
    const pref = await this.prisma.preference.findUnique({
      where: { userId },
      select: { vibeTagsJson: true, tagsJson: true, interestsJson: true }
    });
    const tags = [
      ...((pref?.vibeTagsJson as string[]) ?? []),
      ...((pref?.tagsJson as string[]) ?? []),
      ...((pref?.interestsJson as string[]) ?? [])
    ].filter(Boolean) as string[];
    if (tags.length === 0) {
      return this.listNovels(6);
    }
    return this.prisma.novel.findMany({
      where: {
        status: "PUBLISHED",
        tagsJson: {
          array_contains: tags.slice(0, 5)
        } as Prisma.JsonFilter
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 6
    });
  }

  private buildHallPostContent(
    existing: { title: string; description: string | null; tagsJson: Prisma.JsonValue },
    dto: AdminNovelDto
  ) {
    const title = dto.title?.trim() ?? existing.title;
    const description = dto.description?.trim() ?? existing.description ?? "";
    const tags = Array.isArray(dto.tagsJson)
      ? dto.tagsJson
      : Array.isArray(existing.tagsJson)
        ? (existing.tagsJson as string[])
        : [];
    const tagLine = tags.length > 0 ? `Tags: ${tags.join(" / ")}` : "";
    return [
      "The Bartender's Pick",
      title,
      description,
      tagLine
    ]
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
  }

  private async ensureOfficialUser(tx: Prisma.TransactionClient) {
    const existing = await tx.user.findFirst({
      where: { role: Role.OFFICIAL },
      select: { id: true }
    });
    if (existing) {
      return existing;
    }
    const passwordHash = await argon2.hash(randomBytes(24).toString("hex"));
    return tx.user.create({
      data: {
        email: `official-${Date.now()}@hookedup.local`,
        passwordHash,
        role: Role.OFFICIAL,
        maskName: "The Bartender"
      },
      select: { id: true }
    });
  }

  private async createNovelRoom(
    tx: Prisma.TransactionClient,
    payload: {
      title: string;
      description?: string | null;
      tagsJson?: Prisma.JsonValue;
    }
  ) {
    const officialUser = await this.ensureOfficialUser(tx);
    const tagsJson = Array.isArray(payload.tagsJson) ? payload.tagsJson : [];
    return tx.room.create({
      data: {
        title: `Discussion: ${payload.title}`,
        description: payload.description ?? null,
        tagsJson,
        isOfficial: true,
        createdById: officialUser.id
      },
      select: { id: true }
    });
  }
}
