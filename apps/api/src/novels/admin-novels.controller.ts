import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AdminNovelDto } from "./dto/admin-novel.dto";
import { AdminChapterDto } from "./dto/admin-chapter.dto";
import { NovelsService } from "./novels.service";

@Controller("admin/novels")
@UseGuards(JwtAuthGuard)
export class AdminNovelsController {
  constructor(private readonly novelsService: NovelsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return this.novelsService.listAdminNovels(req.user.role);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: AdminNovelDto) {
    return this.novelsService.createAdminNovel(req.user.role, dto);
  }

  @Patch(":id")
  async update(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminNovelDto
  ) {
    return this.novelsService.updateAdminNovel(req.user.role, id, dto);
  }

  @Delete(":id")
  async remove(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.novelsService.deleteAdminNovel(req.user.role, id);
  }

  @Get(":id/chapters")
  async listChapters(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.novelsService.listAdminChapters(req.user.role, id);
  }

  @Post(":id/chapters")
  async createChapter(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminChapterDto
  ) {
    return this.novelsService.createAdminChapter(req.user.role, id, dto);
  }

  @Patch(":id/chapters/:chapterId")
  async updateChapter(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("chapterId") chapterId: string,
    @Body() dto: AdminChapterDto
  ) {
    return this.novelsService.updateAdminChapter(req.user.role, id, chapterId, dto);
  }

  @Delete(":id/chapters/:chapterId")
  async deleteChapter(
    @Req() req: AuthenticatedRequest,
    @Param("chapterId") chapterId: string
  ) {
    return this.novelsService.deleteAdminChapter(req.user.role, chapterId);
  }
}
