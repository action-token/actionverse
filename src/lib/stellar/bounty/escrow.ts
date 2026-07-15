import { Asset, Horizon, Keypair, Operation, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { Client as BountyManagerClient } from "contracts/bounty_escrow/bindings/src";
import { BOUNTY_ESCROW_CONTRACT_ID } from "~/lib/common";
import { networkPassphrase, SOROBAN_RPC_URL, STELLAR_URL, TrxBaseFee } from "../constant";
import { MOTHER_SECRET } from "../marketplace/SECRET";
import { signXdrTransaction } from "../fan/signXDR";
import { WithSing, type SignUserType } from "../utils";
import type { PrismaClient } from "@prisma/client";

const DAY_IN_LEDGERS = 17280;

// Classic Stellar assets always use 7 decimal places; the Stellar Asset
// Contract (SAC) mirrors that scale for its i128 amounts, so a "1 token"
// bounty prize is `1 * 10_000_000` on the contract side.
const STROOP_SCALE = 10_000_000;

export function toContractAmount(amount: number): bigint {
  return BigInt(Math.round(amount * STROOP_SCALE));
}

export function fromContractAmount(amount: bigint): number {
  return Number(amount) / STROOP_SCALE;
}

/** Resolves a bounty's prize asset to its Stellar Asset Contract (SAC) address. */
export function resolveTokenAddress(
  assetCode: string,
  assetIssuer: string | null,
): string {
  const asset = assetIssuer ? new Asset(assetCode, assetIssuer) : Asset.native();
  return asset.contractId(networkPassphrase);
}

/**
 * `publicKey` becomes both the transaction source account and the identity
 * whose auth entries get attached during simulation — pass the address of
 * whichever party (creator or winner) must sign the resulting XDR. Omit it
 * only for read-only view calls (`get_bounty`/`get_winner_award`).
 */
function getClient(publicKey?: string): BountyManagerClient {
  return new BountyManagerClient({
    contractId: BOUNTY_ESCROW_CONTRACT_ID,
    networkPassphrase,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
  });
}

/**
 * Polls classic Horizon (not Soroban RPC) for a submitted transaction's
 * outcome. Horizon returns a pre-parsed `successful` boolean computed
 * server-side, which sidesteps a real bug in this repo's pinned
 * `@stellar/stellar-sdk` version: its client-side XDR decoder throws ("Bad
 * union switch: 4") on the transaction-meta shape protocol 27 produces, so
 * `rpc.Server.getTransaction()` cannot be used to check status at all right
 * now — this isn't a workaround for something else, Horizon is the correct
 * fix (see contracts/bounty_escrow/README.md for the full explanation).
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

/**
 * A classic Stellar asset's Stellar Asset Contract (SAC) — the address
 * `resolveTokenAddress` computes — only exists once *something* has
 * instantiated it; `Asset.contractId()` returns that address deterministically
 * whether or not the contract is actually deployed there yet. Any brand new
 * (never touched by Soroban) custom asset needs this done once, ever, per
 * network, before any contract (ours included) can call `transfer` on it.
 * It's a permissionless, no-admin-required action, so the platform account
 * pays for and triggers it transparently — the creator never sees this step.
 */
async function ensureSacDeployed(assetCode: string, assetIssuer: string | null): Promise<void> {
  if (!assetIssuer) return; // native XLM's SAC always exists
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const tokenAddress = resolveTokenAddress(assetCode, assetIssuer);

  try {
    await server.getContractData(
      tokenAddress,
      xdr.ScVal.scvLedgerKeyContractInstance(),
      rpc.Durability.Persistent,
    );
    return; // already deployed
  } catch {
    // Not found — deploy it below.
  }

  const motherKeypair = Keypair.fromSecret(MOTHER_SECRET);
  const motherAcc = await server.getAccount(motherKeypair.publicKey());

  const tx = new TransactionBuilder(motherAcc, {
    fee: TrxBaseFee,
    networkPassphrase,
  })
    .addOperation(
      Operation.createStellarAssetContract({
        asset: new Asset(assetCode, assetIssuer),
      }),
    )
    .setTimeout(0)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(motherKeypair);

  const result = await server.sendTransaction(prepared);
  const ok = await pollTransactionSuccess(result.hash);
  if (!ok) throw new Error(`SAC deploy transaction ${result.hash} failed`);
}

/** Creator deposits `amount` of the bounty's prize asset into escrow. */
export async function buildCreateBountyXDR({
  bountyId,
  creatorPubKey,
  assetCode,
  assetIssuer,
  amount,
  maxWinners,
}: {
  bountyId: number;
  creatorPubKey: string;
  assetCode: string;
  assetIssuer: string | null;
  amount: number;
  maxWinners: number;
}): Promise<string> {
  await ensureSacDeployed(assetCode, assetIssuer);
  const client = getClient(creatorPubKey);
  const token = resolveTokenAddress(assetCode, assetIssuer);
  const tx = await client.create_bounty({
    bounty_id: BigInt(bountyId),
    creator: creatorPubKey,
    token,
    amount: toContractAmount(amount),
    max_winners: maxWinners,
  });
  return tx.toXDR();
}

/** Creator commits `amount` of the remaining escrow to `winnerPubKey`. */
export async function buildSelectWinnerXDR({
  bountyId,
  creatorPubKey,
  winnerPubKey,
  amount,
}: {
  bountyId: number;
  creatorPubKey: string;
  winnerPubKey: string;
  amount: number;
}): Promise<string> {
  const client = getClient(creatorPubKey);
  const tx = await client.select_winner({
    caller: creatorPubKey,
    bounty_id: BigInt(bountyId),
    winner: winnerPubKey,
    amount: toContractAmount(amount),
  });
  return tx.toXDR();
}

/** Winner pulls their previously-selected award. */
export async function buildClaimXDR({
  bountyId,
  winnerPubKey,
}: {
  bountyId: number;
  winnerPubKey: string;
}): Promise<string> {
  const client = getClient(winnerPubKey);
  const tx = await client.claim_reward({
    bounty_id: BigInt(bountyId),
    winner: winnerPubKey,
  });
  return tx.toXDR();
}

/** Creator reclaims any unassigned escrow and closes the bounty to new selections. */
export async function buildCancelBountyXDR({
  bountyId,
  creatorPubKey,
}: {
  bountyId: number;
  creatorPubKey: string;
}): Promise<string> {
  const client = getClient(creatorPubKey);
  const tx = await client.cancel_bounty({
    caller: creatorPubKey,
    bounty_id: BigInt(bountyId),
  });
  return tx.toXDR();
}

export async function getOnChainBounty(bountyId: number) {
  const client = getClient();
  const tx = await client.get_bounty({ bounty_id: BigInt(bountyId) });
  return tx.result.isOk() ? tx.result.unwrap() : null;
}

export async function getOnChainWinnerAward(bountyId: number, winnerPubKey: string) {
  const client = getClient();
  const tx = await client.get_winner_award({
    bounty_id: BigInt(bountyId),
    winner: winnerPubKey,
  });
  return tx.result;
}

/**
 * Confirms a submitted invoke transaction actually succeeded on-chain before
 * the caller commits corresponding DB state (funded/selected/claimed). Unlike
 * the legacy classic-payment flow, which trusts the client's report of
 * success, this closes that verification gap for contract-backed bounties.
 */
export async function verifyContractTransaction(txHash: string): Promise<boolean> {
  return pollTransactionSuccess(txHash);
}

/** Build XDR for the admin-only bounty TTL extension. */
export async function buildAdminExtendBountyTTLXDR(
  bountyId: number,
  adminPubKey: string,
): Promise<string> {
  const client = getClient(adminPubKey);
  const tx = await client.admin_extend_bounty_ttl({
    bounty_id: BigInt(bountyId),
  });
  return tx.toXDR();
}

/** Build XDR for the admin-only winner-award TTL extension. */
export async function buildAdminExtendWinnerAwardTTLXDR(
  bountyId: number,
  winnerPubKey: string,
  adminPubKey: string,
): Promise<string> {
  const client = getClient(adminPubKey);
  const tx = await client.admin_extend_winner_award_ttl({
    bounty_id: BigInt(bountyId),
    winner: winnerPubKey,
  });
  return tx.toXDR();
}

/** Build XDR for the admin-only contract-instance TTL extension. */
export async function buildAdminExtendInstanceTTLXDR(adminPubKey: string): Promise<string> {
  const client = getClient(adminPubKey);
  const tx = await client.admin_extend_instance_ttl();
  return tx.toXDR();
}

/** TTL info for a storage entry. */
export interface StorageTTL {
  liveUntilLedger: number;
  remainingLedgers: number;
  approxDaysRemaining: number;
}

/** Get the current ledger sequence from the RPC server. */
export async function getCurrentLedger(): Promise<number> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const latest = await server.getLatestLedger();
  return latest.sequence;
}

