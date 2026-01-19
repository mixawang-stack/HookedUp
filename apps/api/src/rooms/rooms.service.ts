import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma, RoomStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../audit.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { CreateRoomInviteDto } from "./dto/create-room-invite.dto";
import { CreateRoomShareLinkDto } from "./dto/create-room-share-link.dto";
import { DiceAskDto } from "./dto/dice-ask.dto";
import { DiceRespondDto } from "./dto/dice-respond.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { OneThingReactDto } from "./dto/one-thing-react.dto";
import { OneThingShareDto } from "./dto/one-thing-share.dto";
import { RoomGateway } from "./room.gateway";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SILENCE_DURATION_MS = 30_000;
const DICE_GAME_TYPE = "DICE";
const MASK_COLORS = ["#0ea5a2", "#f97316", "#2563eb", "#84cc16", "#e11d48"];
const TRACE_PENALTIES = [
  "System trace: the tempo softens for a moment. Adjust your pace.",
  "System trace: a gentle reminder to keep the room respectful.",
  "System trace: the lights dim briefly. Stay considerate."
];
const ONE_THING_EMOJIS = ["?", "??", "??", "??", "??", "??"];
const ROOM_GAME_TYPES = ["NONE", "DICE", "ONE_THING"] as const;
const DEFAULT_SHARE_EXPIRES_DAYS = 7;
const MAX_SHARE_EXPIRES_DAYS = 30;

type DicePenalty =
  | { type: "silence"; userId: string; until: string }
  | { type: "mask"; userId: string; maskColor: string }
  | { type: "trace"; userId: string; traceId: string };

type DiceState = {
  phase: "IDLE" | "AWAIT_QUESTION" | "AWAIT_RESPONSE";
  askerId: string | null;
  targetScope: "single" | "all" | null;
  targetId: string | null;
  question: string | null;
  answer: string | null;
  answeredBy: string | null;
  lastOutcome:
    | "answered"
    | "refused"
    | "skipped"
    | "silent_protected"
    | "observer"
    | null;
  lastPenalty: DicePenalty | null;
  lastActionAt: string | null;
  silences: Record<string, { until: string }>;
  maskColors: Record<string, string>;
  silentProtectedTargets: Record<string, { at: string }>;
};

type OneThingShare = {
  userId: string;
  content: string;
  createdAt: string;
};

type OneThingReaction = {
  userId: string;
  targetUserId: string;
  emoji: string;
  createdAt: string;
};

type OneThingState = {
  status: "IDLE" | "ACTIVE";
  startedAt: string | null;
  startedBy: string | null;
  shares: OneThingShare[];
  reactions: OneThingReaction[];
};

type RoomGameType = (typeof ROOM_GAME_TYPES)[number];

type SelectedGame = {
  type: RoomGameType | null;
  selectedAt: string | null;
  selectedBy: string | null;
};

