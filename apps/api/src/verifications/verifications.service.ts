import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { promises as fs } from "fs";
import path from "path";
import { VerificationStatus, VerificationType } from "@prisma/client";
import { AuditService } from "../audit.service";
import { CryptoService } from "../crypto.service";
import { PrismaService } from "../prisma.service";
import { STORAGE_DIR } from "../uploads/uploads.constants";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async createVerification(
    userId: string,
    type: VerificationType,
    file: Express.Multer.File | undefined
  ) {
    const upload = await this.uploadsService.processUpload(
      file,
      userId,
      `verification:${type}`
    );

    const sourcePath = path.join(STORAGE_DIR, upload.fileKey);
    const encryptedKey = `${upload.fileKey}.enc`;
    const encryptedPath = path.join(STORAGE_DIR, encryptedKey);

    const fileBuffer = await fs.readFile(sourcePath);
    const encrypted = this.crypto.encryptBuffer(fileBuffer);
    await fs.writeFile(encryptedPath, encrypted.ciphertext);
    await fs.unlink(sourcePath).catch(() => null);

    const metadata = {
      keyId: encrypted.keyId,
      iv: encrypted.iv.toString("base64"),
      tag: encrypted.tag.toString("base64"),
      originalName: upload.originalName,
      mimeType: upload.mimeType
    };

    const verification = await this.prisma.verification.create({
      data: {
        userId,
        type,
        status: VerificationStatus.PENDING,
        fileKey: encryptedKey,
        fileHash: upload.fileHash,
        metadataJson: this.crypto.encrypt(JSON.stringify(metadata))
      }
    });

    await this.audit.log({
      actorId: userId,
      action: "VERIFICATION_SUBMITTED",
      targetType: "Verification",
      targetId: verification.id,
      metaJson: {
        type,
        fileKey: encryptedKey
      }
    });

    return verification;
  }

  async listForUser(userId: string) {
    const verifications = await this.prisma.verification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return verifications.map((verification) => ({
      ...verification,
      reason: verification.reason ? this.safeDecrypt(verification.reason) : null
    }));
  }

  async listAll(role: string, status?: VerificationStatus) {
    if (role !== "ADMIN") {
      throw new ForbiddenException("ADMIN_ONLY");
    }

    const verifications = await this.prisma.verification.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" }
    });

    return verifications.map((verification) => ({
      ...verification,
      reason: verification.reason ? this.safeDecrypt(verification.reason) : null
    }));
  }

  async getVerificationFile(
    requesterId: string,
    role: string,
    verificationId: string
  ) {
    const verification = await this.prisma.verification.findUnique({
      where: { id: verificationId }
    });

    if (!verification) {
      throw new BadRequestException("VERIFICATION_NOT_FOUND");
    }

    if (role !== "ADMIN" && verification.userId !== requesterId) {
      throw new ForbiddenException("FORBIDDEN");
    }

    if (!verification.fileKey || !verification.metadataJson) {
      throw new BadRequestException("FILE_NOT_AVAILABLE");
    }

    if (typeof verification.metadataJson !== "string") {
      throw new BadRequestException("FILE_NOT_AVAILABLE");
    }

    const decryptedMetadata = this.crypto.decrypt(verification.metadataJson);
    const metadata = JSON.parse(decryptedMetadata) as {
      keyId?: string;
      iv: string;
      tag: string;
      originalName: string;
      mimeType: string;
    };

    const filePath = path.join(STORAGE_DIR, verification.fileKey);
    const encryptedData = await fs.readFile(filePath);

    const decrypted = this.crypto.decryptBuffer({
      ciphertext: encryptedData,
      iv: Buffer.from(metadata.iv, "base64"),
      tag: Buffer.from(metadata.tag, "base64"),
      keyId: metadata.keyId
    });

    await this.audit.log({
      actorId: requesterId,
      action: "VERIFICATION_FILE_DOWNLOADED",
      targetType: "Verification",
      targetId: verificationId
    });

    return {
      buffer: decrypted,
      contentType: metadata.mimeType ?? "application/octet-stream",
      fileName: metadata.originalName ?? "file"
    };
  }

  parseStatus(raw?: string): VerificationStatus | undefined {
    if (!raw) {
      return undefined;
    }

    const upper = raw.toUpperCase();
    if (upper === "PENDING") return VerificationStatus.PENDING;
    if (upper === "APPROVED") return VerificationStatus.APPROVED;
    if (upper === "REJECTED") return VerificationStatus.REJECTED;

    throw new BadRequestException("INVALID_STATUS");
  }

  private safeDecrypt(payload: string) {
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return "";
    }
  }
}
