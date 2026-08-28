import {
  Address,
  Asset,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
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
import { getPriceAuthoritySecret, getTreasuryKeypair } from "./treasury";
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

/**
 * The only on-chain currency this collection buys/sells/resells in — no
 * native XLM leg. Removed as a buyer-facing option as part of the
 * fee-bump payment redesign (see `contracts/nft_oz`'s `buy_edition`/`buy`/
 * `buy_batch`): the whole premise of fee-bump — the buyer never spends
 * XLM, not even for gas — doesn't compose with letting someone pay for
 * the item itself in XLM directly. `usdc` stays reserved for a future
 * currency (a new `NftPrice` row is all it would need, no schema/contract
 * change) but isn't wired to a real SAC yet. Deliberately not imported
 * from `~/components/payment/payment-process`'s `PaymentMethodEnum` (which
 * this mirrors) so this server-safe module never pulls a client component
 * file into a server bundle; keep the two lists in sync by hand.
 */
export const NFT_PAYMENT_TOKENS = ["asset"] as const;
export type NftPaymentToken = (typeof NFT_PAYMENT_TOKENS)[number];

/**
 * Every currency an item can be *priced* in for display — a strict superset
 * of `NFT_PAYMENT_TOKENS`. `"usd"` is deliberately not in
 * `NFT_PAYMENT_TOKENS`: it never becomes an on-chain `PriceEntry` (Soroban
 * has no fiat concept), it's a creator/reseller-set sticker price stored
 * only in `NftPrice`/`NftListingPrice` (see
 * `src/server/api/routers/nft.ts`) and charged via Square
 * (`fundBuyerForCardPurchase`). Both currencies are mandatory — a creator
 * or reseller sets a price in each, never just one; a buyer picks which to
 * pay with.
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

/** The native XLM Stellar Asset Contract — the default settlement currency. */
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
// that already-signed transaction in a fee-bump envelope instead of the
// buyer's own account paying the transaction's fee — one ledger close per
// purchase, and the buyer never spends XLM because treasury, not the buyer,
// is the fee-bump's fee source. `inclusion_fee`/`network_fee` (real params
// on `buy_edition`/`buy`/`buy_batch` — see `contracts/nft_oz/src/lib.rs`)
// are what let treasury recover the real cost of doing that; they replace
// this contract's old on-chain `inclusion_fee()` lookup (`getInclusionFee`,
// removed) with a flat app-side constant
// (`INCLUSION_FEE_IN_PLATFORM_ASSET`/`NETWORK_FEE_IN_PLATFORM_ASSET`).
//
// Two shapes, depending on who's holding the signing key:
//   - Custodial: server holds the buyer's secret, so build → sign → fee-bump
//     → submit all happen in one server-side call (`feeBumpAsCustodialBuyer`).
//   - External wallet: server builds the call *unsigned* and hands back the
//     XDR; the client signs it with that wallet's own sign-only function
//     (never the sign-and-submit wrapper it normally uses) and posts the
//     signed XDR back to `submitFeeBumpedPurchase`.
//
// USD/card checkout (see `fundBuyerForCardPurchase` in
// `../marketplace/trx/site-asset-recharge`) funds the custodial buyer's own
// account with the ACTION they're about to spend, then converges on the
// exact same `feeBumpAsCustodialBuyer` path a direct purchase uses.
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
 * `getTransaction` polling `signAndSend()` already relies on elsewhere,
 * without needing an actual `AssembledTransaction` (which only knows how to
 * build *unsigned* calls, not wrap an arbitrary already-signed one in a
 * fee-bump).
 */
async function feeBumpAndSubmit(signedInnerTxXdr: string): Promise<string> {
  const treasury = getTreasuryKeypair();
  const server = new rpc.Server(SOROBAN_RPC_URL);

  const innerTx = TransactionBuilder.fromXDR(signedInnerTxXdr, networkPassphrase);
  if (!(innerTx instanceof Transaction)) {
    throw new Error("Expected a signed Soroban transaction envelope, not a fee-bump envelope");
  }

  // Per-operation base fee for the wrapper. `innerTx.fee` is the inner
  // transaction's FULL fee — inclusion fee *plus* the Soroban resource fee
  // already baked in by simulation/`prepareTransaction`. The SDK's
  // `buildFeeBumpTransaction` separately re-extracts that same resource fee
  // from the inner tx's Soroban extension and adds it again on top of
  // `baseFee * (innerOps + 1)` (see the installed
  // @stellar/stellar-base@14.1.0 source) — so passing `innerTx.fee` here
  // double-counts the resource fee and inflates the inclusion portion
  // several times over. Pass just the inclusion-fee-sized constant we
  // originally built the inner tx's own `fee` field from instead; the SDK
  // still validates baseFee >= the inner tx's actual per-op inclusion fee
  // and throws if it's too low, so this stays safe while producing a
  // correctly-sized (not bloated) fee-bump total.
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    treasury,
    SOROBAN_INCLUSION_FEE,
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
 * separate confirmation poll after it returns is pure redundant latency,
 * not an extra safety check. This helper is the real safety check: it
 * reads the status already obtained, so a failed submission throws
 * immediately instead of silently returning a hash for a transaction that
 * never actually succeeded.
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
 *
 * `expect` is required even though every current caller builds `xdr` itself a
 * few lines earlier, so nothing attacker-controlled reaches here today. That
 * safety is a convention, not a rule the types enforce — and the failure mode
 * if a later call site passes a client-supplied envelope is treasury paying
 * that envelope's fee, the same drain `assertIsExpectedPurchaseCall` exists to
 * stop on the wallet path. Making the expectation an argument turns the
 * convention into something a new caller has to answer for.
 */
export async function feeBumpAsCustodialBuyer({
  xdr,
  signWith,
  expect,
}: {
  xdr: string;
  signWith: SignUserType;
  expect: ExpectedPurchaseCall;
}): Promise<string> {
  // Checked before signing, not after: there is no reason to spend the
  // buyer's custodial signature on an envelope this would then refuse.
  assertIsExpectedPurchaseCall(xdr, expect);
  const { xdr: signedXdr, fullySignedByServer } = await signArtXdr({ xdr, signWith });
  if (!fullySignedByServer) {
    throw new Error("feeBumpAsCustodialBuyer requires a custodial signer (signWith must be set)");
  }
  return feeBumpAndSubmit(signedXdr);
}

/** What a client-supplied envelope has to prove it is before treasury will
 *  pay its fee. See `assertIsExpectedPurchaseCall`. */
export type ExpectedPurchaseCall = {
  /** The signed-in user. The call's own `buyer` argument must be this account
   *  — nobody gets treasury's fee-bump for someone else's purchase. */
  buyerPubKey: string;
  /** Which contract functions are legitimate here, e.g. `["buy_edition"]`. */
  fnNames: string[];
  /** For a primary purchase, the `NftPurchase` row id this confirm call
   *  claims to be completing — must match the `purchase_ref` baked into the
   *  signed call, so one purchase's signature can't confirm another. */
  purchaseRef?: string;
};

/**
 * Verifies a client-supplied envelope really is the purchase it claims to be,
 * before treasury signs a fee-bump for it.
 *
 * Without this the confirm endpoints hand `feeBumpAndSubmit` whatever XDR the
 * client posts, and treasury pays the network fee for it — any transaction at
 * all, not just a purchase, and not necessarily the caller's own. Since a
 * fee-bump covers the inner transaction's declared resource fee, a crafted
 * envelope can make each one arbitrarily expensive, so an authenticated user
 * could drain treasury's XLM a transaction at a time.
 *
 * Structural rather than a byte-comparison against the XDR the server built:
 * that would need the unsigned envelope persisted per purchase (a schema
 * change), and would break on any legitimate re-simulation. Checking the call
 * itself is enough — the envelope must invoke *this* collection contract, one
 * of the functions this endpoint is for, on behalf of the account that is
 * actually signed in.
 */
function assertIsExpectedPurchaseCall(
  signedInnerTxXdr: string,
  expect: ExpectedPurchaseCall,
): void {
  const tx = TransactionBuilder.fromXDR(signedInnerTxXdr, networkPassphrase);
  if (!(tx instanceof Transaction)) {
    throw new Error("Expected a transaction envelope, not a fee-bump envelope");
  }

  // Soroban permits exactly one operation per invocation, so anything else is
  // already not a contract call this app produced.
  if (tx.operations.length !== 1) {
    throw new Error(`Expected exactly one operation, got ${tx.operations.length}`);
  }
  const op = tx.operations[0]!;
  if (op.type !== "invokeHostFunction") {
    throw new Error(`Expected a contract invocation, got "${op.type}"`);
  }

  const hostFn = op.func;
  if (hostFn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
    throw new Error("Expected a contract invocation host function");
  }
  const invocation = hostFn.invokeContract();

  const contractId = Address.fromScAddress(invocation.contractAddress()).toString();
  const expectedContract = requireContractConstant(ART_NFT_CONTRACT_ID, "ART_NFT_CONTRACT_ID");
  if (contractId !== expectedContract) {
    throw new Error(`Refusing to fee-bump a call to ${contractId}`);
  }

  const fnName = invocation.functionName().toString();
  if (!expect.fnNames.includes(fnName)) {
    throw new Error(`Refusing to fee-bump "${fnName}" here`);
  }

  // Every buy entry point takes the buyer as its first argument.
  const args = invocation.args();
  const buyer = args[0] ? (scValToNative(args[0]) as unknown) : undefined;
  if (typeof buyer !== "string" || buyer !== expect.buyerPubKey) {
    throw new Error("Refusing to fee-bump a purchase for a different account");
  }

  // `purchase_ref` is `buy_edition`'s third argument (buyer, edition_ref,
  // purchase_ref, ...) — pins this signature to the purchase being confirmed.
  if (expect.purchaseRef !== undefined) {
    const ref = args[2] ? (scValToNative(args[2]) as unknown) : undefined;
    if (ref !== expect.purchaseRef) {
      throw new Error("Signed purchase does not match the purchase being confirmed");
    }
  }
}

/**
 * The external-wallet second call: the client already signed the XDR
 * `buildBuyEditionXDR`/`buildBuyXDR`/`buildBuyBatchXDR` returned, using that
 * wallet's own sign-only function — this just wraps it in treasury's
 * fee-bump and submits.
 *
 * `expect` is mandatory: treasury pays the fee for whatever this submits, so
 * the envelope has to be checked against the caller's session before it is
 * signed. See `assertIsExpectedPurchaseCall`.
 */
export async function submitFeeBumpedPurchase(
  signedInnerTxXdr: string,
  expect: ExpectedPurchaseCall,
): Promise<string> {
  assertIsExpectedPurchaseCall(signedInnerTxXdr, expect);
  return feeBumpAndSubmit(signedInnerTxXdr);
}

// -----------------------------------------------------------------------------
// Account activation / trustline — the preconditions a fee-bumped purchase
// needs that a plain balance check doesn't cover.
// -----------------------------------------------------------------------------

/**
 * Whether `pubKey` is a real account on the ledger at all. A *direct*
 * purchase (an external wallet, or a custodial buyer paying in Platform
 * Asset) must never silently pay to create one on the buyer's behalf —
 * the caller is expected to check this first and send an unactivated
 * buyer to the existing account-activation flow instead (see
 * `ensureBuyerReady`).
 *
 * The one deliberate exception is a custodial buyer's card/USD purchase
 * (`buyEditionWithCard`/`buyBatchWithCard`): the server already holds
 * their secret, so it activates the account itself
 * (`ensureBuyerActivatedAndTrustedForCardPurchase`) and recoups the real
 * XLM cost via the Square charge instead of turning the buyer away.
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

// =============================================================================
// Writes
// =============================================================================

/**
 * Surfaces a failed Soroban simulation with its real contract error instead
 * of letting it through silently. Without this, `AssembledTransaction` falls
 * back to the *unprepared* transaction (no Soroban resource data attached)
 * whenever simulation didn't succeed, and a caller that just calls `.toXDR()`
 * hands that broken transaction on to be signed and submitted anyway —
 * Stellar Core then rejects it with a generic, useless `txMalformed` instead
 * of the actual reason (e.g. one of this contract's own `panic_with_error!`
 * guards, like `buy_edition`'s "fee reimbursement exceeds the item's price"
 * check). `simulationData` is the SDK's own accessor for this: touching it
 * throws `SimulationFailed` with the real contract error text when
 * simulation didn't succeed, so that's all this needs to do.
 */
function assertSimulated(tx: { simulationData: unknown }): void {
  void tx.simulationData;
}

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
/**
 * Registers an edition on-chain ahead of its first sale, returning its
 * on-chain edition id. Signed and submitted by the price authority alone —
 * same shape as `updateEditionOnChain`/`unlockItemFor`, no buyer or creator
 * signature involved.
 *
 * This must happen before the edition's first `buy_edition`, which no longer
 * creates editions itself. That split is a security fix, not a refactor:
 * creation used to happen inside `buy_edition` from caller-supplied data, so
 * whoever called first for a given `edition_ref` — a value published in every
 * listing URL — permanently defined that edition's creator, price, royalty
 * and supply. See `register_edition`'s doc comment in
 * `contracts/nft_oz/src/lib.rs`.
 *
 * Idempotent on the contract side, so a retried call for an already-
 * registered ref safely returns the existing id rather than failing.
 */
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

/**
 * Stellar's own minimum reserve for an account holding exactly one
 * trustline: (2 base reserves + 1 trustline entry) * 0.5 XLM = 1.5 XLM.
 * This is the real, exact cost of activating a brand-new account that's
 * only ever going to hold the platform asset — not a padded estimate.
 */
export const ACCOUNT_ACTIVATION_RESERVE_XLM = "2.5"; // matches ACCOUNT_ACTIVATION_COST_XLM in constant.ts

/**
 * Activates a custodial card buyer's Stellar account and establishes its
 * Platform Asset trustline in one step, entirely server-side — the
 * card-checkout counterpart to the wallet-driven "Trust & Buy" flow
 * (`buildEstablishTrustlineXDR`), which needs a connected wallet's own
 * signature and so can't run silently. A custodial buyer's secret is
 * already available here (the caller already has it via
 * `getAccSecretFromRubyApi`), so this can fund a brand-new account
 * (`Operation.createAccount` — unlike `ensureBuyerTrustline`'s plain
 * payment, which requires the destination to already exist) and
 * establish the trustline in the same transaction, signed by treasury
 * (paying the real XLM) and the buyer (authorizing the trustline).
 *
 * Treasury fronts `ACCOUNT_ACTIVATION_RESERVE_XLM` for real — the caller
 * (`buyEditionWithCard`/`buyBatchWithCard`) recoups it by adding its live
 * USD-equivalent to the Square charge (see `getAccountActivationCostInUsd`
 * in `~/lib/stellar/constant`) rather than treasury eating the cost.
 *
 * A no-op if the account is already active and already trusts the
 * platform asset. Unlike `isStellarAccountActivated`'s doc comment above
 * (which still holds for every *direct* purchase — wallet-connected or a
 * custodial buyer paying in Platform Asset), this is the one deliberate
 * exception: a custodial buyer's card/USD purchase can activate silently
 * because the server already holds their secret and recoups the real
 * cost through the Square charge instead of turning them away.
 */
export async function ensureBuyerActivatedAndTrustedForCardPurchase({
  buyerPubKey,
  buyerSecret,
}: {
  buyerPubKey: string;
  buyerSecret: string;
}): Promise<{ activated: boolean; trustlineEstablished: boolean }> {
  const alreadyActive = await isStellarAccountActivated(buyerPubKey);
  const alreadyTrusted = alreadyActive && (await hasPlatformAssetTrustline(buyerPubKey));
  if (alreadyActive && alreadyTrusted) {
    return { activated: false, trustlineEstablished: false };
  }

  const treasury = getTreasuryKeypair();
  const server = new Horizon.Server(STELLAR_URL);
  const treasuryAccount = await server.loadAccount(treasury.publicKey());
  const buyerKeypair = Keypair.fromSecret(buyerSecret);

  const builder = new TransactionBuilder(treasuryAccount, { fee: TrxBaseFee, networkPassphrase });
  if (!alreadyActive) {
    builder.addOperation(
      Operation.createAccount({ destination: buyerPubKey, startingBalance: ACCOUNT_ACTIVATION_RESERVE_XLM }),
    );
  }
  if (!alreadyTrusted) {
    builder.addOperation(Operation.changeTrust({ asset: PLATFORM_ASSET, source: buyerPubKey }));
  }
  const tx = builder.setTimeout(30).build();

  tx.sign(treasury);
  if (!alreadyTrusted) tx.sign(buyerKeypair);

  const result = await server.submitTransaction(tx);
  if (!result.successful) {
    throw new Error(
      `ensureBuyerActivatedAndTrustedForCardPurchase: activation transaction ${result.hash} did not succeed`,
    );
  }
  return { activated: !alreadyActive, trustlineEstablished: !alreadyTrusted };
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

export async function registerEditionOnChain({
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
}: {
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
}): Promise<number> {
  const keypair = Keypair.fromSecret(getPriceAuthoritySecret());
  const client = getClient(keypair.publicKey());
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
  const tx = await client.register_edition(
    { caller: keypair.publicKey(), edition_ref: editionRef, edition },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  assertSimulated(tx);

  const sent = await tx.signAndSend({
    signTransaction: basicNodeSigner(keypair, networkPassphrase).signTransaction,
  });
  requireSentTransactionSucceeded(sent);

  // The submitted call's return value can't be decoded off a confirmed
  // transaction with this repo's pinned SDK (see `pollTransactionSuccess`),
  // so read the id back the same way every other post-submit lookup does.
  const editionId = await pollUntilVisible(() => getEditionByRef(editionRef));
  if (editionId === null) {
    throw new Error(`register_edition succeeded but edition_by_ref(${editionRef}) is still empty`);
  }
  return editionId;
}

/**
 * Signs treasury's authorization entry on an assembled purchase.
 *
 * `buy_edition`/`buy`/`buy_batch` require treasury's authorization as well as
 * the buyer's, so that the `inclusion_fee`/`network_fee` arguments can only
 * ever be the ones treasury agreed to — a buyer assembling their own envelope
 * cannot zero them, because a Soroban authorization commits to the exact call
 * *and its arguments* (see `require_treasury_auth` in the contract).
 *
 * This is a different signature from the fee-bump treasury already applies.
 * That one says "treasury pays this transaction's network fee" and lives on
 * the outer envelope; this one says "treasury approves this call" and lives
 * inside it. Signing the outside proves nothing about the inside, which is
 * exactly why the fee argument was forgeable before.
 *
 * Done at build time so the XDR handed to a wallet already carries it — the
 * buyer then only ever signs their own half, and the client round-trip is
 * unchanged.
 */
async function signPurchaseAsTreasury<T>(tx: AssembledTransaction<T>): Promise<void> {
  const treasury = getTreasuryKeypair();
  const pending = tx.needsNonInvokerSigningBy();
  if (!pending.includes(treasury.publicKey())) {
    // Simulation didn't ask for treasury — either the deployed contract
    // predates `require_treasury_auth`, or something is wrong with how this
    // call was assembled. Either way, signing nothing here would produce an
    // envelope that fails at submission for no obvious reason.
    throw new Error(
      `Assembled purchase does not require treasury authorization (needs: ${pending.join(", ") || "none"}) — is the deployed contract older than v10?`,
    );
  }
  // No `expiration` override. The SDK defaults an auth entry to ~8.3 minutes,
  // and the transaction's own timebound is `DEFAULT_TIMEOUT` (5 minutes) — so
  // the envelope always expires before the authorization does, and raising the
  // authorization's lifetime buys nothing. If an external-wallet buyer ever
  // needs longer to approve, the lever is the *transaction* timeout, not this.
  await tx.signAuthEntries({
    address: treasury.publicKey(),
    signAuthEntry: basicNodeSigner(treasury, networkPassphrase).signAuthEntry,
  });
}

export async function buildBuyEditionXDR({
  buyerPubKey,
  editionRef,
  purchaseRef,
  paymentToken,
  quantity,
  inclusionFeeRaw,
  networkFeeRaw,
}: {
  buyerPubKey: string;
  /** The `Nft` row id — must already be registered via
   *  `registerEditionOnChain`; `buy_edition` only resolves it. */
  editionRef: string;
  /** The `NftPurchase` row id — lets `purchase_by_ref` resolve this specific
   *  attempt's minted range afterwards, robust to concurrent purchases of
   *  the same edition (see the contract's doc comment for why). */
  purchaseRef: string;
  paymentToken: string;
  quantity: number;
  /** Raw units, reimbursing treasury for fee-bumping this purchase — see
   *  the fee-bump section above. */
  inclusionFeeRaw: bigint;
  networkFeeRaw: bigint;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy_edition(
    {
      buyer: buyerPubKey,
      edition_ref: editionRef,
      purchase_ref: purchaseRef,
      payment_token: paymentToken,
      quantity,
      inclusion_fee: inclusionFeeRaw,
      network_fee: networkFeeRaw,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  assertSimulated(tx);
  await signPurchaseAsTreasury(tx);
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
  assertSimulated(tx);
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
  assertSimulated(tx);
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
  assertSimulated(tx);
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
  assertSimulated(tx);
  await signPurchaseAsTreasury(tx);
  return tx.toXDR();
}

/**
 * Buys several listed tokens at once, all paid in the same currency — one
 * signature instead of one `buy` call per token. The common case: a buyer
 * taking N copies pooled across one or more resale listings for the same
 * edition. Listings can belong to different sellers; each settles exactly
 * as an individual `buy` would. `inclusionFeeRaw`/`networkFeeRaw` are
 * charged once for the whole batch, not once per token — there's only one
 * real transaction underneath regardless of how many tokens it settles
 * (see `buy_batch`'s doc comment in `contracts/nft_oz/src/lib.rs`).
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
  assertSimulated(tx);
  await signPurchaseAsTreasury(tx);
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
  assertSimulated(tx);
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
  assertSimulated(tx);
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
  assertSimulated(tx);
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
 * Unlike a builder that hands back unsigned XDR for later signing, this
 * one signs and submits itself with no human in the loop, so it uses
 * `requireSentTransactionSucceeded` (already defined above in this file)
 * rather than returning a hash unconditionally — a transaction that gets
 * included but fails on-chain must surface as a thrown error here, not be
 * silently reported as success.
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
    void tx.simulationData;
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "update_edition simulation failed",
    );
  }

  const sent = await tx.signAndSend({
    signTransaction: basicNodeSigner(keypair, networkPassphrase).signTransaction,
  });
  return requireSentTransactionSucceeded(sent);
}

/**
 * Refreshes this contract's own TTL, plus the given editions'/tokens'
 * on-chain data — signed and submitted by treasury alone, same
 * fire-and-forget shape as `unlockItemFor`/`updateEditionOnChain`. Meant to
 * be called on a fixed schedule (see the keep-alive cron in
 * `package/express-wadzzo`) so a long-dormant edition or token never
 * actually reaches Soroban's TTL/state-archival expiry — a copy that never
 * trades again would otherwise see no further transaction to trigger that
 * renewal on its own. Each list must stay at or under the contract's
 * `MAX_KEEP_ALIVE_IDS` (200) — the caller is responsible for chunking longer
 * lists across several calls, and note the caps apply *per list*, so one
 * edition with many unlocked items can exceed `unlocked` on its own.
 *
 * Every key family has to be named explicitly; none can be derived on-chain
 * from another, and reads don't renew anything (the contract's getters are
 * plain reads, and this app reads them through simulation, which never
 * persists a TTL extension). Anything left out of these lists expires:
 * `editionRefs` losing its entry is the worst case — `buy_edition` then
 * can't resolve the ref and `register_edition` would register a duplicate
 * edition rather than find the original. `unlocked` losing one silently
 * re-locks reward content a holder already earned.
 *
 * `force: true` on `signAndSend`, unlike its siblings: unlike
 * `update_edition`/`unlock_item_for` (which always write something),
 * `keep_alive`'s `extend_ttl` calls are no-ops whenever an entry isn't yet
 * near its threshold — a legitimate, expected outcome (most calls on a
 * healthy schedule land before anything actually needs renewing) that
 * simulation reports as a footprint-free "read," which the SDK otherwise
 * refuses to sign and submit.
 */
/** Stellar closes a ledger about every 5 seconds. Mirrors `DAY_IN_LEDGERS`
 *  in `contracts/nft_oz/src/lib.rs`. */
const DAY_IN_LEDGERS = 17_280;

/** How close to expiry the collection's soonest-expiring entry is. */
export type TtlHealth = {
  /** Days of life left on the worst entry checked. */
  daysRemaining: number;
  /** Which entry that was, e.g. `TokenEdition(84)`. */
  worst: string;
  /** How many entries were sampled. */
  checked: number;
  /** Entries the ledger no longer has — already expired, or never written. */
  missing: string[];
};

/**
 * Reads how much life the collection's storage has left.
 *
 * `keep_alive` failing is silent: nothing errors, entries just quietly age out
 * months later. This is the check that isn't silent — it reads
 * `liveUntilLedgerSeq` straight off the ledger, so it measures the thing that
 * actually matters rather than whether a job reported success.
 */
export async function getTtlHealth({
  editionIds,
  editionRefs,
  tokenIds,
}: {
  editionIds: number[];
  editionRefs: string[];
  tokenIds: number[];
}): Promise<TtlHealth> {
  const contractId = requireContractConstant(ART_NFT_CONTRACT_ID, "ART_NFT_CONTRACT_ID");
  const server = new rpc.Server(SOROBAN_RPC_URL);

  const entry = (label: string, key: xdr.ScVal) => ({
    label,
    key: xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(contractId).toScAddress(),
        key,
        durability: xdr.ContractDataDurability.persistent(),
      }),
    ),
  });
  const variant = (name: string, arg: xdr.ScVal) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name), arg]);

  const targets = [
    ...editionIds.map((id) => entry(`Edition(${id})`, variant("Edition", xdr.ScVal.scvU32(id)))),
    ...editionRefs.map((r) => entry(`EditionByRef(${r})`, variant("EditionByRef", xdr.ScVal.scvString(r)))),
    ...tokenIds.map((id) => entry(`TokenEdition(${id})`, variant("TokenEdition", xdr.ScVal.scvU32(id)))),
  ];
  if (targets.length === 0) {
    return { daysRemaining: Number.POSITIVE_INFINITY, worst: "nothing to check", checked: 0, missing: [] };
  }

  const latest = (await server.getLatestLedger()).sequence;
  let worstLedger = Number.POSITIVE_INFINITY;
  let worst = "";
  const missing: string[] = [];

  // The RPC caps how many keys one request may carry, so walk in batches.
  const BATCH = 50;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    const { entries } = await server.getLedgerEntries(...slice.map((t) => t.key));
    const byXdr = new Map(entries.map((e) => [e.key.toXDR("base64"), e.liveUntilLedgerSeq]));
    for (const t of slice) {
      const liveUntil = byXdr.get(t.key.toXDR("base64"));
      if (liveUntil === undefined) {
        missing.push(t.label);
        continue;
      }
      if (liveUntil < worstLedger) {
        worstLedger = liveUntil;
        worst = t.label;
      }
    }
  }

  return {
    daysRemaining: worstLedger === Number.POSITIVE_INFINITY ? 0 : (worstLedger - latest) / DAY_IN_LEDGERS,
    worst: worst || "every entry checked is missing",
    checked: targets.length,
    missing,
  };
}