type RoomGameState = {
  dice: DiceState;
  oneThing: OneThingState;
  selectedGame: SelectedGame;
};

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gateway: RoomGateway
  ) {}

  async createRoom(userId: string, role: string, dto: CreateRoomDto) {
    if (dto.capacity === null || dto.capacity === undefined || dto.capacity < 3) {
      throw new BadRequestException("CAPACITY_MIN_3");
    }
    const isOfficial = role === "OFFICIAL";
    if (isOfficial && !dto.status) {
      throw new BadRequestException("STATUS_REQUIRED");
    }

    const room = await this.prisma.room.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        tagsJson: (dto.tagsJson as any) ?? Prisma.JsonNull,
        status: isOfficial ? (dto.status as RoomStatus) : "LIVE",
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: isOfficial && dto.endsAt ? new Date(dto.endsAt) : null,
        createdById: userId,
        isOfficial,
        allowSpectators: dto.allowSpectators ?? true,
        capacity: dto.capacity
      }
    });

    const previousRoomIds = await this.findActiveRoomIdsToClose(userId, room.id);

    await this.prisma.$transaction([
      this.prisma.roomMembership.updateMany({
        where: {
          userId,
          leftAt: null,
          roomId: { not: room.id }
        },
        data: { leftAt: new Date() }
      }),
      this.prisma.roomMembership.upsert({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId
          }
        },
        create: {
          roomId: room.id,
          userId,
          role: "OWNER",
          mode: "PARTICIPANT",
          joinedAt: new Date(),
          leftAt: null
        },
        update: {
          role: "OWNER",
          mode: "PARTICIPANT",
          joinedAt: new Date(),
          leftAt: null
        }
      }),
      this.prisma.roomGameSelection.create({
        data: {
          roomId: room.id,
          selectedGame: "NONE",
          selectedAt: new Date(),
          selectedById: userId
        }
      })
      ]);

    if (previousRoomIds.length > 0) {
      await Promise.all(
        previousRoomIds.map((previousRoomId) =>
          this.gateway.emitMemberCount(previousRoomId)
        )
      );
    }

    if (isOfficial) {
      await this.audit.log({
        actorId: userId,
        action: "ROOM_CREATED",
        targetType: "Room",
        targetId: room.id,
        metaJson: {
          status: room.status,
          isOfficial: room.isOfficial
        }
      });
    }

    return {
      ...room,
      memberCount: 1
    };
  }

  async listRooms(
    cursor?: string,
    limit?: number,
    status?: string,
    tags?: string[],
    search?: string
  ) {
    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const where: Prisma.RoomWhereInput = {};
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      where.OR = [
        {
          title: { contains: normalizedSearch, mode: "insensitive" }
        },
        {
          description: { contains: normalizedSearch, mode: "insensitive" }
        }
      ];
    }

    // 取消仅显示官方房间的限制，允许显示所有房间
    // if (!this.isRooms08Enabled()) {
    //   where.isOfficial = true;
    // }

    if (status) {
      const normalized = status.toUpperCase();
      if (!["SCHEDULED", "LIVE", "ENDED"].includes(normalized)) {
        throw new BadRequestException("ROOM_STATUS_INVALID");
      }
      where.status = normalized as RoomStatus;
    }

    if (tags && tags.length > 0) {
      where.tagsJson = {
        array_contains: tags
      };
    }

    const rooms = await this.prisma.room.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        novel: {
          select: {
            id: true,
            title: true,
            coverImageUrl: true
          }
        }
      }
    });

    const roomIds = rooms.map((room) => room.id);
    const counts = roomIds.length
      ? await this.prisma.roomMembership.groupBy({
          by: ["roomId"],
          where: {
            roomId: { in: roomIds },
            leftAt: null
          },
          _count: true
        })
      : [];
    const countMap = new Map(
      counts.map((item) => [item.roomId, item._count])
    );

    const nextCursor = rooms.length === take ? rooms[rooms.length - 1].id : null;
    return {
      items: rooms.map((room) => ({
        ...room,
        memberCount: countMap.get(room.id) ?? 0
      })),
      nextCursor
    };
  }

  async getRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      throw new BadRequestException("ROOM_NOT_FOUND");
    }

    // 取消仅官方可见的限制
    // if (!this.isRooms08Enabled() && !room.isOfficial) {
    //   throw new BadRequestException("ROOM_NOT_FOUND");
    // }

    const [count, membership, selection] = await Promise.all([
      this.prisma.roomMembership.count({
        where: { roomId, leftAt: null }
      }),
      this.prisma.roomMembership.findFirst({
        where: { roomId, userId, leftAt: null },
        select: { role: true }
      }),
      this.prisma.roomGameSelection.findUnique({
        where: { roomId }
      })
    ]);

    return {
      ...room,
      memberCount: count,
      currentUserRole: membership?.role ?? null,
      selectedGame: selection
        ? {
            type: selection.selectedGame,
            selectedAt: selection.selectedAt,
            selectedById: selection.selectedById
          }
        : {
            type: "NONE",
            selectedAt: null,
            selectedById: null
          }
    };
  }

  async getActiveRoom(userId: string) {
    const membership = await this.prisma.roomMembership.findFirst({
      where: {
        userId,
        leftAt: null
      },
      include: {
        room: true
      },
      orderBy: {
        joinedAt: "desc"
      }
    });
    if (!membership?.room) {
      return { room: null };
    }
    const count = await this.prisma.roomMembership.count({
      where: {
        roomId: membership.roomId,
        leftAt: null
      }
    });
    return {
      room: {
        id: membership.room.id,
        title: membership.room.title,
        memberCount: count
      }
    };
  }
  async joinRoom(roomId: string, userId: string, dto: JoinRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      throw new BadRequestException("ROOM_NOT_FOUND");
    }

    // 取消仅官方可加入的限制
    // if (!this.isRooms08Enabled() && !room.isOfficial) {
    //   throw new BadRequestException("ROOM_NOT_FOUND");
    // }

    const mode = dto.mode ?? "PARTICIPANT";
    if (mode === "OBSERVER" && !room.allowSpectators) {
      throw new ForbiddenException("SPECTATORS_NOT_ALLOWED");
    }

    const existingMembership = await this.prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });
    if (existingMembership && !existingMembership.leftAt) {
      const previousRoomIds = await this.findActiveRoomIdsToClose(userId, roomId);
      if (previousRoomIds.length > 0) {
        await this.prisma.roomMembership.updateMany({
          where: {
            userId,
            leftAt: null,
            roomId: { not: roomId }
          },
          data: { leftAt: new Date() }
        });
        await Promise.all(
          previousRoomIds.map((previousRoomId) =>
            this.gateway.emitMemberCount(previousRoomId)
          )
        );
      }
      return existingMembership;
    }

    const activeCount = await this.prisma.roomMembership.count({
      where: {
        roomId,
        leftAt: null
      }
    });
    if (room.capacity !== null && activeCount >= room.capacity) {
      throw new ForbiddenException("ROOM_FULL");
    }

    const role = existingMembership?.role ?? "MEMBER";
    const previousRoomIds = await this.findActiveRoomIdsToClose(userId, roomId);
    const membership = await this.prisma.$transaction(async (tx) => {
      await tx.roomMembership.updateMany({
        where: {
          userId,
          leftAt: null,
          roomId: { not: roomId }
        },
        data: { leftAt: new Date() }
      });
      return tx.roomMembership.upsert({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        },
        create: {
          roomId,
          userId,
          role,
          mode,
          joinedAt: new Date(),
          leftAt: null
        },
        update: {
          role,
          mode,
          joinedAt: new Date(),
          leftAt: null
        }
      });
    });
    await this.gateway.emitMemberCount(roomId);
    await this.audit.log({
      actorId: userId,
      action: "ROOM_LEFT",
      targetType: "Room",
      targetId: roomId
    });
    if (previousRoomIds.length > 0) {
      await Promise.all(
        previousRoomIds.map((previousRoomId) =>
          this.gateway.emitMemberCount(previousRoomId)
        )
      );
    }
    await this.audit.log({
      actorId: userId,
      action: "ROOM_JOINED",
      targetType: "Room",
      targetId: roomId,
      metaJson: { mode }
    });
    return membership;
  }

  async leaveRoom(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });

    if (!membership) {
      throw new BadRequestException("ROOM_NOT_JOINED");
    }

    const updatedMembership = await this.prisma.roomMembership.update({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      },
      data: {
        leftAt: new Date()
      }
    });
    await this.gateway.emitMemberCount(roomId);
    return updatedMembership;
  }

  async getMemberCount(roomId: string) {
    await this.ensureRoom(roomId);
    const count = await this.prisma.roomMembership.count({
      where: { roomId, leftAt: null }
    });
    return { memberCount: count };
  }

  async listInviteCandidates(roomId: string, userId: string) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }

    const candidates = await this.getMutualConversationUsers(userId);
    if (candidates.size === 0) {
      return { items: [] };
    }

    const [memberships, pendingInvites] = await Promise.all([
      this.prisma.roomMembership.findMany({
        where: { roomId, leftAt: null },
        select: { userId: true }
      }),
      this.prisma.roomInvite.findMany({
        where: { roomId, status: "PENDING" },
        select: { inviteeId: true }
      })
    ]);

    const excluded = new Set<string>([
      ...memberships.map((item) => item.userId),
      ...pendingInvites.map((item) => item.inviteeId)
    ]);

    const items = Array.from(candidates.values()).filter(
      (candidate) => !excluded.has(candidate.userId)
    );

    return { items };
  }

  async createShareLink(roomId: string, userId: string, dto: CreateRoomShareLinkDto) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }

    const expiresInDays = Math.min(
      dto.expiresInDays ?? DEFAULT_SHARE_EXPIRES_DAYS,
      MAX_SHARE_EXPIRES_DAYS
    );
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = randomBytes(18).toString("hex");
      try {
        const link = await this.prisma.roomShareLink.create({
          data: {
            roomId,
            createdById: userId,
            token,
            expiresAt
          }
        });
        await this.audit.log({
          actorId: userId,
          action: "ROOM_SHARE_LINK_CREATED",
          targetType: "Room",
          targetId: roomId,
          metaJson: {
            shareUrlPath: `/r/${link.token}`,
            expiresAt: link.expiresAt
          }
        });
        return {
          shareUrlPath: `/r/${link.token}`,
          expiresAt: link.expiresAt
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException("SHARE_LINK_CREATE_FAILED");
  }

  async revokeShareLink(roomId: string, userId: string, linkId: string) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }
    const link = await this.prisma.roomShareLink.findUnique({
      where: { id: linkId }
    });
    if (!link || link.roomId !== roomId) {
      throw new BadRequestException("SHARE_LINK_NOT_FOUND");
    }
    if (link.revokedAt) {
      return { revoked: true };
    }
    const updated = await this.prisma.roomShareLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() }
    });
    await this.audit.log({
      actorId: userId,
      action: "ROOM_SHARE_LINK_REVOKED",
      targetType: "Room",
      targetId: roomId,
      metaJson: { linkId: updated.id }
    });
    return { revoked: true };
  }

  async resolveShareLink(token: string) {
    const link = await this.prisma.roomShareLink.findUnique({
      where: { token }
    });
    if (!link || link.revokedAt) {
      throw new BadRequestException("SHARE_LINK_INVALID");
    }
    if (link.expiresAt && link.expiresAt <= new Date()) {
      throw new BadRequestException("SHARE_LINK_EXPIRED");
    }
    return { roomId: link.roomId };
  }

  async createInvite(roomId: string, inviterId: string, dto: CreateRoomInviteDto) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== inviterId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }

    if (dto.inviteeId === inviterId) {
      throw new BadRequestException("INVITEE_INVALID");
    }

    const candidates = await this.getMutualConversationUsers(inviterId);
    if (!candidates.has(dto.inviteeId)) {
      throw new BadRequestException("INVITEE_NOT_ELIGIBLE");
    }

    const existingMembership = await this.prisma.roomMembership.findFirst({
      where: {
        roomId,
        userId: dto.inviteeId,
        leftAt: null
      }
    });
    if (existingMembership) {
      throw new BadRequestException("ALREADY_MEMBER");
    }

    const existingInvite = await this.prisma.roomInvite.findFirst({
      where: {
        roomId,
        inviteeId: dto.inviteeId,
        status: "PENDING"
      }
    });
    if (existingInvite) {
      return { id: existingInvite.id, status: existingInvite.status };
    }

      const invite = await this.prisma.roomInvite.create({
        data: {
          roomId,
          inviterId,
          inviteeId: dto.inviteeId,
          status: "PENDING"
        }
      });

      await this.audit.log({
        actorId: inviterId,
        action: "ROOM_INVITE_CREATED",
        targetType: "Room",
        targetId: roomId,
        metaJson: { inviteId: invite.id }
      });

      return { id: invite.id, status: invite.status };
    }

  async acceptInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.roomInvite.findUnique({
      where: { id: inviteId }
    });
    if (!invite) {
      throw new BadRequestException("INVITE_NOT_FOUND");
    }
    if (invite.inviteeId !== userId) {
      throw new ForbiddenException("INVITE_FORBIDDEN");
    }
    if (invite.status === "ACCEPTED") {
      return { status: invite.status, roomId: invite.roomId };
    }
    if (invite.status === "DECLINED" || invite.status === "CANCELED") {
      return { status: invite.status };
    }

    const room = await this.ensureRoom(invite.roomId);
    const existingMembership = await this.prisma.roomMembership.findFirst({
      where: {
        roomId: invite.roomId,
        userId,
        leftAt: null
      }
    });
    if (existingMembership) {
      const previousRoomIds = await this.findActiveRoomIdsToClose(
        userId,
        invite.roomId
      );
      if (previousRoomIds.length > 0) {
        await this.prisma.roomMembership.updateMany({
          where: {
            userId,
            leftAt: null,
            roomId: { not: invite.roomId }
          },
          data: { leftAt: new Date() }
        });
      }
      await this.prisma.roomInvite.update({
        where: { id: inviteId },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date()
        }
      });
      await this.gateway.emitMemberCount(invite.roomId);
      await this.audit.log({
        actorId: userId,
        action: "ROOM_INVITE_ACCEPTED",
        targetType: "Room",
        targetId: invite.roomId,
        metaJson: { inviteId: inviteId }
      });
      if (previousRoomIds.length > 0) {
        await Promise.all(
          previousRoomIds.map((previousRoomId) =>
            this.gateway.emitMemberCount(previousRoomId)
          )
        );
      }
      return { status: "ACCEPTED", roomId: invite.roomId };
    }

    const activeCount = await this.prisma.roomMembership.count({
      where: {
        roomId: invite.roomId,
        leftAt: null
      }
    });
    if (room.capacity !== null && activeCount >= room.capacity) {
      throw new ForbiddenException("ROOM_FULL");
    }

    const previousRoomIds = await this.findActiveRoomIdsToClose(
      userId,
      invite.roomId
    );
    await this.prisma.$transaction([
      this.prisma.roomMembership.updateMany({
        where: {
          userId,
          leftAt: null,
          roomId: { not: invite.roomId }
        },
        data: { leftAt: new Date() }
      }),
      this.prisma.roomInvite.update({
        where: { id: inviteId },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date()
        }
      }),
      this.prisma.roomMembership.upsert({
        where: {
          roomId_userId: {
            roomId: invite.roomId,
            userId
          }
        },
        create: {
          roomId: invite.roomId,
          userId,
          role: "MEMBER",
          mode: "PARTICIPANT",
          joinedAt: new Date(),
          leftAt: null
        },
        update: {
          role: "MEMBER",
          mode: "PARTICIPANT",
          joinedAt: new Date(),
          leftAt: null
        }
      })
    ]);

    await this.gateway.emitMemberCount(invite.roomId);
    await this.audit.log({
      actorId: userId,
      action: "ROOM_INVITE_ACCEPTED",
      targetType: "Room",
      targetId: invite.roomId,
      metaJson: { inviteId }
    });
    if (previousRoomIds.length > 0) {
      await Promise.all(
        previousRoomIds.map((previousRoomId) =>
          this.gateway.emitMemberCount(previousRoomId)
        )
      );
    }
    return { status: "ACCEPTED", roomId: invite.roomId };
  }

  async declineInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.roomInvite.findUnique({
      where: { id: inviteId }
    });
    if (!invite) {
      throw new BadRequestException("INVITE_NOT_FOUND");
    }
    if (invite.inviteeId !== userId) {
      throw new ForbiddenException("INVITE_FORBIDDEN");
    }
    if (invite.status !== "PENDING") {
      return { status: invite.status };
    }

    const updated = await this.prisma.roomInvite.update({
      where: { id: inviteId },
      data: {
        status: "DECLINED",
        respondedAt: new Date()
      }
    });
    return { status: updated.status };
  }

  async requestJoinRoom(roomId: string, userId: string) {
    const room = await this.ensureRoom(roomId);

    if (!this.isRooms08Enabled() && !room.isOfficial) {
      throw new BadRequestException("ROOM_NOT_FOUND");
    }

    const existingMembership = await this.prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });

    if (existingMembership && !existingMembership.leftAt) {
      return { status: "ALREADY_MEMBER" };
    }

    const activeCount = await this.prisma.roomMembership.count({
      where: {
        roomId,
        leftAt: null
      }
    });
    if (room.capacity !== null && activeCount >= room.capacity) {
      throw new ForbiddenException("ROOM_FULL");
    }

    const request = await this.prisma.roomJoinRequest.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      },
      create: {
        roomId,
        userId,
        status: "PENDING"
      },
      update: {
        status: "PENDING",
        requestedAt: new Date(),
        decidedAt: null,
        decidedById: null
      }
    });

    return { status: request.status, requestId: request.id };
  }

  async getJoinRequestStatus(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });
    if (membership && !membership.leftAt) {
      return { status: "MEMBER" };
    }

    const request = await this.prisma.roomJoinRequest.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });

    if (!request) {
      return { status: "NONE" };
    }

    return { status: request.status, requestId: request.id };
  }

  async listJoinRequests(roomId: string, userId: string) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }

    const requests = await this.prisma.roomJoinRequest.findMany({
      where: {
        roomId,
        status: "PENDING"
      },
      include: {
        user: {
          select: {
            id: true,
            maskName: true,
            maskAvatarUrl: true,
            gender: true,
            dob: true
          }
        }
      },
      orderBy: { requestedAt: "asc" }
    });

    return {
      items: requests.map((request) => ({
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt,
        user: request.user
      }))
    };
  }

  async approveJoinRequest(roomId: string, requestId: string, userId: string) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }

    const request = await this.prisma.roomJoinRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.roomId !== roomId) {
      throw new BadRequestException("REQUEST_NOT_FOUND");
    }

    if (request.status === "APPROVED") {
      return { status: "APPROVED" };
    }

    const existingMembership = await this.prisma.roomMembership.findFirst({
      where: {
        userId: request.userId,
        leftAt: null
      }
    });
    if (existingMembership) {
      await this.prisma.roomJoinRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          decidedAt: new Date(),
          decidedById: userId
        }
      });
      return { status: "REJECTED_ALREADY_MEMBER" };
    }

    const activeCount = await this.prisma.roomMembership.count({
      where: {
        roomId,
        leftAt: null
      }
    });
    if (room.capacity !== null && activeCount >= room.capacity) {
      throw new ForbiddenException("ROOM_FULL");
    }

    await this.prisma.$transaction([
      this.prisma.roomJoinRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
          decidedById: userId
        }
      }),
      this.prisma.roomMembership.upsert({
        where: {
          roomId_userId: {
            roomId,
            userId: request.userId
          }
        },
        create: {
          roomId,
          userId: request.userId,
          mode: "PARTICIPANT",
          joinedAt: new Date(),
          leftAt: null
        },
        update: {
          mode: "PARTICIPANT",
          joinedAt: new Date(),
          leftAt: null
        }
      })
    ]);

    return { status: "APPROVED" };
  }

  async rejectJoinRequest(roomId: string, requestId: string, userId: string) {
    const room = await this.ensureRoom(roomId);
    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_NOT_HOST");
    }

    const request = await this.prisma.roomJoinRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.roomId !== roomId) {
      throw new BadRequestException("REQUEST_NOT_FOUND");
    }

    if (request.status === "REJECTED") {
      return { status: "REJECTED" };
    }

    if (request.status === "APPROVED") {
      return { status: "APPROVED" };
    }

    await this.prisma.roomJoinRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedById: userId
      }
    });

    return { status: "REJECTED" };
  }

  async listRoomMessages(
    roomId: string,
    userId: string,
    cursor?: string,
    limit?: number
  ) {
    await this.ensureMembership(roomId, userId);
    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const messages = await this.prisma.roomMessage.findMany({
      where: { roomId },
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

    const nextCursor = messages.length === take ? messages[messages.length - 1].id : null;
    return { items: messages.reverse(), nextCursor };
  }

  async sendRoomMessage(roomId: string, userId: string, content: string) {
    await this.ensureMembership(roomId, userId);
    if (!content.trim()) {
      throw new BadRequestException("EMPTY_MESSAGE");
    }
    return this.prisma.roomMessage.create({
      data: {
        roomId,
        senderId: userId,
        content: content.trim()
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

  async startRoom(roomId: string, userId: string, role: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      throw new BadRequestException("ROOM_NOT_FOUND");
    }

    if (!this.isRooms08Enabled() && role !== "OFFICIAL") {
      throw new ForbiddenException("ROOM_CONTROL_DISABLED");
    }

    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_CREATOR_ONLY");
    }

    if (room.status !== "SCHEDULED") {
      throw new BadRequestException("ROOM_NOT_SCHEDULED");
    }

    const now = new Date();
    return this.prisma.room.update({
      where: { id: roomId },
      data: {
        status: "LIVE",
        startsAt: room.startsAt ?? now
      }
    });
  }

  async endRoom(roomId: string, userId: string, role: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      throw new BadRequestException("ROOM_NOT_FOUND");
    }

    if (!this.isRooms08Enabled() && role !== "OFFICIAL") {
      throw new ForbiddenException("ROOM_CONTROL_DISABLED");
    }

    if (room.createdById !== userId) {
      throw new ForbiddenException("ROOM_CREATOR_ONLY");
    }

    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    return this.prisma.room.update({
      where: { id: roomId },
      data: {
        status: "ENDED",
        endsAt: new Date()
      }
    });
  }

  private isRooms08Enabled() {
    return true; // 默认开启
  }

  private ensureRooms08Enabled() {
    // 默认开启，不再报错
    return;
  }

  async getDiceState(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    await this.ensureMembership(roomId, userId);
    const state = await this.getDiceStateInternal(roomId);
    return state;
  }

  async startDice(roomId: string, userId: string, role: string) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);

    const isSystem = role === "OFFICIAL" || role === "ADMIN";
    if (room.createdById !== userId && !isSystem) {
      throw new ForbiddenException("ROOM_HOST_ONLY");
    }

    const participants = await this.prisma.roomMembership.findMany({
      where: {
        roomId,
        leftAt: null,
        mode: "PARTICIPANT"
      },
      select: { userId: true }
    });

    if (participants.length === 0) {
      throw new BadRequestException("NO_PARTICIPANTS");
    }

    const picked = participants[Math.floor(Math.random() * participants.length)]?.userId ?? null;
    if (!picked) {
      throw new BadRequestException("NO_PARTICIPANTS");
    }

    const existingState = await this.getDiceStateInternal(roomId);
    if (existingState.phase !== "IDLE") {
      throw new BadRequestException("DICE_ROUND_ACTIVE");
    }
    const state: DiceState = {
      ...existingState,
      phase: "AWAIT_QUESTION",
      askerId: picked,
      targetScope: null,
      targetId: null,
      question: null,
      answer: null,
      answeredBy: null,
      silentProtectedTargets: {},
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, state);
    return state;
  }

  async askDice(roomId: string, userId: string, dto: DiceAskDto) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    if (state.phase !== "AWAIT_QUESTION" || state.askerId !== userId) {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    const question = (dto.question ?? "").trim();
    if (!question) {
      throw new BadRequestException("QUESTION_REQUIRED");
    }

    if (dto.targetScope === "single") {
      if (!dto.targetId) {
        throw new BadRequestException("TARGET_REQUIRED");
      }
      if (dto.targetId === userId) {
        throw new BadRequestException("TARGET_INVALID");
      }
      const target = await this.prisma.roomMembership.findFirst({
        where: {
          roomId,
          userId: dto.targetId,
          leftAt: null,
          mode: "PARTICIPANT"
        }
      });
      if (!target) {
        throw new BadRequestException("TARGET_NOT_FOUND");
      }
    }

    const nextState: DiceState = {
      ...state,
      phase: "AWAIT_RESPONSE",
      targetScope: dto.targetScope,
      targetId: dto.targetScope === "single" ? dto.targetId ?? null : null,
      question,
      answer: null,
      answeredBy: null,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async respondDice(roomId: string, userId: string, dto: DiceRespondDto) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    if (state.phase !== "AWAIT_RESPONSE") {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    if (state.targetScope === "single") {
      if (state.targetId !== userId) {
        throw new ForbiddenException("NOT_TARGET");
      }
    } else if (state.targetScope === "all") {
      if (state.askerId === userId) {
        throw new ForbiddenException("ASKER_CANNOT_RESPOND");
      }
    } else {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    const answer = (dto.answer ?? "").trim();
    if (!answer) {
      throw new BadRequestException("ANSWER_REQUIRED");
    }

    const nextState: DiceState = {
      ...state,
      phase: "IDLE",
      answer,
      answeredBy: userId,
      lastOutcome: "answered",
      lastPenalty: null,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async refuseDice(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    if (state.phase !== "AWAIT_RESPONSE") {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    if (state.targetScope === "single") {
      if (state.targetId !== userId) {
        throw new ForbiddenException("NOT_TARGET");
      }
    } else if (state.targetScope === "all") {
      if (state.askerId === userId) {
        throw new ForbiddenException("ASKER_CANNOT_REFUSE");
      }
    } else {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    const penalty = await this.applyPenalty(roomId, userId, state);
    const nextState: DiceState = {
      ...state,
      phase: "IDLE",
      answer: null,
      answeredBy: null,
      lastOutcome: "refused",
      lastPenalty: penalty,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async skipDice(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    if (state.phase !== "AWAIT_RESPONSE" || state.askerId !== userId) {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    const nextState: DiceState = {
      ...state,
      phase: "IDLE",
      answer: null,
      answeredBy: null,
      lastOutcome: "skipped",
      lastPenalty: null,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async protectSkipDice(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    this.ensureTargetForProtection(state, userId);

    const nextState: DiceState = {
      ...state,
      phase: "IDLE",
      answer: null,
      answeredBy: null,
      lastOutcome: "skipped",
      lastPenalty: null,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async protectStaySilent(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    this.ensureTargetForProtection(state, userId);

    const silentProtectedTargets = {
      ...state.silentProtectedTargets,
      [userId]: { at: new Date().toISOString() }
    };

    const nextState: DiceState = {
      ...state,
      phase: "IDLE",
      answer: null,
      answeredBy: null,
      lastOutcome: "silent_protected",
      lastPenalty: null,
      silentProtectedTargets,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async protectSwitchObserver(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    if (room.status !== "LIVE") {
      throw new BadRequestException("ROOM_NOT_LIVE");
    }

    await this.ensureNotSilenced(roomId, userId);
    await this.ensureParticipant(roomId, userId);

    const state = await this.getDiceStateInternal(roomId);
    this.ensureTargetForProtection(state, userId);

    await this.prisma.roomMembership.update({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      },
      data: {
        mode: "OBSERVER"
      }
    });

    const nextState: DiceState = {
      ...state,
      phase: "IDLE",
      answer: null,
      answeredBy: null,
      lastOutcome: "observer",
      lastPenalty: null,
      lastActionAt: new Date().toISOString()
    };

    await this.saveDiceState(roomId, nextState);
    return nextState;
  }

  async getOneThingState(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    await this.ensureMembership(roomId, userId);
    const state = await this.getRoomGameState(roomId);
    return state.oneThing;
  }

  async getSelectedGame(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    await this.ensureMembership(roomId, userId);
    const selection = await this.prisma.roomGameSelection.findUnique({
      where: { roomId }
    });
    if (!selection) {
      return { type: "NONE", selectedAt: null, selectedById: null };
    }
    return {
      type: selection.selectedGame,
      selectedAt: selection.selectedAt,
      selectedById: selection.selectedById
    };
  }

  async setSelectedGame(roomId: string, userId: string, role: string, gameType: RoomGameType) {
    this.ensureRooms08Enabled();
    const room = await this.ensureRoom(roomId);
    await this.ensureMembership(roomId, userId);

    const isSystem = role === "OFFICIAL" || role === "ADMIN";
    const isHost = room.createdById === userId;
    if (!isHost && !isSystem) {
      throw new ForbiddenException("ROOM_HOST_ONLY");
    }

    if (!ROOM_GAME_TYPES.includes(gameType)) {
      throw new BadRequestException("ROOM_GAME_INVALID");
    }

    const selection = await this.prisma.roomGameSelection.upsert({
      where: { roomId },
      create: {
        roomId,
        selectedGame: gameType,
        selectedAt: new Date(),
        selectedById: userId
      },
      update: {
        selectedGame: gameType,
        selectedAt: new Date(),
        selectedById: userId
      }
    });
    const payload = {
      type: selection.selectedGame,
      selectedAt: selection.selectedAt,
      selectedById: selection.selectedById
    };
    this.gateway.emitGameSelected(roomId, payload);
    await this.audit.log({
      actorId: userId,
      action: "ROOM_GAME_SELECTED",
      targetType: "Room",
      targetId: roomId,
      metaJson: { selectedGame: gameType }
    });
    return payload;
  }

  async startOneThing(roomId: string, userId: string) {
    this.ensureRooms08Enabled();
    await this.ensureMembership(roomId, userId);
    const state = await this.getRoomGameState(roomId);

    if (state.oneThing.status === "ACTIVE") {
      throw new BadRequestException("ONE_THING_ALREADY_ACTIVE");
    }

    const nextState: OneThingState = {
      status: "ACTIVE",
      startedAt: new Date().toISOString(),
      startedBy: userId,
      shares: [],
      reactions: []
    };

    await this.saveRoomGameState(roomId, {
      ...state,
      oneThing: nextState
    });
    return nextState;
  }

  async shareOneThing(roomId: string, userId: string, dto: OneThingShareDto) {
    this.ensureRooms08Enabled();
    await this.ensureParticipant(roomId, userId);

    const state = await this.getRoomGameState(roomId);
    const oneThing = state.oneThing;
    if (oneThing.status !== "ACTIVE") {
      throw new BadRequestException("ONE_THING_NOT_ACTIVE");
    }

    if (oneThing.shares.some((share) => share.userId === userId)) {
      throw new BadRequestException("ONE_THING_ALREADY_SHARED");
    }

    const content = (dto.content ?? "").trim();
    if (content.length === 0) {
      throw new BadRequestException("CONTENT_REQUIRED");
    }
    if (content.length > 200) {
      throw new BadRequestException("CONTENT_TOO_LONG");
    }

    const updated: OneThingState = {
      ...oneThing,
      shares: [
        ...oneThing.shares,
        {
          userId,
          content,
          createdAt: new Date().toISOString()
        }
      ]
    };

    await this.saveRoomGameState(roomId, {
      ...state,
      oneThing: updated
    });
    return updated;
  }

  async reactOneThing(roomId: string, userId: string, dto: OneThingReactDto) {
    this.ensureRooms08Enabled();
    await this.ensureMembership(roomId, userId);

    const state = await this.getRoomGameState(roomId);
    const oneThing = state.oneThing;
    if (oneThing.status !== "ACTIVE") {
      throw new BadRequestException("ONE_THING_NOT_ACTIVE");
    }

    const emoji = (dto.emoji ?? "").trim();
    if (!ONE_THING_EMOJIS.includes(emoji)) {
      throw new BadRequestException("EMOJI_NOT_ALLOWED");
    }

    const targetUserId = (dto.targetUserId ?? "").trim();
    if (!targetUserId) {
      throw new BadRequestException("TARGET_REQUIRED");
    }

    if (!oneThing.shares.some((share) => share.userId === targetUserId)) {
      throw new BadRequestException("SHARE_NOT_FOUND");
    }

    const updated: OneThingState = {
      ...oneThing,
      reactions: [
        ...oneThing.reactions,
        {
          userId,
          targetUserId,
          emoji,
          createdAt: new Date().toISOString()
        }
      ]
    };

    await this.saveRoomGameState(roomId, {
      ...state,
      oneThing: updated
    });
    return updated;
  }

  private async getMutualConversationUsers(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        matchId: { not: null },
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
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const matchIds = conversations
      .map((conversation) => conversation.matchId)
      .filter((matchId): matchId is string => Boolean(matchId));

    const senderCounts = matchIds.length
      ? await this.prisma.message.groupBy({
          by: ["matchId", "senderId"],
          where: {
            matchId: { in: matchIds },
            deletedAt: null
          },
          _count: { _all: true }
        })
      : [];

    const sendersByMatch = new Map<string, Set<string>>();
    senderCounts.forEach((record) => {
      if (!sendersByMatch.has(record.matchId)) {
        sendersByMatch.set(record.matchId, new Set<string>());
      }
      sendersByMatch.get(record.matchId)?.add(record.senderId);
    });

    const candidates = new Map<
      string,
      { userId: string; maskName: string | null; maskAvatarUrl: string | null }
    >();

    conversations.forEach((conversation) => {
      const match = conversation.match;
      if (!match) {
        return;
      }
      const otherUser = match.user1Id === userId ? match.user2 : match.user1;
      if (!otherUser) {
        return;
      }
      const senders = sendersByMatch.get(match.id);
      if (!senders || !senders.has(userId) || !senders.has(otherUser.id)) {
        return;
      }
      if (!candidates.has(otherUser.id)) {
        candidates.set(otherUser.id, {
          userId: otherUser.id,
          maskName: otherUser.maskName,
          maskAvatarUrl: otherUser.maskAvatarUrl
        });
      }
    });

    return candidates;
  }

  private async findActiveRoomIdsToClose(userId: string, roomId: string) {
    const memberships = await this.prisma.roomMembership.findMany({
      where: {
        userId,
        leftAt: null,
        roomId: { not: roomId }
      },
      select: { roomId: true }
    });
    return memberships.map((membership) => membership.roomId);
  }

  private async ensureRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId }
    });
    if (!room) {
      throw new BadRequestException("ROOM_NOT_FOUND");
    }
    return room;
  }

  private async ensureMembership(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null
      }
    });
    if (!membership) {
      throw new ForbiddenException("ROOM_NOT_JOINED");
    }
    return membership;
  }

  private async ensureParticipant(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null,
        mode: "PARTICIPANT"
      }
    });
    if (!membership) {
      throw new ForbiddenException("ROOM_PARTICIPANT_ONLY");
    }
    return membership;
  }

  private ensureTargetForProtection(state: DiceState, userId: string) {
    if (state.phase !== "AWAIT_RESPONSE") {
      throw new ForbiddenException("DICE_NOT_READY");
    }

    if (state.targetScope === "single") {
      if (state.targetId !== userId) {
        throw new ForbiddenException("NOT_TARGET");
      }
      return;
    }

    if (state.targetScope === "all") {
      if (state.askerId === userId) {
        throw new ForbiddenException("ASKER_CANNOT_PROTECT");
      }
      return;
    }

    throw new ForbiddenException("DICE_NOT_READY");
  }

  private async getDiceStateInternal(roomId: string): Promise<DiceState> {
    const roomState = await this.getRoomGameState(roomId);
    const pruned = this.pruneSilences(roomState.dice);
    if (pruned.changed) {
      await this.saveRoomGameState(roomId, {
        ...roomState,
        dice: pruned.state
      });
    }
    return pruned.state;
  }

  private normalizeDiceState(raw: unknown): DiceState {
    const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const silences =
      typeof data.silences === "object" && data.silences !== null ? (data.silences as Record<string, { until: string }>) : {};
    const maskColors =
      typeof data.maskColors === "object" && data.maskColors !== null ? (data.maskColors as Record<string, string>) : {};
    const silentProtectedTargets =
      typeof data.silentProtectedTargets === "object" && data.silentProtectedTargets !== null
        ? (data.silentProtectedTargets as Record<string, { at: string }>)
        : {};

    return {
      phase: (data.phase as DiceState["phase"]) ?? "IDLE",
      askerId: (data.askerId as string) ?? null,
      targetScope: (data.targetScope as DiceState["targetScope"]) ?? null,
      targetId: (data.targetId as string) ?? null,
      question: (data.question as string) ?? null,
      answer: (data.answer as string) ?? null,
      answeredBy: (data.answeredBy as string) ?? null,
      lastOutcome: (data.lastOutcome as DiceState["lastOutcome"]) ?? null,
      lastPenalty: (data.lastPenalty as DicePenalty) ?? null,
      lastActionAt: (data.lastActionAt as string) ?? null,
      silences,
      maskColors,
      silentProtectedTargets
    };
  }

  private normalizeOneThingState(raw: unknown): OneThingState {
    const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const status = data.status === "ACTIVE" ? "ACTIVE" : "IDLE";
    const shares = Array.isArray(data.shares)
      ? (data.shares as OneThingShare[]).filter(
          (share) => Boolean(share?.userId && share?.content)
        )
      : [];
    const reactions = Array.isArray(data.reactions)
      ? (data.reactions as OneThingReaction[]).filter(
          (reaction) =>
            Boolean(reaction?.userId && reaction?.targetUserId && reaction?.emoji)
        )
      : [];

    return {
      status,
      startedAt: (data.startedAt as string) ?? null,
      startedBy: (data.startedBy as string) ?? null,
      shares,
      reactions
    };
  }

  private normalizeRoomGameState(raw: unknown): RoomGameState {
    const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const diceRaw = data.dice ?? data;
    const dice = this.normalizeDiceState(diceRaw);
    const oneThing = this.normalizeOneThingState(data.oneThing);
    const selectedGame = this.normalizeSelectedGame(data.selectedGame);
    return {
      dice,
      oneThing,
      selectedGame
    };
  }

  private normalizeSelectedGame(raw: unknown): SelectedGame {
    const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const type =
      typeof data.type === "string" && ROOM_GAME_TYPES.includes(data.type as RoomGameType)
        ? (data.type as RoomGameType)
        : null;
    return {
      type,
      selectedAt: (data.selectedAt as string) ?? null,
      selectedBy: (data.selectedBy as string) ?? null
    };
  }

  private pruneSilences(state: DiceState) {
    const now = Date.now();
    let changed = false;
    const nextSilences: Record<string, { until: string }> = { ...state.silences };
    Object.entries(nextSilences).forEach(([userId, silence]) => {
      const untilMs = new Date(silence.until).getTime();
      if (!untilMs || Number.isNaN(untilMs) || untilMs <= now) {
        delete nextSilences[userId];
        changed = true;
      }
    });

    if (!changed) {
      return { state, changed: false };
    }

    return {
      state: {
        ...state,
        silences: nextSilences
      },
      changed: true
    };
  }

  private async saveDiceState(roomId: string, state: DiceState) {
    const roomState = await this.getRoomGameState(roomId);
    await this.saveRoomGameState(roomId, {
      ...roomState,
      dice: state
    });
  }

  private async getRoomGameState(roomId: string): Promise<RoomGameState> {
    const record = await this.prisma.roomGameState.findUnique({
      where: { roomId }
    });
    return this.normalizeRoomGameState(record?.stateJson);
  }

  private async saveRoomGameState(roomId: string, state: RoomGameState) {
    await this.prisma.roomGameState.upsert({
      where: { roomId },
      create: {
        roomId,
        gameType: DICE_GAME_TYPE,
        stateJson: state
      },
      update: {
        gameType: DICE_GAME_TYPE,
        stateJson: state
      }
    });
  }

  private async ensureNotSilenced(roomId: string, userId: string) {
    const state = await this.getDiceStateInternal(roomId);
    const silence = state.silences?.[userId];
    if (!silence) {
      return;
    }
    const until = new Date(silence.until);
    if (Number.isNaN(until.getTime())) {
      return;
    }
    if (until > new Date()) {
      throw new ForbiddenException("DICE_SILENCED");
    }
  }

  private async applyPenalty(roomId: string, userId: string, state: DiceState): Promise<DicePenalty> {
    const pick = Math.floor(Math.random() * 3);
    if (pick === 0) {
      const until = new Date(Date.now() + SILENCE_DURATION_MS).toISOString();
      const silences = {
        ...state.silences,
        [userId]: { until }
      };
      state.silences = silences;
      return { type: "silence", userId, until };
    }

    if (pick === 1) {
      const maskColor = MASK_COLORS[Math.floor(Math.random() * MASK_COLORS.length)] ?? "#0ea5a2";
      const maskColors = {
        ...state.maskColors,
        [userId]: maskColor
      };
      state.maskColors = maskColors;
      return { type: "mask", userId, maskColor };
    }

    const content = TRACE_PENALTIES[Math.floor(Math.random() * TRACE_PENALTIES.length)] ?? TRACE_PENALTIES[0];
    const trace = await this.prisma.trace.create({
      data: {
        authorId: null,
        content
      }
    });
    return { type: "trace", userId, traceId: trace.id };
  }
}






