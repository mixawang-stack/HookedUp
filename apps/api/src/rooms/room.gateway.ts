import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { JWT_ACCESS_SECRET } from "../auth/auth.constants";
import { PrismaService } from "../prisma.service";

const ROOM_PREFIX = "room";

type SocketWithUser = Socket & { data: { userId?: string; role?: string } };

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true
  }
})
export class RoomGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: SocketWithUser) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role?: string }>(token, {
        secret: JWT_ACCESS_SECRET
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role ?? "USER";
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage("room:join")
  async joinRoom(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { roomId: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    const membership = await this.ensureMembership(userId, payload.roomId);
    if (!membership) {
      return { ok: false, reason: "ROOM_NOT_JOINED" };
    }

    await client.join(this.roomName(payload.roomId));
    return { ok: true };
  }

  @SubscribeMessage("room:leave")
  async leaveRoom(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { roomId: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    const membership = await this.ensureMembership(userId, payload.roomId);
    if (!membership) {
      return { ok: false, reason: "ROOM_NOT_JOINED" };
    }

    await this.prisma.roomMembership.update({
      where: {
        roomId_userId: {
          roomId: payload.roomId,
          userId
        }
      },
      data: {
        leftAt: new Date()
      }
    });

    await client.leave(this.roomName(payload.roomId));
    await this.emitMemberCount(payload.roomId);
    return { ok: true };
  }

  @SubscribeMessage("room:ping")
  async ping(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { roomId: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    const membership = await this.ensureMembership(userId, payload.roomId);
    if (!membership) {
      return { ok: false, reason: "ROOM_NOT_JOINED" };
    }

    const silence = await this.getActiveSilence(payload.roomId, userId);
    if (silence) {
      return { ok: false, reason: "DICE_SILENCED", until: silence };
    }

    const event = {
      roomId: payload.roomId,
      from: userId,
      at: new Date().toISOString()
    };

    this.server.to(this.roomName(payload.roomId)).emit("room:ping", event);
    return { ok: true, event };
  }

  @SubscribeMessage("room:broadcast")
  async broadcast(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { roomId: string; message: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    const membership = await this.ensureMembership(userId, payload.roomId);
    if (!membership) {
      return { ok: false, reason: "ROOM_NOT_JOINED" };
    }

    const silence = await this.getActiveSilence(payload.roomId, userId);
    if (silence) {
      return { ok: false, reason: "DICE_SILENCED", until: silence };
    }

    const room = await this.prisma.room.findUnique({
      where: { id: payload.roomId },
      select: { createdById: true }
    });
    if (!room) {
      return { ok: false, reason: "ROOM_NOT_FOUND" };
    }

    const role = client.data.role ?? "USER";
    const isSystem = role === "OFFICIAL" || role === "ADMIN";
    const isHost = room.createdById === userId;
    if (!isHost && !isSystem) {
      return { ok: false, reason: "ROOM_HOST_ONLY" };
    }

    const message = (payload.message ?? "").trim();
    if (!message) {
      return { ok: false, reason: "MESSAGE_REQUIRED" };
    }

    const event = {
      roomId: payload.roomId,
      message,
      from: userId,
      at: new Date().toISOString()
    };

    this.server.to(this.roomName(payload.roomId)).emit("room:notice", event);
    return { ok: true, event };
  }

  @SubscribeMessage("room:message:send")
  async sendMessage(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { roomId: string; content: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    const membership = await this.ensureMembership(userId, payload.roomId);
    if (!membership) {
      return { ok: false, reason: "ROOM_NOT_JOINED" };
    }

    const content = (payload.content ?? "").trim();
    if (!content) {
      return { ok: false, reason: "EMPTY_MESSAGE" };
    }

    const message = await this.prisma.roomMessage.create({
      data: {
        roomId: payload.roomId,
        senderId: userId,
        content
      }
    });

    this.server.to(this.roomName(payload.roomId)).emit("room:message", {
      roomId: payload.roomId,
      message
    });

    return { ok: true, message };
  }

  emitGameSelected(
    roomId: string,
    selectedGame: { type: string; selectedAt: Date | string | null; selectedById: string | null }
  ) {
    const event = {
      roomId,
      selectedGame,
      at: new Date().toISOString()
    };
    this.server.to(this.roomName(roomId)).emit("room:gameSelected", event);
    this.server.to(this.roomName(roomId)).emit("room:game", event);
  }

  async emitMemberCount(roomId: string) {
    const memberCount = await this.prisma.roomMembership.count({
      where: {
        roomId,
        leftAt: null
      }
    });
    const event = { roomId, memberCount };
    this.server.to(this.roomName(roomId)).emit("room:memberCount", event);
  }

  private async ensureMembership(userId: string, roomId: string) {
    return this.prisma.roomMembership.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null
      }
    });
  }

  private roomName(roomId: string) {
    return `${ROOM_PREFIX}:${roomId}`;
  }

  private async getActiveSilence(roomId: string, userId: string) {
    const record = await this.prisma.roomGameState.findUnique({
      where: { roomId },
      select: { stateJson: true }
    });
    if (!record?.stateJson || typeof record.stateJson !== "object") {
      return null;
    }
    const state = record.stateJson as Record<string, unknown>;
    const diceState = (state.dice as Record<string, unknown>) ?? state;
    const silences = diceState.silences as Record<string, { until?: string }> | undefined;
    const silence = silences?.[userId];
    if (!silence?.until) {
      return null;
    }
    const until = new Date(silence.until);
    if (Number.isNaN(until.getTime())) {
      return null;
    }
    if (until <= new Date()) {
      return null;
    }
    return until.toISOString();
  }

  private extractToken(client: Socket): string | null {
    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice(7);
    }

    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.length > 0) {
      return authToken;
    }

    return null;
  }
}
