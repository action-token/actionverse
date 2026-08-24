import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "~/env";
import { db } from "~/server/db";
import { keepAliveOnChain } from "~/lib/stellar/oz/nft";

/**
 * Mirrors `stellar-tokens`' `Consecutive` bucket size (`IDS_IN_BUCKET` =
 * `ITEMS_IN_BUCKET`(100) * `IDS_IN_ITEM`(32) = 3,200 — see
 * `contracts/nft_oz`'s pinned `stellar-tokens` crate). Touching one token id
 * per bucket range renews every token whose id falls in that bucket, so
 * there's no need to list — or even know about — every single minted token
 * id, just one representative per 3,200-wide range.
 */
const TOKENS_PER_TTL_BUCKET = 3200;

/** Must match nft_oz's `MAX_KEEP_ALIVE_IDS`. */
const MAX_IDS_PER_CALL = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Internal-only endpoint: renews nft_oz's contract instance plus every
 * registered edition's and minted token's TTL, so a copy that never trades
 * again (a one-and-done buyer, a sold-out limited edition) doesn't drift
 * toward Soroban's TTL/state-archival expiry for lack of any other
 * transaction to trigger a renewal. Called on a schedule by
 * `package/express-wadzzo`'s keep-alive cron — never by an end user, and
 * not itself scheduled from inside this app.
 *
 * Authenticated with the same shared-secret convention
 * `package/express-wadzzo/src/middleware/auth.ts` already uses for the
 * reverse direction (`NEXTAUTH_SECRET`, sent as `X-Api-Key`) rather than a
 * new secret — this is a service-to-service call, not a user request, so
 * there's no session to check.
 *
 * Ported from the same feature in bandfan — this app and bandfan share the
 * exact same deployed nft_oz contract address (see `ART_NFT_CONTRACT_ID` in
 * `~/lib/common`), but each app has its own separate database of editions
 * and tokens, so each needs its own copy of this endpoint to keep its own
 * rows' on-chain data alive.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!env.NEXTAUTH_SECRET || req.headers["x-api-key"] !== env.NEXTAUTH_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const nfts = await db.nft.findMany({
    where: { onChainEditionId: { not: null } },
    select: {
      onChainEditionId: true,
      tokens: { select: { tokenId: true } },
    },
  });

  const editionIds = Array.from(
    new Set(
      nfts
        .map((n) => Number(n.onChainEditionId))
        .filter((id) => Number.isFinite(id)),
    ),
  );

  // One token id per bucket is enough — see `TOKENS_PER_TTL_BUCKET`'s doc
  // comment above.
  const tokenIdByBucket = new Map<number, number>();
  for (const nft of nfts) {
    for (const t of nft.tokens) {
      const tokenId = Number(t.tokenId);
      if (!Number.isFinite(tokenId)) continue;
      const bucket = Math.floor(tokenId / TOKENS_PER_TTL_BUCKET);
      if (!tokenIdByBucket.has(bucket)) tokenIdByBucket.set(bucket, tokenId);
    }
  }
  const tokenIds = Array.from(tokenIdByBucket.values());

  const editionChunks = chunk(editionIds, MAX_IDS_PER_CALL);
  const tokenChunks = chunk(tokenIds, MAX_IDS_PER_CALL);
  const rounds = Math.max(editionChunks.length, tokenChunks.length);

  const results: Array<{
    round: number;
    editionCount: number;
    tokenCount: number;
    hash?: string;
    error?: string;
  }> = [];

  // Sequential, not parallel/Promise.all — every round is signed and
  // submitted by the same treasury source account, so concurrent
  // submissions would race for the same sequence number.
  for (let i = 0; i < rounds; i++) {
    const editionBatch = editionChunks[i] ?? [];
    const tokenBatch = tokenChunks[i] ?? [];
    try {
      const hash = await keepAliveOnChain({
        editionIds: editionBatch,
        tokenIds: tokenBatch,
      });
      results.push({ round: i, editionCount: editionBatch.length, tokenCount: tokenBatch.length, hash });
    } catch (e) {
      results.push({
        round: i,
        editionCount: editionBatch.length,
        tokenCount: tokenBatch.length,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const failures = results.filter((r) => r.error);
  return res.status(failures.length > 0 ? 207 : 200).json({
    editionsTouched: editionIds.length,
    tokensTouched: tokenIds.length,
    rounds: results,
  });
}
