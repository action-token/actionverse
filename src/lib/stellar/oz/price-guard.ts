/**
 * Guards against a creator's edit (`nft.update`) landing between a buyer's
 * `getBuyEditionXDR` call and their signature. Once an edition is
 * registered on-chain, `buy_edition` charges whatever `EditionPrices`
 * holds *at execution time* — not what the database said when the XDR was
 * built — so a stale read here would let a buyer sign a transaction that
 * silently charges something the UI never showed them. See
 * docs/superpowers/specs/2026-08-24-edition-price-editing-design.md,
 * "A pre-existing race this feature turns real".
 *
 * Kept dependency-free (no Stellar SDK, no env access) so it's cheaply
 * unit-testable and safe to import from a router without pulling in the
 * chain-client module's own side-effecting imports.
 */
export function priceStillMatchesOnChain(
  dbPriceRaw: bigint,
  onChainPrices: { payment_token: string; price: bigint }[],
  paymentTokenAddr: string,
): boolean {
  const onChainEntry = onChainPrices.find((p) => p.payment_token === paymentTokenAddr);
  return onChainEntry !== undefined && onChainEntry.price === dbPriceRaw;
}
