import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { AuditService } from "../audit.service";
import { PrismaService } from "../prisma.service";
import { CreateTraceDto } from "./dto/create-trace.dto";
import { UpdateTraceDto } from "./dto/update-trace.dto";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_CONTENT_LENGTH = 2000;
const MAX_IMAGE_DIMENSION = 8000;
const ALLOWED_IMAGE_SUFFIXES = ["jpg", "jpeg", "png", "webp"];
const BANNED_PATTERNS: RegExp[] = [
  /terror/i,
  /bomb/i,
  /explosive/i,
  /firearm/i,
  /weapon/i,
  /massacre/i,
  /drug\s+trafficking/i
];

@Injectable()
export class TracesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async createTrace(userId: string, role: string, dto: CreateTraceDto) {
    const content = this.normalizeContent(dto.content);

    const trace = await this.prisma.trace.create({
      data: {
        authorId: userId,
        content,
        ...this.prepareImageData(dto)
      }
    });

    if (role === "OFFICIAL" || role === "ADMIN") {
      await this.audit.log({
        actorId: userId,
        action: "TRACE_CREATED",
        targetType: "Trace",
        targetId: trace.id,
        metaJson: {
          length: content.length
        }
      });
    }

    return trace;
  }

  async createReply(
    traceId: string,
    userId: string,
    role: string,
    dto: CreateTraceDto
  ) {
    const content = this.normalizeContent(dto.content);

    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      select: { id: true }
    });

    if (!trace) {
      throw new BadRequestException("TRACE_NOT_FOUND");
    }

    const reply = await this.prisma.traceReply.create({
      data: {
        traceId,
        authorId: userId,
        content
      }
    });

    if (role === "OFFICIAL" || role === "ADMIN") {
      await this.audit.log({
        actorId: userId,
        action: "TRACE_REPLY_CREATED",
        targetType: "TraceReply",
        targetId: reply.id,
        metaJson: {
          traceId,
          length: content.length
        }
      });
    }

    return reply;
  }

  async getTrace(traceId: string, cursor?: string, limit?: number) {
    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      include: {
        author: {
          select: {
            id: true,
            maskName: true,
            maskAvatarUrl: true,
            role: true
          }
        },
        _count: { select: { replies: true } }
      }
    });

    if (!trace) {
      throw new BadRequestException("TRACE_NOT_FOUND");
    }

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const replies = await this.prisma.traceReply.findMany({
      where: { traceId },
      include: {
        author: {
          select: {
            id: true,
            maskName: true,
            maskAvatarUrl: true,
            role: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const nextCursor = replies.length === take ? replies[replies.length - 1].id : null;

    return {
      trace: {
        id: trace.id,
        content: trace.content,
        createdAt: trace.createdAt,
        imageUrl: trace.imageUrl,
        imageWidth: trace.imageWidth,
        imageHeight: trace.imageHeight,
        replyCount: trace._count.replies,
        author: trace.author
      },
      replies: replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        author: reply.author
      })),
      nextCursor
    };
  }

  async listMyTraces(userId: string, cursor?: string, limit?: number) {
    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const traces = await this.prisma.trace.findMany({
      where: { authorId: userId },
      include: {
        _count: { select: { replies: true } }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const nextCursor = traces.length === take ? traces[traces.length - 1].id : null;

    return {
      items: traces.map((trace) => ({
        id: trace.id,
        content: trace.content,
        createdAt: trace.createdAt,
        imageUrl: trace.imageUrl,
        imageWidth: trace.imageWidth,
        imageHeight: trace.imageHeight,
        replyCount: trace._count.replies
      })),
      nextCursor
    };
  }

  async deleteTrace(userId: string, role: string, traceId: string) {
    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      select: { id: true, authorId: true }
    });

    if (!trace) {
      throw new BadRequestException("TRACE_NOT_FOUND");
    }

    if (trace.authorId !== userId && !["ADMIN", "OFFICIAL"].includes(role)) {
      throw new ForbiddenException("TRACE_DELETE_FORBIDDEN");
    }

    await this.prisma.$transaction([
      this.prisma.traceReply.deleteMany({ where: { traceId } }),
      this.prisma.trace.delete({ where: { id: traceId } })
    ]);

    return { ok: true };
  }

  async updateTrace(userId: string, role: string, traceId: string, dto: UpdateTraceDto) {
    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      select: { id: true, authorId: true }
    });

    if (!trace) {
      throw new BadRequestException("TRACE_NOT_FOUND");
    }

    if (trace.authorId !== userId && !["ADMIN", "OFFICIAL"].includes(role)) {
      throw new ForbiddenException("TRACE_UPDATE_FORBIDDEN");
    }

    const content = this.normalizeContent(dto.content);
    const updated = await this.prisma.trace.update({
      where: { id: traceId },
      data: { content }
    });

    if (role === "OFFICIAL" || role === "ADMIN") {
      await this.audit.log({
        actorId: userId,
        action: "TRACE_UPDATED",
        targetType: "Trace",
        targetId: updated.id,
        metaJson: {
          length: content.length
        }
      });
    }

    return { id: updated.id, content: updated.content };
  }

  private normalizeContent(raw: string) {
    const content = (raw ?? "").trim();
    if (content.length === 0) {
      throw new BadRequestException("CONTENT_REQUIRED");
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("CONTENT_TOO_LONG");
    }
    if (this.containsBannedContent(content)) {
      throw new ForbiddenException("CONTENT_NOT_ALLOWED");
    }
    return content;
  }

  private containsBannedContent(content: string) {
    return BANNED_PATTERNS.some((pattern) => pattern.test(content));
  }

  private prepareImageData(dto: CreateTraceDto) {
    if (!dto.imageUrl) {
      return {};
    }
    const imageUrl = dto.imageUrl.trim();
    if (!imageUrl) {
      return {};
    }
    if (!this.hasAllowedImageSuffix(imageUrl)) {
      throw new BadRequestException("INVALID_IMAGE_URL");
    }
    const width = dto.imageWidth ?? null;
    const height = dto.imageHeight ?? null;
    if (width !== null && (width < 1 || width > MAX_IMAGE_DIMENSION)) {
      throw new BadRequestException("INVALID_IMAGE_DIMENSION");
    }
    if (height !== null && (height < 1 || height > MAX_IMAGE_DIMENSION)) {
      throw new BadRequestException("INVALID_IMAGE_DIMENSION");
    }
    return {
      imageUrl,
      imageWidth: width,
      imageHeight: height
    };
  }

  private hasAllowedImageSuffix(imageUrl: string) {
    const path = imageUrl.split("?")[0].split("#")[0].toLowerCase();
    return ALLOWED_IMAGE_SUFFIXES.some((suffix) =>
      path.endsWith(`.${suffix}`)
    );
  }
}
