import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { type NftPurchase, type Prisma, type PrismaClient } from "@prisma/client";
import { Client as SquareClient, type Environment as SquareEnvironment } from "square";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildBuyBatchXDR,
  buildBuyEditionXDR,
  buildBuyXDR,
  buildCancelListingXDR,
  buildEstablishTrustlineXDR,
  buildListBatchXDR,
  buildListXDR,
  ensureBuyerTrustline,
  feeBumpAsCustodialBuyer,
  fundBuyerForCardPurchase,
  getEditionMeta,
  getEditionPrices,
  getOnChainBalance,
  getOnChainListing,
  getOnChainUnlockStatus,
  getPurchaseByRef,
  getRemainingSupply,
  getSaleBreakdown,
  hasPlatformAssetTrustline,
  isStellarAccountActivated,
  labelForPaymentTokenAddress,
  NFT_DISPLAY_CURRENCIES,
  NFT_PAYMENT_TOKENS,
  paymentTokenAddress,
  pollUntilVisible,
  signArtXdr,
  submitFeeBumpedPurchase,
  verifyContractTransaction,
  type NftPaymentToken,
} from "~/lib/stellar/oz/nft";
import { priceStillMatchesOnChain } from "~/lib/stellar/oz/price-guard";
import { ART_NFT_CONTRACT_ID } from "~/lib/common";
import {
  INCLUSION_FEE_IN_PLATFORM_ASSET,
  INCLUSION_FEE_IN_USD,
  MAX_ROYALTY_BPS,
  NETWORK_FEE_IN_PLATFORM_ASSET,
  NETWORK_FEE_IN_USD,
  humanPriceToRaw,
  rawPriceToHuman,
} from "~/lib/stellar/constant";
import { STELLAR_NETWORK_LABEL } from "~/lib/stellar/explorer";
import { SignUser } from "~/lib/stellar/utils";
import { env } from "~/env";
import { getAccSecretFromRubyApi } from "package/connect_wallet/src/lib/stellar/get-acc-secret";
import { isRechargeAbleClient } from "~/utils/recharge/is-rechargeable-client";
import { WalletType } from "~/types/wallet/wallet-types";

// Same Square client shape as `src/server/api/routers/marketplace/pay.ts`
// (`buyAsset`) — this is nft_oz's own card-checkout entry point (Part D of
// the nft_oz payment design), kept in this router rather than `pay.ts`
// since it needs deep nft_oz-specific delivery logic
// (`deliverCardFundedEditionPurchase`/`fundBuyerForCardPurchase`).
const squarePaymentsApi = new SquareClient({
  accessToken: env.SQUARE_ACCESS_TOKEN,
  environment: env.SQUARE_ENVIRONMENT as SquareEnvironment,
}).paymentsApi;

/**
 * Splits every buy flow into the two shapes the fee-bump design needs (see
 * the plan's Part B/C): a custodial buyer can be signed for entirely
 * server-side in one call, while an external wallet has to sign its own
 * XDR client-side and round-trip it back. Derived from the session's own
 * `walletType`, not a client-supplied flag — the client can't misreport
 * which path it gets.
 */
type BuyerAuth =
  | { kind: "custodial"; signWith: { email: string }; email: string }
  | { kind: "external" };

function resolveBuyerAuth(user: { walletType: WalletType; email?: string | null }): BuyerAuth {
  if (isRechargeAbleClient(user.walletType)) {
    if (!user.email) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Missing account email" });
    }
    return { kind: "custodial", signWith: { email: user.email }, email: user.email };
  }
  return { kind: "external" };
}

/**
 * Run ahead of any buy flow for a custodial buyer: makes sure they're not
 * still short a Platform Asset trustline (silently fixed, folded into the
 * same server-side flow, no client-visible step — see the plan's Part E)
 * and that their account actually exists on-chain (a custodial sign-up
 * does *not* create one — see `isStellarAccountActivated`'s doc comment).
 * An external wallet gets `NEEDS_ACTIVATION`/`NEEDS_TRUSTLINE_SETUP`
 * instead — those cases need the buyer's own wallet/the existing
 * `ActivationModal`, which only the client can drive.
 */
async function ensureBuyerReady(auth: BuyerAuth, buyerId: string): Promise<void> {
  if (!(await isStellarAccountActivated(buyerId))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NEEDS_ACTIVATION" });
  }
  if (!(await hasPlatformAssetTrustline(buyerId))) {
    if (auth.kind !== "custodial") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NEEDS_TRUSTLINE_SETUP" });
    }
    const secret = await getAccSecretFromRubyApi(auth.email);
    await ensureBuyerTrustline({ buyerPubKey: buyerId, buyerSecret: secret });
  }
}

