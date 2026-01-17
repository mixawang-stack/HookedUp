import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateTraceDto } from "./dto/create-trace.dto";
import { UpdateTraceDto } from "./dto/update-trace.dto";
import { TracesService } from "./traces.service";

@Controller("traces")
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createTrace(
    @Req() req: { user: { sub: string; role: string } },
    @Body() dto: CreateTraceDto
  ) {
    return this.tracesService.createTrace(req.user.sub, req.user.role, dto);
  }

  @Post(":id/replies")
  @UseGuards(JwtAuthGuard)
  async createReply(
    @Req() req: { user: { sub: string; role: string } },
    @Param("id") traceId: string,
    @Body() dto: CreateTraceDto
  ) {
    return this.tracesService.createReply(traceId, req.user.sub, req.user.role, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async listMyTraces(
    @Req() req: { user: { sub: string } },
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.tracesService.listMyTraces(
      req.user.sub,
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async deleteTrace(
    @Req() req: { user: { sub: string; role: string } },
    @Param("id") traceId: string
  ) {
    return this.tracesService.deleteTrace(req.user.sub, req.user.role, traceId);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async updateTrace(
    @Req() req: { user: { sub: string; role: string } },
    @Param("id") traceId: string,
    @Body() dto: UpdateTraceDto
  ) {
    return this.tracesService.updateTrace(req.user.sub, req.user.role, traceId, dto);
  }

  @Get(":id")
  async getTrace(
    @Param("id") traceId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.tracesService.getTrace(
      traceId,
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined
    );
  }
}