/** Check the TTL of a specific bounty entry. */
export async function getBountyTTL(bountyId: number): Promise<StorageTTL | null> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const currentLedger = await getCurrentLedger();

  const key = xdr.ScVal.scvVec([
    xdr.ScVal.scvU32(2), // DataKey::Bounty variant index
    xdr.ScVal.scvU64(BigInt(bountyId) as unknown as xdr.Uint64),
  ]);

  const contractId = BOUNTY_ESCROW_CONTRACT_ID.startsWith("C")
    ? StrKey.decodeContract(BOUNTY_ESCROW_CONTRACT_ID)
    : Buffer.from(BOUNTY_ESCROW_CONTRACT_ID, "hex");

  const ledgerKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: xdr.ScAddress.scAddressTypeContract(contractId),
      key,
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  const result = await server.getLedgerEntries(ledgerKey);
  const entry = result.entries[0];
  if (!entry) return null;

  const liveUntilLedger = entry.liveUntilLedgerSeq ?? 0;
  const remainingLedgers = liveUntilLedger - currentLedger;
  return {
    liveUntilLedger,
    remainingLedgers,
    approxDaysRemaining: remainingLedgers / DAY_IN_LEDGERS,
  };
}

/** Check the TTL of the contract instance entry. */
export async function getContractInstanceTTL(): Promise<StorageTTL | null> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const currentLedger = await getCurrentLedger();

  const contractId = BOUNTY_ESCROW_CONTRACT_ID.startsWith("C")
    ? StrKey.decodeContract(BOUNTY_ESCROW_CONTRACT_ID)
    : Buffer.from(BOUNTY_ESCROW_CONTRACT_ID, "hex");

  const ledgerKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: xdr.ScAddress.scAddressTypeContract(contractId),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  const result = await server.getLedgerEntries(ledgerKey);
  const entry = result.entries[0];
  if (!entry) return null;

  const liveUntilLedger = entry.liveUntilLedgerSeq ?? 0;
  const remainingLedgers = liveUntilLedger - currentLedger;
  return {
    liveUntilLedger,
    remainingLedgers,
    approxDaysRemaining: remainingLedgers / DAY_IN_LEDGERS,
  };
}

