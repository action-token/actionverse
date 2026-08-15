# Soroban Art Contract — Architecture

One OpenZeppelin-based Soroban contract, `nft_oz`, backs the smart-contract
side of the marketplace: a single shared 1-of-1 collection (`NonFungibleToken`
+ Burnable, Royalties). The classic-Stellar `Asset`/`MarketAsset` system is
untouched and continues to work exactly as before; this runs alongside it.

A prior version of this app also supported fungible "edition" artworks (an
`ft_oz` contract deployed per artwork). That contract and its frontend/API
support have been removed — the marketplace now only mints 1-of-1 tokens in
the shared collection. `Nft.onChainTokenId` identifies a token; there is no
`kind`/`symbol` split anymore.

## Why the marketplace lives inside the token contract

`nft_oz` embeds `list` / `buy` / `cancel_listing` rather than delegating to a
separate market contract.

A standalone market would need the seller to `approve` it before listing — an
extra signature and an extra failure mode — and the buyer would then need two
independently-revertible transactions to pay and receive. Because settlement
happens *inside* the contract that owns the ledger entries, `buy` is a single
invocation that moves the token via the low-level `Base::update` (the no-auth
path) and pays out in the same call.

**Only the buyer signs a purchase.** The seller's consent was recorded when they
listed. This is covered by `buy_requires_only_the_buyers_signature` in the test
suite.

## Creating: one signature, not two

`mint_and_list(creator, art_ref, art, price, payment_token) -> token_id` mints
a 1-of-1 and lists it atomically. `mint_art` (mint only, no listing) still
exists for programmatic use, but the storefront's create flow calls
`mint_and_list`.

This used to be two separate transactions — mint, then a follow-up `list` —
and that shape was the source of three different bugs (a malformed transaction
from an unchecked simulation failure, a `tx_bad_seq` from a stale account
sequence, and a "no listing found on-chain" from a stale read), all with the
same root cause: the second transaction had to read the first one's effects
back through the public Soroban RPC pool, and that pool doesn't always agree
with itself in the first few seconds after a ledger closes. A read landing on
a lagging node reads stale state, and a transaction built from stale state is
invalid before it even reaches the network.

Folding mint and list into one call doesn't work around that lag — it removes
the second transaction that would have needed to read through it. There is
nothing left to race. `getListXDR`/`confirmListing` still exist and are used
by the manage page for price changes and re-listing after a cancel; they are
no longer part of the create flow.

`confirmMint` reads back both the token id and the listing the same
transaction created, in one confirmation step, retried against RPC lag via
`pollUntilVisible`.

Listings do not escrow, so a seller can move or burn the asset while a listing
is live. `buy` therefore re-checks ownership before paying for something
undeliverable.

## Money

Sales settle in whatever SEP-41 token the listing names — the native XLM SAC by
default. `payment_token` is stored per listing, so a platform token or USDC can
be accepted later without touching the contract.

Each sale splits three ways: platform fee → treasury, royalty → creator, the
rest → seller. Royalty is skipped when the seller *is* the creator, since a
primary sale would otherwise route their own money back to them.

The platform owns the collection contract, so `set_platform_fee` can change it
for all future sales. The fee is capped at 10% and royalties at 50%, enforced
on chain.

## Two constraints worth knowing

**1. Transaction meta cannot be decoded.** This repo's pinned `stellar-sdk`
throws on the meta protocol 27 produces, so `rpc.getTransaction()` can't be used
to read a call's return value (see `contracts/bounty_escrow/README.md`). As a
consequence, `mint_art` takes an `art_ref` (the `Nft` row id) and records
`ref → token_id`, so `confirmMint` resolves the minted id with `token_by_ref`
instead. Minting twice under one ref is rejected, which also makes a retried
mint safe.

Transaction *success* is polled from Horizon, which computes `successful`
server-side and sidesteps the decoder.

