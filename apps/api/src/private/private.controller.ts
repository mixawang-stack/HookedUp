import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ChatPaginationDto } from "../chat/dto/chat-pagination.dto";
import { SendPrivateMessageDto } from "./dto/send-private-message.dto";
import { StartPrivateConversationDto } from "./dto/start-private-conversation.dto";
import { PrivateService } from "./private.service";

@Controller("private")
@UseGuards(JwtAuthGuard)
export class PrivateController {
  constructor(private readonly privateService: PrivateService) {}

  @Get("conversations")
  async listConversations(
    @Req() req: AuthenticatedRequest,
    @Query() query: ChatPaginationDto
  ) {
    return this.privateService.listConversations(
      req.user.sub,
      query.cursor,
      query.limit
    );
  }

  @Get("unread-total")
  async getUnreadTotal(@Req() req: AuthenticatedRequest) {
    return this.privateService.getUnreadTotal(req.user.sub);
  }

  @Get("conversations/:id/messages")
  async listMessages(
    @Req() req: AuthenticatedRequest,
    @Param("id") conversationId: string,
    @Query() query: ChatPaginationDto
  ) {
    return this.privateService.listMessages(
      req.user.sub,
      conversationId,
      query.cursor,
      query.limit
    );
  }

  @Post("conversations/:id/messages")
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param("id") conversationId: string,
    @Body() dto: SendPrivateMessageDto
  ) {
    return this.privateService.sendMessage(req.user.sub, conversationId, dto.content);
  }

  @Post("conversations/start")
  async startConversation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartPrivateConversationDto
  ) {
    return this.privateService.startConversation(req.user.sub, dto.userId);
  }

  @Post("conversations/:id/mute")
  async mute(
    @Req() req: AuthenticatedRequest,
    @Param("id") conversationId: string
  ) {
    return this.privateService.muteConversation(req.user.sub, conversationId);
  }

  @Post("conversations/:id/unmute")
  async unmute(
    @Req() req: AuthenticatedRequest,
    @Param("id") conversationId: string
  ) {
    return this.privateService.unmuteConversation(req.user.sub, conversationId);
  }
}
