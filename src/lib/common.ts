// export const BASE_URL = "https://app.action-tokens.com/";
// export const BASE_URL = "http://localhost:3000";
export const BASE_URL = process.env.NODE_ENV === "production" ? "https://app.action-tokens.com/" : "https://funnier-jeni-qualmishly.ngrok-free.dev/";
export const EXPRESS_SERVER_URL = "https://portal.actn.xyz/actionverse/api/"

// Bounty escrow Soroban contract ID.
// TODO: Replace with the actual contract ID after deploying the contract.
export const BOUNTY_ESCROW_CONTRACT_ID = "CC6LOIHN7I5JY6FAHSAXIPLAXFGEKBRNQIPERPTVI72YINPPEYJ6EE44";
