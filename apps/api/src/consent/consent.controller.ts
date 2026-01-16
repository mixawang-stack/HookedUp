import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ConsentService } from "./consent.service";

@Controller("consent")
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post(":matchId/init")
  async init(
    @Req() req: AuthenticatedRequest,
    @Param("matchId") matchId: string
  ) {
    return this.consentService.initConsent(req.user.sub, matchId);
  }

  @Post(":matchId/confirm")
  async confirm(
    @Req() req: AuthenticatedRequest,
    @Param("matchId") matchId: string
  ) {
    return this.consentService.confirmConsent(req.user.sub, matchId);
  }

  @Get(":matchId")
  async get(@Req() req: AuthenticatedRequest, @Param("matchId") matchId: string) {
    return this.consentService.getConsent(req.user.sub, matchId);
  }
}
