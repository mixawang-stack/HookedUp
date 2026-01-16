import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post("reports")
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(req.user.sub, dto);
  }

  @Get("me/reports")
  async listMine(@Req() req: AuthenticatedRequest) {
    return this.reportsService.listForUser(req.user.sub);
  }
}
