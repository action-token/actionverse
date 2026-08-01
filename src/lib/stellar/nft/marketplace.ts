import { Asset, Horizon, Keypair, Operation, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { Client as NftMarketplaceClient } from "contracts/nft_marketplace/bindings/src";
import { NFT_MARKETPLACE_CONTRACT_ID } from "~/lib/common";
import {
  networkPassphrase,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
  STELLAR_URL,
  TrxBaseFee,
} from "../constant";
import { MOTHER_SECRET } from "../marketplace/SECRET";
import { signXdrTransaction } from "../fan/signXDR";
import { WithSing, type SignUserType } from "../utils";
import type { PrismaClient } from "@prisma/client";

const DAY_IN_LEDGERS = 17280;
const STROOP_SCALE = 10_000_000;

export function toContractAmount(amount: number): bigint {
  return BigInt(Math.round(amount * STROOP_SCALE));
}

export function fromContractAmount(amount: bigint): number {
  return Number(amount) / STROOP_SCALE;
}

export function resolveTokenAddress(
  assetCode: string,
  assetIssuer: string | null,
): string {
  const asset = assetIssuer ? new Asset(assetCode, assetIssuer) : Asset.native();
  return asset.contractId(networkPassphrase);
}

function getClient(publicKey?: string): NftMarketplaceClient {
  return new NftMarketplaceClient({
    contractId: NFT_MARKETPLACE_CONTRACT_ID,
    networkPassphrase,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
  });
}

async function pollTransactionSuccess(hash: string): Promise<boolean> {
  const server = new Horizon.Server(STELLAR_URL);
  for (let i = 0; i < 15; i++) {
    try {
      const result = await server.transactions().transaction(hash).call();
      return result.successful;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Transaction ${hash} did not confirm in time`);
}

// =============================================================================
// Minting
// =============================================================================

export async function buildMintNftXDR({
  creatorPubKey,
  name,
  description,
  thumbnail,
  contentUrl,
  mediaType,
  copies,
  price,
}: {
  creatorPubKey: string;
  name: string;
  description: string;
  thumbnail: string;
  contentUrl: string;
  mediaType: string;
  copies: number;
  price: number;
}): Promise<string> {
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
      price: toContractAmount(price),
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

// =============================================================================
// Marketplace - Buy
// =============================================================================

export async function buildBuyNftXDR({
  buyerPubKey,
  tokenId,
  quantity,
}: {
  buyerPubKey: string;
  tokenId: bigint;
  quantity: number;
}): Promise<string> {
  const client = getClient(buyerPubKey);
  const tx = await client.buy(
    {
      buyer: buyerPubKey,
      token_id: tokenId,
      quantity,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

// =============================================================================
// Marketplace - List for Sale
// =============================================================================

export async function buildListForSaleXDR({
  sellerPubKey,
  tokenId,
  price,
  copies,
}: {
  sellerPubKey: string;
  tokenId: bigint;
  price: number;
  copies: number;
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.list_for_sale(
    {
      seller: sellerPubKey,
      token_id: tokenId,
      price: toContractAmount(price),
      copies,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

// =============================================================================
// Marketplace - Cancel Listing
// =============================================================================

export async function buildCancelListingXDR({
  sellerPubKey,
  tokenId,
}: {
  sellerPubKey: string;
  tokenId: bigint;
}): Promise<string> {
  const client = getClient(sellerPubKey);
  const tx = await client.cancel_listing(
    {
      seller: sellerPubKey,
      token_id: tokenId,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

// =============================================================================
// Transfers (SEP-50)
// =============================================================================

export async function buildTransferXDR({
  fromPubKey,
  toPubKey,
  tokenId,
}: {
  fromPubKey: string;
  toPubKey: string;
  tokenId: bigint;
}): Promise<string> {
  const client = getClient(fromPubKey);
  const tx = await client.transfer(
    {
      from: fromPubKey,
      to: toPubKey,
      token_id: tokenId,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

export async function buildApproveXDR({
  approverPubKey,
  approvedPubKey,
  tokenId,
  liveUntilLedger,
}: {
  approverPubKey: string;
  approvedPubKey: string;
  tokenId: bigint;
  liveUntilLedger: number;
}): Promise<string> {
  const client = getClient(approverPubKey);
  const tx = await client.approve(
    {
      approver: approverPubKey,
      approved: approvedPubKey,
      token_id: tokenId,
      live_until_ledger: liveUntilLedger,
    },
    { fee: SOROBAN_INCLUSION_FEE },
  );
  return tx.toXDR();
}

// =============================================================================
// Read Operations
// =============================================================================

export async function getNftListing(tokenId: bigint) {
  const client = getClient();
  const tx = await client.get_listing({ token_id: tokenId });
  return tx.result.isOk() ? tx.result.unwrap() : null;
}

export async function getNftMetadata(tokenId: bigint) {
  const client = getClient();
  const tx = await client.get_token_metadata({ token_id: tokenId });
  return tx.result.isOk() ? tx.result.unwrap() : null;
}

export async function getNftOwner(tokenId: bigint) {
  const client = getClient();
  const tx = await client.owner_of({ token_id: tokenId });
  return tx.result.isOk() ? tx.result.unwrap() : null;
}

export async function getNftBalance(ownerPubKey: string) {
  const client = getClient();
  const tx = await client.balance({ owner: ownerPubKey });
  return tx.result;
}

export async function getContractName() {
  const client = getClient();
  const tx = await client.name();
  return tx.result;
}

export async function getContractSymbol() {
  const client = getClient();
  const tx = await client.symbol();
  return tx.result;
}

// =============================================================================
// Transaction Verification
// =============================================================================

export async function verifyContractTransaction(txHash: string): Promise<boolean> {
  return pollTransactionSuccess(txHash);
}

// =============================================================================
// Signing Helper
// =============================================================================

export async function signNftXdr({
  xdr,
  storageSecret,
  signWith,
}: {
  xdr: string;
  storageSecret?: string;
  signWith: SignUserType;
}): Promise<{ xdr: string; fullySignedByServer: boolean }> {
  if (storageSecret) {
    return { xdr: signXdrTransaction(xdr, storageSecret), fullySignedByServer: true };
  }
  const signed = await WithSing({ xdr, signWith });
  return { xdr: signed, fullySignedByServer: signed !== xdr };
}
