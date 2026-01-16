import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { JWT_ACCESS_SECRET } from "./auth.constants";

export type AuthUser = {
  sub: string;
  role: string;
};

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header) {
      throw new UnauthorizedException("MISSING_AUTHORIZATION");
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("INVALID_AUTHORIZATION");
    }

    try {
      const payload = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: JWT_ACCESS_SECRET
      });
      (request as AuthenticatedRequest).user = {
        sub: payload.sub,
        role: payload.role
      };
      return true;
    } catch {
      throw new UnauthorizedException("INVALID_ACCESS_TOKEN");
    }
  }
}
