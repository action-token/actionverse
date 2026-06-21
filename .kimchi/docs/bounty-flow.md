# Actionverse — Bounty Flow

End-to-end map of the bounty feature in `actionverse`. All paths are relative
to the repo root unless noted. Page anchors use 1-based line numbers from the
files as they exist on `main` (2026-06-21).

## 1. What a bounty is

A **bounty** is a public, paid challenge. A creator locks a prize amount
into the platform's escrow ("mother") wallet and publishes a task; users
join, submit work, and the creator picks winners who claim the reward to
their own Stellar wallet.

- Built on **Stellar** for the prize asset (XLM or any credit asset).
- Escrow model: creator → mother wallet → winner (no direct creator→winner
  transfer at claim time).
- Status state machine: `RUNNING` → `PAUSED` / `COMPLETED`.
- Submission state machine: `PENDING` / `APPROVED` / `REJECTED`
  (declared in the enum; selection is currently a separate `BountyWinner`
  row, not a status flip).

---

## 2. Data model — `prisma/schema.prisma`

Bounty feature starts at line 975.

| Model | Key fields | Purpose |
|---|---|---|
| `Bounty` (989) | `id`, `title`, `summary`, `description`, `prizeAmount`, `rewardNote?`, `maxWinners`, `status`, `txHash?`, `userId` (owner), `instructions: String[]`, `prizeAssetCode`, `prizeAssetIssuer?` | The published challenge |
| `BountyParticipant` (1020) | `bountyId`, `userId`, `joinedAt`, unique(`bountyId`,`userId`) | Who joined |
| `BountySubmission` (1034) | `bountyId`, `userId`, `content` (markdown), `status` (default `PENDING`), `media[]` | Work delivered |
| `BountySubmissionMedia` (1053) | `submissionId`, `url`, `type` (`MediaType`), `fileName?` | Files attached to a submission |
| `BountyWinner` (1067) | `bountyId`, `userId`, `prizeAmount`, `txHash?`, `claimedAt?`, `selectedAt`, unique(`bountyId`,`userId`) | Creator-selected winners |

Enums (976–986):

- `BountyStatus`: `RUNNING | PAUSED | COMPLETED`
- `BountySubmissionStatus`: `PENDING | APPROVED | REJECTED`

Cascade: every child row is deleted with its `Bounty` (`onDelete: Cascade`).
Notifications piggyback on the existing `Notification` / `NotificationObject`
tables via three entity types declared at 57–60: `BOUNTY`,
`BOUNTY_PARTICIPANT`, `BOUNTY_SUBMISSION`, `BOUNTY_WINNER`.

Indexing: `Bounty` indexed on `userId`, `status`, `createdAt`; participants /
submissions / winners indexed on both `bountyId` and `userId` for fast
personalised queries.

---

## 3. API surface — tRPC router

All endpoints live in `src/server/api/routers/bounty/bounty.ts` (mounted at
`api.bounty.Bounty.*`, see `root.ts`). Procedures split cleanly into three
audiences.

### 3.1 Any authorized user

| Procedure | Line | Purpose |
|---|---|---|
| `getCreateBountyXDR` | 28 | Builds the Stellar payment XDR that escrows the prize into mother wallet. Handles `fromCreatorWallet` (uses stored `storageSecret`) vs `fromUserWallet`. |
| `createBounty` | 77 | Persists the bounty row after payment confirmed. |
| `draftBounty` | 489 | OpenAI (`gpt-5.4-mini`) JSON-mode draft from a short prompt — title, summary, description, prize, maxWinners, rewardNote, instructions. |
| `getplatformAssetNumberForXLM` | 574 | Quote helper from `~/lib/stellar/fan/get_token_price`. |

### 3.2 Owner only

