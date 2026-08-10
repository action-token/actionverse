// export const BASE_URL = "https://app.action-tokens.com/";
// export const BASE_URL = "http://localhost:3000";
export const BASE_URL = process.env.NODE_ENV === "production" ? "https://app.action-tokens.com/" : "https://funnier-jeni-qualmishly.ngrok-free.dev/";
export const EXPRESS_SERVER_URL = "https://portal.actn.xyz/actionverse/api/"

// Bounty escrow Soroban contract ID — testnet for dev, mainnet for prod.
export const BOUNTY_ESCROW_CONTRACT_ID =
  process.env.NEXT_PUBLIC_STELLAR_PUBNET === "true"
    ? "CBTALUV2T6FRODHLQIT5MRD6SVXOQ5NTURYY5EFS5NWTCZ6ZLKJCJGXW"
    : "CDVOU7U6H5CPUHW457T2TG22RQVHAAW5F4EQAPQ57ZUETGLVCUMRRYJS";

// NFT marketplace Soroban contract ID (testnet) - v4 (media_type support,
// pause, platform fee, royalty, per-seller listings). Same deployed instance
// the sibling `marketplace` project uses — they share one database, so this
// keeps both frontends pointed at one consistent on-chain + off-chain state.
export const NFT_MARKETPLACE_CONTRACT_ID = "CDPYXEQILAJ4EV3GIDBOUNRPQ6PICR3DX4NNUIGKMMOCYJVNGYX2EHDG";

// The contract's `price`/`total_price` fields are i128 amounts in the payment
// token's raw (stroop-like) units. Stellar assets use 7 decimal places by
// convention, so this is the single conversion point between that and the
// human-readable price shown/entered in the UI and stored in `Nft`-related rows.
export const PAYMENT_TOKEN_DECIMALS = 7;
export const PAYMENT_TOKEN_SCALE = 10_000_000; // 10 ** PAYMENT_TOKEN_DECIMALS

export function humanPriceToRaw(price: number): bigint {
  return BigInt(Math.round(price * PAYMENT_TOKEN_SCALE));
}

export function rawPriceToHuman(raw: bigint | number): number {
  return Number(raw) / PAYMENT_TOKEN_SCALE;
}
