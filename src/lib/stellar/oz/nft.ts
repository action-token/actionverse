import { Asset, Horizon, rpc } from "@stellar/stellar-sdk";
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
import {
  networkPassphrase,
  PLATFORM_ASSET,
  requireContractConstant,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
  STELLAR_URL,
} from "../constant";
import { WithSing, type SignUserType } from "../utils";

/**
 * `xlm` and `asset` (the platform token) are live today; `usdc` is a valid
 * value already so a new `NftPrice` row/price-grid column is all a future
 * currency needs — no schema or contract change. Deliberately not imported
 * from `~/components/payment/payment-process`'s `PaymentMethodEnum` (which
 * this mirrors) so this server-safe module never pulls a client component
 * file into a server bundle; keep the two lists in sync by hand.
 */
export const NFT_PAYMENT_TOKENS = ["xlm", "asset", "usdc"] as const;
export type NftPaymentToken = (typeof NFT_PAYMENT_TOKENS)[number];

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
 * `list`/`buy` actually deal in. The one place a new currency needs a real
 * address wired up once its SAC exists.
 */
export function paymentTokenAddress(method: NftPaymentToken): string {
  switch (method) {
    case "xlm":
      return nativeTokenAddress();
    case "asset":
      return platformAssetContractId();
    case "usdc":
      throw new Error("USDC is not wired up yet — no SAC address configured");
  }
}

/** The inverse of `paymentTokenAddress`, for displaying an on-chain price
 *  entry's raw SAC address back as "xlm"/"asset". Falls back to the raw
 *  address for a currency this app doesn't have a label for yet. */
export function labelForPaymentTokenAddress(address: string): string {
  if (address === nativeTokenAddress()) return "xlm";
  if (address === platformAssetContractId()) return "asset";
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
// Writes
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
}: {
  buyerPubKey: string;
  tokenId: number;
  paymentToken: string;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy(
    { buyer: buyerPubKey, token_id: tokenId, payment_token: paymentToken },
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
}: {
  buyerPubKey: string;
  tokenIds: number[];
  paymentToken: string;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy_batch(
    { buyer: buyerPubKey, token_ids: tokenIds, payment_token: paymentToken },
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