| Procedure | Line | Purpose |
|---|---|---|
| `updateBounty` | 106 | Patch title/summary/description/rewardNote/maxWinners/instructions. |
| `updateBountyStatus` | 137 | Flip `RUNNING`/`PAUSED`/`COMPLETED`. |
| `getMyBounties` | 166 | Paginated owner view, status + search filter. |
| `getBountyForOwner` | 200 | Single bounty + winners + counts. |
| `getBountySubmissions` | 230 | All submissions for one of my bounties. |
| `selectWinner` | 258 | Enforces `maxWinners`, rejects duplicates, creates `BountyWinner`, fires `BOUNTY_WINNER` notification to the winner. |
| `getOwnerActivities` | 421 | Recent joins/submissions/wins scoped to bounties I own. |

### 3.3 Public / any signed-in user

| Procedure | Line | Purpose |
|---|---|---|
| `getPublicBounties` | 304 | Cursor-paginated list with `search`, `sortBy` (newest/prize), `filter` (all/not_joined). |
| `getBounty` | 363 | Single bounty + top-20 participants + winners + counts. |
| `joinBounty` | 407 | Validates status is `RUNNING`, blocks self-join, dedupes via unique key, fires `BOUNTY_PARTICIPANT` notif to owner. |
| `getMyBountiesCombined` | 477 | Merges joined + owned with sort + filter for the `/bounty/joined` page. |
| `getJoinedBounties` | 543 | Sidebar preview list. |
| `submitReport` | 591 | Creates submission + media rows in one txn, fires `BOUNTY_SUBMISSION` notif. Requires participant row. |
| `getMySubmissions` | 660 | My submissions for a single bounty. |
| `getMyParticipation` | 678 | `{ joined, winner }` for the current user on a given bounty. |
| `getClaimRewardXDR` | 696 | Builds the payout XDR (mother → winner); may need the winner to sign a `changeTrust` op. |
| `claimReward` | 757 | Marks `BountyWinner.claimedAt` after on-chain success. |
| `getTopBounties` | 781 | Top-N running bounties by prize. |
| `getRecentActivities` | 794 | Public feed: joins + submissions + winner picks, sorted desc, sliced. |

Owner-vs-user checks: `bounty.userId !== ctx.session.user.id` everywhere it
matters (108, 145, 184, 213, 263). The `ownerSelect` helper at the top of the
file returns `{ id, name, image }` from `User` — note the comment that the
"creator" profile is intentionally bypassed.

---

## 4. Stellar layer — `src/lib/stellar/bounty/bounty.ts`

Two functions, both build Stellar transactions directly with
`@stellar/stellar-sdk`.

### 4.1 `SendBountyBalanceGenericToMother` (line 21) — escrow top-up

Used by `getCreateBountyXDR`.

- Loads the **mother** account from `MOTHER_SECRET` (`marketplace/SECRET.ts`).
  The mother account is the tx source — it builds and signs first.
- Determines the real source for the payment op:
  - If `fromCreatorStorage && storageSecret`: signs with the creator's
    custodial secret — fully signed XDR returned.
  - Otherwise: payment `source = userPubKey`; user signs on the client.
- For credit assets: if mother lacks a trustline, atomically prepends a
  `changeTrust` op signed by mother in the same transaction.
- Adds `payment { destination: mother, amount, asset, source }`.
- Email-wallet path: `WithSing` (Albedo-style) signs server-side via
  `signWith.email`.

Returns `{ xdr, pubKey, fullySignedByServer }`.

### 4.2 `claimRewardForUser` (line 92) — escrow payout

Used by `getClaimRewardXDR`.

- Verifies user account exists (otherwise prompts to activate with XLM).
- Verifies mother has the asset and enough balance.
- For credit assets: checks if winner has a trustline. If not, prepends a
  `changeTrust` op that the **user** must sign (because the op's `source`
  is the user pubkey). This is why the page-level `handleClaim` branches:
  - `needsUserSign` → user signs + submits client-side via `clientsign`.
  - Else → fully server-signed, submitted via
    `submitSignedXDRToServer4User`.
- Email-wallet users: `WithSing` signs the changeTrust server-side so they
  don't need a client signer.

Both functions set `TrxBaseFee` and `setTimeout(0)`.

