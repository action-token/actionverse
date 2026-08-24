import {
  Asset,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import { basicNodeSigner, SentTransaction, type AssembledTransaction } from "@stellar/stellar-sdk/contract";
import {
  Client as ArtNftClient,
  type ArtMeta,
  type EditionInput,
  type EditionMeta,
  type Listing,
  type PriceEntry,
  type PurchaseReceipt,
  type SaleBreakdown,
} from "contracts/nft_oz/bindings/src/index";
import { ART_NFT_CONTRACT_ID } from "~/lib/common";
import { StellarAccount } from "../marketplace/test/Account";
import {
  networkPassphrase,
  PLATFORM_ASSET,
  requireContractConstant,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
  STELLAR_URL,
  TrxBaseFee,
} from "../constant";
import { WithSing, type SignUserType } from "../utils";
import { getTreasuryKeypair, getPriceAuthoritySecret } from "./treasury";

/**
 * The only on-chain currency this collection buys/sells/resells in — no
 * native XLM leg. Deliberately not imported from `~/components/payment/
 * payment-process`'s `PaymentMethodEnum` (which this mirrors for the
 * "asset" case; that enum also carries "card"/"xlm" for unrelated,
 * non-nft_oz payment flows) so this server-safe module never pulls a
 * client component file into a server bundle; keep the two lists in sync
 * by hand.
 */
export const NFT_PAYMENT_TOKENS = ["asset"] as const;
export type NftPaymentToken = (typeof NFT_PAYMENT_TOKENS)[number];

/**
 * Every currency an item can be *priced* in for display — a strict superset
 * of `NFT_PAYMENT_TOKENS`. `"usd"` is deliberately not in
 * `NFT_PAYMENT_TOKENS`: it never becomes an on-chain `PriceEntry` (Soroban
 * has no fiat concept), it's a creator/reseller-set sticker price stored
 * only in `NftPrice`/`NftListingPrice` (see `src/server/api/routers/nft.ts`)
 * and charged via Square (see `fundBuyerForCardPurchase` below).
 */
export const NFT_DISPLAY_CURRENCIES = ["asset", "usd"] as const;
export type NftDisplayCurrency = (typeof NFT_DISPLAY_CURRENCIES)[number];

/**
 * `publicKey` becomes both the transaction source account and the identity
 * whose auth entries get attached during simulation — pass the address of
 * whichever party (creator/seller/buyer) must sign the resulting XDR.
 *
 * This matters most for `buy`/`buy_edition`: settlement invokes the payment
 * token's `transfer` as a sub-invocation, and those legs only end up in the
 * auth tree because simulation discovers them from this account. Hand-
 * building the XDR instead would produce a transaction that fails auth on
 * submission.
 */
function getClient(publicKey?: string): ArtNftClient {
  return new ArtNftClient({
    contractId: requireContractConstant(ART_NFT_CONTRACT_ID, "ART_NFT_CONTRACT_ID"),
    networkPassphrase,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
  });
}

/** The native XLM Stellar Asset Contract. Not an offered item currency (see
 *  `NFT_PAYMENT_TOKENS`) — kept only so `labelForPaymentTokenAddress` can
 *  still label a pre-existing on-chain listing/edition that was priced in
 *  XLM before it was dropped as an option. */
export function nativeTokenAddress(): string {
  return Asset.native().contractId(networkPassphrase);
}

/** The platform asset's Stellar Asset Contract. */
export function platformAssetContractId(): string {
  return PLATFORM_ASSET.contractId(networkPassphrase);
}

/**
 * Resolves a `NftPaymentToken` to the SEP-41 contract address `buy_edition`/
 * `list`/`buy`/`buy_batch` actually deal in.
 */
export function paymentTokenAddress(method: NftPaymentToken): string {
  switch (method) {
    case "asset":
      return platformAssetContractId();
  }
}

/** The inverse of `paymentTokenAddress`, for displaying an on-chain price
 *  entry's raw SAC address back as "asset". Also recognizes the native XLM
 *  SAC for a listing/edition priced before XLM was dropped as an offered
 *  currency. Falls back to the raw address for anything else. */
export function labelForPaymentTokenAddress(address: string): string {
  if (address === platformAssetContractId()) return "asset";
  if (address === nativeTokenAddress()) return "xlm";
  return address;
}

/**
 * Polls classic Horizon rather than Soroban RPC for a transaction's outcome.
 *
 * This is not a stylistic choice: this repo's pinned `@stellar/stellar-sdk`
 * cannot decode the transaction meta protocol 27 produces ("Bad union switch:
 * 4"), so `rpc.Server.getTransaction()` throws outright. Horizon computes
 * `successful` server-side, sidestepping the decoder entirely. The same
 * limitation is why a purchase's minted range is read back with
 * `purchase_by_ref` instead of from the invocation's return value — see
 * `contracts/nft_oz/src/lib.rs`'s doc comment on `buy_edition`.
 */
async function pollTransactionSuccess(hash: string): Promise<boolean> {
  const server = new Horizon.Server(STELLAR_URL);
  for (let i = 0; i < 15; i++) {
    try {
      const result = await server.transactions().transaction(hash).call();
      return result.successful;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // not yet indexed
    }
  }
  throw new Error(`Transaction ${hash} did not confirm in time`);
}

export async function verifyContractTransaction(txHash: string): Promise<boolean> {
  return pollTransactionSuccess(txHash);
}

export async function signArtXdr({
  xdr,
  signWith,
}: {
  xdr: string;
  signWith: SignUserType;
}): Promise<{ xdr: string; fullySignedByServer: boolean }> {
  const signed = await WithSing({ xdr, signWith });
  return { xdr: signed, fullySignedByServer: signed !== xdr };
}

/**
 * Approvals and ownership transfers take an *absolute* ledger sequence, so a
 * constant here would be permanently in the past on any live network. Always
 * derive it from the current ledger.
 */
export async function ledgerFromNow(offset = 500_000): Promise<number> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const { sequence } = await server.getLatestLedger();
  return sequence + offset;
}

