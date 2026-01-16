import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Prisma, SwipeAction } from "@prisma/client";
import { PrismaService } from "../prisma.service";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CANDIDATE_MULTIPLIER = 3;
const COOLDOWN_HOURS = 24;

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(userId: string, cursor?: string, limit?: number) {
    const profile = await this.ensureEligible(userId);
    const lookingFor = profile.preference?.lookingForGender?.trim();
    const ownGender = profile.preference?.gender?.trim();

    if (!lookingFor || !ownGender) {
      return { items: [], nextCursor: null };
    }

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        role: { not: "OFFICIAL" },
        swipesReceived: {
          none: {
            fromUserId: userId
          }
        },
        exposuresAsTarget: {
          none: {
            viewerId: userId,
            lastShownAt: { gte: cutoff }
          }
        },
        preference: {
          gender: lookingFor,
          lookingForGender: ownGender
        }
      },
      select: {
        id: true,
        maskName: true,
        maskAvatarUrl: true,
        country: true,
        updatedAt: true,
        preference: {
          select: {
            gender: true,
            lookingForGender: true,
            smPreference: true,
            tagsJson: true
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(take * CANDIDATE_MULTIPLIER, MAX_LIMIT),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const scored = this.rankCandidates(
      candidates,
      profile.preference?.tagsJson ?? [],
      profile.country ?? null
    );
    const items = scored.slice(0, take);
    const nextCursor =
      candidates.length === Math.min(take * CANDIDATE_MULTIPLIER, MAX_LIMIT) &&
      items.length === take
        ? items[items.length - 1].id
        : null;

    if (items.length > 0) {
      await this.prisma.$transaction(
        items.map((item) =>
          this.prisma.recommendationExposure.upsert({
            where: {
              viewerId_targetId: {
                viewerId: userId,
                targetId: item.id
              }
            },
            create: {
              viewerId: userId,
              targetId: item.id,
              lastShownAt: new Date()
            },
            update: {
              lastShownAt: new Date()
            }
          })
        )
      );
    }

    return { items, nextCursor };
  }

  async swipe(userId: string, toUserId: string, action: SwipeAction) {
    if (userId === toUserId) {
      throw new BadRequestException("CANNOT_SWIPE_SELF");
    }

    await this.ensureEligible(userId);

    if (action === SwipeAction.LIKE) {
      const target = await this.prisma.user.findUnique({
        where: { id: toUserId },
        select: { role: true }
      });

      if (!target) {
        throw new BadRequestException("USER_NOT_FOUND");
      }

      if (target.role === "OFFICIAL") {
        throw new ForbiddenException("OFFICIAL_NO_PRIVATE");
      }
    }

    const swipe = await this.prisma.swipe.upsert({
      where: {
        fromUserId_toUserId: {
          fromUserId: userId,
          toUserId
        }
      },
      create: {
        fromUserId: userId,
        toUserId,
        action
      },
      update: {
        action
      }
    });

    let matchCreated = false;

    if (action === SwipeAction.LIKE) {
      const reverse = await this.prisma.swipe.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: toUserId,
            toUserId: userId
          }
        }
      });

      if (reverse?.action === SwipeAction.LIKE) {
        const [user1Id, user2Id] = this.normalizePair(userId, toUserId);
        let matchId: string | null = null;
        try {
          const match = await this.prisma.match.create({
            data: {
              user1Id,
              user2Id
            }
          });
          matchId = match.id;
        } catch (error) {
          if (
            !(
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            )
          ) {
            throw error;
          }
        }

        if (!matchId) {
          const existing = await this.prisma.match.findUnique({
            where: { user1Id_user2Id: { user1Id, user2Id } }
          });
          matchId = existing?.id ?? null;
        }

        if (matchId) {
          await this.ensureConversation(matchId, user1Id, user2Id);
        }

        matchCreated = true;
      }
    }

    return { swipe, matchCreated };
  }

  async listMatches(userId: string, cursor?: string, limit?: number) {
    await this.ensureEligible(userId);

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }]
      },
      include: {
        user1: { select: { id: true, maskName: true, maskAvatarUrl: true } },
        user2: { select: { id: true, maskName: true, maskAvatarUrl: true } }
      },
      orderBy: [{ matchedAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const nextCursor =
      matches.length === take ? matches[matches.length - 1].id : null;

    return { items: matches, nextCursor };
  }

  private normalizePair(userA: string, userB: string): [string, string] {
    return userA < userB ? [userA, userB] : [userB, userA];
  }

  private async ensureEligible(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerifiedAt: true,
        ageVerifiedAt: true,
        healthVerifiedAt: true,
        country: true,
        status: true,
        preference: {
          select: {
            gender: true,
            lookingForGender: true,
            tagsJson: true
          }
        }
      }
    });

    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException("EMAIL_NOT_VERIFIED");
    }

    if (user.status === "BANNED") {
      throw new ForbiddenException("USER_BANNED");
    }

    if (!user.ageVerifiedAt) {
      throw new ForbiddenException("AGE_NOT_VERIFIED");
    }

    if (!user.healthVerifiedAt) {
      throw new ForbiddenException("HEALTH_NOT_VERIFIED");
    }

    return user;
  }

  private rankCandidates(
    candidates: Array<{
      id: string;
      maskName: string | null;
      maskAvatarUrl: string | null;
      country: string | null;
      updatedAt: Date;
      preference: {
        gender: string | null;
        lookingForGender: string | null;
        smPreference: string | null;
        tagsJson: Prisma.JsonValue | null;
      } | null;
    }>,
    userTags: unknown,
    userCountry: string | null
  ) {
    const normalizedTags = Array.isArray(userTags)
      ? userTags.map((tag) => String(tag).toLowerCase())
      : [];
    const tagSet = new Set(normalizedTags);

    return candidates
      .map((candidate) => {
        const candidateTags = Array.isArray(candidate.preference?.tagsJson)
          ? candidate.preference?.tagsJson
          : [];
        let overlap = 0;
        for (const tag of candidateTags) {
          if (tagSet.has(String(tag).toLowerCase())) {
            overlap += 1;
          }
        }

        const hasAvatar = candidate.maskAvatarUrl ? 1 : 0;
        const sameCountry =
          userCountry && candidate.country === userCountry ? 1 : 0;

        return {
          candidate,
          score: overlap * 2 + hasAvatar + sameCountry
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime();
      })
      .map((item) => item.candidate);
  }

  private async ensureConversation(matchId: string, user1Id: string, user2Id: string) {
    const conversation = await this.prisma.conversation.upsert({
      where: { matchId },
      update: {},
      create: {
        matchId
      }
    });

    await this.prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: user1Id
        }
      },
      update: {},
      create: {
        conversationId: conversation.id,
        userId: user1Id,
        isMuted: false
      }
    });

    await this.prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: user2Id
        }
      },
      update: {},
      create: {
        conversationId: conversation.id,
        userId: user2Id,
        isMuted: false
      }
    });
  }
}
