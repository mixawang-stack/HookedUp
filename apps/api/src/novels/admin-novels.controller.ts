import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomBytes } from "crypto";
import path from "path";
import { diskStorage } from "multer";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AdminNovelDto } from "./dto/admin-novel.dto";
import { AdminChapterDto } from "./dto/admin-chapter.dto";
import { NovelsService } from "./novels.service";
import { STORAGE_DIR } from "../uploads/uploads.constants";

const pdfUploadInterceptor = FileInterceptor("file", {
  storage: diskStorage({
    destination: STORAGE_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const token = randomBytes(16).toString("hex");
      cb(null, `${Date.now()}-${token}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("UNSUPPORTED_PDF_TYPE"), false);
    }
    return cb(null, true);
  }
});

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

  @Post(":id/pdf")
  @UseInterceptors(pdfUploadInterceptor)
  async uploadPdf(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body("freeCount") freeCount?: string
  ) {
    const parsedFree = freeCount ? Number(freeCount) : undefined;
    return this.novelsService.importPdfChapters(
      req.user.role,
      id,
      req.file,
      Number.isFinite(parsedFree) ? parsedFree : undefined
    );
  }
}