/**
 * Retries a "did the effect of a just-confirmed transaction become visible
 * yet" read, used right after `verifyContractTransaction` reports success.
 *
 * Horizon confirming a transaction only means classic Horizon has indexed it
 * — it says nothing about whether the Soroban RPC node that happens to answer
 * the *next* read has caught up. `soroban-testnet.stellar.org` (and pubnet's
 * equivalent) load-balances across several backend nodes that don't always
 * agree with each other for a few seconds after a ledger closes, so a single
 * read immediately after confirmation can legitimately come back empty even
 * though the purchase genuinely landed. Retrying turns that into added
 * latency instead of a false "it didn't work".
 */
export async function pollUntilVisible<T>(
  read: () => Promise<T | null>,
  { attempts = 6, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await read();
    if (result !== null) return result;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  return null;
}

// =============================================================================
// Fee-bump purchases — the app's own buy/resale-buy flows.
//
// The buyer signs the real `buy_edition`/`buy`/`buy_batch` call themselves
// (the same call anyone paying their own gas would sign) and treasury wraps
// that already-signed transaction in a fee-bump envelope instead of
// submitting a second transaction — one ledger close per purchase, and the
// buyer never spends XLM because treasury, not the buyer, is the fee-bump's
// fee source. `inclusion_fee`/`network_fee` (now real params on
// `buy_edition`/`buy`/`buy_batch` — see `contracts/nft_oz/src/lib.rs`) are
// what let treasury recover the real cost of doing that.
//
// Two shapes, depending on who's holding the signing key:
//   - Custodial: server holds the buyer's secret, so build → sign → fee-bump
//     → submit all happen in one server-side call (`feeBumpAsCustodialBuyer`).
//   - External wallet: server builds the call *unsigned* and hands back the
//     XDR; the client signs it with that wallet's own sign-only function
//     (never the sign-and-submit wrapper it normally uses) and posts the
//     signed XDR back to `submitFeeBumpedPurchase`.
//
// USD/card checkout (see `fundBuyerForCardPurchase` below) funds the
// custodial buyer's own account with the ACTION they're about to spend, then
// converges on the exact same `feeBumpAsCustodialBuyer` path a direct
// purchase uses — no separate treasury-pays-and-delivers entry point.
// =============================================================================

/**
 * Wraps an already buyer-signed transaction (either a freshly-built inner
 * tx, or one round-tripped from an external wallet) in a fee-bump envelope
 * paid entirely by treasury, submits it, and confirms.
 *
 * Reuses the SDK's own `SentTransaction` (the exact class
 * `AssembledTransaction.signAndSend()` delegates to internally) rather than
 * hand-rolling a new confirmation poll — `SentTransaction.init` only reads
 * `assembled.signed` and a handful of `assembled.options` fields, so a
 * minimal object satisfying that shape gets the same exponential-backoff
 * `getTransaction` polling `signAndSend()` already relies on elsewhere in
 * this file, without needing an actual `AssembledTransaction` (which only
 * knows how to build *unsigned* calls, not wrap an arbitrary already-signed
 * one in a fee-bump).
 */
async function feeBumpAndSubmit(signedInnerTxXdr: string): Promise<string> {
  const treasury = getTreasuryKeypair();
  const server = new rpc.Server(SOROBAN_RPC_URL);

  const innerTx = TransactionBuilder.fromXDR(signedInnerTxXdr, networkPassphrase);
  if (!(innerTx instanceof Transaction)) {
    throw new Error("Expected a signed Soroban transaction envelope, not a fee-bump envelope");
  }

  // Per-operation base fee for the wrapper; Stellar requires the fee-bump's
  // total (baseFee * (innerOps + 1)) to be >= the inner transaction's own
  // fee — reusing the inner fee as the per-op base gives at least 2x
  // headroom for the common one- or two-operation case (buy, or
  // trustline+buy folded together — see `getBuyEditionXDR`'s trustline
  // handling in the router).
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    treasury,
    innerTx.fee,
    innerTx,
    networkPassphrase,
  );
  feeBump.sign(treasury);

  const sent = await SentTransaction.init({
    signed: feeBump,
    options: { server, rpcUrl: SOROBAN_RPC_URL, parseResultXdr: (v: unknown) => v },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see doc comment above
  } as any as AssembledTransaction<unknown>);

  return requireSentTransactionSucceeded(sent);
}

