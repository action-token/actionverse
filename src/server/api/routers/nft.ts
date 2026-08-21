import { TRPCError } from "@trpc/server";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { Client as SquareClient, Environment as SquareEnvironment } from "square";
import { z } from "zod";
import { WalletType } from "package/connect_wallet/src/lib/enums";
import { getAccSecretFromRubyApi } from "package/connect_wallet/src/lib/stellar/get-acc-secret";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildEstablishTrustlineXDR,
  ensureBuyerXlmBuffer,
  fundBuyerForCardPurchase,
} from "~/lib/stellar/marketplace/trx/site_asset_recharge";
import { getPlatformAssetPrice } from "~/lib/stellar/fan/get_token_price";
import {
  buildBuyBatchXDR,
  buildBuyEditionXDR,
  buildBuyXDR,
  buildCancelListingXDR,
  buildListBatchXDR,
  buildListXDR,
  getEditionMeta,
  getEditionPrices,
  getInclusionFee,
  getOnChainListing,
  getOnChainUnlockStatus,
  getPurchaseByRef,
  getRemainingSupply,
  getSaleBreakdown,
  labelForPaymentTokenAddress,
  NFT_PAYMENT_TOKENS,
  paymentTokenAddress,
  pollUntilVisible,
  signArtXdr,
  verifyContractTransaction,
  type NftPaymentToken,
} from "~/lib/stellar/oz/nft";
import { ART_NFT_CONTRACT_ID } from "~/lib/common";
import {
  MAX_ROYALTY_BPS,
  NETWORK_FEE_IN_USD,
  humanPriceToRaw,
  rawPriceToHuman,
} from "~/lib/stellar/constant";
import { STELLAR_NETWORK_LABEL } from "~/lib/stellar/explorer";
import { SignUser, WithSing } from "~/lib/stellar/utils";

// Deliberately reads `SQUARE_ENVIRONMENT` rather than hardcoding Sandbox
// (as `marketplace/pay.ts` does) — a token issued for one environment gets
// a 401 from Square itself against the other, regardless of whether the
// token is otherwise valid. This deployment's configured token is for
// production, so hardcoding Sandbox here would always fail.
const { paymentsApi } = new SquareClient({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

// User ids are Stellar public keys (56-char strkeys) — never a valid match,
// used so the `likes` include can stay an unconditional array shape for
// logged-out requests instead of branching the query's return type.
const NO_SUCH_USER = "__anonymous__";

// Mirrors `MAX_QUANTITY_PER_BUY` in `contracts/nft_oz/src/lib.rs` — kept in
// sync by hand so the UI/API can reject an over-large purchase before ever
// building a doomed transaction.
const MAX_QUANTITY_PER_BUY = 20;

const PaymentTokenSchema = z.enum([...NFT_PAYMENT_TOKENS]);

/**
 * `lowestActivePrice`/`activeListingCount` are read by the marketplace grid,
 * collection cards and stats. They're a cache of *resale* `NftListing` rows,
 * so every mutation that touches one has to recompute them or the UI
 * silently reports zeroes forever. A not-sold-out edition's own primary
 * price comes from `NftPrice`, not this cache.
 */
/** `paymentTokenAddress` throws for a currency without a SAC wired up yet
 *  (e.g. "usdc") — insights display is best-effort, so swallow that instead
 *  of failing the whole query over a link that just won't render. */
function safePaymentTokenAddress(method: NftPaymentToken): string | null {
  try {
    return paymentTokenAddress(method);
  } catch {
    return null;
  }
}

async function refreshListingAggregates(
  tx: Prisma.TransactionClient,
  nftId: string,
) {
  const active = await tx.nftListing.findMany({
    where: { nftId, isActive: true },
    select: { price: true },
  });
  await tx.nft.update({
    where: { id: nftId },
    data: {
      activeListingCount: active.length,
      lowestActivePrice: active.length
        ? Math.min(...active.map((l) => l.price))
        : null,
    },
  });
}

/** Sums each listing's Platform-Asset-priced row for a set of tokenIds —
 *  the ground-truth amount a card checkout needs to charge for, since a
 *  reseller's price is their own live number, never a stored USD sticker
 *  price the way primary sale has `Nft.priceUSD`. Throws if any listing
 *  isn't active or isn't priced in Platform Asset — `buyBatchWithCard`
 *  only ever offers that currency. */
async function getResaleAssetTotal(db: Db, tokenIds: string[]) {
  const listings = await db.nftListing.findMany({
    where: { tokenId: { in: tokenIds } },
    include: { prices: true },
  });
  if (listings.length !== tokenIds.length) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  let total = 0;
  for (const listing of listings) {
    if (!listing.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Listing no longer active" });
    const assetPrice = listing.prices.find((p) => p.paymentToken === "asset");
    if (!assetPrice) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Listing isn't priced in Platform Asset" });
    }
    total += assetPrice.price;
  }
  return { listings, total };
}

/**
 * USD total for a resale purchase — per listing, a reseller-set
 * `priceUSD` (set at list time, same idea as `Nft.priceUSD`) wins; falling
 * back to a live Platform-Asset-price conversion only for listings that
 * never had one set. Mixing is intentional: each listing is independent,
 * so one reseller having a fixed opinion on their own price shouldn't force
 * every other listing in the same batch onto the same method.
 */
async function getResaleUsdTotal(listings: { priceUSD: number | null; prices: { paymentToken: string; price: number }[] }[]) {
  const assetPriceUSD = await getPlatformAssetPrice();
  let total = 0;
  for (const listing of listings) {
    if (listing.priceUSD != null) {
      total += listing.priceUSD;
    } else {
      const assetPrice = listing.prices.find((p) => p.paymentToken === "asset");
      total += (assetPrice?.price ?? 0) * assetPriceUSD;
    }
  }
  return total;
}

/**
 * The shared confirmation path for a resale purchase, extracted from
 * `confirmBuyBatch` so `buyBatchWithCard` can reuse it exactly, same
 * reasoning as `confirmBuyEditionEffects`.
 */
async function confirmBuyBatchEffects(
  db: PrismaClient,
  { tokenIds, buyerId, txHash }: { tokenIds: string[]; buyerId: string; txHash: string },
) {
  const listings = await db.nftListing.findMany({ where: { tokenId: { in: tokenIds } } });
  if (listings.length !== tokenIds.length) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const ok = await verifyContractTransaction(txHash);
  if (!ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
  }

  return db.$transaction(async (tx) => {
    const nftIds = new Set<string>();
    for (const listing of listings) {
      await tx.nftToken.update({ where: { tokenId: listing.tokenId }, data: { ownerId: buyerId } });
      await tx.nftListing.update({ where: { tokenId: listing.tokenId }, data: { isActive: false } });
      await tx.locationGroup.updateMany({
        where: { unlockForToken: { tokenId: listing.tokenId } },
        data: { restrictedToUserId: buyerId },
      });
      nftIds.add(listing.nftId);
    }
    for (const nftId of nftIds) {
      await refreshListingAggregates(tx, nftId);
    }
    return { count: listings.length };
  });
}

/** Square's `ApiError` carries the actual rejection reason in `.errors`
 *  (e.g. `CARD_DECLINED`, `INVALID_LOCATION`) — letting it propagate as a
 *  bare "Response status code was not ok: 400" throws away exactly the
 *  information needed to tell a declined card apart from a config mistake.
 *  Duck-typed rather than an `instanceof` import since the class isn't
 *  exported from the package's public entry point. */
function describeSquareError(e: unknown): string {
  if (e && typeof e === "object" && "errors" in e && Array.isArray((e as { errors: unknown }).errors)) {
    const errors = (e as { errors: { code?: string; detail?: string }[] }).errors;
    return errors.map((err) => err.detail ?? err.code ?? "unknown error").join("; ");
  }
  return e instanceof Error ? e.message : "unknown error";
}

/** Loads a specific minted copy the caller owns, or throws. */
async function requireOwnedToken(
  db: Prisma.TransactionClient,
  tokenId: string,
  ownerId: string,
) {
  const token = await db.nftToken.findUnique({ where: { tokenId } });
  if (!token) throw new TRPCError({ code: "NOT_FOUND" });
  if (token.ownerId !== ownerId) throw new TRPCError({ code: "FORBIDDEN" });
  return token;
}

/**
 * Gives one specific minted copy its own private AR pin set for one
 * specific gated locked-content item, cloned from that item's own unlock
 * rule. A token with several independently-gated items gets several
 * independent pin sets (buying 1 copy of a ticket with a 2-location song
 * and a 3-location video drops 5 pins total for that copy alone); each set
 * unlocks its own item on its own, not waiting on the token's other items.
 * Idempotent per `(nftTokenId, item.id)` — a retried transaction (or a
 * second call for a pair that already has one) is a no-op, not a
 * duplicate.
 */
type Db = Prisma.TransactionClient | PrismaClient;

function fallbackMediaLabel(type: string) {
  switch (type) {
    case "SONG":
      return "Locked Track";
    case "IMAGE":
      return "Locked Image";
    case "VIDEO":
      return "Locked Video";
    default:
      return "Locked Content";
  }
}

/**
 * Creates one token's private pin set for one gated locked-content item —
 * called with the item's rule and the edition's own metadata already
 * fetched *once* by the caller, not re-fetched per token, and against a
 * plain `db` handle rather than an interactive-transaction `tx`. This used
 * to run inside `confirmBuyEdition`'s `$transaction`, doing several
 * sequential round-trips per newly-minted token per gated item; for
 * anything beyond a tiny quantity that blew past Prisma's
 * interactive-transaction timeout and failed the whole purchase with
 * "Transaction not found". Pin-set creation doesn't need to be atomic with
 * the mint — it's independently idempotent, and `nft.unlockStatus`
 * self-heals a missing one lazily (see below) — so it now runs after the
 * transaction commits instead.
 */
async function ensureTokenUnlockPinSet(
  db: Db,
  rule: { radius: number; points: { latitude: number; longitude: number }[] },
  item: { id: string; type: string; label: string | null },
  nftMeta: { description: string; thumbnail: string; creatorId: string },
  nftId: string,
  nftTokenId: string,
  ownerId: string,
) {
  if (rule.points.length === 0) return;

  const existing = await db.locationGroup.findUnique({
    where: {
      unlockForTokenId_unlockForLockedMediaId: {
        unlockForTokenId: nftTokenId,
        unlockForLockedMediaId: item.id,
      },
    },
    select: { id: true },
  });
  if (existing) return;

  const firstPoint = rule.points[0]!;
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 5);

  await db.locationGroup.create({
    data: {
      creatorId: nftMeta.creatorId,
      unlockForTokenId: nftTokenId,
      unlockForLockedMediaId: item.id,
      unlockForNftId: nftId,
      restrictedToUserId: ownerId,
      // Not user-generated/public content needing moderation — the
      // creator already defined the rule template at ticket-creation time
      // — so this private clone doesn't sit in the admin approval queue
      // like an ordinary campaign would. Without this, `getPins`/
      // `pages/api/game/locations` (both require `approved: true`) would
      // never surface it, not even to its own owner.
      approved: true,
      // Titled from this specific item, not the whole ticket, so a token
      // with several gated items shows distinguishable pin sets on the
      // map/AR view instead of several identically-named groups.
      title: item.label?.trim() || fallbackMediaLabel(item.type),
      description: nftMeta.description,
      image: nftMeta.thumbnail,
      startDate: new Date(),
      endDate: farFuture,
      latitude: firstPoint.latitude,
      longitude: firstPoint.longitude,
      radius: rule.radius,
      multiPin: true,
      limit: rule.points.length,
      remaining: rule.points.length,
      locations: {
        createMany: {
          data: rule.points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            autoCollect: false,
          })),
        },
      },
    },
  });
}

