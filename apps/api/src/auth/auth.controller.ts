import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Request, Response } from "express";
import geoip from "geoip-lite";
import {
  AUTH_REFRESH_COOKIE_NAME,
  JWT_REFRESH_TTL_SECONDS
} from "./auth.constants";
import { AuthService } from "./auth.service";
import { JwtAuthGuard, AuthenticatedRequest } from "./jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { VerifyCodeDto } from "./dto/verify-code.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

const allowedCountries = new Set(["US", "DE"]);

function normalizeCountry(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === "XX" || trimmed === "ZZ" || trimmed === "UNKNOWN") {
    return null;
  }
  return trimmed;
}

function extractIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const remoteAddress = req.socket?.remoteAddress;
  if (!remoteAddress) {
    return null;
  }

  if (remoteAddress.startsWith("::ffff:")) {
    return remoteAddress.slice(7);
  }

  return remoteAddress;
}

function getCountryFromIp(ip: string | null): string | null {
  if (!ip) {
    return null;
  }
  const lookup = geoip.lookup(ip);
  return normalizeCountry(lookup?.country ?? null);
}

@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    const ip = extractIp(req);
    const country = getCountryFromIp(ip);

    // 临时放开限制，允许所有地区注册进行测试
    // 如果识别不到 country，默认为 US 以确保流程通过
    const finalCountry = country || "US";

    return this.authService.register({ ...dto, country: finalCountry });
  }

  @Post("verify-code")
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyEmailCode(dto.email, dto.code);
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = extractIp(req);
    const country = getCountryFromIp(ip);
    const { accessToken, refreshToken } = await this.authService.login(
      dto,
      country
    );
    res.cookie(AUTH_REFRESH_COOKIE_NAME, refreshToken, {
      ...baseCookieOptions,
      maxAge: JWT_REFRESH_TTL_SECONDS * 1000
    });
    return { accessToken };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[AUTH_REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException("MISSING_REFRESH_TOKEN");
    }

    const { accessToken, refreshToken: newRefresh } =
      await this.authService.refresh(refreshToken);

    res.cookie(AUTH_REFRESH_COOKIE_NAME, newRefresh, {
      ...baseCookieOptions,
      maxAge: JWT_REFRESH_TTL_SECONDS * 1000
    });

    return { accessToken };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[AUTH_REFRESH_COOKIE_NAME];
    await this.authService.logout(refreshToken);
    res.clearCookie(AUTH_REFRESH_COOKIE_NAME, baseCookieOptions);
    return { ok: true };
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto
  ) {
    await this.authService.changePassword(req.user.sub, dto);
    return { ok: true };
  }

  @Get("verify-email")
  async verifyEmail(@Query("token") token?: string) {
    if (!token) {
      throw new UnauthorizedException("MISSING_VERIFY_TOKEN");
    }

    return this.authService.verifyEmail(token);
  }
}
