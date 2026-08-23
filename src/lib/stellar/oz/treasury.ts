import { Keypair } from "@stellar/stellar-sdk";
import { env } from "~/env";

/**
 * The keypair treasury signs with everywhere it's involved in a purchase
 * (see `src/lib/stellar/oz/nft.ts`'s fee-bump section):
 *   - The fee-bump envelope wrapping every direct/card ACTION purchase's
 *     `buy_edition`/`buy`/`buy_batch` call (`feeBumpAsCustodialBuyer`/
 *     `submitFeeBumpedPurchase`) — this account pays the real Soroban
 *     network fee, never the buyer.
 *   - The source account for `fundBuyerForCardPurchase`/
 *     `ensureBuyerTrustline`/`buildEstablishTrustlineXDR`'s classic
 *     transactions (funding a card buyer's ACTION balance, fronting a new
 *     trustline's XLM reserve).
 *
 * This has to be the exact secret behind the contract's own stored
 * `Treasury` address (`DataKey::Treasury`, set at deploy time to
 * `PLATFORM_TREASURY_ADDRESS` in `~/lib/common`) — not just any funded
 * account — because `buy_edition`/`buy`/`buy_batch` route their
 * `inclusion_fee`/`network_fee` reimbursement (and the platform fee) to
 * whatever address the contract has stored as `Treasury`. If this keypair
 * doesn't match that address, treasury pays for fee-bump/funding out of
 * this account but the on-chain reimbursement lands somewhere else —
 * recovering nothing.
 *
 * Falls back to `MOTHER_SECRET` because that's already true on testnet
 * (`PLATFORM_TREASURY_ADDRESS`'s testnet value is the MOTHER account,
 * exactly as `~/lib/common`'s own comment says). Pubnet uses a dedicated
 * treasury address distinct from MOTHER's key — `TREASURY_SECRET` must be
 * set to that account's real secret before any treasury-sponsored purchase
 * can be submitted on pubnet.
 */
export function getTreasuryKeypair(): Keypair {
  const secret = env.TREASURY_SECRET ?? env.MOTHER_SECRET;
  return Keypair.fromSecret(secret);
}
