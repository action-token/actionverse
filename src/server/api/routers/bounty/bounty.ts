import { z } from "zod";
import { BountyStatus, MediaType, NotificationType } from "@prisma/client";
import OpenAI from "openai";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildCreateBountyXDR,
  buildSelectWinnerXDR,
  buildClaimXDR,
  verifyContractTransaction,
  buildAdminExtendBountyTTLXDR,
  buildAdminExtendInstanceTTLXDR,
  buildAdminExtendWinnerAwardTTLXDR,
  getContractInstanceTTL,
  getBountyTTL,
  getEscrowCreatorIdentity,
  signEscrowXdr,
} from "~/lib/stellar/bounty/escrow";
import { SignUser, WithSing } from "~/lib/stellar/utils";
import { signXdrTransaction } from "~/lib/stellar/fan/signXDR";

import { BOUNTY_ESCROW_CONTRACT_ID } from "~/lib/common";
import { env } from "~/env";
import { Keypair } from "@stellar/stellar-sdk";

import { getplatformAssetNumberForXLM } from "~/lib/stellar/fan/get_token_price";
import { broadcastBounty } from "~/lib/telegram/broadcast-bounty";
import { deriveValidation, type CaptureValidation } from "~/lib/action-cam/derive-validation";
import { captureMetadataSchema, signCapture, verifyCapture } from "~/lib/action-cam/seal";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "~/server/s3";
import { TRPCError } from "@trpc/server";

// Helper: include shape used by bounty queries that surface the owner.
// Returns `name`, `image`, and `id` of the user (not the legacy creator profile).
const ownerSelect = { id: true, name: true, image: true } as const;

function deriveSubmissionValidation(
  captures: {
    captureType: string | null;
    captureOriginalHash: string | null;
    captureSealedHash: string | null;
    captureSignature: string | null;
    captureCapturedAt: Date | null;
    captureSealedAt: Date | null;
  }[],
): CaptureValidation | null {
  if (captures.length === 0) return null;
  const validations = captures
    .map(deriveValidation)
    .filter((v): v is CaptureValidation => v !== null);
  if (validations.length !== captures.length) return null;

  return {
    live: true,
    stamped: validations.every((v) => v.stamped),
    sealed: validations.every((v) => v.sealed),
    sealedAt: validations.every((v) => v.sealed)
      ? validations.reduce<Date | null>((earliest, v) => {
          if (!v.sealedAt) return earliest;
          return !earliest || v.sealedAt < earliest ? v.sealedAt : earliest;
        }, null)
      : null,
  };
}