---

## 5. Pages — `src/pages/bounty/`

```
/bounty              → index.tsx        public listing + filters + sidebars
/bounty/create       → create.tsx       owner flow (pay + draft AI)
/bounty/[id]         → [id].tsx         detail + join + submit + claim + winner select
/bounty/edit/[id]    → edit/[id].tsx    owner edits
/bounty/joined       → joined.tsx       "My" list (joined + owned)
```

### 5.1 `/bounty` — `index.tsx`

Layout: header with `Create Bounty` button, search + sort (`newest`/`prize`),
filter chips (`all`/`not_joined`/`joined`), infinite-scroll grid of
`BountyCardWithJoin`. Right rail (desktop) / floating tab rail (mobile):
**Top Bounties** (prize desc), **My Bounties** (5 most recent owned/joined),
**Recent Activity** (last 8 join/submit/win events).

Queries:
- `getPublicBounties` infinite (default)
- `getJoinedBounties` infinite when filter = `joined`
- `getTopBounties` (5)
- `getRecentActivities` (8)
- `getMyBountiesCombined` for the My list

Anonymous users get the login modal instead of `/bounty/create`.

### 5.2 `/bounty/create` — `create.tsx`

Two-column form. Left: AI draft card (textarea + ⌘/Ctrl-Enter, calls
`draftBounty`), Basic Info (title ≤120, summary ≤600, full description via
`MarkdownEditor`), Submission Requirements (1–10 short strings added
one-by-one). Right (sticky): Reward card with:

1. Asset selector — merges user wallet + creator storage balances, sorted
   PLATFORM_ASSET first then by balance. UI shows source (Wallet / Building2
   icon) and a `stellarExpertUrl` link.
2. Total Prize Pool (validated against selected balance).
3. Number of Winners — `perWinner = floor(prize / winners)` is shown
   live but is not sent to the DB (the DB only stores the total).
4. Reward delivery note (≤600 chars).

Submit flow (`handleCreate`, line ~196):

```
validate() → getCreateBountyXDR.mutateAsync(...)
   └─ onSuccess: clientsign OR submitSignedXDRToServer4User
       └─ createBounty.mutateAsync(...) → router.push(`/bounty/${id}`)
```

State machine: `form → paying → creating → done`. Step guards disable all
inputs.

### 5.3 `/bounty/[id]` — `[id].tsx`

The biggest screen. Cover banner with gradient strip (gold / violet / teal
by prize tier, see `accentGradient` at line 95). Status pill (`Live` /
`Paused` / `Ended` from `statusCfg`). Requirements card (right column on
desktop, top-4 + portal popover for the rest).

Owner toolbar (only when `isOwner`): status `<Select>`,
`Share` (opens `ShareBountyModal`), `Edit` → `/bounty/edit/[id]`.

Three tabs:
- **Description** — `<Markdown>` rendering of `bounty.description`,
  optional `rewardNote` card.
- **Participants** — table of joiners with `Crown` for winners, submitted
  indicator, prize column. `submittedUserIds` is derived from either
  `submissionsQ.data` (owner) or `mySubmissions.data` (user).
- **Submissions / My Reports** — owner sees all submissions and can pick
  winners (`selectWinner` with `prizeAmount = perWinner`); user sees own
  submissions and can open them in a view dialog with `ReportMediaViewer`.

Right rail: Rewards card (prize pool + per-winner + Claim button), Stats
card (counts), Winners list (with claimed check).

Claim flow (`handleClaim`, line ~177):

```
getClaimRewardXDR → branch on result.needsUserSign
  ├─ true  → clientsign(...)         (user signs changeTrust)
  └─ false → submitSignedXDRToServer4User(...)
  → claimReward.mutate → refetch myParticipation
```

Notifications fired along the way: `joinBounty`, `submitReport`,
`selectWinner` all create a `notificationObject` + `notification` row to
the relevant counterparty.

Mobile has a fixed bottom action sheet mirroring the desktop CTAs plus a
floating right-edge tab rail with `requirements | rewards | stats | winners`.

