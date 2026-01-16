import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { AuthenticatedRequest } from "../auth/jwt-auth.guard";

@Injectable()
export class RoomOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roomId = request.params?.id as string | undefined;
    if (!roomId) {
      return false;
    }
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { createdById: true }
    });
    return Boolean(room && room.createdById === request.user.sub);
  }
}