/**
 * `AssembledTransaction.signAndSend()` already polls Soroban RPC's own
 * `getTransaction` internally (exponential backoff) until the transaction
 * has a definitive SUCCESS/FAILED status — it does *not* return early on a
 * merely-submitted-but-still-pending transaction. That means a *second*,
 * separate confirmation poll after it returns (e.g. Horizon polling via
 * `verifyContractTransaction`) is pure redundant latency, not an extra
 * safety check. This helper is the real safety check: it reads the status
 * already obtained, so a failed submission throws immediately instead of
 * silently returning a hash for a transaction that never actually
 * succeeded.
 */
function requireSentTransactionSucceeded(sent: {
  sendTransactionResponse?: { hash: string };
  getTransactionResponse?: { status: string };
}): string {
  const hash = sent.sendTransactionResponse?.hash ?? "";
  if (sent.getTransactionResponse?.status !== "SUCCESS") {
    throw new Error(
      `Fee-bumped transaction ${hash || "(no hash)"} did not succeed on-chain (status: ${sent.getTransactionResponse?.status ?? "unknown"})`,
    );
  }
  return hash;
}

/**
 * The custodial one-call path: signs an unsigned `buy_edition`/`buy`/
 * `buy_batch` XDR (built by `buildBuyEditionXDR`/`buildBuyXDR`/
 * `buildBuyBatchXDR`) with the buyer's own custodial secret, then
 * fee-bumps and submits it. `signWith` must resolve to a real custodial
 * signer (an `{email}`/`{isAdmin}` `SignUserType`) — this is never the path
 * for a wallet-connected buyer, who signs client-side instead (see
 * `submitFeeBumpedPurchase`).
 */
export async function feeBumpAsCustodialBuyer({
  xdr,
  signWith,
}: {
  xdr: string;
  signWith: SignUserType;
}): Promise<string> {
  const { xdr: signedXdr, fullySignedByServer } = await signArtXdr({ xdr, signWith });
  if (!fullySignedByServer) {
    throw new Error("feeBumpAsCustodialBuyer requires a custodial signer (signWith must be set)");
  }
  return feeBumpAndSubmit(signedXdr);
}

/**
 * The external-wallet second call: the client already signed the XDR
 * `buildBuyEditionXDR`/`buildBuyXDR`/`buildBuyBatchXDR` returned, using that
 * wallet's own sign-only function — this just wraps it in treasury's
 * fee-bump and submits.
 */
export async function submitFeeBumpedPurchase(signedInnerTxXdr: string): Promise<string> {
  return feeBumpAndSubmit(signedInnerTxXdr);
}