### 5.4 `/bounty/edit/[id]`

Owner edits. Reuses the same field validators. (Not opened in this trace —
worth reading before touching.)

### 5.5 `/bounty/joined` — `joined.tsx`

Standalone "My Bounties" page. Same search + sort + filter model as the
sidebar widget, full-page layout. Calls `getMyBountiesCombined` with cursor
pagination (server side merges joined + owned, dedupes by bountyId, sorts
in-memory — see `bounty.ts:477`).

---

## 6. Components — `src/components/bounty/`

| File | Role |
|---|---|
| `bounty-card.tsx` | `BountyCard` (presentational), `BountyCardSkeleton`, `BountyCardWithJoin` (wraps with `getMyParticipation` + `joinBounty` mutation). Cards navigate on click, expose `View` / `Join` / `Share` micro-buttons. |
| `markdown-editor.tsx` | Wrapper around `@uiw/react-md-editor` used in `create` and `submit-report-dialog`. Supports `maxWords`, `minHeight`, `disabled`. |
| `markdown.tsx` | Sanitized markdown renderer for read-only display of bounty descriptions and submission content (uses `isomorphic-dompurify`). |
| `recent-activity-item.tsx` | Row for the activity feed (joins/submits/wins). |
| `report-media-viewer.tsx` | Renders the media attached to a submission (images, video, audio, docs). |
| `submit-report-dialog.tsx` | The submission form (markdown body + drag/drop multi-file upload). Uploads via the existing `api.s3.getSignedURL` (server returns a presigned S3 PUT URL), then commits media URLs in `submitReport`. 2,000-word limit. |

Modal flow: `submit-report-dialog` is opened from `[id].tsx` and the
`Share` button opens `src/components/modal/share-bounty-modal.tsx` via
`useShareBountyModalStore` (zustand) — that modal lets the user post the
bounty to one of their communities.

Other notable consumers:
- `src/lib/bounty/bounty-link-detector.tsx` — turns `/bounty/<id>` strings
  inside chat/agent text into clickable links.
- `src/components/store/share-bounty-modal-store.ts` — zustand store
  controlling the share modal.

---

## 7. Notification wiring

Three `NotificationType` enum entries are produced by bounty mutations:

| Action | Type | Target |
|---|---|---|
| `joinBounty` (bounty.ts:432) | `BOUNTY_PARTICIPANT` | bounty owner |
| `submitReport` (bounty.ts:637) | `BOUNTY_SUBMISSION` | bounty owner |
| `selectWinner` (bounty.ts:294) | `BOUNTY_WINNER` | selected winner |

`BOUNTY` itself is declared (schema.prisma:57) but I didn't see it
produced in `bounty.ts` — likely a future use (e.g. bounty status change
fan-out). Worth confirming if a "status change notification" is expected.

---

## 8. End-to-end happy paths

### 8.1 Creator flow

```
/bounty → /bounty/create
  draftBounty (optional)                  → AI populates fields
  fill title / summary / description / instructions
  pick asset (user or creator storage)
  set prize + maxWinners                  → perWinner preview
  set rewardNote
  Create & Pay
    ├─ getCreateBountyXDR                 → mother builds tx, signs
    │   ├─ fromCreatorWallet ? creator's storageSecret signs too (fullySignedByServer=true)
    │   └─ user path: clientsign on user's wallet
    ├─ submitSignedXDRToServer4User or clientsign returns true
    └─ createBounty                       → row inserted → router.push(/bounty/[id])

On /bounty/[id] as owner:
  updateBountyStatus                      → PAUSED / COMPLETED
  updateBounty                            → edit /bounty/edit/[id]
  share                                   → ShareBountyModal → posts to community
  review submissions → selectWinner       → BountyWinner row + notif to winner
  (optional) updateBountyStatus → COMPLETED
```

### 8.2 Participant flow

