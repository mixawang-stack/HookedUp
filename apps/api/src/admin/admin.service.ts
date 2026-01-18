import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  Prisma,
  ReportStatus,
  VerificationStatus,
  VerificationType
} from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";
import { JWT_ACCESS_SECRET, JWT_ACCESS_TTL_SECONDS } from "../auth/auth.constants";
import { LoginDto } from "../auth/dto/login.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService
  ) {}

  async adminLogin(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({
      where: { email }
    });
    if (!admin) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    const passwordOk = await argon2.verify(admin.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, role: "ADMIN" },
      { secret: JWT_ACCESS_SECRET, expiresIn: JWT_ACCESS_TTL_SECONDS }
    );
    return { accessToken };
  }

  async listVerifications(role: string, type?: string, status?: string) {
    this.ensureAdmin(role);

    const parsedType = this.parseType(type);
    const parsedStatus = this.parseStatus(status);

    const where: Prisma.VerificationWhereInput = {};
    if (parsedType) {
      where.type = parsedType;
    }
    if (parsedStatus) {
      where.status = parsedStatus;
    }

    return this.prisma.verification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true } } }
    });
  }

  async approveVerification(role: string, reviewerId: string, id: string) {
    this.ensureAdmin(role);

    const verification = await this.prisma.verification.findUnique({
      where: { id }
    });

    if (!verification) {
      throw new BadRequestException("VERIFICATION_NOT_FOUND");
    }

    if (verification.status !== VerificationStatus.PENDING) {
      throw new BadRequestException("VERIFICATION_NOT_PENDING");
    }

    const now = new Date();
    const userUpdate = this.userUpdateForType(verification.type, now);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedVerification = await tx.verification.update({
        where: { id },
        data: {
          status: VerificationStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: now,
          reason: null
        }
      });

      if (userUpdate) {
        await tx.user.update({
          where: { id: verification.userId },
          data: userUpdate
        });
      }

      await this.audit.log({
        actorId: reviewerId,
        action: "VERIFICATION_APPROVED",
        targetType: "Verification",
        targetId: updatedVerification.id,
        metaJson: {
          type: verification.type,
          userId: verification.userId
        }
      });

      return updatedVerification;
    });

    return result;
  }

  async rejectVerification(
    role: string,
    reviewerId: string,
    id: string,
    reason: string
  ) {
    this.ensureAdmin(role);

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("REJECTION_REASON_REQUIRED");
    }

    const verification = await this.prisma.verification.findUnique({
      where: { id }
    });

    if (!verification) {
      throw new BadRequestException("VERIFICATION_NOT_FOUND");
    }

    if (verification.status !== VerificationStatus.PENDING) {
      throw new BadRequestException("VERIFICATION_NOT_PENDING");
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedVerification = await tx.verification.update({
        where: { id },
        data: {
          status: VerificationStatus.REJECTED,
          reviewedBy: reviewerId,
          reviewedAt: now,
          reason: this.crypto.encrypt(reason.trim())
        }
      });

      await this.audit.log({
        actorId: reviewerId,
        action: "VERIFICATION_REJECTED",
        targetType: "Verification",
        targetId: updatedVerification.id,
        metaJson: {
          type: verification.type,
          userId: verification.userId,
          reason: reason.trim()
        }
      });

      return updatedVerification;
    });

    return result;
  }

  async listReports(role: string, status?: string) {
    this.ensureAdmin(role);

    const parsedStatus = this.parseReportStatus(status);

    const reports = await this.prisma.report.findMany({
      where: parsedStatus ? { status: parsedStatus } : undefined,
      orderBy: { createdAt: "desc" }
    });

    return reports.map((report) => ({
      ...report,
      detail: report.detail ? this.safeDecrypt(report.detail) : null
    }));
  }

  async resolveReport(
    role: string,
    adminId: string,
    reportId: string,
    action: "warn" | "mute" | "ban",
    note?: string
  ) {
    this.ensureAdmin(role);

    const report = await this.prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new BadRequestException("REPORT_NOT_FOUND");
    }

    if (report.status !== ReportStatus.OPEN) {
      throw new BadRequestException("REPORT_NOT_OPEN");
    }

    const now = new Date();
    const targetUserId =
      action === "ban" || action === "mute"
        ? await this.resolveTargetUserId(report)
        : null;

    const resolved = await this.prisma.$transaction(async (tx) => {
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.RESOLVED,
          handledBy: adminId,
          handledAt: now
        }
      });

      if ((action === "ban" || action === "mute") && targetUserId) {
        await tx.user.update({
          where: { id: targetUserId },
          data: { status: action === "ban" ? "BANNED" : "SUSPENDED" }
        });
      }

      await this.audit.log({
        actorId: adminId,
        action: "REPORT_RESOLVED",
        targetType: "Report",
        targetId: reportId,
        metaJson: {
          action,
          note: note?.trim() ?? null,
          targetType: report.targetType,
          targetId: report.targetId,
          targetUserId
        }
      });

      return updatedReport;
    });

    return resolved;
  }

  private ensureAdmin(role: string) {
    if (role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }
  }

  private parseStatus(status?: string): VerificationStatus | undefined {
    if (!status) {
      return undefined;
    }

    const normalized = status.toUpperCase();
    if (normalized === "PENDING") return VerificationStatus.PENDING;
    if (normalized === "APPROVED") return VerificationStatus.APPROVED;
    if (normalized === "REJECTED") return VerificationStatus.REJECTED;

    throw new BadRequestException("INVALID_STATUS");
  }

  private parseType(type?: string): VerificationType | undefined {
    if (!type) {
      return undefined;
    }

    const normalized = type.toUpperCase();
    if (normalized === "AGE") return VerificationType.AGE;
    if (normalized === "HEALTH") return VerificationType.HEALTH;
    if (normalized === "CRIMINAL_RECORD") return VerificationType.CRIMINAL_RECORD;

    throw new BadRequestException("INVALID_TYPE");
  }

  private parseReportStatus(status?: string): ReportStatus | undefined {
    if (!status) {
      return undefined;
    }

    const normalized = status.toUpperCase();
    if (normalized === "OPEN") return ReportStatus.OPEN;
    if (normalized === "REVIEWING") return ReportStatus.REVIEWING;
    if (normalized === "RESOLVED") return ReportStatus.RESOLVED;
    if (normalized === "DISMISSED") return ReportStatus.DISMISSED;

    throw new BadRequestException("INVALID_STATUS");
  }

  private userUpdateForType(type: VerificationType, now: Date) {
    if (type === VerificationType.AGE) {
      return { ageVerifiedAt: now };
    }
    if (type === VerificationType.HEALTH) {
      return { healthVerifiedAt: now };
    }
    if (type === VerificationType.CRIMINAL_RECORD) {
      return { criminalRecordVerifiedAt: now };
    }
    return null;
  }

  private async resolveTargetUserId(report: {
    targetType: string;
    targetId: string;
    reporterId: string;
  }) {
    if (report.targetType === "user") {
      return report.targetId;
    }

    if (report.targetType === "message") {
      const message = await this.prisma.message.findUnique({
        where: { id: report.targetId },
        select: { senderId: true }
      });
      if (!message) {
        throw new BadRequestException("TARGET_NOT_FOUND");
      }
      return message.senderId;
    }

    if (report.targetType === "match") {
      const match = await this.prisma.match.findUnique({
        where: { id: report.targetId },
        select: { user1Id: true, user2Id: true }
      });
      if (!match) {
        throw new BadRequestException("TARGET_NOT_FOUND");
      }
      if (match.user1Id === report.reporterId) {
        return match.user2Id;
      }
      if (match.user2Id === report.reporterId) {
        return match.user1Id;
      }
      throw new BadRequestException("REPORTER_NOT_IN_MATCH");
    }

    throw new BadRequestException("INVALID_TARGET_TYPE");
  }

  private safeDecrypt(payload: string) {
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return "";
    }
  }
}
