import { createHash } from "crypto";
import {
  Client as ArtEditionClient,
  type ArtMeta,
  type Listing,
  type SaleBreakdown,
} from "contracts/ft_oz/bindings/src/index";
import { ART_EDITION_WASM_HASH } from "~/lib/common";
import {
  networkPassphrase,
  requireContractConstant,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
} from "../constant";
import { nativeTokenAddress, pollUntilVisible } from "./nft";

/**
 * Editions are one contract per artwork, so unlike the NFT collection there is
 * no single contract id — the caller always supplies the deployed address.
 */
function getClient(contractId: string, publicKey?: string): ArtEditionClient {
  return new ArtEditionClient({
    contractId,
    networkPassphrase,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
  });
}

/**
 * A contract's address is derived from (deployer, salt), so deriving the salt
 * from the `Nft` row id makes the address deterministic and the deploy
 * idempotent: a retried deploy targets the same address and fails as
 * already-created rather than silently minting a second edition of the piece.
 */
function saltForArt(artRef: string): Buffer {
  return createHash("sha256").update(`actionverse:edition:${artRef}`).digest();
}

// =============================================================================
// Deploy
// =============================================================================

/**
 * Builds the transaction that deploys one artwork's edition contract and
 * mints the whole print run to its creator. Pass `priceRaw: 0n` to mint
 * without listing — `list()` remains available afterward for that case, or
 * for anyone re-listing later. A positive `priceRaw` lists the entire print
 * run for sale in the same transaction as the deploy.
 *
 * The atomic path exists (mirroring `nft_oz`'s `mint_and_list`) because
 * deploy-then-separate-`list` needs that second transaction to read the
 * freshly-deployed contract back through the public Soroban RPC pool, which
 * doesn't always agree with itself in the first few seconds after a ledger
 * closes — a call built from that stale a read fails, often unhelpfully. One
 * call has no gap for that read to land stale.
 *
 * Returns the contract address alongside the XDR: it is computed from the
 * deployer and salt during assembly, so the backend can record it *before* the
 * transaction is signed and submitted. That matters because this repo's pinned
 * `stellar-sdk` cannot decode protocol-27 transaction meta, so the address
 * could not be recovered from the result afterwards.
 */
export async function buildDeployEditionXDR({
  creatorPubKey,
  treasury,
  platformFeeBps,
  artRef,
  editionSize,
  name,
  symbol,
  title,
  description,
  thumbnailUrl,
  mediaUrl,
  mediaType,
  royaltyBps,
  priceRaw,
  paymentToken,
}: {
  creatorPubKey: string;
  treasury: string;
  platformFeeBps: number;
  artRef: string;
  editionSize: number;
  name: string;
  symbol: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: string;
  royaltyBps: number;
  /** Price for a single copy, in the payment token's raw units. */
  priceRaw: bigint;
  paymentToken?: string;
}): Promise<{ xdr: string; contractAddress: string }> {
  const tx = await ArtEditionClient.deploy(
    {
      creator: creatorPubKey,
      treasury,
      platform_fee_bps: platformFeeBps,
      edition_size: BigInt(editionSize),
      // Whole copies only — one unit is one print, never a fraction of one.
      decimals: 0,
      name,
      symbol,
      // Grouped because a Soroban function's spec allows at most 10 inputs
      // (`SCSpecFunctionV0.inputs<10>`); the flat form was 13 and the JS SDK
      // refused to parse the contract spec at all.
      art: {
        title,
        description,
        thumbnail_url: thumbnailUrl,
        media_url: mediaUrl,
        media_type: mediaType,
        royalty_bps: royaltyBps,
      },
      price: priceRaw,
      payment_token: paymentToken ?? nativeTokenAddress(),
    },
    {
      wasmHash: requireContractConstant(ART_EDITION_WASM_HASH, "ART_EDITION_WASM_HASH"),
      format: "hex",
      salt: saltForArt(artRef),
      networkPassphrase,
      rpcUrl: SOROBAN_RPC_URL,
      publicKey: creatorPubKey,
      fee: SOROBAN_INCLUSION_FEE,
    },
  );

  return { xdr: tx.toXDR(), contractAddress: tx.result.options.contractId };
}

// =============================================================================
// Writes
// =============================================================================

