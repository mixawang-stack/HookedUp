import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { ReportStatus } from "@prisma/client";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";
import { CreateReportDto } from "./dto/create-report.dto";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async createReport(userId: string, dto: CreateReportDto) {
    await this.ensureTargetExists(userId, dto);

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reasonType: dto.reasonType,
        detail: dto.detail ? this.crypto.encrypt(dto.detail) : null,
        status: ReportStatus.OPEN
      }
    });

    await this.audit.log({
      actorId: userId,
      action: "REPORT_CREATED",
      targetType: "Report",
      targetId: report.id,
      metaJson: {
        targetType: report.targetType,
        targetId: report.targetId,
        reasonType: report.reasonType
      }
    });

    return report;
  }

  async listForUser(userId: string) {
    const reports = await this.prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: "desc" }
    });

    return reports.map((report) => ({
      ...report,
      detail: report.detail ? this.safeDecrypt(report.detail) : null
    }));
  }

  private async ensureTargetExists(userId: string, dto: CreateReportDto) {
    if (dto.targetType === "user") {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.targetId },
        select: { id: true }
      });
      if (!user) {
        throw new BadRequestException("TARGET_NOT_FOUND");
      }
      return;
    }

    if (dto.targetType === "message") {
      const message = await this.prisma.message.findUnique({
        where: { id: dto.targetId },
        select: { matchId: true, senderId: true }
      });
      if (!message) {
        throw new BadRequestException("TARGET_NOT_FOUND");
      }
      await this.ensureMatchMember(userId, message.matchId);
      return;
    }

    if (dto.targetType === "match") {
      const match = await this.prisma.match.findUnique({
        where: { id: dto.targetId },
        select: { user1Id: true, user2Id: true }
      });
      if (!match) {
        throw new BadRequestException("TARGET_NOT_FOUND");
      }
      if (match.user1Id !== userId && match.user2Id !== userId) {
        throw new ForbiddenException("NOT_MATCH_MEMBER");
      }
    }
  }

  private async ensureMatchMember(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true }
    });
    if (!match) {
      throw new BadRequestException("MATCH_NOT_FOUND");
    }
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new ForbiddenException("NOT_MATCH_MEMBER");
    }
  }

  private safeDecrypt(payload: string) {
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return "";
    }
  }
}