/**
 * The escrow contract's `creator` address for a bounty is either the owner's
 * own pubkey (User.id doubles as the Stellar public key in this app) or, when
 * `fundedFromCreatorStorage` is set, the Creator's custodial storage account
 * — the same account the old mother-wallet flow could fund bounties from.
 * `storageSecret` is only present in the latter case, letting the caller sign
 * fully server-side instead of asking the owner to sign in their wallet.
 */
export async function getEscrowCreatorIdentity(
  db: PrismaClient,
  bounty: { userId: string; fundedFromCreatorStorage: boolean },
): Promise<{ pubKey: string; storageSecret?: string }> {
  if (!bounty.fundedFromCreatorStorage) {
    return { pubKey: bounty.userId };
  }
  const creator = await db.creator.findUniqueOrThrow({
    where: { id: bounty.userId },
    select: { storagePub: true, storageSecret: true },
  });
  if (!creator.storagePub || !creator.storageSecret) {
    throw new Error("Creator storage wallet is not configured");
  }
  return { pubKey: creator.storagePub, storageSecret: creator.storageSecret };
}

/**
 * Signs a built escrow-contract invoke XDR: fully server-side when a custodial
 * secret is available (creator storage account, or email/social session via
 * WithSing), otherwise returns it as-is for the caller's wallet to sign.
 */
export async function signEscrowXdr({
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
