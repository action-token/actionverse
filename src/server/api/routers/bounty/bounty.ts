import { z } from "zod";
import { BountyStatus, MediaType, NotificationType } from "@prisma/client";
import OpenAI from "openai";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  SendBountyBalanceGenericToMother,
  claimRewardForUser,
} from "~/lib/stellar/bounty/bounty";
import { SignUser } from "~/lib/stellar/utils";
import { PLATFORM_ASSET, PLATFORM_FEE } from "~/lib/stellar/constant";
import { env } from "~/env";
import { getplatformAssetNumberForXLM } from "~/lib/stellar/fan/get_token_price";
import {
  broadcastBounty,
  invalidateTelegramConfig,
} from "~/lib/telegram/broadcast-bounty";

// Helper: include shape used by bounty queries that surface the owner.
// Returns `name`, `image`, and `id` of the user (not the legacy creator profile).
const ownerSelect = { id: true, name: true, image: true } as const;

export const BountyRoute = createTRPCRouter({
  // ── ANY AUTHORIZED USER: get XDR to pay into mother wallet ───────────────
  getCreateBountyXDR: protectedProcedure
    .input(
      z.object({
        prize: z.number().positive(),
        signWith: SignUser,
        assetCode: z.string().default(""),
        assetIssuer: z.string().nullable().default(null),
        fromCreatorWallet: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromCreatorWallet) {
        const creator = await ctx.db.creator.findUniqueOrThrow({
          where: { id: ctx.session.user.id },
          select: { storageSecret: true },
        });
        return await SendBountyBalanceGenericToMother({
          prize: input.prize,
          signWith: input.signWith,
          userPubKey: ctx.session.user.id,
          assetCode: input.assetCode,
          assetIssuer: input.assetIssuer,
          fromCreatorStorage: true,
          storageSecret: creator.storageSecret ?? undefined,
        });
      }

      return await SendBountyBalanceGenericToMother({
        prize: input.prize,
        signWith: input.signWith,
        userPubKey: ctx.session.user.id,
        assetCode: input.assetCode,
        assetIssuer: input.assetIssuer,
      });

    }),

  // ── ANY AUTHORIZED USER: create bounty after payment confirmed ────────────
  createBounty: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(120),
        summary: z.string().max(600),
        description: z.string().max(6000),
        prizeAmount: z.number().positive(),
        rewardNote: z.string().max(600).optional(),
        maxWinners: z.number().int().positive(),
        instructions: z.array(z.string()).min(1),
        prizeAssetCode: z.string(),
        prizeAssetIssuer: z.string().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.create({
        data: {
          title: input.title,
          summary: input.summary,
          description: input.description,
          prizeAmount: input.prizeAmount,
          rewardNote: input.rewardNote,
          maxWinners: input.maxWinners,
          instructions: input.instructions,
          userId: ctx.session.user.id,
          prizeAssetCode: input.prizeAssetCode,
          prizeAssetIssuer: input.prizeAssetIssuer,
        },
        include: { user: { select: { name: true } } },
      });

      // Fire-and-forget: notify the Telegram channel if the admin has configured one.
      // Errors are swallowed so a Telegram outage never fails bounty creation.
      void broadcastBounty({
        id: bounty.id,
        title: bounty.title,
        summary: bounty.summary,
        prizeAmount: bounty.prizeAmount,
        prizeAssetCode: bounty.prizeAssetCode,
        maxWinners: bounty.maxWinners,
        creatorName: bounty.user.name ?? "Unknown",
      }).catch((err) =>
        console.error("[telegram] bounty broadcast failed:", err),
      );

      return bounty;
    }),

  // ── OWNER: update bounty info ─────────────────────────────────────────────
  updateBounty: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        title: z.string().min(1).max(120).optional(),
        summary: z.string().max(600).optional(),
        description: z.string().max(6000).optional(),
        rewardNote: z.string().max(600).optional(),
        maxWinners: z.number().int().positive().optional(),
        instructions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");

      const { bountyId, ...data } = input;
      return ctx.db.bounty.update({
        where: { id: bountyId },
        data,
      });
    }),

  // ── OWNER: change bounty status ───────────────────────────────────────────
  updateBountyStatus: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        status: z.nativeEnum(BountyStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");

      return ctx.db.bounty.update({
        where: { id: input.bountyId },
        data: { status: input.status },
      });
    }),

  // ── OWNER: list own bounties ──────────────────────────────────────────────
  getMyBounties: protectedProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().default(20),
        status: z.nativeEnum(BountyStatus).optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.bounty.findMany({
        where: {
          userId: ctx.session.user.id,
          status: input.status,
          title: input.search
            ? { contains: input.search, mode: "insensitive" }
            : undefined,
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: ownerSelect },
          _count: {
            select: { participants: true, submissions: true, winners: true },
          },
        },
      });

      let nextCursor: number | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  // ── OWNER: get single bounty with full details ────────────────────────────
  getBountyForOwner: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        include: {
          user: { select: ownerSelect },
          _count: {
            select: { participants: true, submissions: true, winners: true },
          },
          winners: {
            include: {
              user: { select: ownerSelect },
            },
          },
        },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");
      return bounty;
    }),

  // ── OWNER: get all submissions for a bounty ───────────────────────────────
  getBountySubmissions: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: { userId: true },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");

      return ctx.db.bountySubmission.findMany({
        where: { bountyId: input.bountyId },
        include: {
          user: { select: ownerSelect },
          media: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ── OWNER: select winner ──────────────────────────────────────────────────
  selectWinner: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        winnerId: z.string(),
        prizeAmount: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        include: { _count: { select: { winners: true } } },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");
      if (bounty._count.winners >= bounty.maxWinners)
        throw new Error("Maximum winners already selected");

      const existing = await ctx.db.bountyWinner.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: input.winnerId,
          },
        },
      });
      if (existing) throw new Error("User is already a winner");

      const winner = await ctx.db.bountyWinner.create({
        data: {
          bountyId: input.bountyId,
          userId: input.winnerId,
          prizeAmount: input.prizeAmount,
        },
      });

      // Notify winner
      const notifObj = await ctx.db.notificationObject.create({
        data: {
          entityType: NotificationType.BOUNTY_WINNER,
          entityId: bounty.id,
          actorId: ctx.session.user.id,
        },
      });
      await ctx.db.notification.create({
        data: {
          notificationObjectId: notifObj.id,
          notifierId: input.winnerId,
          isCreator: false,
        },
      });

      return winner;
    }),

  // ── USER: public bounty list ───────────────────────────────────────────────
  getPublicBounties: publicProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().default(20),
        search: z.string().optional(),
        sortBy: z.enum(["newest", "prize"]).default("newest"),
        filter: z.enum(["all", "not_joined"]).default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orderBy =
        input.sortBy === "prize"
          ? { prizeAmount: "desc" as const }
          : { createdAt: "desc" as const };

      const userId = ctx.session?.user?.id;
      let joinedBountyIds: number[] = [];

      if (userId && input.filter === "not_joined") {
        const joined = await ctx.db.bountyParticipant.findMany({
          where: { userId },
          select: { bountyId: true },
        });
        joinedBountyIds = joined.map((p) => p.bountyId);
      }

      const items = await ctx.db.bounty.findMany({
        where: {
          status: { not: BountyStatus.COMPLETED },
          title: input.search
            ? { contains: input.search, mode: "insensitive" }
            : undefined,
          ...(userId && input.filter === "not_joined" ? { userId: { not: userId } } : {}),
          ...(joinedBountyIds.length > 0 ? { id: { notIn: joinedBountyIds } } : {}),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy,
        include: {
          user: { select: ownerSelect },
          _count: {
            select: { participants: true, submissions: true, winners: true },
          },
        },
      });

      let nextCursor: number | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  // ── USER: single bounty public view ───────────────────────────────────────
  getBounty: publicProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        include: {
          user: { select: ownerSelect },
          _count: {
            select: { participants: true, submissions: true, winners: true },
          },
          winners: {
            include: {
              user: { select: ownerSelect },
            },
          },
          participants: {
            include: {
              user: { select: ownerSelect },
            },
            take: 20,
            orderBy: { joinedAt: "desc" },
          },
        },
      });
      if (!bounty) throw new Error("Bounty not found");
      return bounty;
    }),

  // ── USER: join bounty ──────────────────────────────────────────────────────
  joinBounty: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: { id: true, status: true, title: true, userId: true },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId === ctx.session.user.id)
        throw new Error("You cannot join your own bounty");
      if (bounty.status !== BountyStatus.RUNNING)
        throw new Error("Bounty is not accepting participants");

      const existing = await ctx.db.bountyParticipant.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (existing) throw new Error("Already joined");

      const participant = await ctx.db.bountyParticipant.create({
        data: { bountyId: input.bountyId, userId: ctx.session.user.id },
      });

      // Notify owner
      const notifObj = await ctx.db.notificationObject.create({
        data: {
          entityType: NotificationType.BOUNTY_PARTICIPANT,
          entityId: bounty.id,
          actorId: ctx.session.user.id,
        },
      });
      await ctx.db.notification.create({
        data: {
          notificationObjectId: notifObj.id,
          notifierId: bounty.userId,
          isCreator: false,
        },
      });

      return participant;
    }),

  // ── USER: get joined + own bounties (for /bounty/joined page) ─────────────
  // Uses in-memory merge + paginate. The combined list is small (one user's
  // own + joined bounties) so cursor pagination across two queries is overkill.
  getMyBountiesCombined: protectedProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().default(20),
        search: z.string().optional(),
        sortBy: z
          .enum(["newest", "oldest", "prize_high", "prize_low", "title"])
          .default("newest"),
        filter: z.enum(["all", "joined", "owned"]).default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const search = input.search
        ? { contains: input.search, mode: "insensitive" as const }
        : undefined;

      const includeBounty = {
        user: { select: ownerSelect },
        _count: {
          select: { participants: true, submissions: true, winners: true },
        },
      } as const;

      const wantJoined = input.filter === "all" || input.filter === "joined";
      const wantOwned = input.filter === "all" || input.filter === "owned";

      const [owned, joined] = await Promise.all([
        wantOwned
          ? ctx.db.bounty.findMany({
            where: { userId, title: search },
            include: includeBounty,
          })
          : Promise.resolve([]),
        wantJoined
          ? ctx.db.bountyParticipant.findMany({
            where: { userId, bounty: { title: search } },
            include: { bounty: { include: includeBounty } },
            orderBy: { joinedAt: "desc" },
          })
          : Promise.resolve([]),
      ]);

      type Row = {
        bountyId: number;
        owned: boolean;
        joinedAt: Date;
        bounty: (typeof owned)[number];
      };

      // Owned takes precedence over joined when both exist (dedupe by bountyId).
      const map = new Map<number, Row>();
      for (const j of joined) {
        map.set(j.bountyId, {
          bountyId: j.bountyId,
          owned: false,
          joinedAt: j.joinedAt,
          bounty: j.bounty,
        });
      }
      for (const o of owned) {
        map.set(o.id, {
          bountyId: o.id,
          owned: true,
          joinedAt: o.createdAt,
          bounty: o,
        });
      }

      const all = Array.from(map.values());

      const cmp = (a: Row, b: Row) => {
        switch (input.sortBy) {
          case "oldest":
            return a.bounty.createdAt.getTime() - b.bounty.createdAt.getTime();
          case "prize_high":
            return b.bounty.prizeAmount - a.bounty.prizeAmount;
          case "prize_low":
            return a.bounty.prizeAmount - b.bounty.prizeAmount;
          case "title":
            return a.bounty.title.localeCompare(b.bounty.title);
          case "newest":
          default:
            return b.bounty.createdAt.getTime() - a.bounty.createdAt.getTime();
        }
      };
      all.sort(cmp);

      const startIndex = input.cursor ?? 0;
      const slice = all.slice(startIndex, startIndex + input.limit);
      const nextCursor =
        startIndex + slice.length < all.length ? startIndex + slice.length : undefined;

      return { items: slice, nextCursor };
    }),

  // ── USER: get my joined bounties (sidebar preview) ────────────────────────
  getJoinedBounties: protectedProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.bountyParticipant.findMany({
        where: { userId: ctx.session.user.id },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { joinedAt: "desc" },
        include: {
          bounty: {
            include: {
              user: { select: ownerSelect },
              _count: {
                select: { participants: true, submissions: true, winners: true },
              },
            },
          },
        },
      });

      let nextCursor: number | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  // ── USER: submit report ───────────────────────────────────────────────────
  submitReport: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        content: z.string().min(1),
        media: z
          .array(
            z.object({
              url: z.string(),
              type: z.nativeEnum(MediaType),
              fileName: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: { id: true, status: true, userId: true, title: true },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.status !== BountyStatus.RUNNING)
        throw new Error("Bounty is not accepting submissions");

      const participant = await ctx.db.bountyParticipant.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (!participant) throw new Error("You must join the bounty first");

      const submission = await ctx.db.bountySubmission.create({
        data: {
          bountyId: input.bountyId,
          userId: ctx.session.user.id,
          content: input.content,
          media: input.media
            ? {
              create: input.media.map((m) => ({
                url: m.url,
                type: m.type,
                fileName: m.fileName,
              })),
            }
            : undefined,
        },
        include: { media: true },
      });

      // Notify owner
      const notifObj = await ctx.db.notificationObject.create({
        data: {
          entityType: NotificationType.BOUNTY_SUBMISSION,
          entityId: bounty.id,
          actorId: ctx.session.user.id,
        },
      });
      await ctx.db.notification.create({
        data: {
          notificationObjectId: notifObj.id,
          notifierId: bounty.userId,
          isCreator: false,
        },
      });

      return submission;
    }),

  // ── USER: get my submissions for a bounty ────────────────────────────────
  getMySubmissions: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.bountySubmission.findMany({
        where: { bountyId: input.bountyId, userId: ctx.session.user.id },
        include: {
          user: { select: ownerSelect },
          media: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ── USER: check participation ─────────────────────────────────────────────
  getMyParticipation: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const participant = await ctx.db.bountyParticipant.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
      });
      const winner = await ctx.db.bountyWinner.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
      });
      return { joined: !!participant, winner };
    }),

  // ── USER: claim reward ─────────────────────────────────────────────────────
  getClaimRewardXDR: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("getClaimRewardXDR called with", input);
      const winner = await ctx.db.bountyWinner.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
        include: {
          bounty: {
            select: { prizeAssetCode: true, prizeAssetIssuer: true },
          },
        },
      });
      if (!winner) throw new Error("You are not a winner");
      if (winner.claimedAt) throw new Error("Reward already claimed");

      const assetCode = winner.bounty.prizeAssetCode;
      const assetIssuer = winner.bounty.prizeAssetIssuer;

      const result = await claimRewardForUser({
        pubKey: ctx.session.user.id,
        rewardAmount: winner.prizeAmount,
        assetCode,
        assetIssuer,
        signWith: input.signWith,
      });
      return result;
    }),

  claimReward: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const winner = await ctx.db.bountyWinner.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (!winner) throw new Error("You are not a winner");
      if (winner.claimedAt) throw new Error("Reward already claimed");

      await ctx.db.bountyWinner.update({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
        data: { claimedAt: new Date() },
      });

      return { success: true };
    }),

  // ── TOP bounties (by prize, RUNNING only) ──────────────────────────────────
  getTopBounties: publicProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.bounty.findMany({
        where: { status: BountyStatus.RUNNING },
        take: input.limit,
        orderBy: { prizeAmount: "desc" },
        include: {
          user: { select: ownerSelect },
          _count: {
            select: { participants: true, submissions: true, winners: true },
          },
        },
      });
    }),

  // ── Recent activities (public feed) ────────────────────────────────────────
  getRecentActivities: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const [recentParticipants, recentSubmissions, recentWinners] =
        await Promise.all([
          ctx.db.bountyParticipant.findMany({
            take: input.limit,
            orderBy: { joinedAt: "desc" },
            include: {
              user: { select: ownerSelect },
              bounty: { select: { id: true, title: true } },
            },
          }),
          ctx.db.bountySubmission.findMany({
            take: input.limit,
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: ownerSelect },
              bounty: { select: { id: true, title: true } },
            },
          }),
          ctx.db.bountyWinner.findMany({
            take: input.limit,
            orderBy: { selectedAt: "desc" },
            include: {
              user: { select: ownerSelect },
              bounty: { select: { id: true, title: true } },
            },
          }),
        ]);

      type Activity = {
        id: string;
        type: "join" | "submit" | "win";
        bountyId: number;
        bountyTitle: string;
        userName: string | null;
        userImage: string | null;
        userId: string;
        createdAt: Date;
      };

      const activities: Activity[] = [
        ...recentParticipants.map((p) => ({
          id: `join-${p.id}`,
          type: "join" as const,
          bountyId: p.bountyId,
          bountyTitle: p.bounty.title,
          userName: p.user.name,
          userImage: p.user.image,
          userId: p.userId,
          createdAt: p.joinedAt,
        })),
        ...recentSubmissions.map((s) => ({
          id: `submit-${s.id}`,
          type: "submit" as const,
          bountyId: s.bountyId,
          bountyTitle: s.bounty.title,
          userName: s.user.name,
          userImage: s.user.image,
          userId: s.userId,
          createdAt: s.createdAt,
        })),
        ...recentWinners.map((w) => ({
          id: `win-${w.id}`,
          type: "win" as const,
          bountyId: w.bountyId,
          bountyTitle: w.bounty.title,
          userName: w.user.name,
          userImage: w.user.image,
          userId: w.userId,
          createdAt: w.selectedAt,
        })),
      ];

      activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return activities.slice(0, input.limit);
    }),

  // ── Owner recent activities (own bounties) ─────────────────────────────────
  getOwnerActivities: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const ownedBountyIds = await ctx.db.bounty
        .findMany({
          where: { userId: ctx.session.user.id },
          select: { id: true },
        })
        .then((b) => b.map((x) => x.id));

      if (!ownedBountyIds.length) return [];

      const [recentParticipants, recentSubmissions, recentWinners] =
        await Promise.all([
          ctx.db.bountyParticipant.findMany({
            where: { bountyId: { in: ownedBountyIds } },
            take: input.limit,
            orderBy: { joinedAt: "desc" },
            include: {
              user: { select: ownerSelect },
              bounty: { select: { id: true, title: true } },
            },
          }),
          ctx.db.bountySubmission.findMany({
            where: { bountyId: { in: ownedBountyIds } },
            take: input.limit,
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: ownerSelect },
              bounty: { select: { id: true, title: true } },
            },
          }),
          ctx.db.bountyWinner.findMany({
            where: { bountyId: { in: ownedBountyIds } },
            take: input.limit,
            orderBy: { selectedAt: "desc" },
            include: {
              user: { select: ownerSelect },
              bounty: { select: { id: true, title: true } },
            },
          }),
        ]);

      type Activity = {
        id: string;
        type: "join" | "submit" | "win";
        bountyId: number;
        bountyTitle: string;
        userName: string | null;
        userImage: string | null;
        userId: string;
        createdAt: Date;
      };

      const activities: Activity[] = [
        ...recentParticipants.map((p) => ({
          id: `join-${p.id}`,
          type: "join" as const,
          bountyId: p.bountyId,
          bountyTitle: p.bounty.title,
          userName: p.user.name,
          userImage: p.user.image,
          userId: p.userId,
          createdAt: p.joinedAt,
        })),
        ...recentSubmissions.map((s) => ({
          id: `submit-${s.id}`,
          type: "submit" as const,
          bountyId: s.bountyId,
          bountyTitle: s.bounty.title,
          userName: s.user.name,
          userImage: s.user.image,
          userId: s.userId,
          createdAt: s.createdAt,
        })),
        ...recentWinners.map((w) => ({
          id: `win-${w.id}`,
          type: "win" as const,
          bountyId: w.bountyId,
          bountyTitle: w.bounty.title,
          userName: w.user.name,
          userImage: w.user.image,
          userId: w.userId,
          createdAt: w.selectedAt,
        })),
      ];

      activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return activities.slice(0, input.limit);
    }),

  // ── ANY AUTHORIZED USER: AI-draft a bounty from a short idea prompt ───────
  draftBounty: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(5).max(2000),
      }),
    )
    .mutation(async ({ input }) => {
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

      const systemPrompt = `You are an assistant for users on the Actionverse platform who want to launch a bounty (a public challenge with a token reward for the best submissions).

Given a short idea from the user, generate a complete draft of the bounty. Return ONLY a JSON object with this exact shape:

{
  "title": string,            // <= 120 chars, catchy and specific
  "summary": string,          // <= 600 chars, a one-liner for cards
  "description": string,      // <= 6000 chars, markdown with sections: Overview, Goals, Evaluation Criteria, Deliverables
  "prizeAmount": number,      // suggested prize in whole tokens, between 10 and 100000
  "maxWinners": number,       // 1-10, pick what fits the task
  "rewardNote": string,       // <= 600 chars, how/when the reward is delivered (e.g. escrow, timeline, payment method)
  "instructions": string[]    // 3-6 short strings, each <= 200 chars, describing what participants must submit
}

Rules:
- Be concrete and actionable, not generic.
- Match the tone to the user's idea (technical, creative, community, etc.).
- "instructions" should be a flat array of strings (no numbering, no bullets inside the strings).
- Do NOT wrap the JSON in markdown code blocks.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.prompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = {};
      }

      const safeStr = (v: unknown, max: number): string => {
        if (typeof v !== "string") return "";
        return v.slice(0, max);
      };

      const safeNum = (v: unknown, min: number, max: number, fallback: number): number => {
        if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
        return Math.min(Math.max(Math.floor(v), min), max);
      };

      const instructions = Array.isArray(parsed.instructions)
        ? (parsed.instructions as unknown[])
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.slice(0, 200))
          .slice(0, 10)
        : [];

      return {
        title: safeStr(parsed.title, 120),
        summary: safeStr(parsed.summary, 600),
        description: safeStr(parsed.description, 6000),
        prizeAmount: safeNum(parsed.prizeAmount, 1, 1000000, 100),
        maxWinners: safeNum(parsed.maxWinners, 1, 10, 1),
        rewardNote: safeStr(parsed.rewardNote, 600),
        instructions,
      };
    }),
  getplatformAssetNumberForXLM: protectedProcedure
    .input(
      z.object({
        xlm: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await getplatformAssetNumberForXLM(input.xlm);
    }),

});