// -----------------------------------------------------------------------------
// Account activation / trustline — the preconditions a fee-bumped purchase
// needs that a plain balance check doesn't cover. See the plan's Part D
// (activation) and Part E (trustline) for the reasoning.
// -----------------------------------------------------------------------------

/**
 * Whether `pubKey` is a real account on the ledger at all. A custodial
 * sign-up does *not* create one — that only happens through the existing
 * paid $2 flow (`ActivationModal`/`PayForActivation`,
 * `src/lib/stellar/auth/account-activation.ts`). A purchase must never
 * silently pay to create one on the buyer's behalf (see
 * `fundBuyerForCardPurchase`'s doc comment) — the caller is expected to
 * check this first and send an unactivated buyer to that existing flow
 * instead.
 */
export async function isStellarAccountActivated(pubKey: string): Promise<boolean> {
  try {
    await StellarAccount.create(pubKey);
    return true;
  } catch {
    return false;
  }
}

export async function hasPlatformAssetTrustline(pubKey: string): Promise<boolean> {
  try {
    const account = await StellarAccount.create(pubKey);
    return account.hasTrustline(PLATFORM_ASSET.code, PLATFORM_ASSET.issuer);
  } catch {
    return false;
  }
}

/**
 * The one step treasury can't do for a wallet-connected buyer by itself:
 * only the account owner can authorize a new trustline. Builds a
 * transaction with treasury as the fee-paying source — so this costs the
 * buyer nothing — carrying the `changeTrust` op (buyer as that op's
 * source), pre-signed by treasury. The caller's wallet adds just the
 * buyer's own authorization signature (via that wallet's sign-only
 * function, same as a purchase) and submits — a one-time step the client
 * shows as "Trust & Buy" before the buyer's first direct Platform Asset
 * purchase, immediately followed by the regular purchase flow.
 */
export async function buildEstablishTrustlineXDR(buyerPubKey: string): Promise<string> {
  const treasury = getTreasuryKeypair();
  const server = new Horizon.Server(STELLAR_URL);
  const treasuryAccount = await server.loadAccount(treasury.publicKey());

  const tx = new TransactionBuilder(treasuryAccount, { fee: TrxBaseFee, networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: PLATFORM_ASSET, source: buyerPubKey }))
    .setTimeout(180)
    .build();

  tx.sign(treasury);
  return tx.toXDR();
}

/**
 * The custodial counterpart to {@link buildEstablishTrustlineXDR}: since
 * the server already holds the buyer's own secret, it can just sign the
 * `changeTrust` op itself instead of round-tripping an XDR to a wallet for
 * authorization. Treasury still fronts the ~0.5 XLM reserve a new trustline
 * needs; that cost is folded into `INCLUSION_FEE_IN_PLATFORM_ASSET`/
 * `NETWORK_FEE_IN_PLATFORM_ASSET` (recouped from the buyer, not given
 * away — see the fee constants' own doc comments), not eaten by treasury
 * for free. Callers should run this (if `hasPlatformAssetTrustline` is
 * false) immediately before the fee-bumped buy call, never combined with
 * it into a single mutation the client waits differently on — the buyer
 * never sees or signs anything extra either way, it just costs one
 * additional server-side transaction on their very first purchase.
 */
export async function ensureBuyerTrustline({
  buyerPubKey,
  buyerSecret,
}: {
  buyerPubKey: string;
  buyerSecret: string;
}): Promise<void> {
  const treasury = getTreasuryKeypair();
  const server = new Horizon.Server(STELLAR_URL);
  const treasuryAccount = await server.loadAccount(treasury.publicKey());
  const buyerKeypair = Keypair.fromSecret(buyerSecret);

  const tx = new TransactionBuilder(treasuryAccount, { fee: TrxBaseFee, networkPassphrase })
    .addOperation(
      Operation.payment({
        source: treasury.publicKey(),
        destination: buyerPubKey,
        asset: Asset.native(),
        amount: "0.5",
      }),
    )
    .addOperation(Operation.changeTrust({ asset: PLATFORM_ASSET, source: buyerPubKey }))
    .setTimeout(30)
    .build();

  tx.sign(treasury);
  tx.sign(buyerKeypair);

  const result = await server.submitTransaction(tx);
  if (!result.successful) {
    throw new Error(`ensureBuyerTrustline: trustline transaction ${result.hash} did not succeed`);
  }
}

