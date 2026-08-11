/**
 * One-time deployment for the Soroban art contracts.
 *
 *   pnpm contracts:build:nft_oz && pnpm contracts:build:ft_oz
 *   pnpm contracts:deploy
 *
 * Uploads both Wasm blobs, then deploys the single shared 1-of-1 collection
 * contract. Editions are *not* deployed here — each artwork deploys its own
 * from the uploaded Wasm hash at mint time, paid for and signed by its creator.
 *
 * Prints the constants to paste into `src/lib/common.ts`.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  hash,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Client as ArtNftClient } from "contracts/nft_oz/bindings/src/index";
import {
  DEFAULT_PLATFORM_FEE_BPS,
  networkPassphrase,
  SOROBAN_RPC_URL,
} from "~/lib/stellar/constant";
import { ART_NFT_CONTRACT_ID, PLATFORM_TREASURY_ADDRESS } from "~/lib/common";

const WASM_DIR = resolve(process.cwd(), "contracts/target/wasm32v1-none/release");

const DEPLOYER_SECRET = process.env.CONTRACT_DEPLOYER_SECRET ?? process.env.MOTHER_SECRET;
const TREASURY = PLATFORM_TREASURY_ADDRESS;
const PLATFORM_FEE_BPS = DEFAULT_PLATFORM_FEE_BPS;

const COLLECTION_NAME = process.env.ART_COLLECTION_NAME ?? "Actionverse Art";
const COLLECTION_SYMBOL = process.env.ART_COLLECTION_SYMBOL ?? "AVART";
const COLLECTION_BASE_URI =
  process.env.ART_COLLECTION_BASE_URI ?? "https://app.action-tokens.com/nft/";

if (!DEPLOYER_SECRET) {
  throw new Error("Set CONTRACT_DEPLOYER_SECRET (or MOTHER_SECRET) before deploying");
}
if (!TREASURY) {
  throw new Error(
    "Set PLATFORM_TREASURY_ADDRESS in src/lib/common.ts (for this network) " +
      "to the account that collects platform fees, then re-run.",
  );
}

const server = new rpc.Server(SOROBAN_RPC_URL);
const deployer = Keypair.fromSecret(DEPLOYER_SECRET);

async function submit(tx: Parameters<typeof server.sendTransaction>[0]) {
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR" || sent.status === "DUPLICATE") {
    // Surface the decoded reason (tx_bad_seq, tx_insufficient_fee, ...) rather
    // than letting it time out later as an opaque "did not confirm".
    throw new Error(
      `Submission ${sent.status}: ${JSON.stringify(sent.errorResult ?? sent)}`,
    );
  }
  // Poll until the ledger closes. `getTransaction` is only used for status
  // here, never to decode result meta — that decode is what's broken against
  // protocol 27 in this repo's pinned SDK.
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const got = await server.getTransaction(sent.hash);
      if (got.status === "SUCCESS") return sent.hash;
      if (got.status === "FAILED") throw new Error(`Transaction ${sent.hash} failed`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("failed")) throw e;
      // still pending, or meta we can't decode — keep waiting
    }
  }
  throw new Error(`Transaction ${sent.hash} did not confirm in time`);
}

/** Uploads a Wasm blob and returns its hash (which is also its content id). */
async function uploadWasm(fileName: string): Promise<string> {
  const wasm = readFileSync(resolve(WASM_DIR, fileName));
  const wasmHash = hash(wasm).toString("hex");

  // Uploading the same blob twice is harmless on-chain (the entry is keyed by
  // content hash) but still costs a fee, so skip it when re-running.
  const codeKey = xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({ hash: Buffer.from(wasmHash, "hex") }),
  );
  const existing = await server.getLedgerEntries(codeKey);
  if (existing.entries.length > 0) {
    console.log(`  ${fileName} already uploaded (${wasmHash})`);
    return wasmHash;
  }

  const account = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(deployer);
  await submit(prepared);

  console.log(`  ${fileName} uploaded (${wasmHash})`);
  return wasmHash;
}

async function main() {
  console.log(`Network: ${networkPassphrase}`);
  console.log(`Deployer: ${deployer.publicKey()}\n`);

  // Strictly sequential: every upload is signed by the same account, and
  // building them concurrently reads the same sequence number twice, so the
  // second transaction is dead on arrival.
  console.log("Uploading Wasm...");
  const nftWasmHash = await uploadWasm("nft_oz.wasm");
  const ftWasmHash = await uploadWasm("ft_oz.wasm");

  // The collection is a singleton. Re-running after only the edition Wasm
  // changed must not mint a second one at a fresh address, orphaning every
  // token already minted into the first.
  if (ART_NFT_CONTRACT_ID) {
    const existing = new ArtNftClient({
      contractId: ART_NFT_CONTRACT_ID,
      networkPassphrase,
      rpcUrl: SOROBAN_RPC_URL,
    });
    try {
      const { result } = await existing.name();
      console.log(`\nCollection already deployed at ${ART_NFT_CONTRACT_ID} ("${result}") — skipping.`);
      console.log("\n--- src/lib/common.ts ---");
      console.log(`ART_NFT_CONTRACT_ID    = "${ART_NFT_CONTRACT_ID}"`);
      console.log(`ART_EDITION_WASM_HASH  = "${ftWasmHash}"`);
      console.log("-------------------------");
      return;
    } catch {
      console.log(
        `\nART_NFT_CONTRACT_ID is set to ${ART_NFT_CONTRACT_ID} but that contract did not respond — deploying a new one.`,
      );
    }
  }

  console.log("\nDeploying the shared 1-of-1 collection...");
  const deployTx = await ArtNftClient.deploy(
    {
      owner: deployer.publicKey(),
      treasury: TREASURY,
      platform_fee_bps: PLATFORM_FEE_BPS,
      name: COLLECTION_NAME,
      symbol: COLLECTION_SYMBOL,
      base_uri: COLLECTION_BASE_URI,
    },
    {
      wasmHash: nftWasmHash,
      format: "hex",
      networkPassphrase,
      rpcUrl: SOROBAN_RPC_URL,
      publicKey: deployer.publicKey(),
    },
  );

  const contractId = deployTx.result.options.contractId;
  await deployTx.signAndSend({
    signTransaction: async (xdrStr: string) => {
      const tx = TransactionBuilder.fromXDR(xdrStr, networkPassphrase);
      tx.sign(deployer);
      return { signedTxXdr: tx.toXDR(), signerAddress: deployer.publicKey() };
    },
  });

  console.log(`  collection deployed at ${contractId}`);

  const branch =
    networkPassphrase === Networks.PUBLIC ? "pubnet (first)" : "testnet (second)";

  console.log(`\n--- paste into src/lib/common.ts, ${branch} branch ---`);
  console.log(`ART_NFT_CONTRACT_ID    = "${contractId}"`);
  console.log(`ART_EDITION_WASM_HASH  = "${ftWasmHash}"`);
  console.log("------------------------------------------------------");
  console.log(
    "\nThe collection's owner is the deployer account — it is the only key that " +
      "can change the platform fee or pause the collection. Keep it safe.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