// User ids are Stellar public keys (56-char strkeys) — never a valid match,
// used so the `likes` include can stay an unconditional array shape for
// logged-out requests instead of branching the query's return type.
const NO_SUCH_USER = "__anonymous__";

// Mirrors `MAX_QUANTITY_PER_BUY` in `contracts/nft_oz/src/lib.rs` — kept in
// sync by hand so the UI/API can reject an over-large purchase before ever
// building a doomed transaction.
const MAX_QUANTITY_PER_BUY = 20;

const PaymentTokenSchema = z.enum([...NFT_PAYMENT_TOKENS]);
// Broader than `PaymentTokenSchema` — anywhere a creator/reseller *sets* a
// price (not where a buy/list XDR gets built) also accepts "usd", a
// creator/reseller-set sticker price charged via Square, never an on-chain
// `PriceEntry`. See `NFT_DISPLAY_CURRENCIES`'s doc comment.
const DisplayCurrencySchema = z.enum([...NFT_DISPLAY_CURRENCIES]);
// Both currencies are mandatory now — a creator/reseller can no longer
// offer just one. Buyers always get to choose ACTION or USD/card.
const DisplayPricesSchema = z
  .array(z.object({ paymentToken: DisplayCurrencySchema, price: z.number().positive() }))
  .min(2)
  .max(5)
  .refine(
    (prices) => prices.some((p) => p.paymentToken === "asset"),
    "A price in ACTION is required",
  )
  .refine(
    (prices) => prices.some((p) => p.paymentToken === "usd"),
    "A price in USD is required",
  );

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
 * Shared tail for every primary-purchase path once the on-chain
 * `buy_edition` call itself has already succeeded (fee-bumped, custodial or
 * external — see `getBuyEditionXDR`/`confirmBuyEdition` — or via
 * `deliverCardFundedEditionPurchase` below): reads back what actually
 * minted from `purchase_by_ref` (never trusted from the client) and updates
 * the DB from that.
 */
async function finalizeEditionPurchase(
  db: PrismaClient,
  purchase: NftPurchase,
  txHash: string,
) {
  const receipt = await pollUntilVisible(() => getPurchaseByRef(purchase.id));
  if (!receipt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Purchase did not register on-chain",
    });
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
  // outside the transaction above: doing this inside it blew past Prisma's
  // interactive-transaction timeout for anything beyond a tiny quantity
  // ("Transaction not found"). Not required to be atomic with the mint —
  // `nft.unlockStatus` self-heals a missing pin set.
  const gatedItems = await db.nftLockedMedia.findMany({
    where: { nftId: purchase.nftId, unlockRule: { isNot: null } },
    include: { unlockRule: { include: { points: true } } },
  });
  if (gatedItems.length > 0) {
    const nftMeta = await db.nft.findUniqueOrThrow({
      where: { id: purchase.nftId },
      select: { description: true, thumbnail: true, creatorId: true },
    });
    // createMany doesn't hand back the rows it inserted, so re-fetch just
    // the ids for this purchase's own token range.
    const newTokens = await db.nftToken.findMany({
      where: { tokenId: { in: tokenIds } },
      select: { id: true },
    });
    for (const t of newTokens) {
      for (const item of gatedItems) {
        await ensureTokenUnlockPinSet(
          db,
          item.unlockRule!,
          item,
          nftMeta,
          purchase.nftId,
          t.id,
          purchase.buyerId,
        );
      }
    }
  }

  return updated;
}

/**
 * Card/USD checkout's delivery step (Part D of the nft_oz payment design) —
 * called from `buyEditionWithCard` once Square has already charged the
 * card. Funds the buyer's own custodial account with the ACTION they're
 * about to spend (skipped if they already hold enough — a repeat card buyer
 * with leftover balance is a no-op here), then converges on the exact same
 * fee-bumped `buy_edition` call a direct purchase uses — see
 * `fundBuyerForCardPurchase`'s doc comment in `src/lib/stellar/oz/nft.ts`
 * for why this needs no XLM top-up. `purchase` must already be at
 * `STEP1_CONFIRMED` (Square already charged) before this runs. If this
 * step fails, there's no automatic retry (removed for now) — the row just
 * stays at `STEP1_CONFIRMED` for manual follow-up.
 */
