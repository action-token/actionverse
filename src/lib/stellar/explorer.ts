import { env } from "~/env";

// Same network switch used by the rest of the Stellar config (constant.ts,
// stellarExpertUrl for assets) — kept independent since contract/tx links
// use different stellar.expert path segments than the asset explorer does.
export const STELLAR_NETWORK: "public" | "testnet" = env.NEXT_PUBLIC_STELLAR_PUBNET
  ? "public"
  : "testnet";

export const STELLAR_NETWORK_LABEL = STELLAR_NETWORK === "public" ? "Stellar Mainnet" : "Stellar Testnet";

export function stellarExpertContractUrl(contractId: string): string {
  return `https://stellar.expert/explorer/${STELLAR_NETWORK}/contract/${contractId}`;
}

export function stellarExpertTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${txHash}`;
}

export function stellarExpertAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/${STELLAR_NETWORK}/account/${address}`;
}
