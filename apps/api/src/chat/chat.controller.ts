import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ChatPaginationDto } from "./dto/chat-pagination.dto";
import { ChatService } from "./chat.service";

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(":matchId/messages")
  async listMessages(
    @Req() req: AuthenticatedRequest,
    @Param("matchId") matchId: string,
    @Query() query: ChatPaginationDto
  ) {
    return this.chatService.listMessages(
      req.user.sub,
      matchId,
      query.cursor,
      query.limit
    );
  }
}
