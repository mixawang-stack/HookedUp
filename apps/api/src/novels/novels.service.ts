import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { NovelStatus, Prisma } from "@prisma/client";
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
        _count: { select: { chapters: true } }
      }
    });
  }

  async createAdminNovel(role: string, dto: AdminNovelDto) {
    this.ensureAdmin(role);
    const data: Prisma.NovelCreateInput = {
      title: dto.title.trim(),
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      description: dto.description?.trim() || null,
      tagsJson: dto.tagsJson ?? [],
      status: (dto.status as NovelStatus | undefined) ?? "DRAFT",
      isFeatured: dto.isFeatured ?? false
    };
    return this.prisma.novel.create({ data });
  }

  async updateAdminNovel(role: string, id: string, dto: AdminNovelDto) {
    this.ensureAdmin(role);
    const data: Prisma.NovelUpdateInput = {
      title: dto.title?.trim(),
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      description: dto.description?.trim() || null,
      tagsJson: dto.tagsJson ?? undefined,
      status: dto.status as NovelStatus | undefined,
      isFeatured: dto.isFeatured
    };
    return this.prisma.novel.update({
      where: { id },
      data
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
      ...(pref?.vibeTagsJson ?? []),
      ...(pref?.tagsJson ?? []),
      ...(pref?.interestsJson ?? [])
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
}