/**
 * The shared confirmation path for a primary purchase, extracted from
 * `confirmBuyEdition` so `buyEditionWithCard` (server-initiated, no client
 * round-trip to hand back a `txHash`) can run the exact same on-chain
 * verification, mint-range bookkeeping, and gated-item pin-set creation
 * instead of a second, drifting copy of it.
 */
async function confirmBuyEditionEffects(
  db: PrismaClient,
  { nftId, purchaseId, buyerId, txHash }: { nftId: string; purchaseId: string; buyerId: string; txHash: string },
) {
  const purchase = await db.nftPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.nftId !== nftId || purchase.buyerId !== buyerId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (purchase.status !== "PENDING") {
    throw new TRPCError({ code: "CONFLICT", message: "Already confirmed" });
  }

  const ok = await verifyContractTransaction(txHash);
  if (!ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
  }

  const receipt = await pollUntilVisible(() => getPurchaseByRef(purchase.id));
  if (!receipt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Purchase did not register on-chain" });
  }

  const tokenIds: string[] = [];
  for (let id = receipt.first_token_id; id <= receipt.last_token_id; id++) {
    tokenIds.push(String(id));
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.nftToken.createMany({
      data: tokenIds.map((tokenId) => ({
        nftId: purchase.nftId,
        tokenId,
        ownerId: purchase.buyerId,
      })),
    });
    const result = await tx.nft.update({
      where: { id: purchase.nftId },
      data: {
        status: "MINTED",
        onChainEditionId: String(receipt.edition_id),
        mintedCount: { increment: tokenIds.length },
      },
    });
    await tx.nftPurchase.update({
      where: { id: purchase.id },
      data: {
        status: "CONFIRMED",
        txHash,
        firstTokenId: String(receipt.first_token_id),
        lastTokenId: String(receipt.last_token_id),
      },
    });
    return result;
  });

  // One private pin set per (newly-minted copy, gated item), not per
  // purchase — see `ensureTokenUnlockPinSet`'s doc comment. Deliberately
  // outside the transaction above: doing this inside it blew past
  // Prisma's interactive-transaction timeout for anything beyond a tiny
  // quantity ("Transaction not found"). Not required to be atomic with the
  // mint — `nft.unlockStatus` self-heals a missing pin set.
  const gatedItems = await db.nftLockedMedia.findMany({
    where: { nftId: purchase.nftId, unlockRule: { isNot: null } },
    include: { unlockRule: { include: { points: true } } },
  });
  if (gatedItems.length > 0) {
    const nftMeta = await db.nft.findUniqueOrThrow({
      where: { id: purchase.nftId },
      select: { description: true, thumbnail: true, creatorId: true },
    });
    const newTokens = await db.nftToken.findMany({
      where: { tokenId: { in: tokenIds } },
      select: { id: true },
    });
    for (const t of newTokens) {
      for (const item of gatedItems) {
        await ensureTokenUnlockPinSet(db, item.unlockRule!, item, nftMeta, purchase.nftId, t.id, purchase.buyerId);
      }
    }
  }

  return updated;
}

