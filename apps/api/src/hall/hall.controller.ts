import { Controller, Get, Req } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { JWT_ACCESS_SECRET } from "../auth/auth.constants";
import { HallService } from "./hall.service";

@Controller("hall")
export class HallController {
  constructor(
    private readonly hallService: HallService,
    private readonly jwt: JwtService
  ) {}

  @Get()
  async getHall(@Req() req: Request) {
    const header = req.headers.authorization;
    let userId: string | null = null;
    if (header) {
      const [scheme, token] = header.split(" ");
      if (scheme === "Bearer" && token) {
        try {
          const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
            secret: JWT_ACCESS_SECRET
          });
          userId = payload.sub;
        } catch {
          userId = null;
        }
      }
    }
    return this.hallService.getHall(userId ?? undefined);
  }
}
