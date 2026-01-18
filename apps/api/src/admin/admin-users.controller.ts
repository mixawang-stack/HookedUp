import { BadRequestException, Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listUsers(
    @Req() req: { user: { role: string } },
    @Query("search") search?: string,
    @Query("country") country?: string,
    @Query("gender") gender?: string,
    @Query("member") member?: string,
    @Query("active") active?: string
  ) {
    if (req.user.role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }
    const activeDays = active ? Number(active) : undefined;
    return this.adminUsersService.listUsers({
      search,
      country,
      gender,
      member,
      activeDays: Number.isFinite(activeDays) ? activeDays : undefined
    });
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getUserDetail(@Req() req: { user: { role: string } }, @Param("id") id: string) {
    if (req.user.role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }
    const user = await this.adminUsersService.getUserDetail(id);
    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }
    return user;
  }
}

@Controller("users")
export class AdminUsersAliasController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listUsers(
    @Req() req: { user: { role: string } },
    @Query("search") search?: string,
    @Query("country") country?: string,
    @Query("gender") gender?: string,
    @Query("member") member?: string,
    @Query("active") active?: string
  ) {
    if (req.user.role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }
    const activeDays = active ? Number(active) : undefined;
    return this.adminUsersService.listUsers({
      search,
      country,
      gender,
      member,
      activeDays: Number.isFinite(activeDays) ? activeDays : undefined
    });
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getUserDetail(@Req() req: { user: { role: string } }, @Param("id") id: string) {
    if (req.user.role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }
    const user = await this.adminUsersService.getUserDetail(id);
    if (!user) {
      throw new BadRequestException("USER_NOT_FOUND");
    }
    return user;
  }
}