```
/bounty → /bounty/[id]
  joinBounty                              → BountyParticipant row + notif to owner
  SubmitReportDialog:
    upload files via S3 presigned URLs    → setMedia([{ url, type, fileName }])
    submitReport                          → BountySubmission + media + notif to owner
  (wait for owner to pick winners)
  On becoming winner: getMyParticipation.winner populated, Claim button shows
    handleClaim → getClaimRewardXDR
      ├─ needsUserSign (no trustline) → clientsign (sign changeTrust) → submit
      └─ server-signed (email wallet) → submitSignedXDRToServer4User
    claimReward                           → BountyWinner.claimedAt set
```

### 8.3 Visitor flow

```
/bounty → search/filter → click card → /bounty/[id]
  guest sees Join button → opens login modal
  after login: same as participant flow
```

---

## 9. Loose ends worth a second look

1. **`perWinner` storage**: only the total `prizeAmount` is persisted; the
   per-winner amount is recomputed client-side and passed to `selectWinner`.
   The schema doesn't enforce that `Σ winners.prizeAmount ≤ bounty.prizeAmount`.
2. **No transaction/fee accounting in escrow**: `SendBountyBalanceGenericToMother`
   only sends `prize` (the `totalAmount = prize` comment is explicit at
   line 47). Fees are not added to the amount — the user only pays the
   prize. Mother absorbs the base fee.
3. **Mother wallet re-use**: all bounties funnel into the same
   `MOTHER_SECRET`. There's no per-bounty sub-account on Stellar — payouts
   read the asset balance straight off mother and pay winners from that
   pool. That works as long as mother never spends the escrowed balance
   elsewhere; any code path that drains mother will break outstanding
   claims.
4. **`BOUNTY` notification type unused** in `bounty.ts` — only the three
   sub-types are emitted.
5. **`BOUNTY_WINNER` `txHash`**: schema reserves `BountyWinner.txHash` but
   nothing in the router writes it. Claim currently stores `claimedAt`
   only. Either the on-chain tx hash isn't being captured, or it's
   expected to be filled in by a follow-up.
6. **`PLATFORM_FEE` and `getplatformAssetNumberForXLM`** are imported in
   `bounty.ts` but unused — leftover from an earlier fee model.
7. **Email-wallet signing path**: `WithSing` is called for both
   `getCreateBountyXDR` (creator funding) and the changeTrust in
   `claimRewardForUser` — worth confirming this matches the rest of the
   auth/wallet story (`package/connect_wallet` + Albedo).
8. **`updateBounty` allows editing prize-related fields off the table**,
   but the amount is **not** in the input (lines 113–123). Correct — the
   prize is locked once escrowed.
9. **Git status note**: the working tree has many `M` flags and the
   `main` branch reports changes that aren't committed. Before shipping
   any bounty change, a clean diff baseline helps.

---

## 10. Quick reference — file index

```
prisma/schema.prisma                          975–1083   data model
src/types/bounty.ts                           full       shared types
src/server/api/routers/bounty/root.ts         full       router mount
src/server/api/routers/bounty/bounty.ts       full       21 procedures
src/lib/stellar/bounty/bounty.ts              full       escrow + claim tx
src/lib/bounty/bounty-link-detector.tsx       full       chat link detector
src/pages/bounty/index.tsx                    full       listing
src/pages/bounty/create.tsx                   full       owner create
src/pages/bounty/[id].tsx                     full       detail (largest)
src/pages/bounty/edit/[id].tsx                full       owner edit
src/pages/bounty/joined.tsx                   full       my bounties
src/components/bounty/bounty-card.tsx         full       card + skeleton + wrapper
src/components/bounty/markdown-editor.tsx     full       markdown input
src/components/bounty/markdown.tsx            full       markdown renderer
src/components/bounty/recent-activity-item.tsx full      activity row
src/components/bounty/report-media-viewer.tsx full       submission media
src/components/bounty/submit-report-dialog.tsx full      submit form
src/components/modal/share-bounty-modal.tsx   full       share to community
src/components/store/share-bounty-modal-store.ts full    zustand store
```
