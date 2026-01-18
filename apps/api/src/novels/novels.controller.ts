import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { JwtService } from "@nestjs/jwt";
import { JWT_ACCESS_SECRET } from "../auth/auth.constants";
import { NovelsService } from "./novels.service";

@Controller()
export class NovelsController {
  constructor(
    private readonly novelsService: NovelsService,
    private readonly jwt: JwtService
  ) {}

  @Get("novels")
  async listNovels(
    @Query("limit") limit?: string,
    @Query("featured") featured?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedFeatured =
      featured === undefined ? undefined : featured === "true";
    return this.novelsService.listNovels(
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      parsedFeatured
    );
  }

  @Get("novels/:id/preview")
  async preview(@Param("id") id: string) {
    return this.novelsService.previewNovel(id);
  }

  @Get("recommendations")
  async recommend(@Req() req: Request) {
    const header = req.headers.authorization;
    let userId: string | undefined;
    if (header) {
      const [scheme, token] = header.split(" ");
      if (scheme === "Bearer" && token) {
        try {
          const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
            secret: JWT_ACCESS_SECRET
          });
          userId = payload.sub;
        } catch {
          userId = undefined;
        }
      }
    }
    return this.novelsService.recommendNovels(userId);
  }
}
