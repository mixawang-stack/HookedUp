import { Body, Controller, Delete, Get, Patch, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
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
