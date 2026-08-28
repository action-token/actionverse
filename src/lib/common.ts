import { env } from "~/env";

const IS_PUBNET = env.NEXT_PUBLIC_STELLAR_PUBNET;

export const BASE_URL = process.env.NODE_ENV === "production" ? "https://app.action-tokens.com/" : "https://development.d2zw8dm3mms6ad.amplifyapp.com/";
export const EXPRESS_SERVER_URL = "https://portal.actn.xyz/actionverse/api/"

// Bounty escrow Soroban contract ID — testnet for dev, mainnet for prod.
export const BOUNTY_ESCROW_CONTRACT_ID = IS_PUBNET
  ? "CBTALUV2T6FRODHLQIT5MRD6SVXOQ5NTURYY5EFS5NWTCZ6ZLKJCJGXW"
  : "CDVOU7U6H5CPUHW457T2TG22RQVHAAW5F4EQAPQ57ZUETGLVCUMRRYJS";

// Shared art NFT collection contract — one deployed instance, same address
// on both networks, for both bandfan and actionverse. Neither app gets its
// own contract; a shared owner/treasury key administers it for both (see
// `PLATFORM_TREASURY_ADDRESS` below — identical on both apps, both networks).
//
// Pubnet points at CCL6VMDO... (deployed 2026-08-27, CONTRACT_VERSION 1),
// bandfan's fresh redeploy — not actionverse's own. Nothing minted under the
// previous CBLPHBNZ... instance carries over; that contract is abandoned, not
// migrated, same as when CBLPHBNZ... itself replaced CCOWJ2FV... before it.
// Deliberate: a second, actionverse-only deploy was considered and rejected
// — no reason to pay for two contracts when one already serves both apps.
export const ART_NFT_CONTRACT_ID = IS_PUBNET
  ? "CCL6VMDOPOTG636HORVFCC6K22SXBOGFWS4GPWCYHIQFTVUDIGJ2R6FO"
  : "CD3LMEHJG2AA5IZDGQB6O6HL2XPKU5WMXEGPRV25JY4Q4K2EBRK26N4S";

// Account that collects the platform's cut of every sale. Testnet uses the
// MOTHER account; set a dedicated treasury before deploying to pubnet rather
// than routing real fee income through the operational key.
export const PLATFORM_TREASURY_ADDRESS = IS_PUBNET
  ? "GDDMDIXFTWQ6VEPQAGOW3E7TBRP473D27BRO7VGHAQIRQAETUR56L6RG"
  : "GCIRB3GJI5PKOW7BUFERNGVB5DMMQT3RCD2I4Z7W4R4F4ED7QTL2K7HU";