export const BountyRoute = createTRPCRouter({
  // ── ANY AUTHORIZED USER: create bounty row (unfunded until payment confirms) ──
  // Contract-backed and legacy bounties both go through create -> pay -> confirm
  // now, so the on-chain bounty_id (== this row's id) always exists before the
  // escrow contract's create_bounty call needs it. For legacy (no escrow
  // contract configured) bounties this is a harmless reordering — the classic
  // payment doesn't depend on when the DB row was created.
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
        // Action Cam: when true, submissions must use the live capture + seal flow.
        // Owner can toggle off later via `updateBounty`.
        requiresActionCam: z.boolean().default(false),
        // Fund escrow from the owner's Creator storage account (custodial,
        // server holds the secret) instead of their own wallet/session identity.
        fromCreatorWallet: z.boolean().default(false),
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
          requiresActionCam: input.requiresActionCam,
          fundedFromCreatorStorage: input.fromCreatorWallet,
          escrowContractId: BOUNTY_ESCROW_CONTRACT_ID,
        },
      });

      return bounty;
    }),

  // ── OWNER: get XDR to fund the bounty's on-chain escrow ───────────────────
  getCreateBountyXDR: protectedProcedure
    .input(z.object({ bountyId: z.number(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");
      if (bounty.txHash) throw new Error("Bounty is already funded");

      const { pubKey: creatorPubKey, storageSecret } = await getEscrowCreatorIdentity(
        ctx.db,
        bounty,
      );
      const xdr = await buildCreateBountyXDR({
        bountyId: bounty.id,
        creatorPubKey,
        assetCode: bounty.prizeAssetCode,
        assetIssuer: bounty.prizeAssetIssuer,
        amount: bounty.prizeAmount,
        maxWinners: bounty.maxWinners,
      });
      const { xdr: signedXdr, fullySignedByServer } = await signEscrowXdr({
        xdr,
        storageSecret,
        signWith: input.signWith,
      });
      return { xdr: signedXdr, pubKey: creatorPubKey, fullySignedByServer };
    }),

  // ── OWNER: confirm funding succeeded on-chain, activate the bounty ───────
  // Verifies the invoke transaction actually succeeded before recording it —
  // the client's report of "submitted" alone is never trusted.
  confirmBountyFunded: protectedProcedure
    .input(z.object({ bountyId: z.number(), txHash: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        include: { user: { select: { name: true } } },
      });
      if (!bounty) throw new Error("Bounty not found");
      if (bounty.userId !== ctx.session.user.id)
        throw new Error("Not authorized");
      if (bounty.txHash) return bounty; // already confirmed — idempotent

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) throw new Error("Funding transaction did not succeed on-chain");

      const updated = await ctx.db.bounty.update({
        where: { id: input.bountyId },
        data: { txHash: input.txHash },
        include: { user: { select: { name: true } } },
      });

      // Fire-and-forget: notify the Telegram channel if the admin has configured one.
      // Errors are swallowed so a Telegram outage never fails bounty funding.
      void broadcastBounty({
        id: updated.id,
        title: updated.title,
        summary: updated.summary,
        prizeAmount: updated.prizeAmount,
        prizeAssetCode: updated.prizeAssetCode,
        maxWinners: updated.maxWinners,
        creatorName: updated.user.name ?? "Unknown",
        requiresActionCam: updated.requiresActionCam,
      }).catch((err) =>
        console.error("[telegram] bounty broadcast failed:", err),
      );

      return updated;
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
        // Owner can flip the Action Cam requirement on or off at any time.
        requiresActionCam: z.boolean().optional(),
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

      const submissions = await ctx.db.bountySubmission.findMany({
        where: { bountyId: input.bountyId },
        include: {
          user: { select: ownerSelect },
          media: true,
          captures: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return submissions.map((s) => ({
        ...s,
        validation: deriveSubmissionValidation(s.captures),
        captures: s.captures.map((c) => ({ ...c, validation: deriveValidation(c) })),
      }));
    }),

  // ── OWNER: get XDR to commit a winner award on-chain (escrow-backed bounties only) ──
  // Legacy bounties have no on-chain step at selection time (payment happens
  // later, when the winner claims) — returns `xdr: null` so the client can
  // skip straight to `selectWinner` below, exactly like before.
  getSelectWinnerXDR: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        winnerId: z.string(),
        prizeAmount: z.number().positive(),
        signWith: SignUser,
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
          bountyId_userId: { bountyId: input.bountyId, userId: input.winnerId },
        },
      });
      if (existing) throw new Error("User is already a winner");

      const { pubKey: creatorPubKey, storageSecret } = await getEscrowCreatorIdentity(
        ctx.db,
        bounty,
      );
      const xdr = await buildSelectWinnerXDR({
        bountyId: bounty.id,
        creatorPubKey,
        winnerPubKey: input.winnerId,
        amount: input.prizeAmount,
      });
      const { xdr: signedXdr, fullySignedByServer } = await signEscrowXdr({
        xdr,
        storageSecret,
        signWith: input.signWith,
      });
      return { xdr: signedXdr, needsUserSign: !fullySignedByServer };
    }),

  // ── OWNER: select winner (confirms on-chain commitment) ───────────────────
  selectWinner: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        winnerId: z.string(),
        prizeAmount: z.number().positive(),
        txHash: z.string(),
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

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) throw new Error("Selection transaction did not succeed on-chain");

      const winner = await ctx.db.bountyWinner.create({
        data: {
          bountyId: input.bountyId,
          userId: input.winnerId,
          prizeAmount: input.prizeAmount,
          txHash: input.txHash,
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

  // ── OWNER: approve / reject a single capture inside a submission ────────────
  // The parent submission status is rolled up automatically after the change:
  //   - all captures APPROVED       → submission.status = APPROVED
  //   - any capture REJECTED        → submission.status = REJECTED
  //   - everything else still PENDING → submission.status = PENDING
  setCaptureStatus: protectedProcedure
    .input(
      z.object({
        captureId: z.number().int().positive(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Look up the capture + its parent submission + the parent bounty.
      const capture = await ctx.db.bountySubmissionCapture.findUnique({
        where: { id: input.captureId },
        select: {
          id: true,
          status: true,
          submissionId: true,
          submission: {
            select: {
              bountyId: true,
              bounty: { select: { userId: true } },
            },
          },
        },
      });
      if (!capture) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Capture not found" });
      }
      if (capture.submission.bounty.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the bounty owner can review captures",
        });
      }

      // Update the capture status.
      await ctx.db.bountySubmissionCapture.update({
        where: { id: input.captureId },
        data: { status: input.status },
      });

      // Roll up the parent submission status from its children:
      //   - any capture REJECTED          → submission.status = REJECTED
      //   - all captures APPROVED         → submission.status = APPROVED
      //   - everything else still PENDING  → submission.status = PENDING
      const siblings = await ctx.db.bountySubmissionCapture.findMany({
        where: { submissionId: capture.submissionId },
        select: { status: true },
      });
      let rolled: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";
      if (siblings.some((s) => s.status === "REJECTED")) rolled = "REJECTED";
      else if (
        siblings.length > 0 &&
        siblings.every((s) => s.status === "APPROVED")
      ) {
        rolled = "APPROVED";
      }
      await ctx.db.bountySubmission.update({
        where: { id: capture.submissionId },
        data: { status: rolled },
      });

      return { captureId: input.captureId, status: input.status };
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
      const submissions = await ctx.db.bountySubmission.findMany({
        where: { bountyId: input.bountyId, userId: ctx.session.user.id },
        include: {
          user: { select: ownerSelect },
          media: true,
          captures: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return submissions.map((s) => ({
        ...s,
        validation: deriveSubmissionValidation(s.captures),
        captures: s.captures.map((c) => ({ ...c, validation: deriveValidation(c) })),
      }));
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

      // The contract's `claim` establishes the winner's trustline itself
      // (SAC.trust, no-op if already trusted) before transferring, so there's
      // no separate classic changeTrust step needed here.
      const xdr = await buildClaimXDR({
        bountyId: input.bountyId,
        winnerPubKey: ctx.session.user.id,
      });
      const signedXdr = await WithSing({ xdr, signWith: input.signWith });
      return { xdr: signedXdr, needsUserSign: signedXdr === xdr };
    }),

  claimReward: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        txHash: z.string(),
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

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) throw new Error("Claim transaction did not succeed on-chain");

      await ctx.db.bountyWinner.update({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        },
        data: { claimedAt: new Date(), txHash: input.txHash },
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
        prompt: z.string().min(5).max(4000),
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

  // ── ACTION CAM: submit one OR MORE captures as a single submission ────────
  // The client uploads each file (original + optional stamped preview) directly
  // to S3 via presigned URLs, then calls this mutation with the array. One
  // parent BountySubmission + N BountySubmissionCapture children are created
  // in a single transaction.
  //
  // Supports two flows:
  //   - Action Cam: each capture has a `signature` (HMAC) + `previewUrl` + lat/lon
  //   - Plain upload: no signature, no previewUrl — just the original uploaded
  submitCapture: protectedProcedure
    .input(
      z.object({
        bountyId: z.number().int().positive(),
        captures: z
          .array(
            z.object({
              captureType: z.enum(["PHOTO", "VIDEO"]),

              // ── Integrity hashes (sha256 hex, lowercase) ────────────
              originalHash: z.string().regex(/^[a-f0-9]{64}$/),
              sealedHash: z.string().regex(/^[a-f0-9]{64}$/),

              // ── Storage (full public S3 URLs + keys for HEAD check) ────
              storageKey: z.string().min(1).max(500),
              storageUrl: z.string().url(),
              storageSize: z.number().int().nonnegative(),

              // ── Preview (Action Cam only) ──────────────────────────────
              previewKey: z.string().min(1).max(500).optional(),
              previewUrl: z.string().url().optional(),
              previewSize: z.number().int().nonnegative().optional(),

              // ── MIME ────────────────────────────────────────────────────
              mediaContentType: z.string().min(1),

              // ── Action Cam metadata (all optional for plain uploads) ──
              // Note: signature is NOT supplied by the client — the server
              // computes it after verifying the upload, using its own HMAC
              // secret. Client only supplies hashes + uploaded URLs.
              lat: z.number().min(-90).max(90).optional(),
              lon: z.number().min(-180).max(180).optional(),
              wallet: z.string().optional(),
            }),
          )
          .min(1, "At least one capture is required")
          .max(20, "Maximum 20 captures per submission"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // ── 1. Per-type size + MIME constraints (shared limits) ──────────
      const LIMITS: Record<"PHOTO" | "VIDEO", {
        maxBytes: number;
        allowed: Set<string>;
      }> = {
        PHOTO: {
          maxBytes: 10 * 1024 * 1024,
          allowed: new Set(["image/jpeg", "image/png", "image/webp"]),
        },
        VIDEO: {
          maxBytes: 50 * 1024 * 1024,
          allowed: new Set([
            "video/mp4",
            "video/webm",
            "video/quicktime",
          ]),
        },
      };

      // ── 2. Per-capture input validation ──────────────────────────────────
      const serverCapturedAt = new Date();

      const prepared = input.captures.map((cap, idx) => {
        // Per-type MIME + size
        const limits = LIMITS[cap.captureType];
        if (!limits) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Capture ${idx + 1}: unsupported type ${cap.captureType}`,
          });
        }
        if (!limits.allowed.has(cap.mediaContentType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Capture ${idx + 1}: unsupported ${cap.captureType} MIME type: ${cap.mediaContentType}`,
          });
        }
        if (cap.storageSize > limits.maxBytes) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: `Capture ${idx + 1}: file too large (${cap.storageSize} > ${limits.maxBytes} bytes)`,
          });
        }

        // Preview is REQUIRED for every capture (we always render a stamped
        // preview client-side, even on plain bounties, so the canonical HMAC
        // payload is uniform and the row shape is identical).
        if (!cap.previewKey || !cap.previewUrl || cap.previewSize === undefined) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Capture ${idx + 1}: previewKey, previewUrl, previewSize are required`,
          });
        }
        if (cap.previewSize === 0 || cap.previewSize > 2 * 1024 * 1024) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: `Capture ${idx + 1}: preview must be 1 byte – 2 MB (got ${cap.previewSize})`,
          });
        }

        // Truncate wallet for storage (if present)
        const truncatedWallet =
          cap.wallet && cap.wallet.length > 16
            ? `${cap.wallet.slice(0, 6)}…${cap.wallet.slice(-4)}`
            : cap.wallet ?? null;

        return { cap, truncatedWallet };
      });

      // ── 3. Verify caller has joined this bounty ────────────────────────
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: {
          id: true,
          status: true,
          requiresActionCam: true,
          userId: true,
          participants: { where: { userId }, select: { id: true } },
        },
      });
      if (!bounty) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bounty not found" });
      }
      if (bounty.status !== "RUNNING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Bounty is not accepting submissions",
        });
      }
      if (bounty.userId === userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Owner cannot submit to their own bounty",
        });
      }
      if (bounty.participants.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Must join the bounty before submitting",
        });
      }

      // ── 4. HEAD-check every uploaded file, then compute signature per ────
      // capture when Action Cam is required. Signature is always server-side
      // because the HMAC secret never leaves this server.
      const signaturesByIndex: (string | null)[] = [];

      async function headCheck(key: string, expectedSize: number, label: string): Promise<void> {
        try {
          const head = await s3Client.send(
            new HeadObjectCommand({
              Bucket: env.AWS_BUCKET_NAME,
              Key: key,
            }),
          );
          const size = head.ContentLength ?? -1;
          if (size !== expectedSize) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${label}: S3 object ${key} size mismatch (expected ${expectedSize}, got ${size})`,
            });
          }
        } catch (e: unknown) {
          if (e instanceof TRPCError) throw e;
          const name = (e as { name?: string })?.name ?? "Error";
          if (name === "NotFound" || name === "NoSuchKey") {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `${label}: S3 object not found: ${key}`,
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `${label}: S3 HEAD failed: ${name}`,
          });
        }
      }

      for (const [i, { cap }] of prepared.entries()) {
        await Promise.all([
          headCheck(cap.storageKey, cap.storageSize, `Capture ${i + 1} original`),
          ...(cap.previewKey && cap.previewSize !== undefined
            ? [headCheck(cap.previewKey, cap.previewSize, `Capture ${i + 1} preview`)]
            : []),
        ]);
      }

      // ── 5. Compute HMAC signature per capture (only when required) ───────
      if (bounty.requiresActionCam) {
        for (const { cap, truncatedWallet } of prepared) {
          const canonical = captureMetadataSchema.parse({
            bountyId: input.bountyId,
            userId,
            captureType: cap.captureType,
            originalHash: cap.originalHash,
            previewHash: cap.sealedHash,
            capturedAt: serverCapturedAt.toISOString(),
            lat: cap.lat ?? null,
            lon: cap.lon ?? null,
            wallet: truncatedWallet,
          });
          signaturesByIndex.push(
            signCapture(canonical, env.ACTION_CAM_HMAC_SECRET),
          );
        }
      } else {
        // Plain upload — no signature, no per-capture Action Cam metadata.
        signaturesByIndex.push(...Array.from({ length: prepared.length }, () => null));
      }

      // ── 6. Persist: one parent submission + N child captures ───────────
      const capturesCreate = prepared.map(({ cap, truncatedWallet }, idx) => {
        const signature = signaturesByIndex[idx] ?? null;
        const isActionCam = signature !== null;
        // For Action Cam, sealedHash is the client-computed hash of the
        // preview; the server has already verified it via HMAC. For plain
        // uploads, sealedHash == originalHash (the only file uploaded).
        return {
          captureType: cap.captureType,
          captureOriginalHash: cap.originalHash,
          captureSealedHash: cap.sealedHash,
          // URLs: always store the full public URL, not the key, so consumers
          // (UI, public verify, owner view) can use them directly.
          captureStorageUrl: cap.storageUrl,
          capturePreviewUrl: cap.previewUrl ?? null,
          // Action Cam metadata (only populated when bounty requires it)
          captureLat: isActionCam ? cap.lat ?? null : null,
          captureLon: isActionCam ? cap.lon ?? null : null,
          captureCapturedAt: isActionCam ? serverCapturedAt : null,
          captureWallet: isActionCam ? truncatedWallet : null,
          captureSignature: signature,
          captureSealedAt: isActionCam ? serverCapturedAt : null,
        };
      });

      const submission = await ctx.db.bountySubmission.create({
        data: {
          bountyId: input.bountyId,
          userId,
          content: "",
          status: "PENDING",
          captures: {
            create: capturesCreate,
          },
        },
        select: {
          id: true,
          captures: { select: { id: true, captureStorageUrl: true, capturePreviewUrl: true } },
        },
      });

      return {
        submissionId: submission.id,
        captureIds: submission.captures.map((c) => c.id),
        captures: submission.captures.map((c) => ({
          id: c.id,
          storageUrl: c.captureStorageUrl,
          previewUrl: c.capturePreviewUrl,
        })),
      };
    }),

  // ── ACTION CAM: public verification (capture-level) ──────────────
  // Takes a captureId, re-runs HMAC over the stored canonical payload, and
  // returns the verdict + metadata for one specific capture. The HMAC secret
  // is NEVER returned.
  verifyCapture: publicProcedure
    .input(z.object({ captureId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const capture = await ctx.db.bountySubmissionCapture.findUnique({
        where: { id: input.captureId },
        select: {
          id: true,
          captureType: true,
          captureOriginalHash: true,
          captureSealedHash: true,
          captureSignature: true,
          captureCapturedAt: true,
          captureSealedAt: true,
          captureLat: true,
          captureLon: true,
          captureWallet: true,
          captureStorageUrl: true,
          capturePreviewUrl: true,
          submission: {
            select: {
              bountyId: true,
              userId: true,
            },
          },
        },
      });

      if (!capture) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Capture not found",
        });
      }

      // Plain upload — no signature, just metadata.
      if (!capture.captureSignature || !capture.captureCapturedAt) {
        return {
          captureId: capture.id,
          sealed: false as const,
          reason: "Capture was not made via Action Cam (plain upload)",
        };
      }

      // Rebuild the canonical payload exactly as it was at seal time
      // (using the SAME fields the server used in submitCapture).
      let canonicalValid = true;
      let signatureValid = false;
      try {
        const canonical = captureMetadataSchema.parse({
          bountyId: capture.submission.bountyId,
          userId: capture.submission.userId,
          captureType: capture.captureType,
          originalHash: capture.captureOriginalHash,
          previewHash: capture.captureSealedHash,
          capturedAt: capture.captureCapturedAt.toISOString(),
          lat: capture.captureLat,
          lon: capture.captureLon,
          wallet: capture.captureWallet,
        });
        signatureValid = verifyCapture(
          canonical,
          capture.captureSignature,
          env.ACTION_CAM_HMAC_SECRET,
        );
      } catch {
        canonicalValid = false;
      }

      const validation = deriveValidation(capture);

      return {
        captureId: capture.id,
        sealed: true as const,
        canonicalValid,
        signatureValid,
        validation,
        metadata: {
          bountyId: capture.submission.bountyId,
          captureType: capture.captureType,
          originalHash: capture.captureOriginalHash,
          sealedHash: capture.captureSealedHash,
          capturedAt: capture.captureCapturedAt,
          sealedAt: capture.captureSealedAt,
          lat: capture.captureLat,
          lon: capture.captureLon,
          wallet: capture.captureWallet,
        },
      };
    }),

  // ── ADMIN: read contract instance TTL ─────────────────────────────────────
  getAdminContractInstanceTTL: adminProcedure.query(async () => {
    return getContractInstanceTTL();
  }),

  // ── ADMIN: read a specific bounty entry TTL ───────────────────────────────
  getAdminBountyTTL: adminProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ input }) => {
      return getBountyTTL(input.bountyId);
    }),

  // ── ADMIN: list all bounties for TTL management ───────────────────────────
  getAdminBountyList: adminProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.bounty.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, image: true } },
          winners: {
            select: { userId: true, prizeAmount: true },
          },
        },
      });

      let nextCursor: number | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  // ── ADMIN: build XDR to extend a bounty entry TTL ─────────────────────────
  getAdminExtendBountyTTLXDR: adminProcedure
    .input(z.object({ bountyId: z.number() }))
    .mutation(async ({ input }) => {
      const adminPubKey = Keypair.fromSecret(env.MOTHER_SECRET).publicKey();
      const xdr = await buildAdminExtendBountyTTLXDR(input.bountyId, adminPubKey);
      const signedXdr = signXdrTransaction(xdr, env.MOTHER_SECRET);
      return { xdr: signedXdr };
    }),

  // ── ADMIN: build XDR to extend a winner award entry TTL ───────────────────
  getAdminExtendWinnerAwardTTLXDR: adminProcedure
    .input(z.object({ bountyId: z.number(), winnerId: z.string() }))
    .mutation(async ({ input }) => {
      const adminPubKey = Keypair.fromSecret(env.MOTHER_SECRET).publicKey();
      const xdr = await buildAdminExtendWinnerAwardTTLXDR(
        input.bountyId,
        input.winnerId,
        adminPubKey,
      );
      const signedXdr = signXdrTransaction(xdr, env.MOTHER_SECRET);
      return { xdr: signedXdr };
    }),

  // ── ADMIN: build XDR to extend the contract instance TTL ──────────────────
  getAdminExtendInstanceTTLXDR: adminProcedure
    .mutation(async () => {
      const adminPubKey = Keypair.fromSecret(env.MOTHER_SECRET).publicKey();
      const xdr = await buildAdminExtendInstanceTTLXDR(adminPubKey);
      const signedXdr = signXdrTransaction(xdr, env.MOTHER_SECRET);
      return { xdr: signedXdr };
    }),
});
