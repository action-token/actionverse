import { Asset, Horizon, rpc } from "@stellar/stellar-sdk";
import {
  Client as ArtNftClient,
  type ArtMeta,
  type Listing,
  type SaleBreakdown,
} from "contracts/nft_oz/bindings/src/index";
import { ART_NFT_CONTRACT_ID } from "~/lib/common";
import {
  networkPassphrase,
  requireContractConstant,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
  STELLAR_URL,
} from "../constant";
import { WithSing, type SignUserType } from "../utils";

/**
 * `publicKey` becomes both the transaction source account and the identity
 * whose auth entries get attached during simulation — pass the address of
 * whichever party (creator/seller/buyer) must sign the resulting XDR.
 *
 * This matters most for `buy`: settlement invokes the payment token's
 * `transfer` as a sub-invocation, and those legs only end up in the auth tree
 * because simulation discovers them from this account. Hand-building the XDR
 * instead would produce a transaction that fails auth on submission.
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

/**
 * Polls classic Horizon rather than Soroban RPC for a transaction's outcome.
 *
 * This is not a stylistic choice: this repo's pinned `@stellar/stellar-sdk`
 * cannot decode the transaction meta protocol 27 produces ("Bad union switch:
 * 4"), so `rpc.Server.getTransaction()` throws outright. Horizon computes
 * `successful` server-side, sidestepping the decoder entirely. The same
 * limitation is why a minted token id is read back via `token_by_ref` instead
 * of from the invocation's return value — see
 * `contracts/bounty_escrow/README.md`.
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
 * though the mint genuinely landed. Retrying turns that into added latency
 * instead of a false "it didn't work" — the same shape of fix as
 * `getEditionBalanceForListing`.
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

export async function buildMintArtXDR({
  creatorPubKey,
  artRef,
  title,
  description,
  thumbnailUrl,
  mediaUrl,
  mediaType,
  royaltyBps,
}: {
  creatorPubKey: string;
  /** The `Nft` row id — lets `token_by_ref` resolve the minted token later. */
  artRef: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: string;
  royaltyBps: number;
}): Promise<string> {
  const client = getClient(creatorPubKey);
  const tx = await client.mint_art(
    {
      creator: creatorPubKey,
      art_ref: artRef,
      art: {
        title,
        description,
        thumbnail_url: thumbnailUrl,
        media_url: mediaUrl,
        media_type: mediaType,
        royalty_bps: royaltyBps,
      },
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * Mints and lists in one signed call — the storefront's "create for sale"
 * path. See `mint_and_list`'s contract-side doc comment for why this replaced
 * a separate mint-then-list pair of transactions: that shape needed the
 * second transaction to read the first one's effects back through the public
 * Soroban RPC pool, which doesn't always agree with itself within the couple
 * of seconds right after a ledger closes. One call has no gap for a second
 * transaction to read stale state from.
 */
export async function buildMintAndListXDR({
  creatorPubKey,
  artRef,
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
  artRef: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: string;
  royaltyBps: number;
  priceRaw: bigint;
  paymentToken?: string;
}): Promise<string> {
  const client = getClient(creatorPubKey);
  const tx = await client.mint_and_list(
    {
      creator: creatorPubKey,
      art_ref: artRef,
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
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildListXDR({
  sellerPubKey,
  tokenId,
  priceRaw,
  paymentToken,
}: {
  sellerPubKey: string;
  tokenId: number;
  priceRaw: bigint;
  paymentToken?: string;
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.list(
    {
      seller: sellerPubKey,
      token_id: tokenId,
      price: priceRaw,
      payment_token: paymentToken ?? nativeTokenAddress(),
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
 * listed — so this is the buyer's signature alone.
 */
export async function buildBuyXDR({
  buyerPubKey,
  tokenId,
}: {
  buyerPubKey: string;
  tokenId: number;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy(
    { buyer: buyerPubKey, token_id: tokenId },
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
// listing) surfaces as a thrown error. These normalize that to `null` — an
// absent listing is an ordinary UI state, not a failure.
// =============================================================================

/**
 * Resolves a minted token's id from the `Nft` row id passed at mint time.
 * Returns `null` while the mint is still unconfirmed, retrying against RPC
 * replication lag (see `pollUntilVisible`) before giving up.
 */
export async function getTokenIdByRef(artRef: string): Promise<number | null> {
  return pollUntilVisible(async () => {
    try {
      const { result } = await getClient().token_by_ref({ art_ref: artRef });
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

/** What a buyer would actually pay, straight from the contract. */
export async function getSaleBreakdown(
  tokenId: number,
): Promise<SaleBreakdown | null> {
  try {
    const { result } = await getClient().sale_breakdown({ token_id: tokenId });
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