**2. A contract function may take at most 10 arguments.** The spec XDR declares
`SCSpecFunctionV0.inputs<10>`. The Rust CLI happily builds and generates
bindings for a 13-argument function, but the JS SDK then refuses to parse the
spec at all and every client call dies with *"saw 13 length VarArray, max
allowed is 10"*. `nft_oz::mint_art` sits at 8 and has little headroom to
spare.

**3. Storage keys collide by name.** `#[contracttype]` enum unit variants are
keyed by their variant name, so a `DataKey::Meta` silently aliases onto
OpenZeppelin's `FungibleStorageKey::Meta`/`NonFungibleStorageKey::Meta` and
corrupts the token's own decimals/name/symbol. This was a real bug, caught by
`art_metadata_does_not_clobber_token_metadata`. Any new key must avoid OZ's
names (`Meta`, `TotalSupply`, `Balance`, `Allowance`, `Owner`, `Approval`,
`ApprovalForAll`, `Metadata`).

**4. A failed simulation is not an exception — it's a malformed transaction
handed back silently.** When a contract call panics during simulation (bad
args, stale reads, ownership mismatches), the JS SDK's `AssembledTransaction`
does not throw. It leaves the transaction in its raw, pre-simulation shape: no
resource fee, no Soroban transaction-data extension. Any `InvokeHostFunction`
operation without that extension is rejected outright by Stellar Core — so the
failure surfaces as an opaque Horizon `tx_malformed` deep inside the user's
wallet, with the real reason (a contract panic like `InvalidAmount`) nowhere
in sight.

This was fixed for one turn by an `assertSimulationSucceeded` guard on every
builder, which checked the simulation result and threw the real panic reason
instead of returning the doomed XDR. **That guard was deliberately removed at
the user's request** — a broken call once again silently produces an
unassembled transaction rather than a clear error at the tRPC layer, exactly
as described above. If this class of bug resurfaces, that guard (or something
like it) is the known fix; it lived in `oz/nft.ts` and was called from every
state-changing builder there.

**Token ids start at 0.** `Base::sequential_mint` returns 0 for the first token,
so `if (tokenId)` is a bug — use `=== null`/`=== undefined`. `onChainTokenId` is
stored as a string, which keeps `"0"` truthy in the UI.

## Setup

```bash
pnpm contracts:test:all                  # nft_oz's test suite
pnpm contracts:build:nft_oz              # needs rustup's toolchain, not Homebrew's
pnpm contracts:bindings:nft_oz
pnpm db:push
pnpm contracts:deploy                    # uploads the Wasm, deploys the collection
```

The build script prefixes `PATH` with `$HOME/.cargo/bin` because Homebrew's
`cargo` shadows rustup's and only the rustup toolchain has the `wasm32v1-none`
std.

Deployed on testnet:

| | |
|---|---|
| Collection | `CAHBL3WCXHAMRYQX5XKVHTGDQVYLKXSC4T37WPKCCEM7QLUMQRJJINBV` |
| Owner / treasury | `GCIRB3GJI5PKOW7BUFERNGVB5DMMQT3RCD2I4Z7W4R4F4ED7QTL2K7HU` (MOTHER) |

`contracts:deploy` is idempotent: it skips a Wasm already uploaded and skips the
collection if `ART_NFT_CONTRACT_ID` already answers, so re-running won't orphan
minted tokens behind a second collection.

It prints `ART_NFT_CONTRACT_ID` to paste into `src/lib/common.ts`, which
switches on `NEXT_PUBLIC_STELLAR_PUBNET` the same way `BOUNTY_ESCROW_CONTRACT_ID`
does. Set `PLATFORM_TREASURY_ADDRESS` there yourself before deploying — the
script reads it from that file.

It starts as an empty string rather than a plausible-looking placeholder:
`requireContractConstant` turns "not deployed yet" into a clear error at the
call site, whereas a real-but-wrong id fails deep inside signing.

The deployer account becomes the collection's owner and is the only key that can
change the platform fee or pause it.
