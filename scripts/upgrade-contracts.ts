/**
 * Ships a new build of the shared art NFT collection contract to the address
 * already in `ART_NFT_CONTRACT_ID`, in place — same address, same storage.
 * This is the whole point of the contract's `Upgradeable` (OpenZeppelin-style)
 * entry point: behavior changes ship without a fresh deploy or anyone needing
 * to be pointed at a new contract id.
 *
 *   pnpm contracts:build:nft_oz
 *   pnpm contracts:bindings:nft_oz
 *   pnpm contracts:upgrade
 *
 * Only the contract's owner (the deployer account) can call `upgrade` —
 * enforced on-chain via `#[only_owner]`, not just by this script.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { BASE_FEE, Keypair, Operation, TransactionBuilder, hash, rpc, xdr } from "@stellar/stellar-sdk";
import { Client as ArtNftClient } from "contracts/nft_oz/bindings/src/index";
import { networkPassphrase, SOROBAN_RPC_URL } from "~/lib/stellar/constant";
import { ART_NFT_CONTRACT_ID, PLATFORM_TREASURY_ADDRESS } from "~/lib/common";

const WASM_DIR = resolve(process.cwd(), "contracts/target/wasm32v1-none/release");
const DEPLOYER_SECRET = process.env.CONTRACT_DEPLOYER_SECRET ?? process.env.MOTHER_SECRET;

if (!DEPLOYER_SECRET) {
  throw new Error("Set CONTRACT_DEPLOYER_SECRET (or MOTHER_SECRET) before upgrading");
}
if (!ART_NFT_CONTRACT_ID) {
  throw new Error("ART_NFT_CONTRACT_ID is empty in src/lib/common.ts for this network — nothing to upgrade");
}

const TREASURY = PLATFORM_TREASURY_ADDRESS;
if (!TREASURY) {
  throw new Error(
    "Set PLATFORM_TREASURY_ADDRESS in src/lib/common.ts (for this network) before upgrading",
  );
}

const server = new rpc.Server(SOROBAN_RPC_URL);
const deployer = Keypair.fromSecret(DEPLOYER_SECRET);

async function submit(tx: Parameters<typeof server.sendTransaction>[0]) {
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR" || sent.status === "DUPLICATE") {
    throw new Error(`Submission ${sent.status}: ${JSON.stringify(sent.errorResult ?? sent)}`);
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const got = await server.getTransaction(sent.hash);
      if (got.status === "SUCCESS") return sent.hash;
      if (got.status === "FAILED") throw new Error(`Transaction ${sent.hash} failed`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("failed")) throw e;
    }
  }
  throw new Error(`Transaction ${sent.hash} did not confirm in time`);
}

/** Uploads a Wasm blob and returns its hash (which is also its content id). */
async function uploadWasm(fileName: string): Promise<string> {
  const wasm = readFileSync(resolve(WASM_DIR, fileName));
  const wasmHash = hash(wasm).toString("hex");

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
  console.log(`Owner: ${deployer.publicKey()}`);
  console.log(`Contract: ${ART_NFT_CONTRACT_ID}\n`);

  const client = new ArtNftClient({
    contractId: ART_NFT_CONTRACT_ID,
    networkPassphrase,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey: deployer.publicKey(),
  });

  const before = await client.version();
  console.log(`Currently running version ${before.result}`);

  console.log("\nUploading new Wasm...");
  const newWasmHash = await uploadWasm("nft_oz.wasm");

  console.log("\nCalling upgrade()...");
  const assembled = await client.upgrade({
    new_wasm_hash: Buffer.from(newWasmHash, "hex"),
    operator: deployer.publicKey(),
  });
  await assembled.signAndSend({
    signTransaction: async (xdrStr: string) => {
      const tx = TransactionBuilder.fromXDR(xdrStr, networkPassphrase);
      tx.sign(deployer);
      return { signedTxXdr: tx.toXDR(), signerAddress: deployer.publicKey() };
    },
  });

  const after = await client.version();

  console.log("\nEnsuring PriceAuthority is set...");
  const currentAuthority = await client.price_authority();
  if (currentAuthority.result) {
    if (currentAuthority.result !== TREASURY) {
      console.warn(
        `  WARNING: price_authority is set to ${currentAuthority.result}, which does not match this script's TREASURY (${TREASURY}). If the app's PRICE_AUTHORITY_SECRET doesn't correspond to this address, edits will fail.`,
      );
    } else {
      console.log(`  Already set: ${currentAuthority.result}`);
    }
  } else {
    const setAuthority = await client.set_price_authority({ new_authority: TREASURY });
    await setAuthority.signAndSend({
      signTransaction: async (xdrStr: string) => {
        const tx = TransactionBuilder.fromXDR(xdrStr, networkPassphrase);
        tx.sign(deployer);
        return { signedTxXdr: tx.toXDR(), signerAddress: deployer.publicKey() };
      },
    });
    console.log(`  Set to ${TREASURY} (owner/treasury account)`);
  }

  console.log(`\nUpgrade complete — now running version ${after.result}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
