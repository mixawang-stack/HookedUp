import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { SwipeDto } from "./dto/swipe.dto";
import { MatchService } from "./match.service";

@Controller("match")
@UseGuards(JwtAuthGuard)
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get("recommendations")
  async recommendations(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto
  ) {
    return this.matchService.getRecommendations(
      req.user.sub,
      query.cursor,
      query.limit
    );
  }

  @Post("swipe")
  async swipe(@Req() req: AuthenticatedRequest, @Body() dto: SwipeDto) {
    return this.matchService.swipe(req.user.sub, dto.toUserId, dto.action);
  }

  @Get("list")
  async list(@Req() req: AuthenticatedRequest, @Query() query: PaginationQueryDto) {
    return this.matchService.listMatches(req.user.sub, query.cursor, query.limit);
  }
}