export async function deliverCardFundedEditionPurchase(
  db: PrismaClient,
  purchase: NftPurchase,
  buyerEmail: string,
) {
  const nft = await db.nft.findUniqueOrThrow({
    where: { id: purchase.nftId },
    include: { prices: true },
  });
  const onChainPrices = nft.prices.filter((p) => p.paymentToken !== "usd");
  const assetRow = nft.prices.find((p) => p.paymentToken === "asset");
  if (!assetRow) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This item has no on-chain price to settle with" });
  }
  const inclusionFeeRaw = humanPriceToRaw(INCLUSION_FEE_IN_PLATFORM_ASSET);
  const networkFeeRaw = humanPriceToRaw(NETWORK_FEE_IN_PLATFORM_ASSET);
  const totalAssetRaw =
    humanPriceToRaw(assetRow.price * purchase.quantity) + inclusionFeeRaw + networkFeeRaw;

  let txHash: string;
  try {
    const buyerSecret = await getAccSecretFromRubyApi(buyerEmail);
    const currentBalanceRaw = humanPriceToRaw(await getOnChainBalance(purchase.buyerId));
    if (currentBalanceRaw < totalAssetRaw) {
      await fundBuyerForCardPurchase({
        buyerPubKey: purchase.buyerId,
        buyerSecret,
        assetAmountRaw: totalAssetRaw,
      });
    }

    const xdr = await buildBuyEditionXDR({
      buyerPubKey: purchase.buyerId,
      editionRef: nft.id,
      title: nft.name,
      description: nft.description,
      thumbnailUrl: nft.thumbnail,
      mediaUrl: nft.contentUrl,
      mediaType: nft.mediaType,
      creatorPubKey: nft.creatorId,
      royaltyBps: nft.royaltyBps,
      supply: nft.supply,
      prices: onChainPrices.map((p) => ({
        paymentToken: paymentTokenAddress(p.paymentToken as NftPaymentToken),
        priceRaw: humanPriceToRaw(p.price),
      })),
      purchaseRef: purchase.id,
      paymentToken: paymentTokenAddress("asset"),
      quantity: purchase.quantity,
      inclusionFeeRaw,
      networkFeeRaw,
    });
    txHash = await feeBumpAsCustodialBuyer({ xdr, signWith: { email: buyerEmail } });
  } catch (e) {
    // Square already charged the card — every failure from here on is
    // "money received, delivery owed" with no automatic retry (removed for
    // now): the row stays at `STEP1_CONFIRMED`, visible to a manual query
    // (`SELECT * FROM "NftPurchase" WHERE status = 'STEP1_CONFIRMED'`) for
    // someone to follow up on by hand.
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Payment received, but minting failed. Please contact support.",
      cause: e,
    });
  }

  return finalizeEditionPurchase(db, purchase, txHash);
}

/** Shared tail for a single-token resale purchase — used by both `confirmBuy`
 *  (external-wallet fee-bump) and `buyResaleWithCard`. */
async function finalizeResalePurchase(
  db: PrismaClient,
  listing: { tokenId: string; nftId: string },
  buyerId: string,
) {
  return db.$transaction(async (tx) => {
    await tx.nftToken.update({ where: { tokenId: listing.tokenId }, data: { ownerId: buyerId } });
    await tx.nftListing.update({ where: { tokenId: listing.tokenId }, data: { isActive: false } });
    // Hands this token's private pin set (if it's a gated ticket) to the
    // new owner without resetting unlock progress already collected —
    // filtered through the `unlockForToken` relation, not a bare
    // `unlockForTokenId: listing.tokenId` (on-chain id vs. internal id).
    await tx.locationGroup.updateMany({
      where: { unlockForToken: { tokenId: listing.tokenId } },
      data: { restrictedToUserId: buyerId },
    });
    await refreshListingAggregates(tx, listing.nftId);
    return tx.nft.findUniqueOrThrow({ where: { id: listing.nftId } });
  });
}

/** Shared tail for a pooled batch resale purchase — one settlement per
 *  listing, same as `finalizeResalePurchase`, just for every token the
 *  single fee-bumped `buy_batch` call just settled. */
