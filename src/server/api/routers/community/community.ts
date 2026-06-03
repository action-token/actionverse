import {
  CommunityMemberListVisibility,
  CommunityPostPermission,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

const CreateCommunitySchema = z.object({
  title: z.string().min(1, { message: "Title can't be empty" }).max(100),
  description: z
    .string()
    .min(1, { message: "Description can't be empty" })
    .refine(
      (val) => val.trim().split(/\s+/).length <= 100,
      { message: "Description can't exceed 100 words" },
    ),
  coverUrl: z.string().url(),
  profileUrl: z.string().url(),
  memberListVisibility: z
    .nativeEnum(CommunityMemberListVisibility)
    .default(CommunityMemberListVisibility.EVERYONE),
  postPermission: z
    .nativeEnum(CommunityPostPermission)
    .default(CommunityPostPermission.ALL_MEMBERS),
  isTokenGated: z.boolean().default(false),
  requiredBalance: z.number().min(0).optional(),
  requiredBalanceCode: z.string().optional(),
  requiredBalanceIssuer: z.string().optional(),
});

const UpdateCommunitySchema = z.object({
  communityId: z.number(),
  title: z.string().min(1).max(100).optional(),
  description: z
    .string()
    .min(1)
    .refine(
      (val) => val.trim().split(/\s+/).length <= 100,
      { message: "Description can't exceed 100 words" },
    )
    .optional(),
  coverUrl: z.string().url().optional(),
  profileUrl: z.string().url().optional(),
  memberListVisibility: z.nativeEnum(CommunityMemberListVisibility).optional(),
  postPermission: z.nativeEnum(CommunityPostPermission).optional(),
  isTokenGated: z.boolean().optional(),
  requiredBalance: z.number().min(0).optional(),
  requiredBalanceCode: z.string().optional(),
  requiredBalanceIssuer: z.string().optional(),
});

export const communityRouter = createTRPCRouter({
  create: protectedProcedure
    .input(CreateCommunitySchema)
    .mutation(async ({ input, ctx }) => {
      const userExists = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true },
      });
      if (!userExists) throw new Error("User account not found. Please reconnect your wallet.");

      const community = await ctx.db.community.create({
        data: {
          title: input.title,
          description: input.description,
          coverUrl: input.coverUrl,
          profileUrl: input.profileUrl,
          memberListVisibility: input.memberListVisibility,
          postPermission: input.postPermission,
          isTokenGated: input.isTokenGated,
          requiredBalance: input.requiredBalance,
          requiredBalanceCode: input.requiredBalanceCode,
          requiredBalanceIssuer: input.requiredBalanceIssuer,
          ownerId: ctx.session.user.id,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: "OWNER",
            },
          },
          activities: {
            create: {
              actorId: ctx.session.user.id,
              type: "JOIN",
            },
          },
        },
      });

      return community;
    }),

  update: protectedProcedure
    .input(UpdateCommunitySchema)
    .mutation(async ({ input, ctx }) => {
      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
      });

      if (!community) throw new Error("Community not found");
      if (community.ownerId !== ctx.session.user.id)
        throw new Error("Unauthorized: Only the community owner can update");

      const { communityId, ...updateData } = input;

      return await ctx.db.community.update({
        where: { id: communityId },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ communityId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
      });

      if (!community) throw new Error("Community not found");
      if (community.ownerId !== ctx.session.user.id)
        throw new Error("Unauthorized: Only the community owner can delete");

      await ctx.db.community.delete({
        where: { id: input.communityId },
      });

      return { success: true };
    }),

  getById: publicProcedure
    .input(z.object({ communityId: z.number() }))
    .query(async ({ input, ctx }) => {
      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
          members: {
            take: 5,
            orderBy: { joinedAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      if (!community) throw new Error("Community not found");

      const isMember = ctx.session?.user
        ? await ctx.db.communityMember.findUnique({
            where: {
              communityId_userId: {
                communityId: input.communityId,
                userId: ctx.session.user.id,
              },
            },
          })
        : null;

      // Hide member list if MEMBERS_ONLY and user is not a member
      const memberListLocked =
        community.memberListVisibility === "MEMBERS_ONLY" && !isMember;

      return {
        ...community,
        members: memberListLocked ? [] : community.members,
        memberListLocked,
        isOwner: community.ownerId === ctx.session?.user?.id,
        isMember: !!isMember,
        memberRole: isMember?.role ?? null,
      };
    }),

  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
        search: z.string().optional(),
        filter: z.enum(["ALL", "TOKEN_GATED", "OPEN"]).default("ALL"),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor, skip, search, filter } = input;

      const where: Prisma.CommunityWhereInput = {
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(filter === "TOKEN_GATED" && { isTokenGated: true }),
        ...(filter === "OPEN" && { isTokenGated: false }),
      };

      const communities = await ctx.db.community.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: { createdAt: "desc" },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
          members: {
            take: 5,
            orderBy: { joinedAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (communities.length > limit) {
        const nextItem = communities.pop();
        nextCursor = nextItem?.id;
      }

      // Check membership for logged-in user
      let memberCommunityIds: Set<number> = new Set();
      if (ctx.session?.user) {
        const memberships = await ctx.db.communityMember.findMany({
          where: {
            userId: ctx.session.user.id,
            communityId: { in: communities.map((c) => c.id) },
          },
          select: { communityId: true },
        });
        memberCommunityIds = new Set(memberships.map((m) => m.communityId));
      }

      const communitiesWithMembership = communities.map((community) => ({
        ...community,
        isOwner: community.ownerId === ctx.session?.user?.id,
        isMember: memberCommunityIds.has(community.id),
      }));

      return {
        communities: communitiesWithMembership,
        nextCursor,
      };
    }),

  getTrending: publicProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.community.findMany({
        take: input.limit,
        orderBy: {
          members: { _count: "desc" },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
        },
      });
    }),

  getMyCommunities: protectedProcedure.query(async ({ ctx }) => {
    const [owned, joined] = await Promise.all([
      ctx.db.community.findMany({
        where: { ownerId: ctx.session.user.id },
        include: {
          _count: { select: { members: true, posts: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      ctx.db.community.findMany({
        where: {
          members: {
            some: {
              userId: ctx.session.user.id,
              role: "MEMBER",
            },
          },
        },
        include: {
          _count: { select: { members: true, posts: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { owned, joined };
  }),
});