/**
 * The single-kind counterparts to {@link keepAliveOnChain}, for an operator
 * running a sweep by hand from the admin panel.
 *
 * Each renews one kind plus the contract instance, and each enforces its own
 * cap on-chain — a token can touch four ledger entries where a ref touches
 * one, so one blanket number would be wrong for both. Mixing kinds is what
 * overflows a transaction's footprint; here it isn't expressible.
 */
export const KEEP_ALIVE_LIMITS = {
  /** `MAX_TOKENS_PER_CALL` in the contract. */
  tokens: 25,
  /** `MAX_EDITIONS_PER_CALL`. */
  editions: 40,
  /** `MAX_REFS_PER_CALL`. */
  refs: 80,
  /** `MAX_UNLOCKED_PER_CALL`. */
  unlocked: 80,
} as const;

async function sendAsTreasury(
  build: (client: ArtNftClient) => Promise<AssembledTransaction<null>>,
): Promise<string> {
  const keypair = getTreasuryKeypair();
  const tx = await build(getClient(keypair.publicKey()));
  assertSimulated(tx);
  const sent = await tx.signAndSend({
    // `force`, same as `keepAliveOnChain`: these only write TTL metadata, no
    // contract data, so simulation classifies them read-only and the SDK
    // would refuse to submit.
    force: true,
    signTransaction: basicNodeSigner(keypair, networkPassphrase).signTransaction,
  });
  return requireSentTransactionSucceeded(sent);
}

