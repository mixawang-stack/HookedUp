import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  NovelCategory,
  NovelContentSourceType,
  NovelSourceType,
  NovelStatus,
  Prisma,
  Role
} from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import WordExtractor from "word-extractor";
import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import { PrismaService } from "../prisma.service";
import { AdminNovelDto } from "./dto/admin-novel.dto";
import { AdminChapterDto } from "./dto/admin-chapter.dto";
import { API_PUBLIC_BASE_URL } from "../auth/auth.constants";

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
    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException("TITLE_REQUIRED");
    }
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const shouldPublish = dto.status === "PUBLISHED";
    const shouldSchedule = dto.status === "SCHEDULED";
    const shouldArchive = dto.status === "ARCHIVED";
    const autoHallPost = dto.autoHallPost ?? true;
    const autoRoom = dto.autoRoom ?? true;

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
                title: dto.title!.trim(),
                description: dto.description ?? null,
                tagsJson: (dto.tagsJson as any) ?? []
              },
              dto
            ),
            imageUrl: dto.coverImageUrl?.trim() || null
          }
        });
        hallTraceId = hallTrace.id;
      }

      if (shouldPublish && autoRoom) {
        const room = await this.createNovelRoom(tx, {
          title: dto.title!.trim(),
          description: dto.description ?? null,
          tagsJson: (dto.tagsJson as any) ?? []
        });
        roomId = room.id;
      }

      return tx.novel.create({
        data: {
          title: dto.title!.trim(),
          coverImageUrl: dto.coverImageUrl?.trim() || null,
          description: dto.description?.trim() || null,
          authorName: dto.authorName?.trim() || null,
          language: dto.language?.trim() || null,
          tagsJson: (dto.tagsJson as any) ?? [],
          contentWarningsJson: (dto.contentWarningsJson as any) ?? [],
          status: (dto.status as NovelStatus | undefined) ?? "DRAFT",
          audience: dto.audience ?? "ALL",
          sourceType: dto.sourceType ?? "TEXT",
          category: dto.category ?? "DRAMA",
          isFeatured: dto.isFeatured ?? false,
          autoHallPost,
          autoRoom,
          scheduledAt: shouldSchedule ? scheduledAt ?? new Date() : null,
          publishedAt: shouldPublish ? new Date() : null,
          archivedAt: shouldArchive ? new Date() : null,
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

    return this.prisma.$transaction(async (tx) => {
      let hallTraceId = existing.hallTraceId ?? null;
      let roomId = existing.roomId ?? null;

      if (shouldUnpublish && existing.hallTraceId) {
        await tx.traceLike.deleteMany({ where: { traceId: existing.hallTraceId } });
        await tx.traceReply.deleteMany({ where: { traceId: existing.hallTraceId } });
        await tx.trace.deleteMany({ where: { id: existing.hallTraceId } });
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
        await tx.traceLike.deleteMany({ where: { traceId: hallTraceId } });
        await tx.traceReply.deleteMany({ where: { traceId: hallTraceId } });
        await tx.trace.deleteMany({ where: { id: hallTraceId } });
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
          title: dto.title?.trim() ?? existing.title,
          description:
            dto.description !== undefined
              ? dto.description.trim() || null
              : existing.description ?? null,
          tagsJson:
            dto.tagsJson !== undefined
              ? (dto.tagsJson as any)
              : (existing.tagsJson as any)
        });
        roomId = room.id;
      }

      return tx.novel.update({
        where: { id },
        data: {
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
          tagsJson: (dto.tagsJson as any) ?? undefined,
          contentWarningsJson: (dto.contentWarningsJson as any) ?? undefined,
          status: dto.status as NovelStatus | undefined,
          audience: dto.audience ?? undefined,
          sourceType: dto.sourceType ?? undefined,
          category: dto.category ?? undefined,
          isFeatured: dto.isFeatured,
          autoHallPost: dto.autoHallPost,
          autoRoom: dto.autoRoom,
          scheduledAt: shouldSchedule ? scheduledAt ?? existing.scheduledAt ?? new Date() : undefined,
          publishedAt: shouldPublish ? new Date() : undefined,
          archivedAt: shouldArchive ? new Date() : undefined,
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

  async uploadAdminContent(
    role: string,
    novelId: string,
    file: Express.Multer.File | undefined,
    sourceTypeInput?: string,
    asAttachmentOnly?: boolean
  ) {
    this.ensureAdmin(role);
    if (!file) {
      throw new BadRequestException("MISSING_FILE");
    }

    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true, title: true, chapterCount: true, wordCount: true }
    });
    if (!novel) {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }

    const inferredType = this.inferContentSourceType(
      file.originalname,
      file.mimetype,
      sourceTypeInput
    );

    const attachmentUrl =
      inferredType === "PDF"
        ? `${API_PUBLIC_BASE_URL}/uploads/${file.filename}`
        : null;

    if (inferredType === "PDF") {
      if (!asAttachmentOnly) {
        throw new BadRequestException("PDF_CONTENT_UNSUPPORTED");
      }
      await this.prisma.novel.update({
        where: { id: novelId },
        data: {
          contentSourceType: "PDF",
          attachmentUrl: attachmentUrl ?? undefined
        }
      });
      return {
        chapterCount: novel.chapterCount ?? 0,
        wordCount: novel.wordCount ?? 0,
        previewChapters: []
      };
    }

    const buffer = await readFile(file.path);
    const parsed = await this.parseNovelFile(
      buffer,
      file.originalname,
      file.mimetype,
      inferredType,
      novel.title,
      file.path
    );

    if (parsed.chapters.length === 0 && parsed.rawText) {
      parsed.chapters = [
        {
          title: novel.title?.trim() || "Chapter 1",
          content: parsed.rawText.trim()
        }
      ];
    }
    if (parsed.chapters.length === 0) {
      throw new BadRequestException("CONTENT_PARSE_FAILED");
    }

    const nextSourceType: NovelSourceType =
      parsed.sourceType === "MD" ? "MARKDOWN" : "TEXT";

    await this.prisma.$transaction(async (tx) => {
      await tx.novelChapter.deleteMany({ where: { novelId } });
      await tx.novelChapter.createMany({
        data: parsed.chapters.map((chapter, index) => ({
          novelId,
          title: chapter.title,
          content: chapter.content,
          orderIndex: index + 1,
          isFree: true,
          isPublished: true
        }))
      });
      await tx.novel.update({
        where: { id: novelId },
        data: {
          contentSourceType: parsed.sourceType,
          contentRawText: parsed.rawText || null,
          chapterCount: parsed.chapters.length,
          wordCount: parsed.wordCount,
          attachmentUrl: null,
          sourceType: nextSourceType
        }
      });
    });

    return {
      chapterCount: parsed.chapters.length,
      wordCount: parsed.wordCount,
      previewChapters: parsed.chapters.slice(0, 2).map((chapter, index) => ({
        index: index + 1,
        title: chapter.title,
        content: chapter.content.slice(0, 300)
      }))
    };
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

  async importPdfChapters(
    role: string,
    novelId: string,
    file?: Express.Multer.File,
    freeCountInput?: number
  ) {
    this.ensureAdmin(role);
    if (!file) {
      throw new BadRequestException("MISSING_FILE");
    }

    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true }
    });
    if (!novel) {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }

    const buffer = await readFile(file.path);
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text?.replace(/\r\n/g, "\n").trim() ?? "";
    if (!rawText) {
      throw new BadRequestException("PDF_EMPTY");
    }

    const chapters = this.splitPdfIntoChapters(rawText);
    if (chapters.length === 0) {
      throw new BadRequestException("PDF_PARSE_FAILED");
    }

    const freeCount = this.normalizeFreeCount(freeCountInput, chapters.length);
    await this.prisma.$transaction(async (tx) => {
      await tx.novelChapter.deleteMany({ where: { novelId } });
      await tx.novelChapter.createMany({
        data: chapters.map((chapter, index) => ({
          novelId,
          title: chapter.title,
          content: chapter.content,
          orderIndex: index + 1,
          isFree: index < freeCount,
          isPublished: true
        }))
      });
      await tx.novel.update({
        where: { id: novelId },
        data: { sourceType: NovelSourceType.PDF }
      });
    });

    return {
      chapterCount: chapters.length,
      freeCount,
      chapters: chapters.map((chapter, index) => ({
        orderIndex: index + 1,
        title: chapter.title,
        isFree: index < freeCount
      }))
    };
  }

  private splitPdfIntoChapters(text: string) {
    const chapterRegex =
      /(^|\n)\s*(Chapter\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)\b[^\n]*|CHAPTER\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)\b[^\n]*|Part\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)\b[^\n]*|PART\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)\b[^\n]*|Book\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)\b[^\n]*|BOOK\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)\b[^\n]*|Section\s+\d+[^\n]*|SECTION\s+\d+[^\n]*|\u7b2c[0-9\u4e00-\u9fa5]+[\u7ae0\u8282][^\n]*)/g;
    const matches = Array.from(text.matchAll(chapterRegex));

    if (matches.length === 0) {
      return [
        {
          title: "Chapter 1",
          content: text.trim()
        }
      ];
    }

    const chapters: { title: string; content: string }[] = [];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const title = match[2]?.trim() || `Chapter ${index + 1}`;
      const start = (match.index ?? 0) + match[0].length;
      const end =
        index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
      const content = text.slice(start, end).trim();
      if (content.length === 0) {
        continue;
      }
      chapters.push({ title, content });
    }

    if (chapters.length === 0) {
      return [
        {
          title: "Chapter 1",
          content: text.trim()
        }
      ];
    }

    return chapters;
  }

  private normalizeFreeCount(value: number | undefined, total: number) {
    const fallback = Math.min(2, total);
    if (value === undefined || Number.isNaN(value)) {
      return fallback;
    }
    const parsed = Math.floor(value);
    if (parsed < 0) return 0;
    if (parsed > total) return total;
    return parsed;
  }

  private inferContentSourceType(
    filename: string,
    mimeType?: string,
    sourceTypeInput?: string
  ): NovelContentSourceType {
    const normalizedInput = sourceTypeInput?.trim().toLowerCase();
    if (normalizedInput === "doc") return "DOC";
    if (normalizedInput === "docx") return "DOCX";
    if (normalizedInput === "txt") return "TXT";
    if (normalizedInput === "md" || normalizedInput === "markdown") return "MD";
    if (normalizedInput === "pdf") return "PDF";

    const ext = path.extname(filename).toLowerCase();
    if (ext === ".doc") return "DOC";
    if (ext === ".docx") return "DOCX";
    if (ext === ".txt") return "TXT";
    if (ext === ".md") return "MD";
    if (ext === ".pdf") return "PDF";

    const normalizedMime = (mimeType ?? "").toLowerCase();
    if (normalizedMime.includes("application/msword")) return "DOC";
    if (normalizedMime.includes("wordprocessingml")) return "DOCX";
    if (normalizedMime.includes("text/plain")) return "TXT";
    if (normalizedMime.includes("text/markdown")) return "MD";
    if (normalizedMime.includes("application/pdf")) return "PDF";

    return "TXT";
  }

  private async parseNovelFile(
    buffer: Buffer,
    filename: string,
    mimeType: string | undefined,
    sourceType: NovelContentSourceType,
    fallbackTitle: string,
    filePath?: string
  ): Promise<{
    sourceType: NovelContentSourceType;
    rawText: string;
    chapters: Array<{ title: string; content: string }>;
    wordCount: number;
  }> {
    if (sourceType === "DOC") {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(filePath ?? buffer);
      const rawText = this.normalizeRawText(doc.getBody() ?? "");
      const chapters = this.extractChaptersFromText(rawText, fallbackTitle);
      return {
        sourceType,
        rawText,
        chapters,
        wordCount: this.countWords(rawText)
      };
    }

    if (sourceType === "DOCX") {
      const rawResult = await mammoth.extractRawText({ buffer });
      const rawText = this.normalizeRawText(rawResult.value ?? "");
      const chapters = this.extractChaptersFromText(rawText, fallbackTitle);
      return {
        sourceType,
        rawText,
        chapters,
        wordCount: this.countWords(rawText)
      };
    }

    if (sourceType === "MD" || sourceType === "TXT") {
      const rawText = this.normalizeRawText(this.decodeTextBuffer(buffer, mimeType));
      const chapters = this.extractChaptersFromText(rawText, fallbackTitle);
      return {
        sourceType,
        rawText,
        chapters,
        wordCount: this.countWords(rawText)
      };
    }

    return {
      sourceType,
      rawText: "",
      chapters: [],
      wordCount: 0
    };
  }

  private normalizeRawText(text: string) {
    const trimmedBom = text.replace(/^\uFEFF/, "");
    const normalized = trimmedBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return normalized.replace(/\n{3,}/g, "\n\n").trim();
  }


  private decodeTextBuffer(buffer: Buffer, mimeType?: string) {
    const bom = buffer.slice(0, 2);
    if (bom[0] === 0xff && bom[1] === 0xfe) {
      return iconv.decode(buffer, "utf16le").replace(/\u0000/g, "");
    }
    if (bom[0] === 0xfe && bom[1] === 0xff) {
      return iconv.decode(buffer, "utf16be").replace(/\u0000/g, "");
    }

    const utf8Text = buffer.toString("utf8");
    if (this.looksLikeValidUtf8(utf8Text)) {
      return utf8Text.replace(/\u0000/g, "");
    }

    const zeroByteCount = buffer.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
    if (zeroByteCount > buffer.length / 10) {
      try {
        return iconv.decode(buffer, "utf16le").replace(/\u0000/g, "");
      } catch {
        return utf8Text.replace(/\u0000/g, "");
      }
    }
    const detected = chardet.detect(buffer) as string | null;
    const normalized = this.normalizeEncoding(detected ?? mimeType);
    if (normalized && iconv.encodingExists(normalized)) {
      try {
        return iconv.decode(buffer, normalized).replace(/\u0000/g, "");
      } catch {
        return utf8Text.replace(/\u0000/g, "");
      }
    }
    try {
      const utf16leText = iconv.decode(buffer, "utf16le").replace(/\u0000/g, "");
      if (utf16leText.trim().length > 0) {
        return utf16leText;
      }
    } catch {
      // ignore
    }
    try {
      const utf16beText = iconv.decode(buffer, "utf16be").replace(/\u0000/g, "");
      if (utf16beText.trim().length > 0) {
        return utf16beText;
      }
    } catch {
      // ignore
    }
    const latinFallback = buffer.toString("latin1");
    if (latinFallback && this.looksLikeValidUtf8(latinFallback)) {
      return latinFallback.replace(/\u0000/g, "");
    }
    return latinFallback
      ? latinFallback.replace(/\u0000/g, "")
      : utf8Text.replace(/\u0000/g, "");
  }

  private looksLikeValidUtf8(text: string) {
    if (!text) return false;
    const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
    if (replacementCount === 0) return true;
    return replacementCount / text.length < 0.01;
  }

  private normalizeEncoding(value?: string | null) {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized.includes("gbk") || normalized.includes("gb2312")) return "gb18030";
    if (normalized.includes("gb18030")) return "gb18030";
    if (normalized.includes("utf-16le") || normalized.includes("ucs-2")) return "utf16le";
    if (normalized.includes("utf-16be")) return "utf16be";
    if (normalized.includes("utf-16")) return "utf16le";
    if (normalized.includes("utf-8") || normalized.includes("utf8")) return "utf8";
    if (normalized.includes("ascii")) return "ascii";
    return normalized;
  }

  private extractChaptersFromText(text: string, fallbackTitle: string) {
    const lines = text.split("\n");
    const chapters: Array<{ title: string; content: string }> = [];
    let currentTitle: string | null = null;
    let buffer: string[] = [];

    const chapterLineRegex = /^(Chapter|CHAPTER)\s*(\d+)?\b[:.\-]?\s*(.*)$/;
    const numberedHeadingRegex = /^\d+\s*[.)-]\s*(.+)$/;

    const flush = () => {
      const content = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!content) {
        buffer = [];
        return;
      }
      chapters.push({
        title: currentTitle ?? fallbackTitle ?? "Chapter 1",
        content
      });
      buffer = [];
    };

    lines.forEach((line, index) => {
      const nextLine = lines[index + 1] ?? "";
      const prevLine = lines[index - 1] ?? "";
      const isPrevEmpty = prevLine.trim().length === 0;
      const isNextEmpty = nextLine.trim().length === 0;
      const chapterMatch = line.match(chapterLineRegex);
      if (chapterMatch) {
        flush();
        const index = chapterMatch[2];
        const suffix = chapterMatch[3]?.trim();
        currentTitle = index
          ? `Chapter ${index}${suffix ? ` - ${suffix}` : ""}`
          : chapterMatch[1];
        return;
      }

      const numberedMatch = line.match(numberedHeadingRegex);
      if (numberedMatch) {
        flush();
        currentTitle = line.trim();
        return;
      }

      buffer.push(line);
    });

    flush();

    if (chapters.length === 0) {
      const content = text.trim();
      if (!content) {
        return [];
      }
      const lines = content.split("\n");
      const firstLine = lines.find((line) => line.trim().length > 0) ?? "";
      const remaining = lines.slice(lines.indexOf(firstLine) + 1).join("\n").trim();
      return [
        {
          title: firstLine.trim() || fallbackTitle || "Story",
          content: remaining.length > 0 ? remaining : content
        }
      ];
    }

    return chapters;
  }

  private countWords(text: string) {
    const englishMatches = text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) ?? [];
    const chineseMatches = text.match(/[\u4e00-\u9fa5]/g) ?? [];
    return englishMatches.length + chineseMatches.length;
  }

  async listNovels(limit?: number, featured?: boolean, category?: NovelCategory) {
    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.novel.findMany({
      where: {
        status: "PUBLISHED",
        ...(featured !== undefined ? { isFeatured: featured } : {}),
        ...(category ? { category } : {})
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take
    });
  }

  async previewNovel(novelId: string, userId?: string) {
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

    const reaction = userId
      ? await this.prisma.novelReaction.findUnique({
          where: { novelId_userId: { novelId, userId } }
        })
      : null;

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
      favoriteCount: novel.favoriteCount,
      dislikeCount: novel.dislikeCount,
      contentSourceType: novel.contentSourceType,
      attachmentUrl: novel.attachmentUrl,
      chapterCount: novel.chapterCount,
      wordCount: novel.wordCount,
      myReaction: reaction?.type ?? null,
      chapters
    };
  }

  async fullNovel(novelId: string, userId?: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      include: {
        chapters: {
          where: { isPublished: true },
          orderBy: { orderIndex: "asc" }
        },
        room: {
          select: {
            id: true,
            title: true,
            _count: { select: { memberships: true } }
          }
        }
      }
    });
    if (!novel || novel.status !== "PUBLISHED") {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }

    const reaction = userId
      ? await this.prisma.novelReaction.findUnique({
          where: { novelId_userId: { novelId, userId } }
        })
      : null;

    await this.prisma.novel.update({
      where: { id: novelId },
      data: { viewCount: { increment: 1 } }
    });

    const chapters = novel.chapters.map((chapter) => ({
      ...chapter,
      isLocked: false
    }));

    return {
      id: novel.id,
      title: novel.title,
      coverImageUrl: novel.coverImageUrl,
      description: novel.description,
      tagsJson: novel.tagsJson,
      viewCount: novel.viewCount + 1,
      favoriteCount: novel.favoriteCount,
      dislikeCount: novel.dislikeCount,
      contentSourceType: novel.contentSourceType,
      attachmentUrl: novel.attachmentUrl,
      chapterCount: novel.chapterCount,
      wordCount: novel.wordCount,
      myReaction: reaction?.type ?? null,
      chapters,
      room: novel.room
    };
  }

  async toggleNovelReaction(
    novelId: string,
    userId: string,
    type: "LIKE" | "DISLIKE"
  ) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true, status: true }
    });
    if (!novel || novel.status !== "PUBLISHED") {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.novelReaction.findUnique({
        where: { novelId_userId: { novelId, userId } }
      });

      if (!existing) {
        await tx.novelReaction.create({
          data: { novelId, userId, type: type as any }
        });
        await tx.novel.update({
          where: { id: novelId },
          data:
            type === "LIKE"
              ? { favoriteCount: { increment: 1 } }
              : { dislikeCount: { increment: 1 } }
        });
        const updated = await tx.novel.findUnique({
          where: { id: novelId },
          select: { favoriteCount: true, dislikeCount: true }
        });
        return {
          favoriteCount: updated?.favoriteCount ?? 0,
          dislikeCount: updated?.dislikeCount ?? 0,
          myReaction: type
        };
      }

      if (existing.type === type) {
        await tx.novelReaction.delete({
          where: { novelId_userId: { novelId, userId } }
        });
        await tx.novel.update({
          where: { id: novelId },
          data:
            type === "LIKE"
              ? { favoriteCount: { decrement: 1 } }
              : { dislikeCount: { decrement: 1 } }
        });
        const updated = await tx.novel.findUnique({
          where: { id: novelId },
          select: { favoriteCount: true, dislikeCount: true }
        });
        return {
          favoriteCount: Math.max(updated?.favoriteCount ?? 0, 0),
          dislikeCount: Math.max(updated?.dislikeCount ?? 0, 0),
          myReaction: null
        };
      }

      await tx.novelReaction.update({
        where: { novelId_userId: { novelId, userId } },
        data: { type: type as any }
      });
      await tx.novel.update({
        where: { id: novelId },
        data:
          type === "LIKE"
            ? {
                favoriteCount: { increment: 1 },
                dislikeCount: { decrement: 1 }
              }
            : {
                favoriteCount: { decrement: 1 },
                dislikeCount: { increment: 1 }
              }
      });
      const updated = await tx.novel.findUnique({
        where: { id: novelId },
        select: { favoriteCount: true, dislikeCount: true }
      });
      return {
        favoriteCount: Math.max(updated?.favoriteCount ?? 0, 0),
        dislikeCount: Math.max(updated?.dislikeCount ?? 0, 0),
        myReaction: type
      };
    });
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
    const description = dto.description?.trim() ?? existing.description ?? "";
    const title = dto.title?.trim() ?? existing.title;
    const base = description.length > 0 ? description : title;
    const content = [base, "Read full story"]
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
    return this.truncateTraceContent(content);
  }

  private truncateTraceContent(content: string) {
    const maxLen = 1000;
    if (content.length <= maxLen) {
      return content;
    }
    return `${content.slice(0, maxLen - 3)}...`;
  }

  private async ensureOfficialUser(tx: Prisma.TransactionClient) {
    const officialName = process.env.OFFICIAL_USER_NAME?.trim() || "Theo";
    const officialAvatarUrl = process.env.OFFICIAL_USER_AVATAR_URL?.trim() || null;
    const existing = await tx.user.findFirst({
      where: { role: Role.OFFICIAL },
      select: { id: true }
    });
    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          maskName: officialName,
          ...(officialAvatarUrl ? { maskAvatarUrl: officialAvatarUrl } : {})
        }
      });
      return existing;
    }
    const passwordHash = await argon2.hash(randomBytes(24).toString("hex"));
    return tx.user.create({
      data: {
        email: `official-${Date.now()}@hookedup.local`,
        passwordHash,
        role: Role.OFFICIAL,
        maskName: officialName,
        ...(officialAvatarUrl ? { maskAvatarUrl: officialAvatarUrl } : {})
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
        tagsJson: tagsJson as any,
        isOfficial: true,
        createdById: officialUser.id
      },
      select: { id: true }
    });
  }
}