/**
 * Card/USD checkout's funding step, ported from the `development` branch's
 * `fundBuyerForCardPurchase` and trimmed for this branch's fee-bump design:
 * that version also gave the buyer a small XLM buffer so their own account
 * could pay its own network fee, because it predates fee-bump. Here the buy
 * step itself is fee-bumped (see `feeBumpAsCustodialBuyer`), so the buyer
 * never needs to hold any XLM at all — this only tops up what the *item*
 * costs: establishes the Platform Asset trustline if missing (needs
 * `buyerSecret` to countersign `changeTrust` — only the account owner can
 * authorize a new trustline), then sends exactly `assetAmountRaw` (the full
 * grand total: item price + inclusion fee + network fee, since the
 * following `buy_edition`/`buy`/`buy_batch` call charges those on-chain the
 * same as a direct purchase).
 *
 * Callers must check {@link isStellarAccountActivated} first — this never
 * creates the account itself; see that function's doc comment for why.
 */
export async function fundBuyerForCardPurchase({
  buyerPubKey,
  buyerSecret,
  assetAmountRaw,
}: {
  buyerPubKey: string;
  buyerSecret: string;
  /** Raw (stroop-scale) units — `total + inclusion_fee + network_fee`. */
  assetAmountRaw: bigint;
}): Promise<void> {
  if (!(await hasPlatformAssetTrustline(buyerPubKey))) {
    await ensureBuyerTrustline({ buyerPubKey, buyerSecret });
  }

  const treasury = getTreasuryKeypair();
  const server = new Horizon.Server(STELLAR_URL);
  const treasuryAccount = await server.loadAccount(treasury.publicKey());

  const tx = new TransactionBuilder(treasuryAccount, { fee: TrxBaseFee, networkPassphrase })
    .addOperation(
      Operation.payment({
        source: treasury.publicKey(),
        destination: buyerPubKey,
        asset: PLATFORM_ASSET,
        amount: rawPriceToDecimalString(assetAmountRaw),
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(treasury);

  const result = await server.submitTransaction(tx);
  if (!result.successful) {
    throw new Error(`fundBuyerForCardPurchase: funding transaction ${result.hash} did not succeed`);
  }
}

/** Classic Stellar payment amounts are decimal strings, not raw stroop
 *  units — the inverse of `humanPriceToRaw`/`rawPriceToHuman`'s scale, kept
 *  local since this is the only classic-payment amount left in this file. */
function rawPriceToDecimalString(raw: bigint): string {
  const scale = 10_000_000n;
  const whole = raw / scale;
  const frac = raw % scale;
  return `${whole}.${frac.toString().padStart(7, "0")}`;
}

// =============================================================================
// Writes — buy_edition/buy/buy_batch/list/list_batch. `buy_edition`/`buy`/
// `buy_batch` are the app's own primary purchase path now (see the
// fee-bump section above) — every build here is deliberately *unsigned*
// (no `.sign()`/`.signAndSend()` call), so the same builder serves both the
// custodial fee-bump path (server signs afterward) and the external-wallet
// path (the client signs the returned XDR itself).
// =============================================================================

/**
 * Buys `quantity` copies of an edition, minting them straight to the buyer.
 *
 * The *first* purchase of a given `editionRef` also registers the edition
 * on-chain from the fields passed here — this is why creating a listing
 * never asks the creator for a signature: the creator only signs nothing at
 * all, ever, and the buyer's purchase is what puts the edition on-chain.
 * Every later purchase of the same `editionRef` mints the next range against
 * the already-registered edition and ignores these descriptive fields.
 */
export async function buildBuyEditionXDR({
  buyerPubKey,
  editionRef,
  title,
  description,
  thumbnailUrl,
  mediaUrl,
  mediaType,
  creatorPubKey,
  royaltyBps,
  supply,
  prices,
  purchaseRef,
  paymentToken,
  quantity,
  inclusionFeeRaw,
  networkFeeRaw,
}: {
  buyerPubKey: string;
  /** The `Nft` row id — lets `edition_by_ref` resolve the edition later. */
  editionRef: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: string;
  creatorPubKey: string;
  royaltyBps: number;
  supply: number;
  /** The edition's full price grid, raw units per currency. */
  prices: { paymentToken: string; priceRaw: bigint }[];
  /** The `NftPurchase` row id — lets `purchase_by_ref` resolve this specific
   *  attempt's minted range afterwards, robust to concurrent purchases of
   *  the same edition (see the contract's doc comment for why). */
  purchaseRef: string;
  paymentToken: string;
  quantity: number;
  /** Raw units, reimbursing treasury for fee-bumping this purchase — see
   *  the fee-bump section above. `0n` for a call that isn't fee-bumped
   *  (there isn't one in this app's own UI, but the contract itself allows
   *  it for a self-sovereign caller paying their own gas). */
  inclusionFeeRaw: bigint;
  networkFeeRaw: bigint;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const edition: EditionInput = {
    title,
    description,
    thumbnail_url: thumbnailUrl,
    media_url: mediaUrl,
    media_type: mediaType,
    creator: creatorPubKey,
    royalty_bps: royaltyBps,
    supply,
    prices: prices.map(
      (p): PriceEntry => ({ payment_token: p.paymentToken, price: p.priceRaw }),
    ),
  };
  const tx = await client.buy_edition(
    {
      buyer: buyerPubKey,
      edition_ref: editionRef,
      edition,
      purchase_ref: purchaseRef,
      payment_token: paymentToken,
      quantity,
      inclusion_fee: inclusionFeeRaw,
      network_fee: networkFeeRaw,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * Lists in one or more currencies at once — a reseller isn't limited to
 * whichever currencies the creator originally priced the edition in.
 */
export async function buildListXDR({
  sellerPubKey,
  tokenId,
  prices,
}: {
  sellerPubKey: string;
  tokenId: number;
  prices: { paymentToken: string; priceRaw: bigint }[];
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.list(
    {
      seller: sellerPubKey,
      token_id: tokenId,
      prices: prices.map((p): PriceEntry => ({ payment_token: p.paymentToken, price: p.priceRaw })),
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * Lists several of the caller's tokens at once, all at the same price grid —
 * one signature instead of one `list` call per token. The common case: a
 * seller holding a consecutive run from one `buy_edition` purchase relists
 * several of them together via the manage page's "Hold N / list N" control.
 * Each token still gets its own independent on-chain `Listing`, resolved
 * individually afterwards the same way a single `list` call's result is.
 */
export async function buildListBatchXDR({
  sellerPubKey,
  tokenIds,
  prices,
}: {
  sellerPubKey: string;
  tokenIds: number[];
  prices: { paymentToken: string; priceRaw: bigint }[];
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.list_batch(
    {
      seller: sellerPubKey,
      token_ids: tokenIds,
      prices: prices.map((p): PriceEntry => ({ payment_token: p.paymentToken, price: p.priceRaw })),
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildCancelListingXDR({
  sellerPubKey,
  tokenId,
}: {
  sellerPubKey: string;
  tokenId: number;
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.cancel_listing(
    { seller: sellerPubKey, token_id: tokenId },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * One invocation that pays the seller, creator and treasury and moves the
 * token. The seller does not sign — their consent was recorded when they
 * listed — so this is the buyer's signature alone. For a specific already-
 * minted resold copy only; buying a fresh copy of an edition is
 * `buildBuyEditionXDR`.
 */
export async function buildBuyXDR({
  buyerPubKey,
  tokenId,
  paymentToken,
  inclusionFeeRaw,
  networkFeeRaw,
}: {
  buyerPubKey: string;
  tokenId: number;
  paymentToken: string;
  inclusionFeeRaw: bigint;
  networkFeeRaw: bigint;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy(
    {
      buyer: buyerPubKey,
      token_id: tokenId,
      payment_token: paymentToken,
      inclusion_fee: inclusionFeeRaw,
      network_fee: networkFeeRaw,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * Buys several listed tokens at once, all paid in the same currency — one
 * signature instead of one `buy` call per token. The common case: a buyer
 * taking N copies pooled across one or more resale listings for the same
 * edition. Listings can belong to different sellers; each settles exactly
 * as an individual `buy` would.
 */
export async function buildBuyBatchXDR({
  buyerPubKey,
  tokenIds,
  paymentToken,
  inclusionFeeRaw,
  networkFeeRaw,
}: {
  buyerPubKey: string;
  tokenIds: number[];
  paymentToken: string;
  inclusionFeeRaw: bigint;
  networkFeeRaw: bigint;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy_batch(
    {
      buyer: buyerPubKey,
      token_ids: tokenIds,
      payment_token: paymentToken,
      inclusion_fee: inclusionFeeRaw,
      network_fee: networkFeeRaw,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildTransferXDR({
  fromPubKey,
  toPubKey,
  tokenId,
}: {
  fromPubKey: string;
  toPubKey: string;
  tokenId: number;
}): Promise<string> {
  const client = getClient(fromPubKey);
  const tx = await client.transfer(
    { from: fromPubKey, to: toPubKey, token_id: tokenId },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildSetPlatformFeeXDR({
  adminPubKey,
  feeBps,
  treasury,
}: {
  adminPubKey: string;
  feeBps: number;
  treasury: string;
}): Promise<string> {
  const client = getClient(adminPubKey);
  const tx = await client.set_platform_fee(
    { fee_bps: feeBps, treasury },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * Records one locked-content item's completed unlock rule on-chain for one
 * specific token — called by the backend once it has independently
 * verified (off-chain) that this item's pin set was fully collected. No
 * buyer signature involved: the unlock authority keypair signs and submits
 * in one step, same trust boundary as `STORAGE_SECRET`'s pin-reward
 * payouts. Idempotent on the contract side, so a retried call for an
 * already-unlocked (token, item) pair is a safe no-op. `mediaIndex` is the
 * item's stable `NftLockedMedia.chainIndex`, not its database id.
 */
export async function unlockItemFor({
  unlockAuthoritySecret,
  tokenId,
  mediaIndex,
}: {
  unlockAuthoritySecret: string;
  tokenId: number;
  mediaIndex: number;
}): Promise<string> {
  const keypair = Keypair.fromSecret(unlockAuthoritySecret);
  const client = getClient(keypair.publicKey());
  const tx = await client.unlock_item_for(
    { caller: keypair.publicKey(), token_id: tokenId, media_index: mediaIndex },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  const sent = await tx.signAndSend({
    signTransaction: basicNodeSigner(keypair, networkPassphrase).signTransaction,
  });
  return sent.sendTransactionResponse?.hash ?? "";
}

/**
 * Records a creator's post-first-sale edit on-chain via `update_edition` —
 * signed and submitted in one step by the price authority, same shape as
 * `unlockItemFor`. No creator signature involved.
 *
 * Unlike every other write in this file, this one asserts the simulation
 * actually succeeded before submitting. Every other builder here is
 * deliberately unsigned XDR that a caller signs later (see this file's
 * module doc — a failed simulation there just produces a malformed
 * transaction that surfaces as an opaque `tx_malformed` at signing time,
 * which is fine when a human is about to look at a wallet prompt anyway).
 * This builder signs and submits itself with no human in the loop, so
 * `nft.update`'s caller needs the *real* on-chain rejection reason (e.g.
 * "supply can't go below what's already minted") surfaced as a thrown
 * error here, not several layers of opaque failure down.
 */
export async function updateEditionOnChain({
  priceAuthoritySecret,
  editionId,
  title,
  description,
  thumbnailUrl,
  supply,
  prices,
}: {
  priceAuthoritySecret: string;
  editionId: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  supply: number;
  /** New price grid, raw units per currency. */
  prices: { paymentToken: string; priceRaw: bigint }[];
}): Promise<string> {
  const keypair = Keypair.fromSecret(priceAuthoritySecret);
  const client = getClient(keypair.publicKey());
  const tx = await client.update_edition(
    {
      caller: keypair.publicKey(),
      edition_id: editionId,
      title,
      description,
      thumbnail_url: thumbnailUrl,
      supply,
      prices: prices.map(
        (p): PriceEntry => ({ payment_token: p.paymentToken, price: p.priceRaw }),
      ),
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );

  try {
    // Accessing this getter is what forces the SDK to inspect the
    // simulation result — it throws with the real panic reason
    // (`AssembledTransaction.Errors.SimulationFailed`) if the call would
    // fail on-chain, before this ever reaches `signAndSend`.
    void tx.simulationData;
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "update_edition simulation failed",
    );
  }

  const sent = await tx.signAndSend({
    signTransaction: basicNodeSigner(keypair, networkPassphrase).signTransaction,
  });
  return sent.sendTransactionResponse?.hash ?? "";
}

// =============================================================================
// Reads
//
// Every read is a simulation, so a contract that panics (missing token, no
// edition) surfaces as a thrown error. These normalize that to `null` — an
// absent edition/listing is an ordinary UI state, not a failure.
// =============================================================================

/**
 * Resolves a registered edition's id from the `Nft` row id passed at
 * purchase time. Returns `null` until the edition's first purchase has
 * landed, retrying against RPC replication lag (see `pollUntilVisible`)
 * before giving up.
 */
export async function getEditionByRef(editionRef: string): Promise<number | null> {
  return pollUntilVisible(async () => {
    try {
      const { result } = await getClient().edition_by_ref({ edition_ref: editionRef });
      return result ?? null;
    } catch {
      return null;
    }
  });
}

export async function getEditionMeta(editionId: number): Promise<EditionMeta | null> {
  try {
    const { result } = await getClient().edition_meta({ edition_id: editionId });
    return result ?? null;
  } catch {
    return null;
  }
}

export async function getEditionPrices(editionId: number): Promise<PriceEntry[]> {
  try {
    const { result } = await getClient().edition_prices({ edition_id: editionId });
    return result;
  } catch {
    return [];
  }
}

export async function getRemainingSupply(editionId: number): Promise<number> {
  try {
    const { result } = await getClient().remaining_supply({ edition_id: editionId });
    return result;
  } catch {
    return 0;
  }
}

/**
 * Resolves what a specific purchase attempt actually minted. Retried the
 * same way `getEditionByRef` is — see `pollUntilVisible`.
 */
export async function getPurchaseByRef(purchaseRef: string): Promise<PurchaseReceipt | null> {
  return pollUntilVisible(async () => {
    try {
      const { result } = await getClient().purchase_by_ref({ purchase_ref: purchaseRef });
      return result ?? null;
    } catch {
      return null;
    }
  });
}

export async function getOnChainOwner(tokenId: number): Promise<string | null> {
  try {
    const { result } = await getClient().owner_of({ token_id: tokenId });
    return result;
  } catch {
    return null;
  }
}

export async function getOnChainUnlockStatus(
  tokenId: number,
  mediaIndex: number,
): Promise<boolean | null> {
  try {
    const { result } = await getClient().is_item_unlocked({
      token_id: tokenId,
      media_index: mediaIndex,
    });
    return result;
  } catch {
    return null;
  }
}

export async function getOnChainArtMeta(tokenId: number): Promise<ArtMeta | null> {
  try {
    const { result } = await getClient().art_meta({ token_id: tokenId });
    return result ?? null;
  } catch {
    return null;
  }
}

export async function getOnChainListing(tokenId: number): Promise<Listing | null> {
  try {
    const { result } = await getClient().listing({ token_id: tokenId });
    return result ?? null;
  } catch {
    return null;
  }
}

/** What a resale buyer would actually pay in one specific currency, straight
 *  from the contract. */
export async function getSaleBreakdown(
  tokenId: number,
  paymentToken: string,
): Promise<SaleBreakdown | null> {
  try {
    const { result } = await getClient().sale_breakdown({ token_id: tokenId, payment_token: paymentToken });
    return result ?? null;
  } catch {
    return null;
  }
}

export async function getOnChainBalance(owner: string): Promise<number> {
  try {
    const { result } = await getClient().balance({ account: owner });
    return result;
  } catch {
    return 0;
  }
}

export async function getOnChainRoyalty(
  tokenId: number,
  salePriceRaw: bigint,
): Promise<{ receiver: string; amount: bigint } | null> {
  try {
    const { result } = await getClient().royalty_info({
      token_id: tokenId,
      sale_price: salePriceRaw,
    });
    const [receiver, amount] = result;
    return { receiver, amount };
  } catch {
    return null;
  }
}

export async function getOnChainPlatformFeeBps(): Promise<number | null> {
  try {
    const { result } = await getClient().platform_fee_bps();
    return result;
  } catch {
    return null;
  }
}

export async function getOnChainTreasury(): Promise<string | null> {
  try {
    const { result } = await getClient().treasury();
    return result ?? null;
  } catch {
    return null;
  }
}

export async function isPaused(): Promise<boolean> {
  try {
    const { result } = await getClient().paused();
    return result;
  } catch {
    return false;
  }
}
