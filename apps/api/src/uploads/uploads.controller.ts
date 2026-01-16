import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomBytes } from "crypto";
import path from "path";
import { diskStorage } from "multer";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma.service";
import { API_PUBLIC_BASE_URL } from "../auth/auth.constants";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  STORAGE_DIR,
  TRACE_IMAGE_MAX_BYTES,
  TRACE_IMAGE_MIME_TYPES
} from "./uploads.constants";
import { UploadsService } from "./uploads.service";

const uploadStorage = diskStorage({
  destination: STORAGE_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const token = randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${token}${ext}`);
  }
});

const uploadInterceptor = FileInterceptor("file", {
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"), false);
    }
    return cb(null, true);
  }
});

const imageUploadInterceptor = FileInterceptor("file", {
  storage: uploadStorage,
  limits: { fileSize: TRACE_IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!TRACE_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_IMAGE_TYPE"), false);
    }
    return cb(null, true);
  }
});

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @UseInterceptors(uploadInterceptor)
  async upload(@Req() req: AuthenticatedRequest) {
    const file = req.file as Express.Multer.File | undefined;
    return this.uploadsService.processUpload(file, req.user.sub, "generic");
  }

  @Post("avatar")
  @UseInterceptors(uploadInterceptor)
  async uploadAvatar(@Req() req: AuthenticatedRequest) {
    const file = req.file as Express.Multer.File | undefined;
    const result = await this.uploadsService.processUpload(
      file,
      req.user.sub,
      "avatar"
    );
    const avatarUrl = `${API_PUBLIC_BASE_URL}/uploads/${result.fileKey}`;

    await this.prisma.user.update({
      where: { id: req.user.sub },
      data: { maskAvatarUrl: avatarUrl }
    });

    return { ...result, avatarUrl };
  }

  @Post("image")
  @UseInterceptors(imageUploadInterceptor)
  async uploadTraceImage(@Req() req: AuthenticatedRequest) {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      throw new BadRequestException("MISSING_FILE");
    }
    const result = await this.uploadsService.processUpload(
      file,
      req.user.sub,
      "trace-image"
    );
    const imageUrl = `${API_PUBLIC_BASE_URL}/uploads/${result.fileKey}`;

    const dimensions = await this.uploadsService.getImageDimensions(file.path);
    const response = {
      imageUrl,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null
    };
    console.log("Upload response:", response);
    return response;
  }
}
