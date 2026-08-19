# VIP Ticket NFT: locked media unlocked by per-token AR pin collection

## Implementation status (update as work lands)

- ✅ §1 data model — migrated via `prisma db push` (this project uses
  `db push`, not `migrate dev`; see `package.json`'s `db:push` script and
  the sparse/stale `prisma/migrations` history).
- ✅ §2 backend: `nft.create` accepts `lockedMedia`/`unlockLocationPoints`;
  `ensureTokenUnlockPinSet` is wired into `confirmBuyEdition` (one pin set
  per newly-minted token, `approved: true` so it isn't stuck in the admin
  moderation queue) and its created `LocationGroup` is invisible to
  everyone except its buyer — enforced in `gameRouter.getPins`,
  `pages/api/game/locations/index.ts`, and `consumePin` alike (the last one
  matters even though the first two hide it from listings, since a direct
  call with a learned `pinId` would otherwise still work); `unlockStatus`
  and `listGated` queries exist; `byId` exposes the rule's shape and the
  reward's outline (never `url`) pre-unlock; resale is blocked server-side
  in `getListXDR`/`getListBatchXDR` via `requireResaleAllowed`.
- ✅ §0 smart contract (`contracts/nft_oz/src/lib.rs`): `UnlockAuthority`
  role, `unlock_token_for`/`is_unlocked`/`set_unlock_authority` added
  exactly as designed below, `CONTRACT_VERSION` bumped to 4, 6 new tests
  (authority-only, idempotent, no sibling-token bleed, rotation) — `cargo
  test` passes 54/54. **Deployed and fully wired (2026-08-19):** the live
  testnet contract (`CD3LMEHJG2AA5IZDGQB6O6HL2XPKU5WMXEGPRV25JY4Q4K2EBRK26N4S`,
  `src/lib/common.ts`'s `ART_NFT_CONTRACT_ID`) was upgraded in place — no
  existing tokens/listings affected — `set_unlock_authority` was called
  (the `MOTHER_SECRET` key, per instruction, serves as both deployer and
  unlock authority — no separate `UNLOCK_AUTHORITY_SECRET`), bindings were
  regenerated, and `consumePin` in `src/server/api/routers/game.ts` now
  calls the new `unlockTokenFor()` helper (`src/lib/stellar/oz/nft.ts`)
  right after a multi-pin group's last location is collected, persisting
  `onChainUnlockedAt`/`onChainUnlockTxHash`. Verified end-to-end through
  the real app twice (not just direct contract calls): buy → collect all
  required pins → `is_unlocked()` flips `true` on-chain automatically,
  with a real tx hash recorded. **Note found along the way:** an
  *unrelated, unused* decoy contract (referenced only by a dead
  `NEXT_PUBLIC_NFT_MARKETPLACE_CONTRACT_ID` env var nothing reads) had a
  contract-migration bug — `Ownable`'s owner was never bootstrapped after
  an earlier refactor, permanently locking every owner-gated call
  including future upgrades. Confirmed this does **not** affect the real
  contract (its owner was always correctly set); redeployed a throwaway
  replacement for the decoy since it was already touched, but it isn't
  referenced by anything. `unlockStatus`'s `unlocked` flag is still
  decided by the DB (collected pins vs. required) — that remains correct
  and unchanged; the on-chain flag is now an independently-verifiable
  *record* of the same fact, not a new gate.
- ✅ §2 backend: fixed a real bug found in production use —
  `ensureTokenUnlockPinSet` used to run inside `confirmBuyEdition`'s
  `$transaction`, once per newly-minted token; for any decent purchase
  quantity that blew past Prisma's interactive-transaction timeout
  ("Transaction not found"). It now runs after the transaction commits,
  with the rule/edition metadata fetched once instead of per token, and
  `unlockStatus` lazily self-heals a token that ended up with no pin set.
- ✅ §5 frontend: `src/pages/smart-contract/[id].tsx` is now the **one buy
  page for every NFT**, gated or not, replacing `src/pages/nft/[id].tsx`
  (still on disk but no longer linked from anywhere — `NftCard`'s href is
  unconditionally `/smart-contract/[id]` now). It shows `ResaleBuyCard`
  for a resold copy or `PrimaryBuyCard` otherwise (both exported from
  `nft-detail-view.tsx`), plus the gated-only sections (unlock
  requirement, locked-content teaser/reveal, unlock progress) which
  simply don't render for an ordinary item. `src/pages/smart-contract/index.tsx`
  is the gated-tickets browse page. Resale controls are hidden on the
  *existing* manage page (`nft-detail-view.tsx`'s `ManagePriceCard`) for
  any edition with a location rule, via a `resaleBlocked` prop — note
  resale is only blocked when a *location rule* is set
  (`unlockRuleType`), not merely for having locked content; a ticket with
  reward content but no rule can be resold freely since owning it is the
  only requirement either way.
- ✅ §3 creation UI: the create-modal's steps now match the requested
  order exactly — Details (title/description/thumbnail only, no separate
  content upload — the thumbnail *is* the item's content) → Pricing
  (royalty/supply/price) → Locked Content (**required**, not optional —
  drag-and-drop `MediaDropzone` per song/image/video row, `react-dropzone`
  based, plus a validated link input for "Other") → Unlock Rule
  (**optional** — `UnlockLocationPicker`, a real embedded Google Map with
  search-to-add and click-to-add, no non-functional radius control).
  `unlockStatus` was fixed to match: "gated" now means "has locked
  content," with the location rule as an optional *extra* requirement on
  top of that — a ticket with content but no rule unlocks immediately for
  any owner instead of never unlocking.
- ✅ **§2b resale for gated tickets.** Client resolved the open resale
  question (2026-08-19): resale is allowed for gated tokens, and a
  token's unlock progress travels with it on sale (never resets; an
  already-unlocked token stays unlocked for its new owner). Implemented:
  `requireResaleAllowed` removed (listing a gated token is no longer
  blocked); `confirmBuy`/`confirmBuyBatch` re-point the token's
  `LocationGroup.restrictedToUserId` to the new buyer in the same
  transaction as the ownership transfer; `unlockStatus`'s `collected`
  count is scoped to the group instead of the querying user, so history
  from a previous owner still counts; `ManagePriceCard`'s now-dead
  `resaleBlocked` prop removed. **Not done**: §2b step 6, a per-listing
  progress badge on `ResaleBuyCard` so a buyer can see "4/10 collected"
  or "Unlocked" before buying a resold gated token — that card currently
  pools resale listings into a plain "buy N cheapest" flow with no
  per-token detail, so this would need a small UX redesign of that
  component, not just a badge; left for a follow-up if wanted.

## Confirmed use case

A "VIP Ticket" is a normal smart-contract NFT edition. A creator can
optionally attach:

1. **Locked content** — one or more uploaded media files (song, image,
   video…), hidden from everyone until unlocked.
2. **An unlock rule** (optional, currently one type: "visit N locations").
   The creator picks N locations on a map once, as a template (e.g. Dhaka,
   Comilla, Barishal, Sylhet). **Every individual minted copy gets its own
   private, full copy of those N locations** — buying 4 copies of a
   4-location ticket drops 4×4 = 16 pins total (4 in each city), not 4.
   Each copy unlocks its own reward independently once *its own* 4 pins
   are collected. Pins can be collected in any order — no sequencing.

Buying is unaffected by whether a rule exists: minting happens at purchase
time exactly as it does today, for gated and ungated editions alike, in
any quantity. The rule only gates *content visibility*, never ownership.

**Resale, resolved (2026-08-19):** the client answered the open question —
resale is **allowed** for gated tokens, and a token's unlock progress
**travels with it, unchanged**, when it's resold:

- If a token is already fully unlocked when its owner resells it, the
  buyer receives it already unlocked — the reward stays revealed for
  whoever owns the token now, no re-collecting required.
- If a token is only partially collected (e.g. 4 of 10 locations) when
  resold, the buyer picks up at 4/10, not 0/10 — progress is **never
  reset** by a sale.

This replaces the earlier "hide resale entirely for gated tokens" decision
below §2 (`requireResaleAllowed`) — see "§2b Resale for gated tickets" for
the implementation. Ungated editions are unaffected either way.

This is different from the existing `LocationGroup`/`Location` campaigns
used elsewhere in the app today, which are shared, public, first-come pools
with a global consumption cap. Those stay completely unchanged for their
existing uses (hotspots, redeem drops, etc.); this feature adds a private,
per-token variant on top of the same tables rather than replacing anything.

**Contract change, confirmed**: the pin-collection check itself can never
happen on-chain — Soroban has no way to verify real-world GPS location, so
the backend necessarily remains the party attesting "this token's pins were
collected." What *does* move on-chain is the **result** of that
attestation: once a token's rule is completed, the backend calls a new
contract entrypoint that permanently records "this token is unlocked" on
the ledger — a public, tamper-evident fact anyone can verify independent
of trusting our database, even though the underlying GPS/pin-collection
check that triggered it is still off-chain. See §0.

## 0. Smart contract (`contracts/nft_oz/src/lib.rs`)

Add a minimal, owner-rotatable **unlock authority** role, separate from the
existing `Ownable` owner. Reusing `#[only_owner]` for this would be wrong:
the owner key is presumably cold/rarely-used (it can pause and upgrade the
whole contract), while unlocking needs to be called automatically by the
backend every time a token finishes collecting its pins — a hot key that
should only ever be able to do this one thing, nothing else.

Keyed by **`token_id` alone** — not edition, not owner. The rule is now a
per-copy thing, so the flag belongs to the specific token: once a token's
pins are all collected, `Unlocked(token_id)` flips to `true` and stays
that way (resale of the *unlocked* flag itself isn't a concern to solve
now, since resale is hidden entirely for gated tokens — see above).

```rust
// DataKey — two new variants
UnlockAuthority,
Unlocked(u32), // token_id -> bool, permanent once true

// New error
NotUnlockAuthority = 323,
```

```rust
// New event
#[contractevent]
pub struct ContentUnlocked {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub owner: Address, // resolved from Consecutive::owner_of at call time, for indexers
}
```

Constructor gets one new parameter, `unlock_authority: Address`, stored at
deploy — cheap to add now since (per the client's original message) this
hasn't gone to mainnet yet; if it's already on testnet, `Upgradeable`
(already implemented) plus a new `set_unlock_authority` lets it be added
without a new contract address.

```rust
#[only_owner]
pub fn set_unlock_authority(e: &Env, new_authority: Address) {
    e.storage().instance().set(&DataKey::UnlockAuthority, &new_authority);
}

/// Called by the backend once it has independently verified (off-chain)
/// that this specific token's pin set was fully collected. Idempotent —
/// calling it again for an already-unlocked token is a no-op, not an
/// error, so a retried backend call after a dropped response is safe.
pub fn unlock_token_for(e: &Env, caller: Address, token_id: u32) {
    caller.require_auth();
    let authority: Address = e.storage().instance().get(&DataKey::UnlockAuthority)
        .unwrap_or_else(|| panic_with_error!(e, ArtError::NotUnlockAuthority));
    if caller != authority {
        panic_with_error!(e, ArtError::NotUnlockAuthority);
    }

    let key = DataKey::Unlocked(token_id);
    if e.storage().persistent().get::<_, bool>(&key).unwrap_or(false) {
        return; // already unlocked — idempotent
    }
    e.storage().persistent().set(&key, &true);
    e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

    let owner = Consecutive::owner_of(e, token_id);
    ContentUnlocked { token_id, owner }.publish(e);
}

/// Public, permissionless read — anyone can verify on-chain whether a
/// given token has been unlocked, without trusting the backend's word.
pub fn is_unlocked(e: &Env, token_id: u32) -> bool {
    e.storage().persistent().get(&DataKey::Unlocked(token_id)).unwrap_or(false)
}
```

**Backend signing key**: `unlock_token_for` needs its own funded Stellar
keypair distinct from `STORAGE_SECRET` (the existing pin-reward payout
account used by `ClaimXDR` in `src/lib/stellar/map/claim.ts`) — different
trust boundary, so a new `UNLOCK_AUTHORITY_SECRET` env var, validated in
`src/env.js` the same way `STORAGE_SECRET` is today. Its public key is
what gets passed as `unlock_authority` at deploy (or into
`set_unlock_authority` post-deploy).

Existing tests in `contracts/nft_oz/src/test.rs` need a matching
`unlock_authority` constructor arg threaded through the test setup helper,
plus new cases: only the unlock authority can call `unlock_token_for`
(others panic with `NotUnlockAuthority`), it's idempotent on a repeat call,
and `is_unlocked` reads back `false`/`true` correctly before/after, keyed
per token id (unlocking token A does not unlock token B from the same
edition).

## 1. Data model (`prisma/schema.prisma`)

**Locked media** — a creator attaches several files, each already uploaded
to S3 via the existing uploader. One set per edition (the reward content
itself doesn't multiply per copy — every unlocked copy reveals the same
media list):

```prisma
enum NftLockedMediaType {
  SONG
  IMAGE
  VIDEO
  OTHER
}

model NftLockedMedia {
  id        String             @id @default(uuid())
  nftId     String
  nft       Nft                @relation(fields: [nftId], references: [id], onDelete: Cascade)
  url       String             // S3 URL, produced by the existing getSignedURL upload flow
  type      NftLockedMediaType
  label     String?
  sortOrder Int                @default(0)
  createdAt DateTime           @default(now())

  @@index([nftId])
}
```

**Unlock rule template** — the creator's *definition* of the N required
locations, set once per edition. Deliberately its own small table rather
than a generic polymorphic "rule engine": today there's exactly one rule
kind (location-visit). If a second kind is added later (e.g. "hold X
token"), it gets its own table the same way, selected by a new
`Nft.unlockRuleType` value — this keeps today's code simple instead of
building abstraction for rule kinds that don't exist yet.

```prisma
enum NftUnlockRuleType {
  LOCATION_VISIT
}

model Nft {
  ...
  unlockRuleType      NftUnlockRuleType?     // null = no rule, ticket is never gated
  unlockLocationRule  NftUnlockLocationRule?
  lockedMedia         NftLockedMedia[]
}

model NftUnlockLocationRule {
  id        String                   @id @default(uuid())
  nftId     String                   @unique
  nft       Nft                      @relation(fields: [nftId], references: [id], onDelete: Cascade)
  radius    Float                    @default(30) // meters — how close counts as "visiting" a point
  points    NftUnlockLocationPoint[]
  createdAt DateTime                 @default(now())
}

model NftUnlockLocationPoint {
  id        String                 @id @default(uuid())
  ruleId    String
  rule      NftUnlockLocationRule  @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  label     String?                // e.g. "Dhaka"
  latitude  Float
  longitude Float
  sortOrder Int                    @default(0)
}
```

**Per-token private pin instance** — reuses `LocationGroup`/`Location`/
`LocationConsumer` exactly as they exist today, with new nullable columns
on `LocationGroup` marking an instance as a private, single-token clone of
the rule template:

```prisma
model LocationGroup {
  ...
  restrictedToUserId  String?
  restrictedToUser    User?     @relation("RestrictedPinGroups", fields: [restrictedToUserId], references: [id])
  // One private pin set per minted copy — not per edition, not per buyer.
  unlockForTokenId    String?   @unique
  unlockForToken      NftToken? @relation(fields: [unlockForTokenId], references: [id], onDelete: Cascade)
  // Denormalized for convenience queries ("how many pin sets exist for this
  // edition") without joining through NftToken; not itself a lookup key.
  unlockForNftId      String?
  unlockForNft        Nft?      @relation(fields: [unlockForNftId], references: [id], onDelete: Cascade)
  // Set once this token's collected >= required pins triggers the one-time
  // call to the contract's `unlock_token_for` (see §0). Null until then;
  // present so a retry/cron never double-submits the on-chain call.
  onChainUnlockedAt    DateTime?
  onChainUnlockTxHash  String?
}

model NftToken {
  ...
  unlockPinGroup LocationGroup?
}

model User {
  ...
  restrictedPinGroups LocationGroup[] @relation("RestrictedPinGroups")
}
```

When all of these are null (every `LocationGroup` that exists today),
behavior is completely unchanged. When `unlockForTokenId` is set, the
group is a one-token-only clone: exactly `points.length` `Location` rows
at the rule's exact coordinates (no random scatter), `multiPin: true`
(needed so several distinct locations under the same group can each be
collected independently, with no ordering constraint between them),
`limit`/`remaining` = `points.length` (safe — only the token's owner can
ever consume from it, enforced in §2).

`restrictedToUserId` starts as the buyer at mint time, used for the
AR-visibility filter (§2), but it's a **live pointer, not a snapshot**:
`confirmBuy`/`confirmBuyBatch` re-point it to whoever buys the token next
on resale (§2b), so the visibility filter always tracks current ownership
rather than freezing at first mint.

Migration: `npx prisma migrate dev --name nft-unlock-rule-and-locked-media`
— additive only, safe on existing data.

## 2. Backend

### `src/server/api/routers/nft.ts`

- **`create`**: extend the input with
  ```ts
  lockedMedia: z.array(z.object({
    url: z.string().url(),
    type: z.enum(["SONG", "IMAGE", "VIDEO", "OTHER"]),
    label: z.string().optional(),
  })).max(20).default([]),
  unlockLocationPoints: z.array(z.object({
    lat: z.number(), lng: z.number(), label: z.string().optional(),
  })).max(20).optional(),
  unlockRadius: z.number().positive().max(1000).default(30),
  ```
  Create `lockedMedia` as a nested `create` (same pattern as `prices`).
  If `unlockLocationPoints` is provided and non-empty, also set
  `unlockRuleType: "LOCATION_VISIT"` and nested-create
  `unlockLocationRule: { create: { radius: unlockRadius, points: { create: [...] } } }`.
  If omitted/empty, the ticket is simply ungated — no other behavior changes.

- **Shared helper, `ensureTokenUnlockPinSet(tx, nftId, tokenId, ownerId)`**
  — creates one private pin set for **one specific minted token**, not
  once per purchase. Called once per `tokenId` in `confirmBuyEdition`'s
  freshly-minted range, so buying quantity 4 of a 4-location-rule ticket
  calls this 4 times → 4 independent pin sets → 16 pins total, one full
  4-location set per copy:
  ```ts
  async function ensureTokenUnlockPinSet(tx: PrismaTx, nftId: string, nftTokenId: string, ownerId: string) {
    const rule = await tx.nftUnlockLocationRule.findUnique({
      where: { nftId }, include: { points: true },
    });
    if (!rule) return; // ungated edition — nothing to do

    const existing = await tx.locationGroup.findUnique({
      where: { unlockForTokenId: nftTokenId },
      select: { id: true },
    });
    if (existing) return; // idempotent — safety net against a retried transaction

    const nft = await tx.nft.findUniqueOrThrow({ where: { id: nftId } });
    await tx.locationGroup.create({
      data: {
        creatorId: /* the Nft's creator's Creator row id */,
        unlockForTokenId: nftTokenId,
        unlockForNftId: nftId,
        restrictedToUserId: ownerId,
        title: nft.name, description: nft.description, image: nft.thumbnail,
        startDate: new Date(), endDate: /* +5 years */,
        latitude: rule.points[0].latitude, longitude: rule.points[0].longitude,
        radius: rule.radius,
        multiPin: true,
        limit: rule.points.length, remaining: rule.points.length,
        locations: {
          createMany: {
            data: rule.points.map(p => ({
              latitude: p.latitude, longitude: p.longitude, autoCollect: true,
            })),
          },
        },
      },
    });
  }
  ```

- **`confirmBuyEdition`**: inside the existing `$transaction`, right after
  `tx.nftToken.createMany(...)`, the freshly-minted rows need their own
  ids back (switch that `createMany` to individual `create` calls in a
  loop, or `createMany` + a follow-up `findMany` on the just-inserted
  `tokenId`s, to get each new `NftToken.id`) — then call
  `ensureTokenUnlockPinSet(tx, purchase.nftId, nftTokenRow.id, purchase.buyerId)`
  once per newly-minted token. No wiring needed in `confirmBuy`/
  `confirmBuyBatch` (the resale paths) — see below, resale is blocked
  before it gets that far for gated tokens.

- **Resale hidden for gated tokens** — rather than design what resale
  *should* do to a token's progress (an open question), block it outright
  for now:
  - `getListXDR` and `getListBatchXDR` (`nft.ts:305-329`, `384-409`): after
    the existing `requireOwnedToken` check, load the token's `Nft` and
    reject with `TRPCError({ code: "BAD_REQUEST", message: "Resale isn't
    available yet for tickets with unlock rewards" })` if
    `unlockRuleType` is not null.
  - `src/components/nft/nft-detail-view.tsx`, `mode="manage"`: hide the
    "List for sale" / "List multiple" controls (the ones wired to
    `onListToken`/`onListMultiple` from `src/pages/nft/manage/[id].tsx`)
    entirely when `nft.unlockRuleType` is set, replaced with a short note
    ("Resale isn't available yet for tickets with unlock rewards"). This
    is the actual UI/UX the task asked to hide.
  - Existing listings/`confirmListing`/`confirmBuy` code paths are
    otherwise untouched — this only adds a new rejection at the *listing*
    step, so an already-existing (pre-feature) listing can't exist for a
    newly-gated edition in the first place.

- **New `unlockStatus` query** (`publicProcedure`, input `{ nftId }`) —
  now returns **one entry per owned token**, since each copy unlocks
  independently:
  1. Load `Nft` with `unlockLocationRule.points` and `lockedMedia`. If
     `unlockRuleType` is null → `{ gated: false as const }`.
  2. `required = rule.points.length`.
  3. No session → `{ gated: true, required, tokens: [] }`.
  4. `myTokens = ctx.db.nftToken.findMany({ where: { nftId, ownerId: userId }, select: { id: true, tokenId: true } })`.
  5. For each owned token, load its pin set:
     `ctx.db.locationGroup.findUnique({ where: { unlockForTokenId: token.id } })`.
  6. `collected` = `group ? ctx.db.locationConsumer.count({ where: { userId, location: { locationGroupId: group.id } } }) : 0`
     (guard for `null` rather than crashing, e.g. a narrow window
     mid-transaction).
  7. `unlocked = collected >= required`.
  8. Return
     ```ts
     {
       gated: true, required,
       tokens: myTokens.map(t => ({
         nftTokenId: t.id, onChainTokenId: t.tokenId,
         collected, unlocked,
         lockedMedia: unlocked ? nft.lockedMedia : [],
         onChainUnlockTxHash: group?.onChainUnlockTxHash ?? null,
       })),
     }
     ```

- **On-chain unlock trigger, in `src/server/api/routers/game.ts`'s
  `consumePin`**: right after a `multiPin` collect successfully creates the
  `LocationConsumer` row (the branch at game.ts:258-277), if
  `location.locationGroup.unlockForTokenId` is set: re-count that group's
  consumers; if the new count `>= ` the group's `limit` (i.e. this
  collection just completed the token's requirement) **and**
  `location.locationGroup.onChainUnlockedAt` is still null, call the
  contract's `unlock_token_for(onChainTokenId)` (resolve the numeric
  on-chain id via `NftToken.tokenId` for the group's `unlockForTokenId`)
  signed by `UNLOCK_AUTHORITY_SECRET` (same XDR-build-and-submit shape as
  `ClaimXDR` in `src/lib/stellar/map/claim.ts`, no buyer signature
  needed), then persist `onChainUnlockedAt`/`onChainUnlockTxHash` on the
  group. Wrapped in try/catch so a transient Stellar/RPC failure never
  breaks the pin collection response the buyer is waiting on —
  `onChainUnlockedAt` simply stays null and a retry (either the buyer
  viewing `unlockStatus` again triggering a lazy retry, or a small cron
  sweeping `onChainUnlockedAt: null` groups whose collected count already
  meets their limit) submits it later. Because `unlock_token_for` is
  idempotent on-chain, an accidental double-submit from a retry racing a
  slow-but-successful first call is harmless.

### Pin privacy enforcement — the actual security-critical part

Two places list pins for the AR/map view today, and both need the same new
filter (they duplicate the same query logic, pre-existing tech debt, not
introduced by this change — just mirrored in both spots):

- `gameRouter.getPins` in `src/server/api/routers/game.ts:58-157`
- `pages/api/game/locations/index.ts:139-176` (`pinsForUser`'s
  `db.locationGroup.findMany` call)

In both, add to the top-level `AND` array:
```ts
{ OR: [{ restrictedToUserId: null }, { restrictedToUserId: userId }] }
```
so a restricted group is invisible to everyone except the one buyer it
belongs to; every pre-existing (unrestricted) group is unaffected.

`consumePin` in `src/server/api/routers/game.ts:216-394`: right after
`location.locationGroup` is loaded (line ~254), add:
```ts
if (location.locationGroup.restrictedToUserId &&
    location.locationGroup.restrictedToUserId !== userId) {
  throw new TRPCError({ code: "FORBIDDEN", message: "This pin belongs to someone else" });
}
```
This is the actual enforcement — without it, a user who somehow learned
another buyer's `pinId` (e.g. from a shared screenshot) could collect it
server-side even though the map/list already hides it from them.

No changes needed to `pinRouter.createPin` itself — it's not called for
this feature at all (see §3: point-picking happens in the NFT form, and
the private per-token clone is created directly in `confirmBuyEdition`,
not via `createPin`'s random-scatter path).

### §2b. Resale for gated tickets — progress travels with the token

✅ **Implemented** (steps 1-5 below; step 6 is a follow-up, not done).
Supersedes the "resale hidden" decision above.
No schema or contract changes needed — `LocationGroup.unlockForTokenId`
(per-token, unique) and `.restrictedToUserId` already give each token its
own independent pin set and its own "who can currently collect it" flag;
this just stops blocking the sale and keeps those columns in sync with
whoever owns the token at any moment, instead of freezing them at mint.

1. **Stop blocking the listing.** Delete `requireResaleAllowed` (nft.ts:98)
   and its two call sites in `getListXDR` (nft.ts:519) and
   `getListBatchXDR` (nft.ts:600). A gated token can be listed exactly
   like an ungated one — no new validation needed at listing time, since
   nothing about listing itself needs to know the unlock state.

2. **Transfer the pin set's ownership alongside the token, atomically, in
   both purchase-confirmation transactions:**
   - `confirmBuy` (nft.ts:753-771) — right next to the existing
     `tx.nftToken.update({ where: { tokenId }, data: { ownerId: buyerId } })`,
     add
     ```ts
     await tx.locationGroup.updateMany({
       where: { unlockForTokenId: input.tokenId },
       data: { restrictedToUserId: buyerId },
     });
     ```
     (`updateMany` on purpose, not `update` — an ungated token has no
     matching group, and `updateMany` is a no-op instead of throwing
     `NOT_FOUND` in that case.)
   - `confirmBuyBatch` (nft.ts:805-831) — same `updateMany`, once per
     `listing.tokenId` inside the existing per-listing loop.
   - Effect: the moment a resale confirms, the seller loses visibility
     into (and the ability to collect for) that token's pins — they no
     longer pass the `restrictedToUserId === userId` check in
     `gameRouter.getPins`, `pages/api/game/locations`, or `consumePin` —
     and the buyer immediately gains it, picking up wherever collection
     was left off.

3. **Stop scoping "collected" to whoever physically visited each pin —
   scope it to the token's group instead**, so history from a previous
   owner still counts. In `unlockStatus` (nft.ts:1165-1169), change
   ```ts
   const collected = group
     ? await ctx.db.locationConsumer.count({
         where: { userId, location: { locationGroupId: group.id } },
       })
     : 0;
   ```
   to drop the `userId` filter:
   ```ts
   const collected = group
     ? await ctx.db.locationConsumer.count({
         where: { location: { locationGroupId: group.id } },
       })
     : 0;
   ```
   Safe to do unconditionally: a restricted group only ever has one
   `restrictedToUserId` valid at a time, so `consumePin`'s existing
   ownership check already guarantees every `LocationConsumer` row under
   this group was collected by whoever legitimately held the token at the
   moment they collected it — counting all of them, not just the
   *current* owner's own, is exactly what "progress isn't reset by a
   sale" means in practice.

4. **Already-unlocked tokens need no special-casing.** `unlocked =
   collected >= required` is derived purely from the group's state, not
   from who's asking — so a fully-collected token already reads as
   `unlocked: true` (reward included) for whichever account owns it after
   step 2 runs, automatically.

5. **Remove the UI hard-block.** `ManagePriceCard`'s `resaleBlocked` prop
   and its one caller, `resaleBlocked={hasLocationRule}` in
   `src/pages/smart-contract/manage/[id].tsx`, go back to always `false`
   (or drop the prop entirely if nothing else will ever need it) — list/
   cancel controls render for gated tokens exactly like ordinary ones.

6. **Recommended, not asked for but worth doing alongside this:** a buyer
   evaluating a resale listing for a gated ticket currently has no way to
   tell whether they're buying a fresh 0/N token or one already sitting at
   4/10 (or already fully unlocked). Surface `unlockStatus`'s per-token
   `collected`/`required`/`unlocked` as a small badge on `ResaleBuyCard`
   (`src/components/nft/nft-detail-view.tsx`) next to each listed token's
   price, so "already unlocked" or "6/10 collected" is visible before
   purchase rather than a surprise after.

7. **Docs/comments to fix once this lands:** `requireResaleAllowed`'s own
   doc comment (nft.ts:90-97), the `restrictedToUserId`/`unlockForTokenId`
   comments in `prisma/schema.prisma` and §1 above that describe it as "a
   snapshot at mint time" (it's now a live pointer, updated on every
   resale), and this file's "Confirmed use case" section (done above).

## 3. Frontend — creation flow (`src/components/modal/nft-create-modal.tsx`)

Re-order/extend `SmartContractNftForm`'s steps to match the requested flow:

1. **Details** — title, description, thumbnail (unchanged).
2. **Pricing** — royalty, supply, price grid for XLM + platform asset
   (today's second step, unchanged).
3. **Locked Content** — repeatable rows, "+ Add media": each row has a
   kind selector (Song / Image / Video / Other), an `UploadS3Button` with
   `endpoint` chosen from the kind (`musicUploader` for Song,
   `imageUploader` for Image, `videoUploader` for Video, `multiBlobUploader`
   for Other), and an optional label field. On upload success, the row's
   `url` is filled from `onClientUploadComplete`. Optional step — can be
   skipped entirely (ticket just has no locked content).
4. **Unlock Rule** (optional, toggle: "Require visiting locations to
   unlock — applies separately to every copy sold"). When on:
   - A map (same `@vis.gl/react-google-maps` + `CustomMapControl` +
     places-autocomplete `Input` already used in
     `creator-create-pin-modal.tsx`) with a search box. Each time the
     creator searches/selects a place, "+ Add this location" appends
     `{ lat, lng, label }` to a list shown below the map (repeatable rows,
     each removable) — this is how "user can add multiple locations" is
     satisfied: explicit creator-picked points, not a random scatter.
   - A radius input (default 30m — "how close counts as visiting").
   - At least 1 point required once the toggle is on; no upper practical
     limit but capped at 20 server-side.
   - A short note reminding the creator this rule template is cloned once
     per copy sold, so supply × N locations pins will exist in total.
   - No call to `pinRouter.createPin` here — nothing pin-related exists
     yet at creation time; the points are just plain data passed into
     `nft.create` as `unlockLocationPoints`.

Submit calls `nft.create` once with `lockedMedia` and, if the toggle was
on, `unlockLocationPoints`/`unlockRadius`. Exactly as today, this creates
the `Nft` row with `status: "PENDING"` and **does not mint anything** —
first mint still happens lazily on first purchase, unchanged.

## 4. Frontend — buy flow

No changes to `getBuyEditionXDR`/`confirmBuyEdition` call sites in the
client — buying N copies of a gated or ungated ticket looks identical to
the buyer. Each copy's private pin set is created as a side effect of
`confirmBuyEdition` on the server (§2); the client doesn't need to know
about it at buy time, and doesn't need to know quantity N means N× the
pins either.

## 5. Frontend — detail/unlock page (`src/components/nft/nft-detail-view.tsx`)

Add `UnlockProgressCard`, rendered when `nft.unlockRuleType` is set, backed
by `api.nft.unlockStatus.useQuery({ nftId })`. Because unlock is per-token
now, this renders **one row per owned copy**, not one aggregate:

- Not gated → render nothing.
- Gated, owns zero tokens → "Buy this ticket to start collecting" (no
  counts shown pre-purchase).
- Gated, owns N tokens → one row per token: "`collected` of `required`
  locations collected" + a button linking to the pins/map page for tokens
  still in progress; for a token that's `unlocked`, render its
  `lockedMedia` inline instead (audio player for `SONG`, image for
  `IMAGE`, video tag for `VIDEO`, plain "Open" link for `OTHER`). Because
  of the §2 visibility filter, the pins/map page naturally shows only
  pins belonging to the current user across all their tokens.
- **Resale controls** (`mode="manage"` only): when `nft.unlockRuleType`
  is set, don't render the "List for sale"/"List multiple" buttons at
  all — replace with "Resale isn't available yet for tickets with unlock
  rewards." Cancel-listing stays available in case an old listing somehow
  exists (shouldn't, per the new §2 guard, but exiting a position should
  never be blocked).

No changes needed to `src/pages/pins/index.tsx` or
`src/components/modal/claim-pin-modal.tsx` beyond what §2 already covers —
collection UI is unchanged; it just now also renders private pins to their
owner and no one else.

## Verification

1. `cargo test` in `contracts/nft_oz` — new cases pass (only the unlock
   authority can call `unlock_token_for`, it's idempotent, `is_unlocked`
   reads back correctly per-token, unlocking one token doesn't unlock a
   sibling token from the same edition, all pre-existing tests still pass
   with the new constructor arg threaded through).
2. Build + deploy (or `upgrade`, if already on testnet) the updated wasm to
   testnet; confirm `version()` reports the bumped `CONTRACT_VERSION`, and
   `set_unlock_authority`/`unlock_token_for`/`is_unlocked` are callable
   from a throwaway script before wiring the backend to them.
3. `npx prisma migrate dev` runs clean; inspect new tables/columns in
   `npx prisma studio`.
4. `pnpm tsc --noEmit` across touched files — zero new errors vs. baseline.
5. Manual, dev server + testnet wallet:
   - Create a VIP ticket, supply ≥ 4, with 2 locked media items and a
     4-location unlock rule (Dhaka, Comilla, Barishal, Sylhet — or 4 test
     coordinates near the device).
   - Confirm it lists on the marketplace identically to an ungated NFT.
   - Buy 4 copies in **one purchase**. Confirm **16** `Location` rows
     exist in total (4 independent `LocationGroup`s, one per token, 4
     locations each) — not 4. Confirm `unlockStatus` returns 4 entries,
     each `{ collected: 0, required: 4, unlocked: false }`.
   - Confirm the AR/pins view shows all 16 pins (4 markers in each of the
     4 places), all attributable back to this buyer only.
   - Collect all 4 pins for **token #1 only**, in a deliberately scrambled
     order (e.g. Sylhet, then Dhaka, then Barishal, then Comilla — not the
     order the creator entered them). Confirm token #1 flips to
     `unlocked: true` with both locked media items visible/playable, while
     tokens #2–#4 remain `unlocked: false` with `collected: 0` — no
     ordering requirement, and no cross-token bleed.
   - Confirm token #1's unlock triggered the on-chain call: within a few
     seconds, its entry in `unlockStatus` shows a non-null
     `onChainUnlockTxHash`, and calling the contract's
     `is_unlocked(onChainTokenId)` directly (e.g. via `stellar contract
     invoke` or a scratch script) returns `true` for token #1's on-chain
     id and `false` for tokens #2–#4's.
   - **Resale hidden**: on the manage page for this gated NFT, confirm no
     "List for sale"/"List multiple" controls render for any of the 4
     tokens (including the now-unlocked token #1), and that
     `getListXDR`/`getListBatchXDR` reject with `BAD_REQUEST` if called
     directly against one of these token ids. Confirm an ungated NFT's
     manage page is unaffected — its list controls still work exactly as
     today.
