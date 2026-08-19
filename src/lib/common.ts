import { env } from "~/env";

const IS_PUBNET = env.NEXT_PUBLIC_STELLAR_PUBNET;

export const BASE_URL = process.env.NODE_ENV === "production" ? "https://app.action-tokens.com/" : "https://development.d2zw8dm3mms6ad.amplifyapp.com/";
export const EXPRESS_SERVER_URL = "https://portal.actn.xyz/actionverse/api/"

// Bounty escrow Soroban contract ID — testnet for dev, mainnet for prod.
export const BOUNTY_ESCROW_CONTRACT_ID = IS_PUBNET
  ? "CBTALUV2T6FRODHLQIT5MRD6SVXOQ5NTURYY5EFS5NWTCZ6ZLKJCJGXW"
  : "CDVOU7U6H5CPUHW457T2TG22RQVHAAW5F4EQAPQ57ZUETGLVCUMRRYJS";

// Shared art NFT collection contract — testnet for dev, mainnet for prod.
// Fill these in from `pnpm contracts:deploy`, which prints the value.
export const ART_NFT_CONTRACT_ID = IS_PUBNET
  ? "CCOWJ2FVOQNOB3L6XS46EDWDKABRAUNEHVMALS35STOUMOND5SH4EIFZ"
  : "CD3LMEHJG2AA5IZDGQB6O6HL2XPKU5WMXEGPRV25JY4Q4K2EBRK26N4S";

// Account that collects the platform's cut of every sale. Testnet uses the
// MOTHER account; set a dedicated treasury before deploying to pubnet rather
// than routing real fee income through the operational key.
export const PLATFORM_TREASURY_ADDRESS = IS_PUBNET
  ? "GDDMDIXFTWQ6VEPQAGOW3E7TBRP473D27BRO7VGHAQIRQAETUR56L6RG"
  : "GCIRB3GJI5PKOW7BUFERNGVB5DMMQT3RCD2I4Z7W4R4F4ED7QTL2K7HU";
