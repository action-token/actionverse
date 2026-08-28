import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "~/env";
import { db } from "~/server/db";
import { getTtlHealth } from "~/lib/stellar/oz/nft";

/** Alert below this. Two months of sweeps can fail before it trips. */
const WARN_BELOW_DAYS = 90;

/**
 * Reads how much life the collection's on-chain storage has left.
 *
 * The sweep failing is silent — no error, nothing broken, until entries age
 * out months later and tokens stop resolving. This measures the outcome
 * instead of trusting the job: if `keep_alive` stops running, the database
 * drifts from the chain, or a `stellar-tokens` upgrade moves the keys the
 * sweep targets, `daysRemaining` falls in every case.
 *
 * `ok: false` means act. 90 days leaves room for two missed sweeps.

 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!env.NEXTAUTH_SECRET || req.headers["x-api-key"] !== env.NEXTAUTH_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const nfts = await db.nft.findMany({
    where: { onChainEditionId: { not: null } },
    select: { id: true, onChainEditionId: true, tokens: { select: { tokenId: true } } },
  });

  const editionIds = Array.from(
    new Set(nfts.map((n) => Number(n.onChainEditionId)).filter(Number.isFinite)),
  );
  const editionRefs = nfts.map((n) => n.id);
  const allTokenIds = Array.from(
    new Set(nfts.flatMap((n) => n.tokens.map((t) => Number(t.tokenId))).filter(Number.isFinite)),
  );

  // Editions and refs in full — they are few, and `EditionByRef` is the entry
  // whose loss is worst. Tokens are sampled: they can run to thousands, and
  // one sweep renews them together, so a spread of them shows the same
  // picture as all of them at a fraction of the RPC calls.
  const SAMPLE = 100;
  const step = Math.max(1, Math.floor(allTokenIds.length / SAMPLE));
  const sampled = allTokenIds.filter((_, i) => i % step === 0).slice(0, SAMPLE);

  try {
    const health = await getTtlHealth({ editionIds, editionRefs, tokenIds: sampled });
    const ok = health.daysRemaining >= WARN_BELOW_DAYS && health.missing.length === 0;

    if (!ok) {
      console.error("keep-alive-health: collection storage is aging out", {
        daysRemaining: health.daysRemaining,
        worst: health.worst,
        missing: health.missing.slice(0, 20),
      });
    }

    return res.status(200).json({
      ok,
      daysRemaining: Number(health.daysRemaining.toFixed(1)),
      worst: health.worst,
      warnBelowDays: WARN_BELOW_DAYS,
      checked: health.checked,
      tokensTotal: allTokenIds.length,
      tokensSampled: sampled.length,
      missing: health.missing.slice(0, 20),
      missingCount: health.missing.length,
    });
  } catch (e) {
    // A failed check is not a healthy collection — say so rather than 200.
    const message = e instanceof Error ? e.message : String(e);
    console.error("keep-alive-health: check failed", { message });
    return res.status(503).json({ ok: false, error: message });
  }
}
