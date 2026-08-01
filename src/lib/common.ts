// export const BASE_URL = "https://app.action-tokens.com/";
// export const BASE_URL = "http://localhost:3000";
export const BASE_URL = process.env.NODE_ENV === "production" ? "https://app.action-tokens.com/" : "https://funnier-jeni-qualmishly.ngrok-free.dev/";
export const EXPRESS_SERVER_URL = "https://portal.actn.xyz/actionverse/api/"

// Bounty escrow Soroban contract ID (mainnet).
export const BOUNTY_ESCROW_CONTRACT_ID = "CBTALUV2T6FRODHLQIT5MRD6SVXOQ5NTURYY5EFS5NWTCZ6ZLKJCJGXW";

// NFT marketplace Soroban contract ID (testnet) - v2 without collections.
export const NFT_MARKETPLACE_CONTRACT_ID = "CDVRK7PYX6E2EKV2FM333MSJ4PL6IXYUPRICAB6C4ZAGTBV72PJA62IS";
