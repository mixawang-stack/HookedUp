import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ReportUserDto } from "./dto/report-user.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserService } from "./user.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.userService.getMe(req.user.sub);
  }

  @Get("users/:id")
  async getUserProfile(
    @Req() req: AuthenticatedRequest,
    @Param("id") targetUserId: string
  ) {
    return this.userService.getPublicProfile(req.user.sub, targetUserId);
  }

  @Post("users/:id/block")
  async blockUser(
    @Req() req: AuthenticatedRequest,
    @Param("id") targetUserId: string
  ) {
    return this.userService.blockUser(req.user.sub, targetUserId);
  }

  @Delete("users/:id/block")
  async unblockUser(
    @Req() req: AuthenticatedRequest,
    @Param("id") targetUserId: string
  ) {
    return this.userService.unblockUser(req.user.sub, targetUserId);
  }

  @Post("users/:id/report")
  async reportUser(
    @Req() req: AuthenticatedRequest,
    @Param("id") targetUserId: string,
    @Body() dto: ReportUserDto
  ) {
    return this.userService.reportUser(req.user.sub, targetUserId, dto);
  }

  @Patch("me")
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto
  ) {
    return this.userService.updateProfile(req.user.sub, dto);
  }

  @Get("me/preferences")
  async getPreferences(@Req() req: AuthenticatedRequest) {
    return this.userService.getPreferences(req.user.sub);
  }

  @Put("me/preferences")
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePreferencesDto
  ) {
    return this.userService.upsertPreferences(req.user.sub, dto);
  }

  @Get("me/export")
  async exportMe(@Req() req: AuthenticatedRequest) {
    return this.userService.exportData(req.user.sub);
  }

  @Delete("me")
  async deleteMe(@Req() req: AuthenticatedRequest) {
    return this.userService.deleteMe(req.user.sub);
  }
}
