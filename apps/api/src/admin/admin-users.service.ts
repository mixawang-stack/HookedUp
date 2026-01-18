import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type AdminUsersQuery = {
  search?: string;
  country?: string;
  gender?: string;
  member?: string;
  activeDays?: number;
  page?: number;
  limit?: number;
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUsersQuery) {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      const needle = query.search.trim();
      if (needle.length > 0) {
        where.OR = [
          { email: { contains: needle, mode: "insensitive" } },
          { maskName: { contains: needle, mode: "insensitive" } }
        ];
      }
    }
    if (query.country) {
      where.country = query.country;
    }
    if (query.gender) {
      where.gender = query.gender;
    }
    if (query.activeDays && query.activeDays > 0) {
      const since = new Date(Date.now() - query.activeDays * 24 * 60 * 60 * 1000);
      where.updatedAt = { gte: since };
    }

    const pageSize = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * pageSize;

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          maskName: true,
          maskAvatarUrl: true,
          country: true,
          gender: true,
          dob: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          _count: {
            select: {
              traces: true,
              createdRooms: true,
              messagesSent: true
            }
          }
        }
      })
    ]);

    const items = users.map((user) => ({
      ...user,
      membershipStatus: "FREE",
      lastActiveAt: user.updatedAt,
      activityCounts: {
        posts: user._count.traces,
        rooms: user._count.createdRooms,
        privateChats: user._count.messagesSent
      }
    }));

    return {
      items,
      total,
      page,
      pageSize
    };
  }

  async getFilterOptions() {
    const [total, countryGroups, genderGroups] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ["country"],
        where: { country: { not: null } },
        _count: { _all: true }
      }),
      this.prisma.user.groupBy({
        by: ["gender"],
        where: { gender: { not: null } },
        _count: { _all: true }
      })
    ]);

    const countries = countryGroups
      .map((item) => ({
        value: (item.country ?? "").trim(),
        count: item._count._all
      }))
      .filter((item) => item.value.length > 0)
      .sort((a, b) => b.count - a.count);

    const genders = genderGroups
      .map((item) => ({
        value: (item.gender ?? "").trim(),
        count: item._count._all
      }))
      .filter((item) => item.value.length > 0)
      .sort((a, b) => b.count - a.count);

    return {
      total,
      countries,
      genders
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preference: true,
        verifications: true
      }
    });
    if (!user) {
      return null;
    }

    const reportCount = await this.prisma.report.count({
      where: {
        targetType: "USER",
        targetId: userId
      }
    });

    return {
      id: user.id,
      email: user.email,
      maskName: user.maskName,
      maskAvatarUrl: user.maskAvatarUrl,
      bio: user.bio,
      country: user.country,
      city: user.city,
      gender: user.gender,
      dob: user.dob,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      membershipStatus: "FREE",
      compliance: {
        isAgeVerified: Boolean(user.ageVerifiedAt),
        reports: reportCount,
        status: user.status
      },
      preference: user.preference,
      verifications: user.verifications,
      commercial: {
        subscriptions: [],
        novelPurchases: []
      }
    };
  }
}