export const nftRouter = createTRPCRouter({
  // Purely a database write — no chain call, no signature, nothing for the
  // creator to sign or pay for. The row is live on the marketplace the
  // instant this returns; `buy_edition` registers it on-chain (from this
  // same data) the moment the first copy sells. See the module doc on
  // `contracts/nft_oz`'s `buy_edition` for why creation and first sale are
  // split this way.
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(128),
        description: z.string().trim().max(2000),
        thumbnail: z.string().url(),
        contentUrl: z.string().url(),
        mediaType: z.string().min(1),
        royaltyBps: z.number().int().min(0).max(MAX_ROYALTY_BPS).default(0),
        supply: z.number().int().min(1).max(100_000).default(1),
        // Sticker price for the USD/card checkout path — set independently
        // of `prices`, never becomes an on-chain `payment_token` itself.
        priceUSD: z.number().positive().optional(),
        prices: z
          .array(
            z.object({
              paymentToken: PaymentTokenSchema,
              price: z.number().positive(),
            }),
          )
          .min(1, "At least one price is required")
          .max(5),
        collectionId: z.string().optional(),
        // Optional "VIP ticket" gating — see VIP_TICKET_UNLOCK_PLAN.md.
        // Reward content that stays hidden until a buyer's own copy
        // completes that item's own unlock rule — an item with no rule
        // reveals the moment a copy is bought.
        lockedMedia: z
          .array(
            z.object({
              url: z.string().url(),
              type: z.enum(["SONG", "IMAGE", "VIDEO", "OTHER"]),
              label: z.string().trim().max(80).optional(),
              unlockRule: z
                .object({
                  points: z
                    .array(
                      z.object({
                        lat: z.number().min(-90).max(90),
                        lng: z.number().min(-180).max(180),
                        label: z.string().trim().max(80).optional(),
                      }),
                    )
                    .min(1)
                    .max(20),
                  radius: z.number().positive().max(1000).default(30),
                })
                .optional(),
            }),
          )
          .max(20)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasUnlockRule = input.lockedMedia.some((m) => m.unlockRule);
      if (hasUnlockRule) {
        // A gated edition's per-copy pin sets are LocationGroups, which are
        // owned by a Creator row, not a bare User — this NFT router doesn't
        // otherwise require the caller to be a Creator, so check explicitly
        // here rather than let it fail obscurely at first-purchase time.
        const creator = await ctx.db.creator.findUnique({
          where: { id: ctx.session.user.id },
          select: { id: true },
        });
        if (!creator) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You need a creator profile before adding an unlock rule to an NFT",
          });
        }
      }

      return ctx.db.nft.create({
        data: {
          name: input.name,
          description: input.description,
          thumbnail: input.thumbnail,
          contentUrl: input.contentUrl,
          mediaType: input.mediaType,
          royaltyBps: input.royaltyBps,
          supply: input.supply,
          priceUSD: input.priceUSD,
          collectionId: input.collectionId,
          creatorId: ctx.session.user.id,
          status: "PENDING",
          prices: {
            create: input.prices.map((p) => ({
              paymentToken: p.paymentToken,
              price: p.price,
            })),
          },
          lockedMedia: {
            create: input.lockedMedia.map((m, i) => ({
              url: m.url,
              type: m.type,
              label: m.label,
              sortOrder: i,
              // Permanent on-chain key component (§0/contracts/nft_oz) —
              // assigned once here from the same index as sortOrder, never
              // reassigned afterward even if display order later changes.
              chainIndex: i,
              ...(m.unlockRule
                ? {
                    unlockRule: {
                      create: {
                        radius: m.unlockRule.radius,
                        points: {
                          create: m.unlockRule.points.map((p, j) => ({
                            latitude: p.lat,
                            longitude: p.lng,
                            label: p.label,
                            sortOrder: j,
                          })),
                        },
                      },
                    },
                  }
                : {}),
            })),
          },
        },
        include: {
          prices: true,
          lockedMedia: { include: { unlockRule: { include: { points: true } } } },
        },
      });
    }),

  // Build + sign here, return the (possibly already fully-signed) XDR to the
  // client, which either submits it as-is (custodial) or signs it with the
  // connected wallet via `clientsign`. Same shape as every other mutation
  // here. The XDR both registers the edition on first purchase and mints —
  // see `buildBuyEditionXDR`'s doc comment.
  getBuyEditionXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        paymentToken: PaymentTokenSchema,
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_BUY).default(1),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.nftId },
        include: { prices: true },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const remaining = nft.supply - nft.mintedCount;
      if (input.quantity > remaining) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Only ${remaining} cop${remaining === 1 ? "y" : "ies"} left`,
        });
      }
      const priceRow = nft.prices.find((p) => p.paymentToken === input.paymentToken);
      if (!priceRow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This item isn't priced in that currency",
        });
      }

      // Treasury covers the buyer's Soroban network fee (and, for a
      // custodial buyer, sets up a missing trustline too) before we build
      // anything — same funding step every direct Platform Asset purchase
      // goes through now, not just card checkout. Only relevant when
      // they're actually paying in the Platform Asset (XLM needs no
      // trustline at all, and isn't a buyer-facing option currently
      // anyway). A wallet-connected buyer with no trustline yet can't be
      // fixed up here (only they can authorize their own trustline); the
      // client is expected to run `getEstablishTrustlineXDR` once and retry.
      if (input.paymentToken === "asset") {
        const buyerSecret =
          input.signWith && "email" in input.signWith
            ? await getAccSecretFromRubyApi(input.signWith.email)
            : undefined;
        const { hasTrustline } = await ensureBuyerXlmBuffer({
          buyerPubKey: ctx.session.user.id,
          buyerSecret,
        });
        if (!hasTrustline) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NEEDS_TRUSTLINE_SETUP" });
        }
      }

      // Pre-created so its id can be handed to the contract as `purchase_ref`
      // — the buyer hasn't signed anything yet, same shape as `Nft.create`
      // pre-creating a row before a mint used to happen.
      const purchase = await ctx.db.nftPurchase.create({
        data: {
          nftId: nft.id,
          buyerId: ctx.session.user.id,
          quantity: input.quantity,
          paymentToken: input.paymentToken,
          unitPrice: priceRow.price,
        },
      });

      const xdr = await buildBuyEditionXDR({
        buyerPubKey: ctx.session.user.id,
        editionRef: nft.id,
        title: nft.name,
        description: nft.description,
        thumbnailUrl: nft.thumbnail,
        mediaUrl: nft.contentUrl,
        mediaType: nft.mediaType,
        creatorPubKey: nft.creatorId,
        royaltyBps: nft.royaltyBps,
        supply: nft.supply,
        prices: nft.prices.map((p) => ({
          paymentToken: paymentTokenAddress(p.paymentToken as NftPaymentToken),
          priceRaw: humanPriceToRaw(p.price),
        })),
        purchaseRef: purchase.id,
        paymentToken: paymentTokenAddress(input.paymentToken),
        quantity: input.quantity,
      });
      const contractAddress = ART_NFT_CONTRACT_ID;

      await ctx.db.nft.update({ where: { id: nft.id }, data: { contractAddress } });

      const signed = await signArtXdr({ xdr, signWith: input.signWith });
      return { ...signed, contractAddress, purchaseId: purchase.id };
    }),

  // The one-time step a wallet-connected buyer (Albedo etc.) runs when
  // `getBuyEditionXDR`/`getBuyBatchXDR` come back with "NEEDS_TRUSTLINE_SETUP"
  // — treasury pre-signs a transaction that funds a 2 XLM buffer and adds
  // the Platform Asset trustline, and the buyer's wallet only needs to add
  // its own signature to authorize the trustline on their account (the fee
  // is already covered by treasury as the transaction's source). Once
  // submitted, a retry of the original buy call proceeds normally.
  getEstablishTrustlineXDR: protectedProcedure.mutation(async ({ ctx }) => {
    return { xdr: await buildEstablishTrustlineXDR(ctx.session.user.id) };
  }),

  // Confirms against the chain rather than trusting the client: the minted
  // token range is read back from `purchase_by_ref`, so a client that lies
  // about its txHash can't fabricate copies it never paid for.
  confirmBuyEdition: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        purchaseId: z.string(),
        txHash: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return confirmBuyEditionEffects(ctx.db, {
        nftId: input.nftId,
        purchaseId: input.purchaseId,
        buyerId: ctx.session.user.id,
        txHash: input.txHash,
      });
    }),

  // Card/USD checkout for a fresh copy — Square charge, then the exact same
  // purchase + confirmation path `getBuyEditionXDR`/`confirmBuyEdition`
  // already use, just built, signed, and submitted entirely server-side
  // (custodial accounts only — see `PrimaryBuyCard`'s `useIsCustodialWallet`
  // gate) rather than round-tripping an XDR to the client to sign.
  //
  // No fee-bump yet (see VIP_TICKET_UNLOCK_PLAN / plan discussion) — the
  // buyer's own account still pays the transaction's Soroban network fee,
  // so `fundBuyerForCardPurchase` tops up a small XLM buffer alongside the
  // Platform Asset amount rather than relying on a treasury-paid fee-bump.
  buyEditionWithCard: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_BUY).default(1),
        sourceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { walletType, email, id: buyerId } = ctx.session.user;
      const isCustodial =
        walletType === WalletType.emailPass ||
        walletType === WalletType.google ||
        walletType === WalletType.facebook ||
        walletType === WalletType.apple;
      if (!isCustodial || !email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Card checkout is only available for email or social sign-in accounts",
        });
      }

      const nft = await ctx.db.nft.findUnique({
        where: { id: input.nftId },
        include: { prices: true },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const remaining = nft.supply - nft.mintedCount;
      if (input.quantity > remaining) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Only ${remaining} cop${remaining === 1 ? "y" : "ies"} left`,
        });
      }
      if (!nft.priceUSD || nft.priceUSD <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This item isn't priced in USD" });
      }
      const assetPriceRow = nft.prices.find((p) => p.paymentToken === "asset");
      if (!assetPriceRow) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This item isn't priced in Platform Asset" });
      }

      // NETWORK_FEE_IN_USD added on top — the one place this can be
      // collected as real, new money with no leak risk (see the constant's
      // doc comment).
      const totalUSD = nft.priceUSD * input.quantity + NETWORK_FEE_IN_USD;
      const totalAsset = assetPriceRow.price * input.quantity;

      let paymentResult;
      try {
        ({ result: paymentResult } = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: input.sourceId,
          amountMoney: { currency: "USD", amount: BigInt(Math.round(totalUSD * 100)) },
        }));
      } catch (e) {
        const detail = describeSquareError(e);
        console.error("buyEditionWithCard: Square createPayment failed", { buyerId, nftId: nft.id, detail, error: e });
        throw new TRPCError({ code: "BAD_REQUEST", message: `Card payment failed: ${detail}` });
      }
      if (paymentResult.errors || paymentResult.payment?.status !== "COMPLETED") {
        const detail = paymentResult.errors?.map((e) => e.detail ?? e.code).join("; ") ?? "not completed";
        throw new TRPCError({ code: "BAD_REQUEST", message: `Card payment failed: ${detail}` });
      }

      // Money has moved at this point — every failure from here on is the
      // "Square succeeded, on-chain step failed" gap flagged in the plan.
      // No automatic reconciliation yet; logged so it's at least visible.
      try {
        const buyerSecret = await getAccSecretFromRubyApi(email);
        await fundBuyerForCardPurchase({ buyerPubKey: buyerId, buyerSecret, assetAmount: totalAsset });

        const purchase = await ctx.db.nftPurchase.create({
          data: {
            nftId: nft.id,
            buyerId,
            quantity: input.quantity,
            paymentToken: "asset",
            unitPrice: assetPriceRow.price,
          },
        });

        const xdr = await buildBuyEditionXDR({
          buyerPubKey: buyerId,
          editionRef: nft.id,
          title: nft.name,
          description: nft.description,
          thumbnailUrl: nft.thumbnail,
          mediaUrl: nft.contentUrl,
          mediaType: nft.mediaType,
          creatorPubKey: nft.creatorId,
          royaltyBps: nft.royaltyBps,
          supply: nft.supply,
          prices: nft.prices.map((p) => ({
            paymentToken: paymentTokenAddress(p.paymentToken as NftPaymentToken),
            priceRaw: humanPriceToRaw(p.price),
          })),
          purchaseRef: purchase.id,
          paymentToken: paymentTokenAddress("asset"),
          quantity: input.quantity,
        });
        await ctx.db.nft.update({ where: { id: nft.id }, data: { contractAddress: ART_NFT_CONTRACT_ID } });

        const signed = await WithSing({ xdr, signWith: { email } });
        const submitted = await submitSignedXDRToServer4User(signed);
        const txHash = submitted.hash;
        if (!txHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not submit" });

        return confirmBuyEditionEffects(ctx.db, { nftId: nft.id, purchaseId: purchase.id, buyerId, txHash });
      } catch (e) {
        console.error("buyEditionWithCard: on-chain step failed after a completed Square charge", {
          buyerId,
          nftId: nft.id,
          quantity: input.quantity,
          squarePaymentId: paymentResult.payment?.id,
          error: e,
        });
        throw e;
      }
    }),

  // -------------------------------------------------------------------------
  // Secondary market — reselling one specific already-minted copy. Every
  // copy, regardless of which edition it came from, behaves like an
  // independent 1-of-1 once minted: whoever currently owns that `tokenId`
  // can list and sell it.
  // -------------------------------------------------------------------------

  // A reseller prices their own copy in one or more currencies at once, same
  // shape as an edition's own price grid — independent of whatever
  // currencies the creator originally offered.
  getListXDR: protectedProcedure
    .input(
      z.object({
        tokenId: z.string(),
        prices: z
          .array(z.object({ paymentToken: PaymentTokenSchema, price: z.number().positive() }))
          .min(1)
          .max(5),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedToken(ctx.db, input.tokenId, ctx.session.user.id);

      const xdr = await buildListXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId: Number(input.tokenId),
        prices: input.prices.map((p) => ({
          paymentToken: paymentTokenAddress(p.paymentToken),
          priceRaw: humanPriceToRaw(p.price),
        })),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  // Mirrors the listing the contract actually recorded rather than echoing
  // the client's numbers back into the database. `priceUSD` is the one
  // exception — it never touches the contract (only Platform Asset/XLM
  // prices are on-chain), so it's taken from the client here and trusted:
  // there's no "on-chain" copy to verify it against, same as `Nft.priceUSD`
  // at create time.
  confirmListing: protectedProcedure
    .input(z.object({ tokenId: z.string(), txHash: z.string().min(1), priceUSD: z.number().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const token = await requireOwnedToken(ctx.db, input.tokenId, ctx.session.user.id);

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const onChain = await getOnChainListing(Number(input.tokenId));
      if (!onChain || onChain.prices.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No listing found on-chain" });
      }
      // The denormalized `price`/`paymentToken` on `NftListing` stay the
      // cheapest entry, for the existing single-price sort/aggregate code —
      // `prices` below is the full grid and the actual source of truth.
      const cheapest = onChain.prices.reduce((min, p) => (p.price < min.price ? p : min));
      const price = rawPriceToHuman(cheapest.price);
      const paymentToken = cheapest.payment_token;
      // Explicit null (not omitted) when unset — this mirrors the price
      // grid below, which fully replaces itself each time rather than
      // merging: whatever the form currently shows (including "cleared") is
      // what ends up stored, not whatever was there from a previous list.
      const priceUSD = input.priceUSD ?? null;

      return ctx.db.$transaction(async (tx) => {
        const listing = await tx.nftListing.upsert({
          where: { tokenId: input.tokenId },
          create: {
            nftId: token.nftId,
            tokenId: input.tokenId,
            sellerId: ctx.session.user.id,
            price,
            paymentToken,
            priceUSD,
            isActive: true,
          },
          update: { sellerId: ctx.session.user.id, price, paymentToken, priceUSD, isActive: true },
        });
        await tx.nftListingPrice.deleteMany({ where: { listingId: listing.id } });
        await tx.nftListingPrice.createMany({
          data: onChain.prices.map((p) => ({
            listingId: listing.id,
            paymentToken: labelForPaymentTokenAddress(p.payment_token),
            price: rawPriceToHuman(p.price),
          })),
        });
        await refreshListingAggregates(tx, token.nftId);
        return tx.nft.findUniqueOrThrow({ where: { id: token.nftId } });
      });
    }),

  // Lists several held copies at once in a single signature, via the
  // contract's `list_batch` — the on-chain counterpart of the manage page's
  // "Hold N / list N for sale" control. All listed tokens share one price
  // grid; each still gets its own independent on-chain `Listing`.
  getListBatchXDR: protectedProcedure
    .input(
      z.object({
        tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY),
        prices: z
          .array(z.object({ paymentToken: PaymentTokenSchema, price: z.number().positive() }))
          .min(1)
          .max(5),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const tokenId of input.tokenIds) {
        await requireOwnedToken(ctx.db, tokenId, ctx.session.user.id);
      }

      const xdr = await buildListBatchXDR({
        sellerPubKey: ctx.session.user.id,
        tokenIds: input.tokenIds.map(Number),
        prices: input.prices.map((p) => ({
          paymentToken: paymentTokenAddress(p.paymentToken),
          priceRaw: humanPriceToRaw(p.price),
        })),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  // Mirrors what `list_batch` actually recorded on-chain — one `Listing` per
  // token id, resolved individually exactly like `confirmListing` does for a
  // single token.
  confirmListBatch: protectedProcedure
    .input(
      z.object({
        tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY),
        txHash: z.string().min(1),
        // Same USD sticker price applied to every token in the batch — they
        // all share one price grid, same as the Platform Asset/XLM prices
        // passed to `getListBatchXDR` do.
        priceUSD: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const priceUSD = input.priceUSD ?? null;
      const tokens = await Promise.all(
        input.tokenIds.map((tokenId) => requireOwnedToken(ctx.db, tokenId, ctx.session.user.id)),
      );

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      // Resolve every token's on-chain listing (RPC round trips) *before*
      // opening the DB transaction — an interactive transaction has a fixed
      // timeout (5s by default), and awaiting a network call per token
      // inside it blew through that for anything but a very small batch.
      const resolved = await Promise.all(
        tokens.map(async (token) => {
          const onChain = await getOnChainListing(Number(token.tokenId));
          if (!onChain || onChain.prices.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "No listing found on-chain" });
          }
          const cheapest = onChain.prices.reduce((min, p) => (p.price < min.price ? p : min));
          return { token, onChain, cheapest };
        }),
      );

      return ctx.db.$transaction(async (tx) => {
        const nftIds = new Set<string>();
        for (const { token, onChain, cheapest } of resolved) {
          const listing = await tx.nftListing.upsert({
            where: { tokenId: token.tokenId },
            create: {
              nftId: token.nftId,
              tokenId: token.tokenId,
              sellerId: ctx.session.user.id,
              price: rawPriceToHuman(cheapest.price),
              paymentToken: cheapest.payment_token,
              priceUSD,
              isActive: true,
            },
            update: {
              sellerId: ctx.session.user.id,
              price: rawPriceToHuman(cheapest.price),
              paymentToken: cheapest.payment_token,
              priceUSD,
              isActive: true,
            },
          });
          await tx.nftListingPrice.deleteMany({ where: { listingId: listing.id } });
          await tx.nftListingPrice.createMany({
            data: onChain.prices.map((p) => ({
              listingId: listing.id,
              paymentToken: labelForPaymentTokenAddress(p.payment_token),
              price: rawPriceToHuman(p.price),
            })),
          });
          nftIds.add(token.nftId);
        }

        for (const nftId of nftIds) {
          await refreshListingAggregates(tx, nftId);
        }

        return { count: tokens.length };
      });
    }),

  getCancelListingXDR: protectedProcedure
    .input(z.object({ tokenId: z.string(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const xdr = await buildCancelListingXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId: Number(input.tokenId),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  confirmCancelListing: protectedProcedure
    .input(z.object({ tokenId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.nftListing.findUnique({ where: { tokenId: input.tokenId } });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.nftListing.update({ where: { tokenId: input.tokenId }, data: { isActive: false } });
        await refreshListingAggregates(tx, listing.nftId);
        return tx.nft.findUniqueOrThrow({ where: { id: listing.nftId } });
      });
    }),

  /** What a resale buyer will actually pay in one of the listing's
   *  currencies, read from the contract. */
  saleQuote: publicProcedure
    .input(z.object({ tokenId: z.string(), paymentToken: PaymentTokenSchema }))
    .query(async ({ input }) => {
      const breakdown = await getSaleBreakdown(
        Number(input.tokenId),
        paymentTokenAddress(input.paymentToken),
      );
      if (!breakdown) return null;
      return {
        total: rawPriceToHuman(breakdown.total),
        platformFee: rawPriceToHuman(breakdown.platform_fee),
        royalty: rawPriceToHuman(breakdown.royalty),
        sellerAmount: rawPriceToHuman(breakdown.seller_amount),
        // Additive on top of `total`, not part of the seller/royalty/
        // platform split — see `DataKey::InclusionFee` in the contract.
        inclusionFee: rawPriceToHuman(breakdown.inclusion_fee),
      };
    }),

  // Primary-sale equivalent of `saleQuote`'s inclusion-fee field — a fresh
  // edition purchase never goes through `sale_breakdown` (that's keyed by
  // an already-minted `token_id`), so this reads the flat per-currency fee
  // directly instead.
  inclusionFeeQuote: publicProcedure
    .input(z.object({ paymentToken: PaymentTokenSchema }))
    .query(async ({ input }) => {
      const raw = await getInclusionFee(paymentTokenAddress(input.paymentToken));
      return { inclusionFee: rawPriceToHuman(raw) };
    }),

  // A single contract call settles payment and delivery together, so there is
  // no window where the buyer has paid but not received (or vice versa), and
  // only the buyer signs. `paymentToken` picks which of the listing's
  // currencies to pay in.
  getBuyXDR: protectedProcedure
    .input(z.object({ tokenId: z.string(), paymentToken: PaymentTokenSchema, signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.nftListing.findUnique({ where: { tokenId: input.tokenId } });
      if (!listing?.isActive) throw new TRPCError({ code: "NOT_FOUND" });
      if (listing.sellerId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
      }

      const xdr = await buildBuyXDR({
        buyerPubKey: ctx.session.user.id,
        tokenId: Number(input.tokenId),
        paymentToken: paymentTokenAddress(input.paymentToken),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  confirmBuy: protectedProcedure
    .input(z.object({ tokenId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.nftListing.findUnique({ where: { tokenId: input.tokenId } });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const buyerId = ctx.session.user.id;
      return ctx.db.$transaction(async (tx) => {
        await tx.nftToken.update({ where: { tokenId: input.tokenId }, data: { ownerId: buyerId } });
        await tx.nftListing.update({ where: { tokenId: input.tokenId }, data: { isActive: false } });
        // Hands this token's private pin set (if it's a gated ticket) to
        // the new owner — a no-op for an ungated token, which has none.
        // Unlock progress already collected stays counted (see
        // `unlockStatus`'s group-scoped count below), so a resale never
        // resets it; it just changes who can add to it going forward.
        // Filtered through the `unlockForToken` relation, not a bare
        // `unlockForTokenId: input.tokenId` — `input.tokenId` is the
        // on-chain numeric id, while `unlockForTokenId` is a foreign key to
        // `NftToken.id` (the internal row id); the two are different values.
        await tx.locationGroup.updateMany({
          where: { unlockForToken: { tokenId: input.tokenId } },
          data: { restrictedToUserId: buyerId },
        });
        await refreshListingAggregates(tx, listing.nftId);
        return tx.nft.findUniqueOrThrow({ where: { id: listing.nftId } });
      });
    }),

  // Buys several pooled resale listings at once via the contract's
  // `buy_batch` — one signature instead of one `buy` call per token. Backs
  // the buy page's quantity stepper over pooled resale listings.
  getBuyBatchXDR: protectedProcedure
    .input(
      z.object({
        tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY),
        paymentToken: PaymentTokenSchema,
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listings = await ctx.db.nftListing.findMany({ where: { tokenId: { in: input.tokenIds } } });
      if (listings.length !== input.tokenIds.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      for (const listing of listings) {
        if (!listing.isActive) throw new TRPCError({ code: "NOT_FOUND" });
        if (listing.sellerId === ctx.session.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
        }
      }

      // Same treasury funding step as `getBuyEditionXDR` — see its comment.
      if (input.paymentToken === "asset") {
        const buyerSecret =
          input.signWith && "email" in input.signWith
            ? await getAccSecretFromRubyApi(input.signWith.email)
            : undefined;
        const { hasTrustline } = await ensureBuyerXlmBuffer({
          buyerPubKey: ctx.session.user.id,
          buyerSecret,
        });
        if (!hasTrustline) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NEEDS_TRUSTLINE_SETUP" });
        }
      }

      const xdr = await buildBuyBatchXDR({
        buyerPubKey: ctx.session.user.id,
        tokenIds: input.tokenIds.map(Number),
        paymentToken: paymentTokenAddress(input.paymentToken),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  confirmBuyBatch: protectedProcedure
    .input(z.object({ tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return confirmBuyBatchEffects(ctx.db, {
        tokenIds: input.tokenIds,
        buyerId: ctx.session.user.id,
        txHash: input.txHash,
      });
    }),

  // USD estimate for a pooled resale purchase — a reseller-set `priceUSD`
  // (fixed at list time) is used where set; listings without one fall back
  // to a live Platform-Asset-price conversion. `buyBatchWithCard` recomputes
  // this itself at charge time rather than trusting whatever the client
  // last saw.
  resaleUsdQuote: publicProcedure
    .input(z.object({ tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY) }))
    .query(async ({ ctx, input }) => {
      const { listings, total: totalAsset } = await getResaleAssetTotal(ctx.db, input.tokenIds);
      const totalUSD = (await getResaleUsdTotal(listings)) + NETWORK_FEE_IN_USD;
      return { totalAsset, totalUSD };
    }),

  // Card/USD checkout for a pooled resale purchase — same shape as
  // `buyEditionWithCard`, pointed at `buy_batch` instead of `buy_edition`.
  // See that mutation's doc comment for the custodial-only / no-fee-bump-yet
  // caveats, both identical here.
  buyBatchWithCard: protectedProcedure
    .input(z.object({ tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY), sourceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { walletType, email, id: buyerId } = ctx.session.user;
      const isCustodial =
        walletType === WalletType.emailPass ||
        walletType === WalletType.google ||
        walletType === WalletType.facebook ||
        walletType === WalletType.apple;
      if (!isCustodial || !email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Card checkout is only available for email or social sign-in accounts",
        });
      }

      const { listings, total: totalAsset } = await getResaleAssetTotal(ctx.db, input.tokenIds);
      for (const listing of listings) {
        if (listing.sellerId === buyerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
        }
      }
      // NETWORK_FEE_IN_USD added on top — same reasoning as buyEditionWithCard.
      const totalUSD = (await getResaleUsdTotal(listings)) + NETWORK_FEE_IN_USD;

      let paymentResult;
      try {
        ({ result: paymentResult } = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: input.sourceId,
          amountMoney: { currency: "USD", amount: BigInt(Math.round(totalUSD * 100)) },
        }));
      } catch (e) {
        const detail = describeSquareError(e);
        console.error("buyBatchWithCard: Square createPayment failed", { buyerId, tokenIds: input.tokenIds, detail, error: e });
        throw new TRPCError({ code: "BAD_REQUEST", message: `Card payment failed: ${detail}` });
      }
      if (paymentResult.errors || paymentResult.payment?.status !== "COMPLETED") {
        const detail = paymentResult.errors?.map((e) => e.detail ?? e.code).join("; ") ?? "not completed";
        throw new TRPCError({ code: "BAD_REQUEST", message: `Card payment failed: ${detail}` });
      }

      try {
        const buyerSecret = await getAccSecretFromRubyApi(email);
        await fundBuyerForCardPurchase({ buyerPubKey: buyerId, buyerSecret, assetAmount: totalAsset });

        const xdr = await buildBuyBatchXDR({
          buyerPubKey: buyerId,
          tokenIds: input.tokenIds.map(Number),
          paymentToken: paymentTokenAddress("asset"),
        });
        const signed = await WithSing({ xdr, signWith: { email } });
        const submitted = await submitSignedXDRToServer4User(signed);
        const txHash = submitted.hash;
        if (!txHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not submit" });

        return confirmBuyBatchEffects(ctx.db, { tokenIds: input.tokenIds, buyerId, txHash });
      } catch (e) {
        console.error("buyBatchWithCard: on-chain step failed after a completed Square charge", {
          buyerId,
          tokenIds: input.tokenIds,
          squarePaymentId: paymentResult.payment?.id,
          error: e,
        });
        throw e;
      }
    }),

  // -------------------------------------------------------------------------
  // Browse
  // -------------------------------------------------------------------------

  // Two kinds of cards, merged into one feed: an edition still selling new
  // copies (primary, priced via `NftPrice`) and a resold individual copy
  // (secondary, priced via its own `NftListing`) — each its own browsable
  // entry, "Resold by" marked distinctly, per the same principle a resale
  // has always been a distinct card here rather than merged into the
  // original mint's.
  //
  // Pagination here is a bounded in-memory merge + sort (cursor is a plain
  // offset) rather than a real DB-level keyset cursor across the two
  // sources — simpler, and entirely fine at this app's catalog size; revisit
  // with real cross-source pagination if the catalog gets very large.
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(24),
        search: z.string().trim().max(128).optional(),
        sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const offset = input.cursor ? Number(input.cursor) : 0;
      const nameFilter = input.search
        ? { contains: input.search, mode: "insensitive" as const }
        : undefined;

      const [editions, resaleListings] = await Promise.all([
        ctx.db.nft.findMany({
          where: nameFilter ? { name: nameFilter } : undefined,
          include: {
            creator: { select: { id: true, name: true, image: true } },
            prices: true,
            _count: { select: { likes: true } },
            likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        ctx.db.nftListing.findMany({
          where: {
            isActive: true,
            ...(nameFilter ? { nft: { name: nameFilter } } : {}),
            ...(input.minPrice !== undefined || input.maxPrice !== undefined
              ? { price: { gte: input.minPrice, lte: input.maxPrice } }
              : {}),
          },
          include: {
            seller: { select: { id: true, name: true, image: true } },
            prices: true,
            nft: {
              include: {
                creator: { select: { id: true, name: true, image: true } },
                _count: { select: { likes: true } },
                likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
      ]);

      const primaryCards = editions
        .filter((nft) => nft.mintedCount < nft.supply && nft.prices.length > 0)
        .map((nft) => {
          const cheapest = nft.prices.reduce((min, p) => (p.price < min.price ? p : min));
          return {
            kind: "primary" as const,
            id: nft.id,
            name: nft.name,
            thumbnail: nft.thumbnail,
            mediaType: nft.mediaType,
            status: nft.status,
            creator: nft.creator,
            price: cheapest.price,
            priceToken: cheapest.paymentToken,
            prices: nft.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price })),
            supply: nft.supply,
            mintedCount: nft.mintedCount,
            likeCount: nft._count.likes,
            isLiked: nft.likes.length > 0,
            createdAt: nft.createdAt,
          };
        })
        .filter(
          (card) =>
            (input.minPrice === undefined || card.price >= input.minPrice) &&
            (input.maxPrice === undefined || card.price <= input.maxPrice),
        );

      // A reseller who lists several copies of the same edition at once (the
      // common case: they hold a consecutive run from one `buy_edition` call
      // and list them together) shouldn't fragment into one marketplace card
      // per token — group listings that are the same edition, same seller,
      // and priced identically into a single "N available" card. Different
      // sellers, or the same seller at a different price, still get their
      // own card, same as before.
      const priceSignature = (prices: { paymentToken: string; price: number }[]) =>
        [...prices]
          .sort((a, b) => a.paymentToken.localeCompare(b.paymentToken))
          .map((p) => `${p.paymentToken}:${p.price}`)
          .join("|");

      const resaleGroups = new Map<string, typeof resaleListings>();
      for (const listing of resaleListings) {
        const key = `${listing.nftId}::${listing.sellerId}::${priceSignature(listing.prices)}`;
        const group = resaleGroups.get(key);
        if (group) group.push(listing);
        else resaleGroups.set(key, [listing]);
      }

      const resaleCards = Array.from(resaleGroups.values()).map((group) => {
        const listing = group[0]!;
        const { likes, _count, ...nft } = listing.nft;
        const tokenIds = group.map((l) => l.tokenId);
        const latestCreatedAt = group.reduce(
          (max, l) => (l.createdAt > max ? l.createdAt : max),
          listing.createdAt,
        );
        return {
          kind: "resale" as const,
          id: nft.id,
          tokenId: listing.tokenId,
          tokenIds,
          quantity: tokenIds.length,
          name: nft.name,
          thumbnail: nft.thumbnail,
          mediaType: nft.mediaType,
          status: nft.status,
          creator: nft.creator,
          price: listing.price,
          priceToken: labelForPaymentTokenAddress(listing.paymentToken ?? paymentTokenAddress("xlm")),
          prices: listing.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price })),
          sellerId: listing.sellerId,
          sellerName: listing.seller.name,
          sellerImage: listing.seller.image,
          likeCount: _count.likes,
          isLiked: likes.length > 0,
          createdAt: latestCreatedAt,
        };
      });

      const combined = [...primaryCards, ...resaleCards].sort((a, b) => {
        if (input.sort === "price_asc") return a.price - b.price;
        if (input.sort === "price_desc") return b.price - a.price;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const items = combined.slice(offset, offset + input.limit);
      const nextCursor =
        offset + input.limit < combined.length ? String(offset + input.limit) : undefined;

      return { items, nextCursor };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.id },
        include: {
          creator: { select: { id: true, name: true, image: true } },
          prices: true,
          tokens: {
            include: {
              owner: { select: { id: true, name: true, image: true } },
              listing: {
                include: {
                  seller: { select: { id: true, name: true, image: true } },
                  prices: true,
                },
              },
            },
          },
          _count: { select: { likes: true } },
          likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
          // Just each item's gate shape (how many locations it requires, if
          // any) and its reward *outline* (type/label only, e.g. "2 tracks,
          // 1 video") — never `url`, which stays out of this query and only
          // ever comes back from `unlockStatus` once a specific copy's
          // specific item is unlocked.
          lockedMedia: {
            select: {
              type: true,
              label: true,
              sortOrder: true,
              unlockRule: { select: { points: { select: { id: true } } } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const ownersById = new Map<string, { id: string; name: string | null; image: string | null }>();
      for (const t of nft.tokens) ownersById.set(t.owner.id, t.owner);

      // Each resold copy carries its own full price grid — a reseller can
      // offer more than one currency for the same token, same as an
      // edition's own primary price grid.
      const resaleListings = nft.tokens
        .filter((t) => t.listing?.isActive)
        .map((t) => ({
          tokenId: t.tokenId,
          sellerId: t.listing!.sellerId,
          sellerName: t.listing!.seller.name,
          sellerImage: t.listing!.seller.image,
          price: t.listing!.price,
          paymentToken: labelForPaymentTokenAddress(t.listing!.paymentToken ?? paymentTokenAddress("xlm")),
          prices: t.listing!.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price })),
        }))
        .sort((a, b) => a.price - b.price);

      const { tokens: _tokens, likes, _count, ...rest } = nft;
      return {
        ...rest,
        likeCount: _count.likes,
        isLiked: likes.length > 0,
        owners: [...ownersById.values()],
        resaleListings,
      };
    }),

  // Cards for a "smart-contract" browse page — gated editions only. Kept as
  // its own simple query rather than folding a `gatedOnly` filter into
  // `list`'s existing primary+resale merge/sort, which is already doing
  // enough — a gated edition's own primary price grid is all this page
  // needs.
  listGated: publicProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.nft.findMany({
        where: { lockedMedia: { some: { unlockRule: { isNot: null } } } },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          prices: true,
          lockedMedia: { select: { unlockRule: { select: { points: { select: { id: true } } } } } },
        },
      });
      let nextCursor: string | undefined;
      if (items.length > input.limit) nextCursor = items.pop()!.id;
      return {
        items: items.map((nft) => ({
          id: nft.id,
          name: nft.name,
          thumbnail: nft.thumbnail,
          supply: nft.supply,
          mintedCount: nft.mintedCount,
          prices: nft.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price })),
          // Summed across every gated item — a ticket with a 2-location song
          // and a 3-location video reports 5, not one shared count.
          requiredLocations: nft.lockedMedia.reduce(
            (sum, m) => sum + (m.unlockRule?.points.length ?? 0),
            0,
          ),
          lockedMediaCount: nft.lockedMedia.length,
        })),
        nextCursor,
      };
    }),

  // Per-copy unlock progress for a gated edition — each individually minted
  // token unlocks its own reward independently, and now each locked-content
  // item on that token unlocks independently *of the token's other items*
  // too (see VIP_TICKET_UNLOCK_PLAN.md Phase 2), so this returns one entry
  // per token the caller owns, each carrying one status per locked-media
  // item rather than a single aggregate.
  unlockStatus: publicProcedure
    .input(z.object({ nftId: z.string() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.nftId },
        include: {
          lockedMedia: {
            orderBy: { sortOrder: "asc" },
            include: { unlockRule: { include: { points: true } } },
          },
        },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      // "Gated" means "has locked content" — each item's own rule (if any)
      // is an optional extra requirement on top of that. A ticket with
      // reward content but no rule on a given item still counts as gated
      // overall (content hidden from non-owners) but that item unlocks
      // immediately for anyone who owns a copy.
      if (nft.lockedMedia.length === 0) return { gated: false as const };

      const userId = ctx.session?.user.id;
      if (!userId) return { gated: true as const, tokens: [] };

      const myTokens = await ctx.db.nftToken.findMany({
        where: { nftId: input.nftId, ownerId: userId },
        select: { id: true, tokenId: true },
        orderBy: { createdAt: "asc" },
      });

      const tokens = await Promise.all(
        myTokens.map(async (t) => {
          const items = await Promise.all(
            nft.lockedMedia.map(async (media) => {
              // No rule on this item — owning a copy is the only
              // requirement, so it's revealed the moment it shows up here.
              if (!media.unlockRule) {
                return {
                  lockedMediaId: media.id,
                  type: media.type,
                  label: media.label,
                  requiresUnlock: false as const,
                  unlocked: true as const,
                  collected: 0,
                  required: 0,
                  url: media.url,
                  onChainUnlockTxHash: null,
                  onChainUnlocked: null,
                };
              }

              const required = media.unlockRule.points.length;
              let group = await ctx.db.locationGroup.findUnique({
                where: {
                  unlockForTokenId_unlockForLockedMediaId: {
                    unlockForTokenId: t.id,
                    unlockForLockedMediaId: media.id,
                  },
                },
                select: { id: true, onChainUnlockTxHash: true },
              });
              // Self-heal: normally already created by `confirmBuyEdition`
              // right after mint, but that now runs outside its transaction
              // (see the comment there) and could in principle fail to
              // land — provision it here instead of leaving the buyer
              // permanently stuck at 0 pins with nothing to collect.
              if (!group) {
                const nftMeta = { description: nft.description, thumbnail: nft.thumbnail, creatorId: nft.creatorId };
                await ensureTokenUnlockPinSet(ctx.db, media.unlockRule, media, nftMeta, input.nftId, t.id, userId);
                group = await ctx.db.locationGroup.findUnique({
                  where: {
                    unlockForTokenId_unlockForLockedMediaId: {
                      unlockForTokenId: t.id,
                      unlockForLockedMediaId: media.id,
                    },
                  },
                  select: { id: true, onChainUnlockTxHash: true },
                });
              }
              // Scoped to the group, not `userId` — a restricted group only
              // ever belongs to one user at a time (enforced in
              // `consumePin`), so every consumer row under it is legitimate
              // progress toward this item's requirement regardless of who
              // collected it. That makes a resale carry progress forward
              // instead of resetting it: if the previous owner collected 4
              // of 10, the new owner (who `confirmBuy`/`confirmBuyBatch`
              // re-point this group's `restrictedToUserId` to) still reads
              // 4/10, not 0/10.
              const collected = group
                ? await ctx.db.locationConsumer.count({
                    where: { location: { locationGroupId: group.id } },
                  })
                : 0;
              const unlocked = collected >= required;
              // Live ground-truth read, independent of the cached DB flag —
              // the unlock trigger in `consumePin` can in principle fail
              // after the DB is updated (or vice versa if still in
              // flight), so the UI can show both figures and flag drift.
              const onChainUnlocked = unlocked
                ? await getOnChainUnlockStatus(Number(t.tokenId), media.chainIndex)
                : null;
              return {
                lockedMediaId: media.id,
                type: media.type,
                label: media.label,
                requiresUnlock: true as const,
                unlocked,
                collected,
                required,
                url: unlocked ? media.url : null,
                onChainUnlockTxHash: group?.onChainUnlockTxHash ?? null,
                onChainUnlocked,
              };
            }),
          );

          return { nftTokenId: t.id, onChainTokenId: t.tokenId, items };
        }),
      );

      return { gated: true as const, tokens };
    }),

  // Ground-truth read straight from the contract, independent of the cached
  // DB row — lets the manage page show real on-chain state (and flag it if
  // the cache has drifted) rather than re-displaying what confirm* already
  // wrote.
  onChainInsights: publicProcedure
    .input(z.object({ id: z.string(), account: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.id }, include: { prices: true } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const account = input.account ?? ctx.session?.user?.id;
      const base = {
        contractId: nft.contractAddress,
        network: STELLAR_NETWORK_LABEL,
        account: account ?? null,
      };

      const myTokens = account
        ? await ctx.db.nftToken.findMany({
            where: { nftId: nft.id, ownerId: account },
            select: { tokenId: true },
          })
        : [];

      if (!nft.onChainEditionId) {
        return {
          ...base,
          minted: false as const,
          supply: nft.supply,
          mintedCount: nft.mintedCount,
          remainingSupply: nft.supply - nft.mintedCount,
          prices: nft.prices.map((p) => ({
            paymentToken: p.paymentToken,
            price: p.price,
            tokenAddress: safePaymentTokenAddress(p.paymentToken as NftPaymentToken),
          })),
          myTokenIds: myTokens.map((t) => t.tokenId),
        };
      }

      const editionId = Number(nft.onChainEditionId);
      const [meta, remaining, onChainPrices] = await Promise.all([
        getEditionMeta(editionId),
        getRemainingSupply(editionId),
        getEditionPrices(editionId),
      ]);

      return {
        ...base,
        minted: true as const,
        editionId,
        title: meta?.title ?? nft.name,
        description: meta?.description ?? nft.description,
        thumbnailUrl: meta?.thumbnail_url ?? nft.thumbnail,
        mediaUrl: meta?.media_url ?? nft.contentUrl,
        creator: meta?.creator ?? nft.creatorId,
        royaltyBps: nft.royaltyBps,
        supply: meta?.supply ?? nft.supply,
        mintedCount: meta?.minted ?? nft.mintedCount,
        remainingSupply: remaining,
        // Ground truth once minted — read straight from the contract rather
        // than the DB cache the create form wrote before anything existed
        // on-chain.
        prices: onChainPrices.length
          ? onChainPrices.map((p) => ({
              paymentToken: labelForPaymentTokenAddress(p.payment_token),
              price: rawPriceToHuman(p.price),
              tokenAddress: p.payment_token,
            }))
          : nft.prices.map((p) => ({
              paymentToken: p.paymentToken,
              price: p.price,
              tokenAddress: safePaymentTokenAddress(p.paymentToken as NftPaymentToken),
            })),
        myTokenIds: myTokens.map((t) => t.tokenId),
        verified: meta !== null,
      };
    }),

  myCreated: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.nft.findMany({
      where: { creatorId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        prices: true,
        _count: { select: { likes: true } },
        likes: { where: { userId: ctx.session.user.id }, select: { id: true } },
      },
    });
    return items.map((nft) => {
      const { likes, _count, ...rest } = nft;
      return { ...rest, likeCount: _count.likes, isLiked: likes.length > 0 };
    });
  }),

  // Groups the caller's individually-owned copies by edition — one card per
  // edition showing "you hold N of M", not one card per copy.
  myOwned: protectedProcedure.query(async ({ ctx }) => {
    const tokens = await ctx.db.nftToken.findMany({
      where: { ownerId: ctx.session.user.id },
      include: {
        nft: {
          include: {
            creator: { select: { id: true, name: true, image: true } },
            _count: { select: { likes: true } },
            likes: { where: { userId: ctx.session.user.id }, select: { id: true } },
          },
        },
        listing: { include: { prices: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byNft = new Map<
      string,
      {
        nft: Omit<(typeof tokens)[number]["nft"], "likes" | "_count"> & {
          likeCount: number;
          isLiked: boolean;
        };
        quantity: number;
        tokens: {
          tokenId: string;
          isListed: boolean;
          listingPrice: number | null;
          listingPaymentToken: string | null;
          listingPrices: { paymentToken: string; price: number }[];
          listingPriceUSD: number | null;
        }[];
      }
    >();
    for (const t of tokens) {
      if (!byNft.has(t.nftId)) {
        byNft.set(t.nftId, { nft: shapeLikes(t.nft), quantity: 0, tokens: [] });
      }
      const entry = byNft.get(t.nftId)!;
      entry.quantity += 1;
      entry.tokens.push({
        tokenId: t.tokenId,
        isListed: t.listing?.isActive ?? false,
        listingPrice: t.listing?.isActive ? t.listing.price : null,
        listingPaymentToken: t.listing?.isActive
          ? labelForPaymentTokenAddress(t.listing.paymentToken ?? paymentTokenAddress("xlm"))
          : null,
        listingPrices: t.listing?.isActive
          ? t.listing.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price }))
          : [],
        listingPriceUSD: t.listing?.isActive ? t.listing.priceUSD : null,
      });
    }

    return [...byNft.values()];
  }),

  stats: publicProcedure.query(async ({ ctx }) => {
    const [listed, creators] = await Promise.all([
      ctx.db.nft.count(),
      ctx.db.nft.findMany({ distinct: ["creatorId"], select: { creatorId: true } }),
    ]);
    return { listed, creators: creators.length };
  }),

  toggleLike: protectedProcedure
    .input(z.object({ nftId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.nftLike.findUnique({
        where: { nftId_userId: { nftId: input.nftId, userId: ctx.session.user.id } },
      });
      if (existing) {
        await ctx.db.nftLike.delete({ where: { id: existing.id } });
        return { liked: false };
      }
      await ctx.db.nftLike.create({
        data: { nftId: input.nftId, userId: ctx.session.user.id },
      });
      return { liked: true };
    }),
});

function shapeLikes<T extends { _count: { likes: number }; likes: { id: string }[] }>(
  nft: T,
): Omit<T, "likes" | "_count"> & { likeCount: number; isLiked: boolean } {
  const { likes, _count, ...rest } = nft;
  return { ...rest, likeCount: _count.likes, isLiked: likes.length > 0 };
}
