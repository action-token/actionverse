import { Horizon } from "@stellar/stellar-sdk";
import {
  Client as NftMarketplaceClient,
  type Listing,
  type TokenMetadata,
} from "contracts/nft_marketplace/bindings/src/index";
import { NFT_MARKETPLACE_CONTRACT_ID } from "~/lib/common";
import {
  networkPassphrase,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
  STELLAR_URL,
} from "../constant";
import { WithSing, type SignUserType } from "../utils";

/**
 * `publicKey` becomes both the transaction source account and the identity
 * whose auth entries get attached during simulation — pass the address of
 * whichever party (creator/seller/buyer) must sign the resulting XDR. Omit it
 * only for read-only view calls.
 */
function getClient(publicKey?: string): NftMarketplaceClient {
  return new NftMarketplaceClient({
    contractId: NFT_MARKETPLACE_CONTRACT_ID,
    networkPassphrase,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
  });
}

/**
 * Polls classic Horizon (not Soroban RPC) for a submitted transaction's
 * outcome — same fix as the bounty escrow contract (see
 * `~/lib/stellar/bounty/escrow.ts`): this repo's pinned `@stellar/stellar-sdk`
 * throws decoding the transaction-meta shape current protocol produces via
 * `rpc.Server.getTransaction()`, so Horizon is the correct, working check.
 */
async function pollTransactionSuccess(hash: string): Promise<boolean> {
  const server = new Horizon.Server(STELLAR_URL);
  for (let i = 0; i < 15; i++) {
    try {
      const result = await server.transactions().transaction(hash).call();
      return result.successful;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // not yet indexed — retry
    }
  }
  throw new Error(`Transaction ${hash} did not confirm in time`);
}

/** Confirms a submitted invoke transaction actually succeeded on-chain before
 *  the caller commits corresponding DB state. */
export async function verifyContractTransaction(txHash: string): Promise<boolean> {
  return pollTransactionSuccess(txHash);
}

/**
 * Signs a built marketplace-contract invoke XDR: fully server-side when a
 * custodial `signWith` is available (email/social session), otherwise
 * returns it as-is for the caller's own wallet to sign via `clientsign`.
 */
export async function signNftXdr({
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
 * Builds the mint XDR. `tokenId` is read from the transaction's simulated
 * result (`AssembledTransaction.result`, populated before signing/submission)
 * — deterministic, since a mint that lands exactly as simulated is assigned
 * exactly this id; `confirmMint` still verifies on-chain success afterward
 * before any DB state is trusted.
 */
export async function buildMintXDR({
  creatorPubKey,
  name,
  description,
  thumbnail,
  contentUrl,
  mediaType,
  copies,
  price,
  royaltyBps,
}: {
  creatorPubKey: string;
  name: string;
  description: string;
  thumbnail: string;
  contentUrl: string;
  mediaType: string;
  copies: number;
  price: bigint;
  royaltyBps: number;
}): Promise<{ xdr: string; tokenId: number }> {
  const client = getClient(creatorPubKey);
  const tx = await client.mint(
    {
      creator: creatorPubKey,
      name,
      description,
      thumbnail,
      content_url: contentUrl,
      media_type: mediaType,
      copies,
      price,
      royalty_bps: royaltyBps,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  if (tx.result.isErr()) throw new Error(tx.result.unwrapErr().message);
  return { xdr: tx.toXDR(), tokenId: tx.result.unwrap() };
}

export async function buildListForSaleXDR({
  sellerPubKey,
  tokenId,
  price,
  copies,
}: {
  sellerPubKey: string;
  tokenId: number;
  price: bigint;
  copies: number;
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.list_for_sale(
    { seller: sellerPubKey, token_id: tokenId, price, copies },
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

export async function buildBuyXDR({
  buyerPubKey,
  sellerPubKey,
  tokenId,
  quantity,
}: {
  buyerPubKey: string;
  sellerPubKey: string;
  tokenId: number;
  quantity: number;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy(
    { buyer: buyerPubKey, seller: sellerPubKey, token_id: tokenId, quantity },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

/**
 * Ground-truth reads used to populate/reconcile the DB cache after a
 * confirm* mutation — we mirror what the contract says is true right now
 * rather than trusting client-supplied price/copies/owner values.
 *
 * Listings are keyed by (token_id, seller) since v4 — every copy-holder can
 * run their own independent listing — so callers must say whose listing they
 * mean. `getOnChainTokenBalance` is the source of truth for whether an
 * address is even eligible to list/resell in the first place.
 */
export async function getOnChainListing(
  tokenId: number,
  seller: string,
): Promise<Listing | null> {
  const { result } = await getClient().get_listing({ token_id: tokenId, seller });
  return result.isOk() ? result.unwrap() : null;
}

export async function getOnChainListings(tokenId: number): Promise<Listing[]> {
  const { result } = await getClient().get_listings({ token_id: tokenId });
  return result;
}

export async function getOnChainTokenMetadata(tokenId: number): Promise<TokenMetadata | null> {
  const { result } = await getClient().get_token_metadata({ token_id: tokenId });
  return result.isOk() ? result.unwrap() : null;
}

export async function getOnChainOwner(tokenId: number): Promise<string | null> {
  const { result } = await getClient().owner_of({ token_id: tokenId });
  return result.isOk() ? result.unwrap() : null;
}

export async function getOnChainTokenBalance(tokenId: number, owner: string): Promise<number> {
  const { result } = await getClient().token_balance_of({ token_id: tokenId, owner });
  return result;
}
