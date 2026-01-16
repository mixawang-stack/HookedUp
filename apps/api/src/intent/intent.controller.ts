import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { IntentConfirmDto } from "./dto/intent-confirm.dto";
import { IntentRequestDto } from "./dto/intent-request.dto";
import { IntentService } from "./intent.service";

@Controller("intent")
@UseGuards(JwtAuthGuard)
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Post("offline/request")
  async request(
    @Req() req: AuthenticatedRequest,
    @Body() dto: IntentRequestDto
  ) {
    return this.intentService.requestOffline(req.user.sub, dto.conversationId);
  }

  @Post("offline/confirm")
  async confirm(
    @Req() req: AuthenticatedRequest,
    @Body() dto: IntentConfirmDto
  ) {
    return this.intentService.confirmOffline(req.user.sub, dto.intentId);
  }
}
