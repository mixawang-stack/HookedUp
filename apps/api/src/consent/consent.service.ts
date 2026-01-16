import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CONSENT_TERMS_VERSION } from "./consent.constants";
import { hashConsentPayload } from "./consent.utils";

export type ConsentStatus = "pending" | "completed";

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async initConsent(userId: string, matchId: string) {
    const match = await this.ensureMatchMember(userId, matchId);
    const { userAId, userBId } = this.normalizePair(match.user1Id, match.user2Id);

    const existing = await this.prisma.consentRecord.findUnique({
      where: {
        matchId_userAId_userBId: {
          matchId,
          userAId,
          userBId
        }
      }
    });

    if (existing) {
      return this.decorate(existing);
    }

    const payload = {
      matchId,
      userAId,
      userBId,
      termsVersion: CONSENT_TERMS_VERSION,
      confirmedAtA: null,
      confirmedAtB: null
    };

    const created = await this.prisma.consentRecord.create({
      data: {
        matchId,
        userAId,
        userBId,
        termsVersion: CONSENT_TERMS_VERSION,
        hash: hashConsentPayload(payload)
      }
    });

    return this.decorate(created);
  }

  async confirmConsent(userId: string, matchId: string) {
    const match = await this.ensureMatchMember(userId, matchId);
    const { userAId, userBId } = this.normalizePair(match.user1Id, match.user2Id);

    const record = await this.prisma.consentRecord.findUnique({
      where: {
        matchId_userAId_userBId: {
          matchId,
          userAId,
          userBId
        }
      }
    });

    if (!record) {
      throw new BadRequestException("CONSENT_NOT_INITIALIZED");
    }

    const now = new Date();
    const updateData: { confirmedAtA?: Date; confirmedAtB?: Date } = {};

    if (userId === userAId) {
      updateData.confirmedAtA = record.confirmedAtA ?? now;
    } else if (userId === userBId) {
      updateData.confirmedAtB = record.confirmedAtB ?? now;
    } else {
      throw new ForbiddenException("NOT_MATCH_MEMBER");
    }

    const updated = await this.prisma.consentRecord.update({
      where: { id: record.id },
      data: updateData
    });

    const payload = {
      matchId,
      userAId,
      userBId,
      termsVersion: updated.termsVersion,
      confirmedAtA: updated.confirmedAtA?.toISOString() ?? null,
      confirmedAtB: updated.confirmedAtB?.toISOString() ?? null
    };

    const hash = hashConsentPayload(payload);

    const finalRecord = await this.prisma.consentRecord.update({
      where: { id: updated.id },
      data: { hash }
    });

    return this.decorate(finalRecord);
  }

  async getConsent(userId: string, matchId: string) {
    const match = await this.ensureMatchMember(userId, matchId);
    const { userAId, userBId } = this.normalizePair(match.user1Id, match.user2Id);

    const record = await this.prisma.consentRecord.findUnique({
      where: {
        matchId_userAId_userBId: {
          matchId,
          userAId,
          userBId
        }
      }
    });

    if (!record) {
      return null;
    }

    return this.decorate(record);
  }

  private decorate(record: {
    confirmedAtA: Date | null;
    confirmedAtB: Date | null;
    [key: string]: unknown;
  }) {
    const status: ConsentStatus =
      record.confirmedAtA && record.confirmedAtB ? "completed" : "pending";
    return { ...record, status };
  }

  private normalizePair(user1Id: string, user2Id: string) {
    return user1Id < user2Id
      ? { userAId: user1Id, userBId: user2Id }
      : { userAId: user2Id, userBId: user1Id };
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

    return match;
  }
}
