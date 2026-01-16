import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

export type AuditLogInput = {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metaJson?: Prisma.InputJsonValue | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metaJson: entry.metaJson ?? Prisma.JsonNull
      }
    });
  }
}