export async function buildListEditionXDR({
  contractId,
  sellerPubKey,
  pricePerCopyRaw,
  quantity,
  paymentToken,
}: {
  contractId: string;
  sellerPubKey: string;
  pricePerCopyRaw: bigint;
  quantity: number;
  paymentToken?: string;
}): Promise<string> {
  const client = getClient(contractId, sellerPubKey);
  const tx = await client.list(
    {
      seller: sellerPubKey,
      price: pricePerCopyRaw,
      quantity: BigInt(quantity),
      payment_token: paymentToken ?? nativeTokenAddress(),
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildCancelEditionListingXDR({
  contractId,
  sellerPubKey,
}: {
  contractId: string;
  sellerPubKey: string;
}): Promise<string> {
  const client = getClient(contractId, sellerPubKey);
  const tx = await client.cancel_listing(
    { seller: sellerPubKey },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/** Buys `quantity` copies from one seller — payment and delivery in one call. */
export async function buildBuyEditionXDR({
  contractId,
  buyerPubKey,
  sellerPubKey,
  quantity,
}: {
  contractId: string;
  buyerPubKey: string;
  sellerPubKey: string;
  quantity: number;
}): Promise<string> {
  const client = getClient(contractId, buyerPubKey);
  const tx = await client.buy(
    { buyer: buyerPubKey, seller: sellerPubKey, quantity: BigInt(quantity) },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildTransferEditionXDR({
  contractId,
  fromPubKey,
  toPubKey,
  quantity,
}: {
  contractId: string;
  fromPubKey: string;
  toPubKey: string;
  quantity: number;
}): Promise<string> {
  const client = getClient(contractId, fromPubKey);
  const tx = await client.transfer(
    { from: fromPubKey, to: toPubKey, amount: BigInt(quantity) },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

// =============================================================================
// Reads
// =============================================================================

/**
 * Whether the edition contract exists and is initialized. Used to confirm a
 * deploy landed, since the transaction result itself can't be decoded.
 * Retries against RPC replication lag (see `pollUntilVisible`) — the same gap
 * that made `getTokenIdByRef` need it.
 */
export async function editionExists(contractId: string): Promise<boolean> {
  const meta = await pollUntilVisible(() => getEditionMeta(contractId));
  return meta !== null;
}

export async function getEditionMeta(contractId: string): Promise<ArtMeta | null> {
  try {
    const { result } = await getClient(contractId).art_meta();
    return result ?? null;
  } catch {
    return null;
  }
}

/** How many copies `owner` holds. `decimals` is 0, so this is a plain count. */
export async function getEditionBalance(
  contractId: string,
  owner: string,
): Promise<number> {
  try {
    const { result } = await getClient(contractId).balance({ account: owner });
    return Number(result);
  } catch {
    return 0;
  }
}

/**
 * Balance read used to clamp a listing's quantity. A single read right after a
 * fresh deploy or purchase can land on a Soroban RPC backend that hasn't
 * caught up with the ledger yet — `soroban-testnet.stellar.org` load-balances
 * across several nodes that don't always agree with each other for a few
 * seconds — and a stale zero here would silently build a `quantity: 0`
 * listing, which the contract rejects (now as a clear error, via
 * the contract itself, but a broken call may now just silently
 * produce an unusable transaction instead of a clear error — see history). Retrying costs nothing when the real balance isn't zero, and only adds
 * latency — not incorrectness — when it genuinely is, since the contract
 * rejects that listing either way.
 */
export async function getEditionBalanceForListing(
  contractId: string,
  owner: string,
): Promise<number> {
  let balance = await getEditionBalance(contractId, owner);
  for (let attempt = 0; attempt < 4 && balance === 0; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    balance = await getEditionBalance(contractId, owner);
  }
  return balance;
}

export async function getEditionSupply(contractId: string): Promise<number> {
  try {
    const { result } = await getClient(contractId).total_supply();
    return Number(result);
  } catch {
    return 0;
  }
}

export async function getEditionListing(
  contractId: string,
  seller: string,
): Promise<Listing | null> {
  try {
    const { result } = await getClient(contractId).listing({ seller });
    return result ?? null;
  } catch {
    return null;
  }
}

/** Every live listing for this edition, one per selling holder. */
export async function getEditionListings(contractId: string): Promise<Listing[]> {
  try {
    const { result } = await getClient(contractId).listings();
    return result;
  } catch {
    return [];
  }
}

export async function getEditionSaleBreakdown({
  contractId,
  seller,
  quantity,
}: {
  contractId: string;
  seller: string;
  quantity: number;
}): Promise<SaleBreakdown | null> {
  try {
    const { result } = await getClient(contractId).sale_breakdown({
      seller,
      quantity: BigInt(quantity),
    });
    return result ?? null;
  } catch {
    return null;
  }
}

export async function getEditionSymbol(contractId: string): Promise<string | null> {
  try {
    const { result } = await getClient(contractId).symbol();
    return result;
  } catch {
    return null;
  }
}