/** Renews only the contract instance — the entry whose loss breaks everything. */
export async function keepContractAliveOnChain(): Promise<string> {
  return sendAsTreasury((c) => c.keep_contract_alive({ fee: SOROBAN_INCLUSION_FEE }));
}

export async function keepEditionsAliveOnChain(editionIds: number[]): Promise<string> {
  return sendAsTreasury((c) =>
    c.keep_editions_alive({ edition_ids: editionIds }, { fee: SOROBAN_INCLUSION_FEE }),
  );
}

/** `Nft` row ids — the refs editions were registered under. */
export async function keepEditionRefsAliveOnChain(editionRefs: string[]): Promise<string> {
  return sendAsTreasury((c) =>
    c.keep_edition_refs_alive({ edition_refs: editionRefs }, { fee: SOROBAN_INCLUSION_FEE }),
  );
}

export async function keepTokensAliveOnChain(tokenIds: number[]): Promise<string> {
  return sendAsTreasury((c) =>
    c.keep_tokens_alive({ token_ids: tokenIds }, { fee: SOROBAN_INCLUSION_FEE }),
  );
}

/** `[tokenId, mediaIndex]` pairs — `NftLockedMedia.chainIndex`, not its row id. */
export async function keepUnlockedAliveOnChain(unlocked: [number, number][]): Promise<string> {
  return sendAsTreasury((c) =>
    c.keep_unlocked_alive({ unlocked }, { fee: SOROBAN_INCLUSION_FEE }),
  );
}

export async function keepAliveOnChain({
  editionIds,
  editionRefs,
  tokenIds,
  unlocked,
}: {
  editionIds: number[];
  /** `Nft` row ids — the `edition_ref` each edition was registered under. */
  editionRefs: string[];
  tokenIds: number[];
  /** `[tokenId, mediaIndex]` pairs — `NftLockedMedia.chainIndex`, not its
   *  database id (see `unlockItemFor`). */
  unlocked: [number, number][];
}): Promise<string> {
  const keypair = getTreasuryKeypair();
  const client = getClient(keypair.publicKey());
  const tx = await client.keep_alive(
    {
      edition_ids: editionIds,
      edition_refs: editionRefs,
      token_ids: tokenIds,
      unlocked,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  assertSimulated(tx);
  const sent = await tx.signAndSend({
    force: true,
    signTransaction: basicNodeSigner(keypair, networkPassphrase).signTransaction,
  });
  return requireSentTransactionSucceeded(sent);
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
