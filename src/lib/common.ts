import { env } from "~/env";

const IS_PUBNET = env.NEXT_PUBLIC_STELLAR_PUBNET;

export const BASE_URL = process.env.NODE_ENV === "production" ? "https://app.action-tokens.com/" : "https://funnier-jeni-qualmishly.ngrok-free.dev/";
export const EXPRESS_SERVER_URL = "https://portal.actn.xyz/actionverse/api/"

// Bounty escrow Soroban contract ID — testnet for dev, mainnet for prod.
export const BOUNTY_ESCROW_CONTRACT_ID = IS_PUBNET
  ? "CBTALUV2T6FRODHLQIT5MRD6SVXOQ5NTURYY5EFS5NWTCZ6ZLKJCJGXW"
  : "CDVOU7U6H5CPUHW457T2TG22RQVHAAW5F4EQAPQ57ZUETGLVCUMRRYJS";

// Shared 1-of-1 art collection contract — testnet for dev, mainnet for prod.
// Fill these in from `pnpm contracts:deploy`, which prints both values.
export const ART_NFT_CONTRACT_ID = IS_PUBNET
  ? ""
  : "CAHBL3WCXHAMRYQX5XKVHTGDQVYLKXSC4T37WPKCCEM7QLUMQRJJINBV";

// Wasm hash of `ft_oz`. Uploaded once per network; every edition deploys its
// own contract instance from this hash, so it is a content id, not an address.
export const ART_EDITION_WASM_HASH = IS_PUBNET
  ? ""
  : "307d54cb276e3c4b759fa55385d5753630b62faf7c9205182297244a80ca62c5";

// Account that collects the platform's cut of every sale. Testnet uses the
// MOTHER account; set a dedicated treasury before deploying to pubnet rather
// than routing real fee income through the operational key.
export const PLATFORM_TREASURY_ADDRESS = IS_PUBNET
  ? ""
  : "GCIRB3GJI5PKOW7BUFERNGVB5DMMQT3RCD2I4Z7W4R4F4ED7QTL2K7HU";
