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
import { ChatService } from "./chat.service";
import { CryptoService } from "../crypto.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { buildCorsOrigin } from "../cors/origin";

const ROOM_PREFIX = "match";

type SocketWithUser = Socket & { data: { userId?: string } };

@WebSocketGateway({
  cors: {
    origin: buildCorsOrigin(),
    credentials: true
  }
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly chatService: ChatService,
    private readonly crypto: CryptoService
  ) {}

  async handleConnection(client: SocketWithUser) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: JWT_ACCESS_SECRET
      });
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage("match:join")
  async joinMatch(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { matchId: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    await this.chatService.ensureCanCommunicate(userId, payload.matchId);
    await client.join(this.roomName(payload.matchId));
    return { ok: true };
  }

  @SubscribeMessage("message:send")
  async sendMessage(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: SendMessageDto
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }

    const message = await this.chatService.createMessage(
      userId,
      payload.matchId,
      payload.ciphertext
    );

    this.server
      .to(this.roomName(payload.matchId))
      .emit("message:new", {
        ...message,
        ciphertext: this.safeDecrypt(message.ciphertext)
      });

    return { ok: true, message };
  }

  @SubscribeMessage("call:offer")
  async callOffer(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { matchId: string; sdp: RTCSessionDescriptionInit }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }
    await this.chatService.ensureCanCommunicate(userId, payload.matchId);
    await client.join(this.roomName(payload.matchId));
    this.server
      .to(this.roomName(payload.matchId))
      .emit("call:offer", { from: userId, matchId: payload.matchId, sdp: payload.sdp });
    return { ok: true };
  }

  @SubscribeMessage("call:answer")
  async callAnswer(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { matchId: string; sdp: RTCSessionDescriptionInit }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }
    await this.chatService.ensureCanCommunicate(userId, payload.matchId);
    await client.join(this.roomName(payload.matchId));
    this.server
      .to(this.roomName(payload.matchId))
      .emit("call:answer", { from: userId, matchId: payload.matchId, sdp: payload.sdp });
    return { ok: true };
  }

  @SubscribeMessage("call:ice")
  async callIce(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody()
    payload: { matchId: string; candidate: RTCIceCandidateInit }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { ok: false };
    }
    await this.chatService.ensureMatchMember(userId, payload.matchId);
    await client.join(this.roomName(payload.matchId));
    this.server
      .to(this.roomName(payload.matchId))
      .emit("call:ice", {
        from: userId,
        matchId: payload.matchId,
        candidate: payload.candidate
      });
    return { ok: true };
  }

  private roomName(matchId: string) {
    return `${ROOM_PREFIX}:${matchId}`;
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

  private safeDecrypt(payload: string) {
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return "";
    }
  }
}
