import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "~/env";
import { db } from "~/server/db";
import { keepAliveOnChain } from "~/lib/stellar/oz/nft";

/**
 * Ids per `keep_alive` call, by kind.
 *
 * The binding limit is Soroban's per-transaction footprint — 100 entries on
 * mainnet — and it counts *every* entry the call touches, across all four
 * lists at once. So a single per-list cap is not enough: 25 of each was
 * measured at 153 entries, over the limit, even though no one list looked big.
 *
 * Each kind therefore gets its own cap, sized by how many ledger entries one
 * id costs, and a call only ever carries **one** kind:
 *
 *   token     up to 4  — OwnershipBucket, Owner, TokenEdition, Listing
 *   edition        2  — Edition, EditionPrices
 *   ref            1  — EditionByRef
 *   unlocked       1  — Unlocked(token, index)
 *
 * Every cap lands near 80 entries, leaving room under 100 for the instance
 * entry and for a batch where every token is listed. Measured, not guessed —
 * see `a_sweep_at_the_scheduler_batch_size_fits_one_transaction` in the
 * contract tests, where 31 worst-case tokens already reach 102.
 */
const LIMITS = {
  tokens: 20,
  editions: 40,
  refs: 80,
  unlocked: 80,
} as const;

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
 * not itself scheduled from inside this app (see that cron's own comment
 * for why the trigger lives there).
 *
 * Authenticated with the same shared-secret convention
 * `package/express-wadzzo/src/middleware/auth.ts` already uses for the
 * reverse direction (`NEXTAUTH_SECRET`, sent as `X-Api-Key`) rather than a
 * new secret — this is a service-to-service call, not a user request, so
 * there's no session to check.
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
      // The `edition_ref` each edition was registered under — losing this
      // entry is the worst case, since `buy_edition` then can't resolve the
      // ref and `register_edition` would create a duplicate edition.
      id: true,
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
  const editionRefs = nfts.map((n) => n.id);

  // Every minted token, deliberately — this used to send one representative
  // per 3,200-id `Consecutive` bucket, since touching one renews ownership
  // for the whole bucket. That no longer suffices: `keep_alive` now also
  // renews `TokenEdition` (what `art_meta`/`royalty_info` resolve through)
  // and `Listing`, both keyed per token, so a bucket representative renews
  // only its own. Thinning the list would leave every other token owned but
  // metadata-less — the exact failure this endpoint exists to prevent. The
  // trade is a higher per-run cost.
  const tokenIds = Array.from(
    new Set(
      nfts
        .flatMap((n) => n.tokens.map((t) => Number(t.tokenId)))
        .filter((id) => Number.isFinite(id)),
    ),
  );

  // Reward items already unlocked on-chain. Their `Unlocked(token, index)`
  // entry is written once by `unlock_item_for` and never touched again, so
  // without renewal it expires and silently re-locks content the holder has
  // already earned. `chainIndex` is the item's permanent on-chain identity,
  // not its database id.
  const unlockedRows = await db.locationGroup.findMany({
    where: {
      onChainUnlockedAt: { not: null },
      unlockForToken: { isNot: null },
      unlockForLockedMedia: { isNot: null },
    },
    select: {
      unlockForToken: { select: { tokenId: true } },
      unlockForLockedMedia: { select: { chainIndex: true } },
    },
  });
  const unlocked = unlockedRows
    .map((r): [number, number] => [
      Number(r.unlockForToken?.tokenId),
      r.unlockForLockedMedia?.chainIndex ?? Number.NaN,
    ])
    .filter(([tokenId, index]) => Number.isFinite(tokenId) && Number.isFinite(index));

  /**
   * One kind per call. Mixing them is what blew the footprint before: the caps
   * are per-list, but the transaction pays for all of them together.
   */
  const rounds: Array<{ kind: string; call: Parameters<typeof keepAliveOnChain>[0]; size: number }> = [
    ...chunk(tokenIds, LIMITS.tokens).map((b) => ({
      kind: "tokens",
      call: { editionIds: [], editionRefs: [], tokenIds: b, unlocked: [] },
      size: b.length,
    })),
    ...chunk(editionIds, LIMITS.editions).map((b) => ({
      kind: "editions",
      call: { editionIds: b, editionRefs: [], tokenIds: [], unlocked: [] },
      size: b.length,
    })),
    ...chunk(editionRefs, LIMITS.refs).map((b) => ({
      kind: "refs",
      call: { editionIds: [], editionRefs: b, tokenIds: [], unlocked: [] },
      size: b.length,
    })),
    ...chunk(unlocked, LIMITS.unlocked).map((b) => ({
      kind: "unlocked",
      call: { editionIds: [], editionRefs: [], tokenIds: [], unlocked: b },
      size: b.length,
    })),
  ];

  const results: Array<{
    round: number;
    kind: string;
    size: number;
    hash?: string;
    error?: string;
  }> = [];

  // Sequential, not parallel/Promise.all — every round is signed and
  // submitted by the same treasury source account, so concurrent
  // submissions would race for the same sequence number.
  //
  // Every round also renews the contract instance, so even a collection with
  // nothing else to sweep still keeps the contract itself alive.
  for (const [i, round] of rounds.entries()) {
    try {
      const hash = await keepAliveOnChain(round.call);
      results.push({ round: i, kind: round.kind, size: round.size, hash });
    } catch (e) {
      results.push({
        round: i,
        kind: round.kind,
        size: round.size,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const failures = results.filter((r) => r.error);
  return res.status(failures.length > 0 ? 207 : 200).json({
    editionsTouched: editionIds.length,
    editionRefsTouched: editionRefs.length,
    tokensTouched: tokenIds.length,
    unlockedTouched: unlocked.length,
    rounds: results,
  });
}
