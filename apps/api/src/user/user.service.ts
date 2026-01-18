import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";
import { STORAGE_DIR } from "../uploads/uploads.constants";
import { ReportUserDto } from "./dto/report-user.dto";
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
        bio: true,
        language: true,
        city: true,
        gender: true,
        dob: true,
        country: true,
        createdAt: true,
        preference: {
          select: {
            gender: true,
            lookingForGender: true,
            smPreference: true,
            tagsJson: true,
            vibeTagsJson: true,
            interestsJson: true,
            allowStrangerPrivate: true
          }
        }
      }
    });

    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    const vibeTags =
      this.normalizeTags(user.preference?.vibeTagsJson) ??
      this.normalizeTags(user.preference?.tagsJson);
    const interests = this.normalizeTags(user.preference?.interestsJson);
    const profileCompleted =
      Boolean(user.maskName?.trim()) &&
      Boolean(user.bio?.trim()) &&
      (vibeTags?.length ?? 0) > 0;

    return {
      ...user,
      preference: user.preference
        ? {
            ...user.preference,
            vibeTags,
            interests
          }
        : null,
      profileCompleted
    };
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
      bio?: string | null;
      language?: string | null;
      city?: string | null;
      gender?: string | null;
      dob?: Date | null;
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

    if (dto.bio !== undefined) {
      const trimmed = dto.bio.trim();
      data.bio = trimmed.length > 0 ? trimmed : null;
    }

    if (dto.language !== undefined) {
      const trimmed = dto.language.trim();
      data.language = trimmed.length > 0 ? trimmed : null;
    }

    if (dto.city !== undefined) {
      const trimmed = dto.city.trim();
      data.city = trimmed.length > 0 ? trimmed : null;
    }

    if (dto.gender !== undefined) {
      const trimmed = dto.gender.trim();
      data.gender = trimmed.length > 0 ? trimmed : null;
    }

    if (dto.dob !== undefined) {
      const trimmed = dto.dob.trim();
      if (!trimmed) {
        data.dob = null;
      } else {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException("INVALID_DOB");
        }
        data.dob = parsed;
      }
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
        bio: true,
        language: true,
        city: true,
        gender: true,
        dob: true,
        country: true,
        createdAt: true,
        preference: {
          select: {
            gender: true,
            lookingForGender: true,
            smPreference: true,
            tagsJson: true,
            vibeTagsJson: true,
            interestsJson: true,
            allowStrangerPrivate: true
          }
        }
      }
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.preference.findUnique({
      where: { userId }
    });
  }

  async upsertPreferences(userId: string, dto: UpdatePreferencesDto) {
    const vibeTags = dto.vibeTagsJson ?? dto.tagsJson ?? [];
    const payload = {
      gender: dto.gender ?? null,
      lookingForGender: dto.lookingForGender ?? null,
      smPreference: dto.smPreference ?? null,
      tagsJson: vibeTags,
      vibeTagsJson: vibeTags,
      interestsJson: dto.interestsJson ?? []
    };

    return this.prisma.preference.upsert({
      where: { userId },
      create: {
        userId,
        ...payload,
        ...(dto.allowStrangerPrivate !== undefined
          ? { allowStrangerPrivate: dto.allowStrangerPrivate }
          : {})
      },
      update: {
        ...payload,
        ...(dto.allowStrangerPrivate !== undefined
          ? { allowStrangerPrivate: dto.allowStrangerPrivate }
          : {})
      }
    });
  }

  async getPublicProfile(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      return this.getMe(userId);
    }
    const profile = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        status: true,
        maskName: true,
        maskAvatarUrl: true,
        bio: true,
        language: true,
        city: true,
        gender: true,
        preference: {
          select: {
            tagsJson: true,
            vibeTagsJson: true,
            interestsJson: true,
            allowStrangerPrivate: true
          }
        }
      }
    });

    if (!profile) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    const vibeTags =
      this.normalizeTags(profile.preference?.vibeTagsJson) ??
      this.normalizeTags(profile.preference?.tagsJson);
    const interests = this.normalizeTags(profile.preference?.interestsJson);

    return {
      ...profile,
      preference: profile.preference
        ? {
            ...profile.preference,
            vibeTags,
            interests
          }
        : null
    };
  }

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException("CANNOT_BLOCK_SELF");
    }
    await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: targetUserId
        }
      },
      create: {
        blockerId: userId,
        blockedId: targetUserId
      },
      update: {}
    });
    return { ok: true };
  }

  async unblockUser(userId: string, targetUserId: string) {
    await this.prisma.userBlock.deleteMany({
      where: {
        blockerId: userId,
        blockedId: targetUserId
      }
    });
    return { ok: true };
  }

  async reportUser(userId: string, targetUserId: string, dto: ReportUserDto) {
    if (userId === targetUserId) {
      throw new BadRequestException("CANNOT_REPORT_SELF");
    }
    await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: "USER",
        targetId: targetUserId,
        reasonType: dto.reasonType,
        detail: dto.detail ?? null
      }
    });
    return { ok: true };
  }

  private normalizeTags(payload: unknown): string[] | null {
    if (!Array.isArray(payload)) {
      return null;
    }
    const filtered = payload.filter(
      (tag) => typeof tag === "string" && tag.trim().length > 0
    ) as string[];
    return filtered.length > 0 ? filtered : null;
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
