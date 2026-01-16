import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { VerificationType } from "@prisma/client";
import { randomBytes } from "crypto";
import path from "path";
import { diskStorage } from "multer";
import { Response } from "express";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  STORAGE_DIR
} from "../uploads/uploads.constants";
import { VerificationsService } from "./verifications.service";

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

@Controller("verifications")
@UseGuards(JwtAuthGuard)
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Get("me")
  async listMine(@Req() req: AuthenticatedRequest) {
    return this.verificationsService.listForUser(req.user.sub);
  }

  @Get()
  async listAll(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: string
  ) {
    const parsed = this.verificationsService.parseStatus(status);
    return this.verificationsService.listAll(req.user.role, parsed);
  }

  @Get(":id/file")
  async downloadFile(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Res() res: Response
  ) {
    const file = await this.verificationsService.getVerificationFile(
      req.user.sub,
      req.user.role,
      id
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${file.fileName}\"`
    );
    res.send(file.buffer);
  }

  @Post("age")
  @UseInterceptors(uploadInterceptor)
  async submitAge(@Req() req: AuthenticatedRequest) {
    return this.verificationsService.createVerification(
      req.user.sub,
      VerificationType.AGE,
      req.file as Express.Multer.File | undefined
    );
  }

  @Post("health")
  @UseInterceptors(uploadInterceptor)
  async submitHealth(@Req() req: AuthenticatedRequest) {
    return this.verificationsService.createVerification(
      req.user.sub,
      VerificationType.HEALTH,
      req.file as Express.Multer.File | undefined
    );
  }

  @Post("criminal-record")
  @UseInterceptors(uploadInterceptor)
  async submitCriminal(@Req() req: AuthenticatedRequest) {
    return this.verificationsService.createVerification(
      req.user.sub,
      VerificationType.CRIMINAL_RECORD,
      req.file as Express.Multer.File | undefined
    );
  }
}
