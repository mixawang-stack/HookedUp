import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { PrismaService } from "../prisma.service";
import {
  API_PUBLIC_BASE_URL,
  AUTH_ALLOW_UNVERIFIED_LOGIN,
  AUTH_RETURN_VERIFY_TOKEN,
  EMAIL_VERIFY_TTL_SECONDS,
  JWT_ACCESS_SECRET,
  JWT_ACCESS_TTL_SECONDS,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_TTL_SECONDS,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER
} from "./auth.constants";
import { generateToken, hashToken } from "./auth.utils";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

export type RegisterResult = {
  ok: true;
  pending: true;
  verificationToken?: string;
};

export type TokenResult = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    if (!dto.agreeTerms) {
      throw new BadRequestException("TERMS_NOT_ACCEPTED");
    }

    const email = dto.email.trim().toLowerCase();
    const dob = new Date(dto.dob);
    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestException("INVALID_DOB");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    if (existingUser) {
      throw new ConflictException("EMAIL_ALREADY_REGISTERED");
    }

    const verificationCode = this.generateVerificationCode();
    const tokenHash = hashToken(verificationCode);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_SECONDS * 1000);
    const passwordHash = await argon2.hash(dto.password);
    const agreedTermsAt = new Date();

    await this.prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        dob,
        country: (dto.country ?? "US").toUpperCase(),
        agreedTermsAt,
        tokenHash,
        expiresAt
      },
      update: {
        passwordHash,
        dob,
        country: (dto.country ?? "US").toUpperCase(),
        agreedTermsAt,
        tokenHash,
        expiresAt,
        createdAt: new Date()
      }
    });

    try {
      await this.sendVerificationCode(email, verificationCode);
    } catch (error) {
      await this.prisma.pendingRegistration.deleteMany({
        where: { email }
      });
      throw new BadRequestException("EMAIL_SEND_FAILED");
    }

    return {
      ok: true,
      pending: true,
      verificationToken: AUTH_RETURN_VERIFY_TOKEN ? verificationCode : undefined
    };
  }

  async login(
    dto: LoginDto,
    geo?: { country: string; city: string } | null
  ): Promise<TokenResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }

    if (user.status === "BANNED") {
      throw new ForbiddenException("USER_BANNED");
    }
    if (user.status === "DELETED") {
      throw new ForbiddenException("USER_DELETED");
    }
    if (user.status !== "ACTIVE" && user.status !== "SUSPENDED") {
      throw new ForbiddenException("USER_NOT_ACTIVE");
    }

    if (!user.emailVerifiedAt && !AUTH_ALLOW_UNVERIFIED_LOGIN) {
      throw new ForbiddenException("EMAIL_NOT_VERIFIED");
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }

    // Auto-fill missing location data
    if (geo && (!user.country || !user.city)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          country: user.country || geo.country,
          city: user.city || geo.city
        }
      });
    }

    const accessToken = await this.issueAccessToken(user.id, user.role);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<TokenResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!existing) {
      throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    }

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("REFRESH_TOKEN_EXPIRED");
    }

    if (existing.user.status !== "ACTIVE") {
      throw new ForbiddenException("USER_NOT_ACTIVE");
    }

    if (payload.sub !== existing.userId) {
      throw new UnauthorizedException("REFRESH_TOKEN_SUB_MISMATCH");
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });

    const accessToken = await this.issueAccessToken(
      existing.user.id,
      existing.user.role
    );
    const newRefreshToken = await this.createRefreshToken(existing.user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async verifyEmail(token: string): Promise<{ ok: true }> {
    const tokenHash = hashToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("INVALID_VERIFY_TOKEN");
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() }
      })
    ]);

    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, status: true }
    });
    if (!user) {
      throw new UnauthorizedException("USER_NOT_FOUND");
    }
    if (user.status === "BANNED" || user.status === "DELETED") {
      throw new ForbiddenException("USER_NOT_ACTIVE");
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!passwordOk) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  }

  async verifyEmailCode(email: string, code: string): Promise<{ ok: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email: normalizedEmail }
    });

    if (!pending) {
      throw new BadRequestException("INVALID_VERIFY_TOKEN");
    }

    const tokenHash = hashToken(normalizedCode);
    if (pending.tokenHash !== tokenHash || pending.expiresAt < new Date()) {
      throw new BadRequestException("INVALID_VERIFY_TOKEN");
    }

    try {
      await this.prisma.$transaction([
        this.prisma.user.create({
          data: {
            email: pending.email,
            passwordHash: pending.passwordHash,
            dob: pending.dob,
            country: pending.country,
            agreedTermsAt: pending.agreedTermsAt,
            emailVerifiedAt: new Date()
          }
        }),
        this.prisma.pendingRegistration.delete({
          where: { id: pending.id }
        })
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("EMAIL_ALREADY_REGISTERED");
      }
      throw error;
    }

    return { ok: true };
  }

  private async issueAccessToken(userId: string, role: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: JWT_ACCESS_SECRET,
        expiresIn: JWT_ACCESS_TTL_SECONDS
      }
    );
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const jwtToken = await this.jwt.signAsync(
      { sub: userId, jti: generateToken(16) },
      {
        secret: JWT_REFRESH_SECRET,
        expiresIn: JWT_REFRESH_TTL_SECONDS
      }
    );

    const tokenHash = hashToken(jwtToken);
    const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });

    return jwtToken;
  }

  private async verifyRefreshToken(token: string): Promise<{ sub: string }> {
    try {
      return await this.jwt.verifyAsync(token, {
        secret: JWT_REFRESH_SECRET
      });
    } catch {
      throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    }
  }

  private generateVerificationCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000);
    return String(code);
  }

  private async sendVerificationCode(email: string, code: string) {
    if (!SMTP_HOST || !SMTP_FROM) {
      if (AUTH_RETURN_VERIFY_TOKEN) {
        return;
      }
      throw new Error("SMTP_NOT_CONFIGURED");
    }

    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
    });

    const expiresMinutes = Math.floor(EMAIL_VERIFY_TTL_SECONDS / 60);
    const subject = "Your verification code";
    const text = `Your verification code is ${code}. It expires in ${expiresMinutes} minutes.`;

    await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject,
      text
    });
  }
}
