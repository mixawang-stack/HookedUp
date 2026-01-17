import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { ChatService } from "../chat/chat.service";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

@Injectable()
export class PrivateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly crypto: CryptoService
  ) {}

  async listConversations(userId: string, cursor?: string, limit?: number) {
    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      include: {
        match: {
          include: {
            user1: { select: { id: true, maskName: true, maskAvatarUrl: true } },
            user2: { select: { id: true, maskName: true, maskAvatarUrl: true } }
          }
        },
        participants: {
          where: { userId },
          select: { isMuted: true, mutedAt: true, lastSeenAt: true }
        },
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = conversation.participants[0];
        const otherUser = await this.resolveOtherUser(conversation, userId);
        const unreadCount = conversation.matchId
          ? await this.prisma.message.count({
              where: {
                matchId: conversation.matchId,
                senderId: { not: userId },
                ...(participant?.lastSeenAt
                  ? { createdAt: { gt: participant.lastSeenAt } }
                  : {})
              }
            })
          : 0;
        return {
          id: conversation.id,
          matchId: conversation.matchId,
          otherUser,
          isMuted: participant?.isMuted ?? false,
          mutedAt: participant?.mutedAt ?? null,
          unreadCount
        };
      })
    );

    const nextCursor =
      conversations.length === take ? conversations[conversations.length - 1].id : null;

    return { items, nextCursor };
  }

  async listMessages(userId: string, conversationId: string, cursor?: string, limit?: number) {
    const conversation = await this.getConversationForUser(userId, conversationId);

    const messages = await this.chatService.listMessages(
      userId,
      conversation.matchId,
      cursor,
      limit
    );

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      },
      data: {
        lastSeenAt: new Date()
      }
    });

    return {
      ...messages,
      isMuted: conversation.participant.isMuted
    };
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    const conversation = await this.getConversationForUser(userId, conversationId);

    await this.ensureReplyGate(userId, conversation.matchId);

    const message = await this.chatService.createMessage(
      userId,
      conversation.matchId,
      content
    );

    return {
      ...message,
      ciphertext: this.safeDecrypt(message.ciphertext)
    };
  }

  async startConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException("CANNOT_MESSAGE_SELF");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true }
    });

    if (!target) {
      throw new BadRequestException("USER_NOT_FOUND");
    }

    if (target.role === Role.OFFICIAL) {
      throw new ForbiddenException("OFFICIAL_NO_PRIVATE");
    }

    const [user1Id, user2Id] = this.normalizePair(userId, targetUserId);
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

    if (!matchId) {
      throw new BadRequestException("MATCH_NOT_FOUND");
    }

    const conversation = await this.ensureConversation(matchId, user1Id, user2Id);
    return { conversationId: conversation.id };
  }

  async muteConversation(userId: string, conversationId: string) {
    const membership = await this.ensureParticipant(userId, conversationId);

    return this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      },
      data: {
        isMuted: true,
        mutedAt: new Date()
      }
    });
  }

  async unmuteConversation(userId: string, conversationId: string) {
    const membership = await this.ensureParticipant(userId, conversationId);

    return this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      },
      data: {
        isMuted: false,
        mutedAt: null
      }
    });
  }

  private async getConversationForUser(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: { userId },
          select: { userId: true, isMuted: true }
        }
      }
    });

    if (!conversation || !conversation.matchId) {
      throw new BadRequestException("CONVERSATION_NOT_FOUND");
    }

    const participant = conversation.participants[0];
    if (!participant) {
      throw new ForbiddenException("NOT_CONVERSATION_MEMBER");
    }

    return { matchId: conversation.matchId, participant };
  }

  private async ensureParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      }
    });

    if (!participant) {
      throw new BadRequestException("CONVERSATION_NOT_FOUND");
    }

    return participant;
  }

  private normalizePair(userA: string, userB: string): [string, string] {
    return userA < userB ? [userA, userB] : [userB, userA];
  }

  private async ensureConversation(matchId: string, user1Id: string, user2Id: string) {
    const conversation = await this.prisma.conversation.upsert({
      where: { matchId },
      update: {},
      create: { matchId }
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

    return conversation;
  }

  private async ensureReplyGate(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true }
    });

    if (!match) {
      throw new BadRequestException("MATCH_NOT_FOUND");
    }

    const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;

    const otherReplied = await this.prisma.message.findFirst({
      where: {
        matchId,
        senderId: otherUserId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (otherReplied) {
      return;
    }

    const sentCount = await this.prisma.message.count({
      where: {
        matchId,
        senderId: userId,
        deletedAt: null
      }
    });

    if (sentCount >= 3) {
      throw new ForbiddenException("PRIVATE_REPLY_REQUIRED");
    }
  }

  private async resolveOtherUser(
    conversation: {
      matchId: string | null;
      match?: {
        user1Id: string;
        user1: { id: string; maskName: string | null; maskAvatarUrl: string | null };
        user2: { id: string; maskName: string | null; maskAvatarUrl: string | null };
      } | null;
    },
    userId: string
  ) {
    if (conversation.match) {
      return conversation.match.user1Id === userId
        ? conversation.match.user2
        : conversation.match.user1;
    }

    return null;
  }

  private safeDecrypt(payload: string) {
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return "";
    }
  }
}
