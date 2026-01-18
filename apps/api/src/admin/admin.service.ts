import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException
} from "@nestjs/common";
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
export class AdminService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService
  ) {}

  async onModuleInit() {
    await this.bootstrapAdminUser();
  }

  async adminLogin(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    const matchesBootstrap =
      Boolean(bootstrapEmail && bootstrapPassword) &&
      email === bootstrapEmail &&
      dto.password === bootstrapPassword;

    let admin = await this.prisma.adminUser.findUnique({
      where: { email }
    });

    if (!admin && matchesBootstrap && bootstrapPassword) {
      admin = await this.prisma.adminUser.create({
        data: {
          email,
          passwordHash: await argon2.hash(bootstrapPassword),
          name: "Admin"
        }
      });
    }

    if (!admin) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }

    if (matchesBootstrap && bootstrapPassword) {
      await this.prisma.adminUser.update({
        where: { email },
        data: { passwordHash: await argon2.hash(bootstrapPassword) }
      });
    } else {
      const passwordOk = await argon2.verify(admin.passwordHash, dto.password);
      if (!passwordOk) {
        throw new UnauthorizedException("INVALID_CREDENTIALS");
      }
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

  async listUsers(
    role: string,
    filters: {
      country?: string;
      gender?: string;
      status?: string;
      search?: string;
      activeWithinDays?: string;
    }
  ) {
    this.ensureAdmin(role);

    const where: Prisma.UserWhereInput = {};
    if (filters.country && filters.country !== "ALL") {
      where.country = filters.country;
    }
    if (filters.gender && filters.gender !== "ALL") {
      where.gender = filters.gender;
    }
    if (filters.status && filters.status !== "ALL") {
      where.status = filters.status as Prisma.UserWhereInput["status"];
    }
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: "insensitive" } },
        { maskName: { contains: filters.search, mode: "insensitive" } }
      ];
    }
    if (filters.activeWithinDays) {
      const days = Number(filters.activeWithinDays);
      if (!Number.isNaN(days) && days > 0) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        where.updatedAt = { gte: since };
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        maskName: true,
        maskAvatarUrl: true,
        country: true,
        gender: true,
        dob: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        _count: {
          select: {
            traces: true,
            createdRooms: true,
            conversationParticipants: true
          }
        }
      }
    });

    return users.map((user) => ({
      ...user,
      membershipStatus: "FREE",
      postsCount: user._count.traces,
      roomsCount: user._count.createdRooms,
      privateChatsCount: user._count.conversationParticipants,
      _count: undefined
    }));
  }

  async getUserDetail(role: string, userId: string) {
    this.ensureAdmin(role);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preference: true,
        verifications: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            reviewedAt: true
          }
        },
        _count: {
          select: {
            traces: true,
            createdRooms: true,
            conversationParticipants: true,
            messagesSent: true
          }
        }
      }
    });

    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    const reportsCount = await this.prisma.report.count({
      where: { reportedUserId: userId }
    });

    return {
      id: user.id,
      email: user.email,
      maskName: user.maskName,
      maskAvatarUrl: user.maskAvatarUrl,
      bio: user.bio,
      country: user.country,
      gender: user.gender,
      dob: user.dob,
      language: user.language,
      city: user.city,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      membershipStatus: "FREE",
      verifications: user.verifications,
      preference: user.preference,
      reportsCount,
      postsCount: user._count.traces,
      roomsCount: user._count.createdRooms,
      privateChatsCount: user._count.conversationParticipants,
      messagesSentCount: user._count.messagesSent
    };
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

  private async bootstrapAdminUser() {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    const force =
      process.env.ADMIN_BOOTSTRAP_FORCE === "true" ||
      process.env.ADMIN_BOOTSTRAP_FORCE === "1";

    if (!email || !password) {
      return;
    }

    const existing = await this.prisma.adminUser.findUnique({
      where: { email }
    });
    const passwordHash = await argon2.hash(password);

    if (!existing) {
      await this.prisma.adminUser.create({
        data: { email, passwordHash, name: "Admin" }
      });
      return;
    }

    if (force) {
      await this.prisma.adminUser.update({
        where: { email },
        data: { passwordHash }
      });
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
