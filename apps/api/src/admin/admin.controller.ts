import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("verifications")
  async listVerifications(
    @Req() req: AuthenticatedRequest,
    @Query("type") type?: string,
    @Query("status") status?: string
  ) {
    return this.adminService.listVerifications(req.user.role, type, status);
  }

  @Post("verifications/:id/approve")
  async approve(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string
  ) {
    return this.adminService.approveVerification(req.user.role, req.user.sub, id);
  }

  @Post("verifications/:id/reject")
  async reject(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body("reason") reason?: string
  ) {
    return this.adminService.rejectVerification(
      req.user.role,
      req.user.sub,
      id,
      reason ?? ""
    );
  }

  @Get("reports")
  async listReports(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: string
  ) {
    return this.adminService.listReports(req.user.role, status);
  }

  @Post("reports/:id/resolve")
  async resolveReport(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body("action") action?: string,
    @Body("note") note?: string
  ) {
    if (action !== "warn" && action !== "mute" && action !== "ban") {
      throw new BadRequestException("INVALID_ACTION");
    }

    return this.adminService.resolveReport(
      req.user.role,
      req.user.sub,
      id,
      action,
      note
    );
  }
}