async function finalizeBatchResalePurchase(
  db: PrismaClient,
  listings: { tokenId: string; nftId: string }[],
  buyerId: string,
): Promise<number> {
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
    return listings.length;
  });
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
        prices: DisplayPricesSchema,
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
                  radius: z.number().positive().max(1000).default(50),
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

  // Primary purchase, direct ACTION — fee-bumped (Part B/C of the nft_oz
  // payment design). Custodial buyers get everything done in this one call
  // (`submitted: true`, `txHash` already final); an external wallet gets an
  // unsigned `buy_edition` XDR back to sign with its own sign-only function
  // and hand to `confirmBuyEdition`. `NEEDS_ACTIVATION`/
  // `NEEDS_TRUSTLINE_SETUP` (thrown via `ensureBuyerReady`) tell the client
  // to run the existing `ActivationModal`/"Trust & Buy" flow first — see
  // `buildEstablishTrustlineXDR`'s doc comment for the latter.
  getBuyEditionXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        paymentToken: PaymentTokenSchema,
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_BUY).default(1),
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

      // Once the edition is registered on-chain, `buy_edition` charges
      // whatever EditionPrices holds right now — not this DB row — so a
      // creator's `nft.update` landing between this build and the buyer's
      // signature could otherwise silently charge something the UI never
      // showed them. See src/lib/stellar/oz/price-guard.ts's doc comment.
      if (nft.onChainEditionId !== null) {
        const onChainPrices = await getEditionPrices(Number(nft.onChainEditionId));
        const paymentTokenAddr = paymentTokenAddress(input.paymentToken);
        if (
          !priceStillMatchesOnChain(
            humanPriceToRaw(priceRow.price),
            onChainPrices,
            paymentTokenAddr,
          )
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Price changed, please refresh and try again",
          });
        }
      }

      const buyerId = ctx.session.user.id;
      const auth = resolveBuyerAuth(ctx.session.user);
      await ensureBuyerReady(auth, buyerId);

      // Pre-created so its id can be handed to the contract as `purchase_ref`
      // — the buyer hasn't signed anything yet, same shape as `Nft.create`
      // pre-creating a row before a mint used to happen.
      const purchase = await ctx.db.nftPurchase.create({
        data: {
          nftId: nft.id,
          buyerId,
          quantity: input.quantity,
          paymentToken: input.paymentToken,
          unitPrice: priceRow.price,
        },
      });
      const contractAddress = ART_NFT_CONTRACT_ID;
      await ctx.db.nft.update({ where: { id: nft.id }, data: { contractAddress } });

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
        prices: nft.prices
          .filter((p) => p.paymentToken !== "usd")
          .map((p) => ({
            paymentToken: paymentTokenAddress(p.paymentToken as NftPaymentToken),
            priceRaw: humanPriceToRaw(p.price),
          })),
        purchaseRef: purchase.id,
        paymentToken: paymentTokenAddress(input.paymentToken),
        quantity: input.quantity,
        inclusionFeeRaw: humanPriceToRaw(INCLUSION_FEE_IN_PLATFORM_ASSET),
        networkFeeRaw: humanPriceToRaw(NETWORK_FEE_IN_PLATFORM_ASSET),
      });

      if (auth.kind === "custodial") {
        const txHash = await feeBumpAsCustodialBuyer({ xdr, signWith: auth.signWith });
        const nftResult = await finalizeEditionPurchase(ctx.db, purchase, txHash);
        return { submitted: true as const, txHash, contractAddress, purchaseId: purchase.id, nft: nftResult };
      }
      return { submitted: false as const, xdr, contractAddress, purchaseId: purchase.id };
    }),

  // The external-wallet second call: the client already signed the XDR
  // `getBuyEditionXDR` returned with that wallet's own sign-only function.
  // Fee-bumps, submits, and finalizes the same way the custodial path does
  // inline.
  confirmBuyEdition: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        purchaseId: z.string(),
        signedXdr: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const purchase = await ctx.db.nftPurchase.findUnique({
        where: { id: input.purchaseId },
      });
      if (
        !purchase ||
        purchase.nftId !== input.nftId ||
        purchase.buyerId !== ctx.session.user.id
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (purchase.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "Already confirmed" });
      }

      const txHash = await submitFeeBumpedPurchase(input.signedXdr);
      return finalizeEditionPurchase(ctx.db, purchase, txHash);
    }),

  // USD/card checkout for a primary edition purchase (Part D of the nft_oz
  // payment design): Square charges the card for the item's own USD sticker
  // price (`NftPrice{paymentToken: "usd"}`, set independently by the
  // creator — not converted live from the ACTION price), then
  // `deliverCardFundedEditionPurchase` funds and delivers. Custodial
  // accounts only — the buyer's own custodial secret has to sign the actual
  // on-chain `buy_edition` call (see that function's doc comment); an
  // unactivated account is sent to the existing `ActivationModal` instead
  // of silently having its account created here.
  buyEditionWithCard: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_BUY).default(1),
        sourceId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { walletType, email, id: buyerId } = ctx.session.user;
      if (!isRechargeAbleClient(walletType) || !email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Card checkout is only available for email or social sign-in accounts",
        });
      }
      if (!(await isStellarAccountActivated(buyerId))) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NEEDS_ACTIVATION" });
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
      const usdRow = nft.prices.find((p) => p.paymentToken === "usd");
      if (!usdRow) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This item isn't priced in USD" });
      }
      // The on-chain leg still settles in ACTION — the USD price Square
      // charges and the ACTION price the buyer's funded account pays the
      // creator in are two independent numbers, not derived from each
      // other, but an ACTION entry has to exist for the on-chain leg.
      if (!nft.prices.some((p) => p.paymentToken === "asset")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This item has no on-chain price to settle with" });
      }

      const totalUsd = usdRow.price * input.quantity + INCLUSION_FEE_IN_USD + NETWORK_FEE_IN_USD;

      const purchase = await ctx.db.nftPurchase.create({
        data: {
          nftId: nft.id,
          buyerId,
          quantity: input.quantity,
          paymentToken: "asset",
          unitPrice: usdRow.price,
        },
      });

      const { result } = await squarePaymentsApi.createPayment({
        idempotencyKey: randomUUID(),
        sourceId: input.sourceId,
        amountMoney: { currency: "USD", amount: BigInt(Math.round(totalUsd * 100)) },
      });
      if (result.errors || result.payment?.status !== "COMPLETED") {
        await ctx.db.nftPurchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Card payment failed" });
      }
      // Square already has the money — mark this checkpoint so a delivery
      // failure from here is "money received, delivery owed" for the
      // reconciliation job, not "never happened".
      await ctx.db.nftPurchase.update({
        where: { id: purchase.id },
        data: { status: "STEP1_CONFIRMED", step1TxHash: result.payment.id },
      });

      return deliverCardFundedEditionPurchase(ctx.db, purchase, email);
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
        prices: DisplayPricesSchema,
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedToken(ctx.db, input.tokenId, ctx.session.user.id);

      // Only "asset" entries become on-chain `PriceEntry`s — "usd" is a
      // creator/reseller sticker price with no on-chain representation
      // (see `DisplayPricesSchema`/`NFT_DISPLAY_CURRENCIES`); it's carried
      // through to `confirmListing` below instead, alongside this XDR.
      const onChainPrices = input.prices.filter(
        (p): p is { paymentToken: NftPaymentToken; price: number } => p.paymentToken !== "usd",
      );

      const xdr = await buildListXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId: Number(input.tokenId),
        prices: onChainPrices.map((p) => ({
          paymentToken: paymentTokenAddress(p.paymentToken),
          priceRaw: humanPriceToRaw(p.price),
        })),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  // Mirrors the listing the contract actually recorded rather than echoing
  // the client's numbers back into the database — except for the USD
  // sticker price, which has no on-chain representation at all and so has
  // no ground truth to mirror; it's trusted from the caller the same way
  // `create`'s own USD price already is.
  confirmListing: protectedProcedure
    .input(z.object({ tokenId: z.string(), txHash: z.string().min(1), usdPrice: z.number().positive() }))
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

      return ctx.db.$transaction(async (tx) => {
        const listing = await tx.nftListing.upsert({
          where: { tokenId: input.tokenId },
          create: {
            nftId: token.nftId,
            tokenId: input.tokenId,
            sellerId: ctx.session.user.id,
            price,
            paymentToken,
            isActive: true,
          },
          update: { sellerId: ctx.session.user.id, price, paymentToken, isActive: true },
        });
        // Leave any "usd" row alone — it has no on-chain counterpart to
        // resync from, so only the on-chain-derived rows get replaced here.
        await tx.nftListingPrice.deleteMany({
          where: { listingId: listing.id, paymentToken: { not: "usd" } },
        });
        await tx.nftListingPrice.createMany({
          data: onChain.prices.map((p) => ({
            listingId: listing.id,
            paymentToken: labelForPaymentTokenAddress(p.payment_token),
            price: rawPriceToHuman(p.price),
          })),
        });
        await tx.nftListingPrice.upsert({
          where: { listingId_paymentToken: { listingId: listing.id, paymentToken: "usd" } },
          create: { listingId: listing.id, paymentToken: "usd", price: input.usdPrice },
          update: { price: input.usdPrice },
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
        prices: DisplayPricesSchema,
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const tokenId of input.tokenIds) {
        await requireOwnedToken(ctx.db, tokenId, ctx.session.user.id);
      }

      const onChainPrices = input.prices.filter(
        (p): p is { paymentToken: NftPaymentToken; price: number } => p.paymentToken !== "usd",
      );

      const xdr = await buildListBatchXDR({
        sellerPubKey: ctx.session.user.id,
        tokenIds: input.tokenIds.map(Number),
        prices: onChainPrices.map((p) => ({
          paymentToken: paymentTokenAddress(p.paymentToken),
          priceRaw: humanPriceToRaw(p.price),
        })),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  // Mirrors what `list_batch` actually recorded on-chain — one `Listing` per
  // token id, resolved individually exactly like `confirmListing` does for a
  // single token. `usdPrice` has the same "no on-chain ground truth, trusted
  // from the caller" treatment as `confirmListing`'s.
  confirmListBatch: protectedProcedure
    .input(
      z.object({
        tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY),
        txHash: z.string().min(1),
        usdPrice: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      // Batched rather than four queries per token: the price rows for the
      // whole batch are cleared and rewritten in single `deleteMany`/
      // `createMany` calls keyed on every listing id at once. A 20-token
      // relist went from ~84 sequential round trips to ~26, which both
      // finishes far inside Prisma's 5s interactive-transaction budget and
      // narrows the window in which a connection pooler can hand a later
      // statement a different backend connection (the cause of the
      // "Transaction not found ... refers to an old closed transaction"
      // failures — see the pgbouncer note in the README).
      return ctx.db.$transaction(async (tx) => {
        const nftIds = new Set<string>();
        const listingIds: string[] = [];
        // Still one upsert per token — each needs its own generated id back
        // to key the price rows below — but nothing else is per-token now.
        for (const { token, cheapest } of resolved) {
          const listing = await tx.nftListing.upsert({
            where: { tokenId: token.tokenId },
            create: {
              nftId: token.nftId,
              tokenId: token.tokenId,
              sellerId: ctx.session.user.id,
              price: rawPriceToHuman(cheapest.price),
              paymentToken: cheapest.payment_token,
              isActive: true,
            },
            update: {
              sellerId: ctx.session.user.id,
              price: rawPriceToHuman(cheapest.price),
              paymentToken: cheapest.payment_token,
              isActive: true,
            },
          });
          listingIds.push(listing.id);
          nftIds.add(token.nftId);
        }

        // Every price row for this batch, replaced wholesale. The "usd" row
        // is rewritten the same way rather than upserted per listing — it
        // has no on-chain counterpart, but it is still fully determined by
        // `input.usdPrice`, so there is nothing to preserve.
        await tx.nftListingPrice.deleteMany({ where: { listingId: { in: listingIds } } });
        await tx.nftListingPrice.createMany({
          data: [
            ...resolved.flatMap(({ onChain }, i) =>
              onChain.prices.map((p) => ({
                listingId: listingIds[i]!,
                paymentToken: labelForPaymentTokenAddress(p.payment_token),
                price: rawPriceToHuman(p.price),
              })),
            ),
            ...listingIds.map((listingId) => ({
              listingId,
              paymentToken: "usd",
              price: input.usdPrice,
            })),
          ],
        });

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
      };
    }),

  // USD/card checkout for a resale purchase — resale's counterpart to
  // `buyEditionWithCard`. The reseller's own USD sticker price
  // (`NftListingPrice{paymentToken: "usd"}`, set independently of their
  // ACTION price) is what Square charges; the fee-bumped `buy` call still
  // settles on-chain in ACTION, using whichever ACTION price the reseller
  // listed at. Custodial buyers only.
  buyResaleWithCard: protectedProcedure
    .input(z.object({ tokenId: z.string(), sourceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { walletType, email, id: buyerId } = ctx.session.user;
      if (!isRechargeAbleClient(walletType) || !email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Card checkout is only available for email or social sign-in accounts",
        });
      }
      if (!(await isStellarAccountActivated(buyerId))) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NEEDS_ACTIVATION" });
      }

      const listing = await ctx.db.nftListing.findUnique({
        where: { tokenId: input.tokenId },
        include: { prices: true },
      });
      if (!listing?.isActive) throw new TRPCError({ code: "NOT_FOUND" });
      if (listing.sellerId === buyerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
      }
      const usdRow = listing.prices.find((p) => p.paymentToken === "usd");
      if (!usdRow) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This listing isn't priced in USD" });
      }
      if (!listing.prices.some((p) => p.paymentToken === "asset")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This listing has no on-chain price to settle with" });
      }

      const totalUsd = usdRow.price + INCLUSION_FEE_IN_USD + NETWORK_FEE_IN_USD;
      const { result } = await squarePaymentsApi.createPayment({
        idempotencyKey: randomUUID(),
        sourceId: input.sourceId,
        amountMoney: { currency: "USD", amount: BigInt(Math.round(totalUsd * 100)) },
      });
      if (result.errors || result.payment?.status !== "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Card payment failed" });
      }

      const inclusionFeeRaw = humanPriceToRaw(INCLUSION_FEE_IN_PLATFORM_ASSET);
      const networkFeeRaw = humanPriceToRaw(NETWORK_FEE_IN_PLATFORM_ASSET);

      try {
        const breakdown = await getSaleBreakdown(Number(input.tokenId), paymentTokenAddress("asset"));
        if (!breakdown) {
          throw new Error("Listing isn't priced in ACTION");
        }
        const totalAssetRaw = breakdown.total + inclusionFeeRaw + networkFeeRaw;

        const buyerSecret = await getAccSecretFromRubyApi(email);
        const currentBalanceRaw = humanPriceToRaw(await getOnChainBalance(buyerId));
        if (currentBalanceRaw < totalAssetRaw) {
          await fundBuyerForCardPurchase({ buyerPubKey: buyerId, buyerSecret, assetAmountRaw: totalAssetRaw });
        }

        const xdr = await buildBuyXDR({
          buyerPubKey: buyerId,
          tokenId: Number(input.tokenId),
          paymentToken: paymentTokenAddress("asset"),
          inclusionFeeRaw,
          networkFeeRaw,
        });
        await feeBumpAsCustodialBuyer({ xdr, signWith: { email } });
      } catch (e) {
        // Square already charged the card — resale has no `NftPurchase`-
        // equivalent row to key an automatic retry off of yet (same known
        // gap `deliverCardFundedEditionPurchase`'s doc comment flags for
        // primary purchases), so this surfaces directly instead.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Card charged, but delivery failed — please contact support.",
          cause: e,
        });
      }

      return finalizeResalePurchase(ctx.db, listing, buyerId);
    }),

  // Resale purchase, direct ACTION — fee-bumped, same shape as
  // `getBuyEditionXDR`/`confirmBuyEdition`. Custodial buyers get everything
  // done in this one call; an external wallet gets an unsigned `buy` XDR to
  // sign itself and hand to `confirmBuy`.
  getBuyXDR: protectedProcedure
    .input(z.object({ tokenId: z.string(), paymentToken: PaymentTokenSchema }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.nftListing.findUnique({ where: { tokenId: input.tokenId } });
      if (!listing?.isActive) throw new TRPCError({ code: "NOT_FOUND" });
      const buyerId = ctx.session.user.id;
      if (listing.sellerId === buyerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
      }

      const breakdown = await getSaleBreakdown(Number(input.tokenId), paymentTokenAddress(input.paymentToken));
      if (!breakdown) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This item isn't priced in that currency" });
      }

      const auth = resolveBuyerAuth(ctx.session.user);
      await ensureBuyerReady(auth, buyerId);

      const xdr = await buildBuyXDR({
        buyerPubKey: buyerId,
        tokenId: Number(input.tokenId),
        paymentToken: paymentTokenAddress(input.paymentToken),
        inclusionFeeRaw: humanPriceToRaw(INCLUSION_FEE_IN_PLATFORM_ASSET),
        networkFeeRaw: humanPriceToRaw(NETWORK_FEE_IN_PLATFORM_ASSET),
      });

      if (auth.kind === "custodial") {
        const txHash = await feeBumpAsCustodialBuyer({ xdr, signWith: auth.signWith });
        const nft = await finalizeResalePurchase(ctx.db, listing, buyerId);
        return { submitted: true as const, txHash, nft };
      }
      return { submitted: false as const, xdr, tokenId: input.tokenId };
    }),

  // The external-wallet second call for a resale purchase — mirrors
  // `confirmBuyEdition`.
  confirmBuy: protectedProcedure
    .input(z.object({ tokenId: z.string(), signedXdr: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.nftListing.findUnique({ where: { tokenId: input.tokenId } });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      await submitFeeBumpedPurchase(input.signedXdr);
      return finalizeResalePurchase(ctx.db, listing, ctx.session.user.id);
    }),

  // Batch resale purchase, direct ACTION — fee-bumped, one `buy_batch`
  // transaction settling every token at once. `INCLUSION_FEE_IN_PLATFORM_
  // ASSET`/`NETWORK_FEE_IN_PLATFORM_ASSET` are charged once for the whole
  // batch, not once per token — see `buy_batch`'s doc comment in
  // `contracts/nft_oz/src/lib.rs` — since there's only one real Soroban
  // transaction underneath regardless of how many tokens it settles.
  getBuyBatchXDR: protectedProcedure
    .input(
      z.object({
        tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY),
        paymentToken: PaymentTokenSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listings = await ctx.db.nftListing.findMany({ where: { tokenId: { in: input.tokenIds } } });
      if (listings.length !== input.tokenIds.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const buyerId = ctx.session.user.id;
      for (const listing of listings) {
        if (!listing.isActive) throw new TRPCError({ code: "NOT_FOUND" });
        if (listing.sellerId === buyerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
        }
      }

      const paymentToken = paymentTokenAddress(input.paymentToken);
      const breakdowns = await Promise.all(
        input.tokenIds.map((tokenId) => getSaleBreakdown(Number(tokenId), paymentToken)),
      );
      if (breakdowns.some((b) => !b)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "One or more items aren't priced in that currency" });
      }

      const auth = resolveBuyerAuth(ctx.session.user);
      await ensureBuyerReady(auth, buyerId);

      const xdr = await buildBuyBatchXDR({
        buyerPubKey: buyerId,
        tokenIds: input.tokenIds.map(Number),
        paymentToken,
        inclusionFeeRaw: humanPriceToRaw(INCLUSION_FEE_IN_PLATFORM_ASSET),
        networkFeeRaw: humanPriceToRaw(NETWORK_FEE_IN_PLATFORM_ASSET),
      });

      if (auth.kind === "custodial") {
        const txHash = await feeBumpAsCustodialBuyer({ xdr, signWith: auth.signWith });
        const count = await finalizeBatchResalePurchase(ctx.db, listings, buyerId);
        return { submitted: true as const, txHash, count };
      }
      return { submitted: false as const, xdr, tokenIds: input.tokenIds };
    }),

  // The external-wallet second call for a batch resale purchase — mirrors
  // `confirmBuy`.
  confirmBuyBatch: protectedProcedure
    .input(
      z.object({
        tokenIds: z.array(z.string()).min(1).max(MAX_QUANTITY_PER_BUY),
        signedXdr: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listings = await ctx.db.nftListing.findMany({ where: { tokenId: { in: input.tokenIds } } });
      if (listings.length !== input.tokenIds.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await submitFeeBumpedPurchase(input.signedXdr);
      const count = await finalizeBatchResalePurchase(ctx.db, listings, ctx.session.user.id);
      return { count };
    }),

  // The client shows a "Trust & Buy" button in place of "Buy" when a
  // wallet-connected buyer has no Platform Asset trustline yet (see
  // `ensureBuyerReady`'s `NEEDS_TRUSTLINE_SETUP` signal and
  // `buildEstablishTrustlineXDR`'s doc comment) — this is the XDR that
  // button signs first, immediately followed by the regular buy flow.
  getEstablishTrustlineXDR: protectedProcedure.mutation(async ({ ctx }) => {
    return { xdr: await buildEstablishTrustlineXDR(ctx.session.user.id) };
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
          priceToken: labelForPaymentTokenAddress(listing.paymentToken ?? paymentTokenAddress("asset")),
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
              id: true,
              type: true,
              label: true,
              sortOrder: true,
              // Names/coordinates, not just a count — shown on the buy page
              // so a prospective buyer can see exactly which real-world
              // places a gated item requires before paying, not just "N
              // locations" (see `UnlockLocationsPreview`). Also matched
              // against `unlockStatus`'s `lockedMediaId` by this same `id`
              // so `UnlockProgressList` can show the names/map for a
              // specific item's still-required locations, not just a count.
              unlockRule: {
                select: {
                  points: {
                    select: { id: true, label: true, latitude: true, longitude: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
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
          paymentToken: labelForPaymentTokenAddress(t.listing!.paymentToken ?? paymentTokenAddress("asset")),
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
          ? labelForPaymentTokenAddress(t.listing.paymentToken ?? paymentTokenAddress("asset"))
          : null,
        listingPrices: t.listing?.isActive
          ? t.listing.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price }))
          : [],
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
