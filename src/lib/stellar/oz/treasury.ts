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
 *
 * Also reused as the `unlock_authority` signer (see `getTreasurySecret`
 * below) — treasury and unlock-authority happen to be the same account on
 * every environment this contract has been deployed to so far. A caller
 * that signs `unlock_item_for` with `MOTHER_SECRET` directly instead is
 * only correct on testnet (where treasury == MOTHER); on pubnet, where
 * treasury is its own dedicated account, that signs with the wrong key and
 * fails on-chain — `getTreasurySecret()` resolves the same way
 * `getTreasuryKeypair()` does so both stay correct together.
 */
export function getTreasuryKeypair(): Keypair {
  return Keypair.fromSecret(getTreasurySecret());
}

/**
 * Raw secret behind {@link getTreasuryKeypair}, exported separately for
 * callers that need the string rather than a `Keypair` — currently
 * `unlockItemFor` (`src/lib/stellar/oz/nft.ts`), since `set_unlock_authority`
 * on the shared nft_oz contract has always been called with this same
 * treasury account.
 */
export function getTreasurySecret(): string {
  return env.TREASURY_SECRET ?? env.MOTHER_SECRET;
}
