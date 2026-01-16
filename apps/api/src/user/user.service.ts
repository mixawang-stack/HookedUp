import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";
import { STORAGE_DIR } from "../uploads/uploads.constants";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { generateMaskName } from "./user.utils";

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        maskName: true,
        maskAvatarUrl: true,
        gender: true,
        dob: true,
        country: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { maskName: true }
    });

    if (!existing) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    const data: {
      maskName?: string;
      maskAvatarUrl?: string | null;
      gender?: string | null;
    } = {};

    if (dto.maskName !== undefined) {
      const trimmed = dto.maskName.trim();
      data.maskName = trimmed.length > 0 ? trimmed : generateMaskName();
    } else if (!existing.maskName) {
      data.maskName = generateMaskName();
    }

    if (dto.maskAvatarUrl !== undefined) {
      const trimmed = dto.maskAvatarUrl.trim();
      data.maskAvatarUrl = trimmed.length > 0 ? trimmed : null;
    }

    if (dto.gender !== undefined) {
      const trimmed = dto.gender.trim();
      data.gender = trimmed.length > 0 ? trimmed : null;
    }

    if (Object.keys(data).length === 0) {
      return this.getMe(userId);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        maskName: true,
        maskAvatarUrl: true,
        gender: true,
        dob: true,
        country: true,
        createdAt: true
      }
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.preference.findUnique({
      where: { userId }
    });
  }

  async upsertPreferences(userId: string, dto: UpdatePreferencesDto) {
    const payload = {
      gender: dto.gender ?? null,
      lookingForGender: dto.lookingForGender ?? null,
      smPreference: dto.smPreference ?? null,
      tagsJson: dto.tagsJson ?? []
    };

    return this.prisma.preference.upsert({
      where: { userId },
      create: {
        userId,
        ...payload
      },
      update: payload
    });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    const [
      preference,
      verifications,
      swipesSent,
      swipesReceived,
      matches,
      messagesSent,
      reports,
      consents
    ] = await Promise.all([
      this.prisma.preference.findUnique({ where: { userId } }),
      this.prisma.verification.findMany({ where: { userId } }),
      this.prisma.swipe.findMany({ where: { fromUserId: userId } }),
      this.prisma.swipe.findMany({ where: { toUserId: userId } }),
      this.prisma.match.findMany({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] }
      }),
      this.prisma.message.findMany({ where: { senderId: userId } }),
      this.prisma.report.findMany({ where: { reporterId: userId } }),
      this.prisma.consentRecord.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }]
        }
      })
    ]);

    await this.audit.log({
      actorId: userId,
      action: "GDPR_EXPORT",
      targetType: "User",
      targetId: userId
    });

    const decryptedMessages = messagesSent.map((message) => ({
      ...message,
      ciphertext: this.safeDecrypt(message.ciphertext)
    }));

    const redactedSwipesSent = swipesSent.map((swipe) => ({
      id: swipe.id,
      action: swipe.action,
      createdAt: swipe.createdAt
    }));

    const redactedSwipesReceived = swipesReceived.map((swipe) => ({
      id: swipe.id,
      action: swipe.action,
      createdAt: swipe.createdAt
    }));

    const redactedMatches = matches.map((match) => ({
      id: match.id,
      matchedAt: match.matchedAt
    }));

    return {
      user,
      preference,
      verifications,
      swipesSent: redactedSwipesSent,
      swipesReceived: redactedSwipesReceived,
      matches: redactedMatches,
      messagesSent: decryptedMessages,
      reports,
      consents
    };
  }

  async deleteMe(userId: string) {
    const now = new Date();
    const anonymizedEmail = `deleted-${userId}@example.invalid`;

    const verificationFiles = await this.prisma.verification.findMany({
      where: { userId },
      select: { fileKey: true }
    });

    await Promise.all(
      verificationFiles
        .map((file) => file.fileKey)
        .filter((fileKey): fileKey is string => Boolean(fileKey))
        .map(async (fileKey) => {
          const filePath = path.join(STORAGE_DIR, fileKey);
          try {
            await fs.unlink(filePath);
          } catch {
            return;
          }
        })
    );

    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.emailVerificationToken.deleteMany({ where: { userId } }),
      this.prisma.message.updateMany({
        where: { senderId: userId },
        data: { ciphertext: "", deletedAt: now }
      }),
      this.prisma.verification.updateMany({
        where: { userId },
        data: { fileKey: null, fileHash: null, metadataJson: Prisma.JsonNull }
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: "DELETED",
          email: anonymizedEmail,
          passwordHash: "",
          maskName: null,
          maskAvatarUrl: null
        }
      })
    ]);

    await this.audit.log({
      actorId: userId,
      action: "GDPR_DELETE",
      targetType: "User",
      targetId: userId
    });

    return { ok: true };
  }

  private safeDecrypt(payload: string) {
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return "";
    }
  }
}
