import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { IntentStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

const TERMS_VERSION = "offline-v1";

type SafetyPack = {
  termsVersion: string;
  country: string;
  legalReminder: string[];
  safetyTips: string[];
  notice: string;
};

@Injectable()
export class IntentService {
  constructor(private readonly prisma: PrismaService) {}

  async requestOffline(userId: string, conversationId: string) {
    this.ensureIntentEnabled();
    const { conversation, member, otherParticipant } =
      await this.ensureConversationMember(userId, conversationId);

    const existing = await this.prisma.intentOffline.findUnique({
      where: { conversationId }
    });

    if (existing) {
      return this.decorateIntent(existing, userId, member.country);
    }

    const intent = await this.prisma.intentOffline.create({
      data: {
        conversationId: conversation.id,
        requesterId: userId,
        responderId: otherParticipant.id,
        status: IntentStatus.PENDING,
        termsVersion: TERMS_VERSION,
        requesterConfirmedAt: new Date()
      }
    });

    return this.decorateIntent(intent, userId, member.country);
  }

  async confirmOffline(userId: string, intentId: string) {
    this.ensureIntentEnabled();
    const intent = await this.prisma.intentOffline.findUnique({
      where: { id: intentId },
      include: {
        conversation: {
          include: {
            participants: {
              select: { userId: true, user: { select: { id: true, country: true } } }
            }
          }
        }
      }
    });

    if (!intent) {
      throw new BadRequestException("INTENT_NOT_FOUND");
    }

    const participant = intent.conversation.participants.find(
      (item) => item.userId === userId
    );
    if (!participant) {
      throw new ForbiddenException("NOT_CONVERSATION_MEMBER");
    }

    let updateData: {
      requesterConfirmedAt?: Date;
      responderConfirmedAt?: Date;
      status?: IntentStatus;
      confirmedAt?: Date;
    } = {};

    if (intent.requesterId === userId && !intent.requesterConfirmedAt) {
      updateData.requesterConfirmedAt = new Date();
    }

    if (intent.responderId === userId && !intent.responderConfirmedAt) {
      updateData.responderConfirmedAt = new Date();
    }

    const nextRequesterConfirmedAt =
      updateData.requesterConfirmedAt ?? intent.requesterConfirmedAt;
    const nextResponderConfirmedAt =
      updateData.responderConfirmedAt ?? intent.responderConfirmedAt;

    if (nextRequesterConfirmedAt && nextResponderConfirmedAt) {
      updateData = {
        ...updateData,
        status: IntentStatus.CONFIRMED,
        confirmedAt: intent.confirmedAt ?? new Date()
      };
    }

    const updated =
      Object.keys(updateData).length > 0
        ? await this.prisma.intentOffline.update({
            where: { id: intent.id },
            data: updateData
          })
        : intent;

    return this.decorateIntent(
      updated,
      userId,
      participant.user.country ?? null
    );
  }

  private async ensureConversationMember(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, country: true } }
          }
        }
      }
    });

    if (!conversation) {
      throw new BadRequestException("CONVERSATION_NOT_FOUND");
    }

    const member = conversation.participants.find((item) => item.userId === userId);
    if (!member) {
      throw new ForbiddenException("NOT_CONVERSATION_MEMBER");
    }

    const otherParticipant = conversation.participants.find(
      (item) => item.userId !== userId
    );

    if (!otherParticipant) {
      throw new BadRequestException("CONVERSATION_PARTNER_NOT_FOUND");
    }

    return {
      conversation,
      member: member.user,
      otherParticipant: otherParticipant.user
    };
  }

  private decorateIntent(
    intent: {
      id: string;
      conversationId: string;
      requesterId: string;
      responderId: string;
      status: IntentStatus;
      termsVersion: string;
      requestedAt: Date;
      requesterConfirmedAt: Date | null;
      responderConfirmedAt: Date | null;
      confirmedAt: Date | null;
    },
    viewerId: string,
    country: string | null
  ) {
    const safetyPack =
      intent.status === IntentStatus.CONFIRMED
        ? this.buildSafetyPack(country)
        : null;

    return {
      intent: {
        ...intent,
        requestedAt: intent.requestedAt.toISOString(),
        requesterConfirmedAt: intent.requesterConfirmedAt
          ? intent.requesterConfirmedAt.toISOString()
          : null,
        responderConfirmedAt: intent.responderConfirmedAt
          ? intent.responderConfirmedAt.toISOString()
          : null,
        confirmedAt: intent.confirmedAt ? intent.confirmedAt.toISOString() : null,
        viewerId
      },
      safetyPack
    };
  }

  private buildSafetyPack(country: string | null): SafetyPack {
    const countryLabel = (country ?? "").trim() || "GLOBAL";
    const legalReminder = [
      "遵守你所在地区的法律与年龄限制。",
      "任何形式的胁迫或强迫都是不可接受的。"
    ];

    return {
      termsVersion: TERMS_VERSION,
      country: countryLabel,
      legalReminder,
      safetyTips: [
        "明确边界：开始前就说明各自可接受与不可接受的内容。",
        "可撤回：任何时刻都可以暂停或改变主意。",
        "保护措施：做好健康与避孕的基本准备。"
      ],
      notice:
        "平台不记录细节内容，仅保留触发与确认时间。请务必保护个人安全。"
    };
  }

  private ensureIntentEnabled() {
    const enabled = (process.env.FF_INTENT_12 ?? "false").toLowerCase() === "true";
    if (!enabled) {
      throw new ForbiddenException("INTENT_DISABLED");
    }
  }
}
