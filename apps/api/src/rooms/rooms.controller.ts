import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { CreateRoomDto } from "./dto/create-room.dto";
import { CreateRoomInviteDto } from "./dto/create-room-invite.dto";
import { CreateRoomShareLinkDto } from "./dto/create-room-share-link.dto";
import { DiceAskDto } from "./dto/dice-ask.dto";
import { DiceRespondDto } from "./dto/dice-respond.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { OneThingReactDto } from "./dto/one-thing-react.dto";
import { OneThingShareDto } from "./dto/one-thing-share.dto";
import { SetRoomGameDto } from "./dto/set-room-game.dto";
import { RoomMessageDto } from "./dto/room-message.dto";
import { RoomOwnerGuard } from "./room-owner.guard";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@ApiTags("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle(5, 60)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a room and auto-join as owner." })
  async createRoom(@Req() req: AuthenticatedRequest, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(req.user.sub, req.user.role, dto);
  }

  @Get()
  async listRooms(
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("tags") tags?: string,
    @Query("search") search?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedTags = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : undefined;
    return this.roomsService.listRooms(
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      status,
      parsedTags,
      search
    );
  }

  @Get("active")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current active room for the user." })
  async getActiveRoom(@Req() req: AuthenticatedRequest) {
    return this.roomsService.getActiveRoom(req.user.sub);
  }

  @Get("my-active")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current active room for the user." })
  async getMyActiveRoom(@Req() req: AuthenticatedRequest) {
    return this.roomsService.getActiveRoom(req.user.sub);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get room detail with memberCount, role, selectedGame." })
  async getRoom(@Req() req: AuthenticatedRequest, @Param("id") roomId: string) {
    return this.roomsService.getRoom(roomId, req.user.sub);
  }

  @Post(":id/join")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Join or re-join a room." })
  async joinRoom(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: JoinRoomDto
  ) {
    return this.roomsService.joinRoom(roomId, req.user.sub, dto);
  }

  @Post(":id/join-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async requestJoin(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.requestJoinRoom(roomId, req.user.sub);
  }

  @Get(":id/join-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getJoinStatus(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.getJoinRequestStatus(roomId, req.user.sub);
  }

  @Get(":id/requests")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listJoinRequests(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.listJoinRequests(roomId, req.user.sub);
  }

  @Post(":id/requests/:requestId/approve")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async approveJoinRequest(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Param("requestId") requestId: string
  ) {
    return this.roomsService.approveJoinRequest(roomId, requestId, req.user.sub);
  }

  @Post(":id/requests/:requestId/reject")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async rejectJoinRequest(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Param("requestId") requestId: string
  ) {
    return this.roomsService.rejectJoinRequest(roomId, requestId, req.user.sub);
  }

  @Post(":id/leave")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Leave a room (set leftAt)." })
  async leaveRoom(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.leaveRoom(roomId, req.user.sub);
  }

  @Get(":id/members/count")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get active member count for a room." })
  async getMemberCount(@Param("id") roomId: string) {
    return this.roomsService.getMemberCount(roomId);
  }

  @Post(":id/share-links")
  @UseGuards(JwtAuthGuard, RoomOwnerGuard, ThrottlerGuard)
  @Throttle(5, 60)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a share link for the room (owner only)." })
  async createShareLink(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: CreateRoomShareLinkDto
  ) {
    return this.roomsService.createShareLink(roomId, req.user.sub, dto);
  }

  @Post(":id/share-links/:linkId/revoke")
  @UseGuards(JwtAuthGuard, RoomOwnerGuard, ThrottlerGuard)
  @Throttle(5, 60)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke a share link (owner only)." })
  async revokeShareLink(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Param("linkId") linkId: string
  ) {
    return this.roomsService.revokeShareLink(roomId, req.user.sub, linkId);
  }

  @Get(":id/invite-candidates")
  @UseGuards(JwtAuthGuard, RoomOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List invite candidates with mutual messages." })
  async listInviteCandidates(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.listInviteCandidates(roomId, req.user.sub);
  }

  @Post(":id/invites")
  @UseGuards(JwtAuthGuard, RoomOwnerGuard, ThrottlerGuard)
  @Throttle(10, 60)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send an invite to a user (owner only)." })
  async createInvite(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: CreateRoomInviteDto
  ) {
    return this.roomsService.createInvite(roomId, req.user.sub, dto);
  }

  @Post("invites/:inviteId/accept")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Accept a room invite." })
  async acceptInvite(
    @Req() req: AuthenticatedRequest,
    @Param("inviteId") inviteId: string
  ) {
    return this.roomsService.acceptInvite(inviteId, req.user.sub);
  }

  @Post("invites/:inviteId/decline")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Decline a room invite." })
  async declineInvite(
    @Req() req: AuthenticatedRequest,
    @Param("inviteId") inviteId: string
  ) {
    return this.roomsService.declineInvite(inviteId, req.user.sub);
  }

  @Get(":id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listRoomMessages(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.roomsService.listRoomMessages(
      roomId,
      req.user.sub,
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined
    );
  }

  @Post(":id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async sendRoomMessage(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: RoomMessageDto
  ) {
    return this.roomsService.sendRoomMessage(roomId, req.user.sub, dto.content);
  }

  @Post(":id/start")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async startRoom(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.startRoom(roomId, req.user.sub, req.user.role);
  }

  @Post(":id/end")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async endRoom(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.endRoom(roomId, req.user.sub, req.user.role);
  }

  @Get(":id/games/dice")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getDiceState(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.getDiceState(roomId, req.user.sub);
  }

  @Post(":id/games/dice/start")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async startDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.startDice(roomId, req.user.sub, req.user.role);
  }

  @Post(":id/games/dice/ask")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async askDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: DiceAskDto
  ) {
    return this.roomsService.askDice(roomId, req.user.sub, dto);
  }

  @Post(":id/games/dice/respond")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async respondDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: DiceRespondDto
  ) {
    return this.roomsService.respondDice(roomId, req.user.sub, dto);
  }

  @Post(":id/games/dice/refuse")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async refuseDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.refuseDice(roomId, req.user.sub);
  }

  @Post(":id/games/dice/skip")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async skipDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.skipDice(roomId, req.user.sub);
  }

  @Post(":id/games/dice/protect/skip")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async protectSkipDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.protectSkipDice(roomId, req.user.sub);
  }

  @Post(":id/games/dice/protect/silent")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async protectSilentDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.protectStaySilent(roomId, req.user.sub);
  }

  @Post(":id/games/dice/protect/observer")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async protectObserverDice(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.protectSwitchObserver(roomId, req.user.sub);
  }

  @Get(":id/games/one-thing")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getOneThing(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.getOneThingState(roomId, req.user.sub);
  }

  @Post(":id/games/one-thing/start")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async startOneThing(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.startOneThing(roomId, req.user.sub);
  }

  @Post(":id/games/one-thing/share")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async shareOneThing(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: OneThingShareDto
  ) {
    return this.roomsService.shareOneThing(roomId, req.user.sub, dto);
  }

  @Post(":id/games/one-thing/react")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async reactOneThing(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: OneThingReactDto
  ) {
    return this.roomsService.reactOneThing(roomId, req.user.sub, dto);
  }

  @Post(":id/game")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async setSelectedGame(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string,
    @Body() dto: SetRoomGameDto
  ) {
    const selectedGame = dto.selectedGame ?? dto.type;
    return this.roomsService.setSelectedGame(
      roomId,
      req.user.sub,
      req.user.role,
      selectedGame ?? "NONE"
    );
  }

  @Get(":id/game")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getSelectedGame(
    @Req() req: AuthenticatedRequest,
    @Param("id") roomId: string
  ) {
    return this.roomsService.getSelectedGame(roomId, req.user.sub);
  }
}





