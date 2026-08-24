import { describe, expect, it } from "vitest";
import { priceStillMatchesOnChain } from "./price-guard";

describe("priceStillMatchesOnChain", () => {
  const ASSET_TOKEN = "CASSETADDR000000000000000000000000000000000000000000";
  const USD_TOKEN = "CUSDADDR0000000000000000000000000000000000000000000000";

  it("returns true when the DB price matches the on-chain price for that currency", () => {
    const onChain = [{ payment_token: ASSET_TOKEN, price: 1_0000000n }];
    expect(priceStillMatchesOnChain(1_0000000n, onChain, ASSET_TOKEN)).toBe(true);
  });

  it("returns false when the on-chain price has changed", () => {
    const onChain = [{ payment_token: ASSET_TOKEN, price: 2_0000000n }];
    expect(priceStillMatchesOnChain(1_0000000n, onChain, ASSET_TOKEN)).toBe(false);
  });

  it("returns false when the currency isn't in the on-chain price grid at all", () => {
    const onChain = [{ payment_token: USD_TOKEN, price: 1_0000000n }];
    expect(priceStillMatchesOnChain(1_0000000n, onChain, ASSET_TOKEN)).toBe(false);
  });

  it("ignores unrelated currencies in a multi-entry price grid", () => {
    const onChain = [
      { payment_token: USD_TOKEN, price: 9_0000000n },
      { payment_token: ASSET_TOKEN, price: 1_0000000n },
    ];
    expect(priceStillMatchesOnChain(1_0000000n, onChain, ASSET_TOKEN)).toBe(true);
  });
});
