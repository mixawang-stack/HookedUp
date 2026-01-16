import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { createReadStream, existsSync, mkdirSync } from "fs";
import path from "path";
import sizeOf from "image-size";
import { PrismaService } from "../prisma.service";
import { STORAGE_DIR } from "./uploads.constants";

export type UploadResult = {
  fileKey: string;
  fileHash: string;
  size: number;
  mimeType: string;
  originalName: string;
};

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  getStorageDir(): string {
    return STORAGE_DIR;
  }

  generateFileName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const token = randomBytes(16).toString("hex");
    return `${Date.now()}-${token}${ext}`;
  }

  async processUpload(
    file: Express.Multer.File | undefined,
    actorId: string | null,
    context: string
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException("MISSING_FILE");
    }

    const fileHash = await this.hashFile(file.path);

    const result: UploadResult = {
      fileKey: file.filename,
      fileHash,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname
    };

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: "UPLOAD_FILE",
        targetType: "Upload",
        targetId: result.fileKey,
        metaJson: {
          context,
          fileHash: result.fileHash,
          size: result.size,
          mimeType: result.mimeType,
          originalName: result.originalName
        }
      }
    });

    return result;
  }

  async getImageDimensions(
    filePath: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      const dimensions = sizeOf(filePath as any);
      if (dimensions.width && dimensions.height) {
        return {
          width: dimensions.width,
          height: dimensions.height
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }
}
