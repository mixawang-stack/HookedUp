import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService
  ) {}

  async ensureMatchMember(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true }
    });

    if (!match) {
      throw new NotFoundException("MATCH_NOT_FOUND");
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new ForbiddenException("NOT_MATCH_MEMBER");
    }

    return match;
  }

  async ensureCanCommunicate(userId: string, matchId: string) {
    await this.ensureNotMuted(userId);
    return this.ensureMatchMember(userId, matchId);
  }

  async listMessages(
    userId: string,
    matchId: string,
    cursor?: string,
    limit?: number
  ) {
    await this.ensureMatchMember(userId, matchId);

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const messages = await this.prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: {
          select: {
            id: true,
            maskName: true,
            maskAvatarUrl: true
          }
        }
      }
    });

    const items = messages.map((message) => ({
      ...message,
      ciphertext: this.safeDecrypt(message.ciphertext)
    }));

    const nextCursor =
      messages.length === take ? messages[messages.length - 1].id : null;

    return { items, nextCursor };
  }

  async createMessage(userId: string, matchId: string, ciphertext: string) {
    await this.ensureCanCommunicate(userId, matchId);

    return this.prisma.message.create({
      data: {
        matchId,
        senderId: userId,
        ciphertext: this.crypto.encrypt(ciphertext)
      },
      include: {
        sender: {
          select: {
            id: true,
            maskName: true,
            maskAvatarUrl: true
          }
        }
      }
    });
  }

  private async ensureNotMuted(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true }
    });

    if (!user) {
      throw new NotFoundException("USER_NOT_FOUND");
    }

    if (user.status === "BANNED") {
      throw new ForbiddenException("USER_BANNED");
    }

    if (user.status === "SUSPENDED") {
      throw new ForbiddenException("USER_MUTED");
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
