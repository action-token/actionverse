#![no_std]
//! Actionverse art NFT collection with a built-in marketplace.
//!
//! One shared collection for every creator — no per-creator deploy. An
//! "edition" is one artwork with a fixed `supply`.
//!
//! **The creator never touches this contract.** The backend registers an
//! edition under the price authority ([`Self::register_edition`]), and
//! [`Self::buy_edition`] mints straight to the buyer — so the creator never
//! signs and pays no gas to list.
//!
//! The marketplace lives inside the token contract so settlement can move
//! tokens via [`Consecutive::update`]. A standalone market would need the
//! seller to `approve` it first — an extra signature and failure mode.
//!
//! Minting uses [`Consecutive`], not [`Base`]'s `sequential_mint`: ownership
//! is stored once per bucket, not once per token, which is what makes minting
//! a whole edition run in one call affordable.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::TokenClient, Address, BytesN, Env, String, Vec,
};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_contract_utils::{
    pausable::{self as pausable, Pausable},
    upgradeable::{self as upgradeable, Upgradeable},
};
use stellar_macros::{only_owner, when_not_paused};
use stellar_tokens::non_fungible::{
    consecutive::{
        storage::{IDS_IN_BUCKET, NFTConsecutiveStorageKey},
        Consecutive,
    },
    emit_transfer, Base, NonFungibleToken,
};

mod test;

const DAY_IN_LEDGERS: u32 = 17_280;
/// Sized against mainnet's `minPersistentTtl` (120 days, what a new entry
/// starts with) and `maxEntryTtl` (180 days, the extension ceiling).
///
/// `extend_ttl` fires only when remaining TTL is *below* the threshold. 150
/// clears the 120-day floor outright, so a write lifts its own record to 175
/// days and the sweep is a backstop, not the only thing keeping data alive.
/// `BUMP_TO` stops short of 180 so an off-by-one can't start rejecting
/// extensions. Two consecutive missed two-monthly sweeps still fit in 175
/// days — a failed run is silent, so it must not be able to archive anything.
const BUMP_THRESHOLD: u32 = 150 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 175 * DAY_IN_LEDGERS;

/// Bump this before building/deploying each new wasm so `version()` reflects
/// what's actually running on-chain — paired with the `Upgradeable` impl
/// below, this is how future changes ship without a redeploy (new address).
///
/// Reset to 1 for the mainnet collection deployed fresh rather than upgraded,
/// so the number counts releases of *this* contract instance. The previous
/// instance reached 9 and is not an ancestor of this one.
const CONTRACT_VERSION: u32 = 1;

/// Basis-points denominator for fee/royalty math (10_000 = 100%).
const BPS_DENOM: i128 = 10_000;
/// Hard ceiling, enforced in the constructor and `set_platform_fee` so an
/// admin key can't take an unbounded cut.
const MAX_PLATFORM_FEE_BPS: u32 = 1_000; // 10%
/// Not a policy number: `seller_amount = total - platform_fee - royalty`, so
/// anything above `10_000 - MAX_PLATFORM_FEE_BPS` could go negative and panic
/// settlement. 90% is the largest safe value at the 10% fee ceiling.
const MAX_ROYALTY_BPS: u32 = 9_000; // 90%

// Bounded string lengths so one entry can't bloat ledger storage unboundedly.
const MAX_NAME_LEN: u32 = 128;
const MAX_DESCRIPTION_LEN: u32 = 2_000;
/// 500 was too tight for a signed IPFS gateway URL with query parameters.
const MAX_URI_LEN: u32 = 2_048;

/// Sane ceiling on how many copies one edition can ever mint — a bound, not
/// a target; most editions will be far smaller.
const MAX_SUPPLY: u32 = 100_000;
/// How many distinct currencies one edition can price itself in at once
/// (XLM + the platform asset today, room for a couple more like USDC later).
const MAX_PRICE_ENTRIES: u32 = 5;
/// Ceiling on copies minted in a single `buy_edition` call. Well under
/// `Consecutive`'s own 32,000-token batch cap — this keeps one purchase's
/// compute/storage footprint predictable; a buyer wanting more just buys
/// again.
const MAX_QUANTITY_PER_BUY: u32 = 20;
/// Ceiling on how many edition/token ids `keep_alive` touches in one call —
/// bounds one keeper transaction's compute/storage footprint the same way
/// `MAX_QUANTITY_PER_BUY` bounds a purchase. A scheduler with more ids than
/// this just splits them across several calls.
const MAX_KEEP_ALIVE_IDS: u32 = 200;

/// Caps for the single-kind entry points below.
///
/// Sized against Soroban's per-transaction footprint (100 entries on mainnet)
/// rather than against `MAX_KEEP_ALIVE_IDS`, which is one blanket number for
/// four kinds that cost very different amounts. A token can touch four entries
/// (`OwnershipBucket`, `Owner`, `TokenEdition`, `Listing`), an edition two, a
/// ref or an unlocked item one — so each lands near 80 entries, leaving room
/// under the limit. Measured, not guessed: 31 worst-case tokens already reach
/// 102.
const MAX_TOKENS_PER_CALL: u32 = 25;
const MAX_EDITIONS_PER_CALL: u32 = 40;
const MAX_REFS_PER_CALL: u32 = 80;
const MAX_UNLOCKED_PER_CALL: u32 = 80;

// =============================================================================
// Data
// =============================================================================

/// Off-chain-media descriptor returned by [`ArtNft::art_meta`] for a single
/// token — synthesized from that token's edition, not stored per-token.
/// No royalty bps — [`ArtNft::royalty_info`] is the single source of truth.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtMeta {
    pub title: String,
    pub description: String,
    pub thumbnail_url: String,
    pub media_url: String,
    pub media_type: String,
    pub creator: Address,
}

/// One accepted currency and its price for one copy of an edition.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceEntry {
    /// SEP-41 token address (the native XLM SAC, the platform asset's SAC,
    /// or any other Stellar Asset Contract added later).
    pub payment_token: Address,
    pub price: i128,
}

/// A creator's submission: bounded artwork with a fixed supply, minted
/// lazily as copies sell rather than up front.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EditionMeta {
    pub title: String,
    pub description: String,
    pub thumbnail_url: String,
    /// The locked/gated content — visible to the storefront, but only
    /// meaningful once a copy is owned.
    pub media_url: String,
    pub media_type: String,
    pub creator: Address,
    pub royalty_bps: u32,
    /// Total copies this edition will ever mint.
    pub supply: u32,
    /// Copies minted so far, always `<= supply`.
    pub minted: u32,
}

/// Fields for a new edition. Grouped into one argument to stay under
/// Soroban's 10-parameter-per-function cap.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EditionInput {
    pub title: String,
    pub description: String,
    pub thumbnail_url: String,
    pub media_url: String,
    pub media_type: String,
    pub creator: Address,
    pub royalty_bps: u32,
    pub supply: u32,
    pub prices: Vec<PriceEntry>,
}

/// What one `buy_edition` call minted. Recorded because the return value
/// can't be read back — see [`ArtNft::buy_edition`].
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PurchaseReceipt {
    pub edition_id: u32,
    pub buyer: Address,
    pub first_token_id: u32,
    pub last_token_id: u32,
    pub quantity: u32,
    pub payment_token: Address,
    pub unit_price: i128,
}

/// At most one listing per token. Secondary market only — a primary sale is
/// priced via `EditionPrices`. A reseller sets their own currencies, not
/// whatever the creator originally offered.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub prices: Vec<PriceEntry>,
}

/// What a buyer will actually be charged, broken out so the UI can show the
/// split before asking for a signature.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleBreakdown {
    pub total: i128,
    pub platform_fee: i128,
    pub royalty: i128,
    pub royalty_receiver: Address,
    pub seller_amount: i128,
}

/// Variant *names* land in the ledger, so these must not collide with
/// OpenZeppelin's own keys (`Owner`, `Balance`, `Approval`,
/// `OwnershipBucket`, `TokenRoyalty`, `Metadata`) — a shared name silently
/// aliases two structs onto one storage entry.
#[contracttype]
pub enum DataKey {
    Edition(u32),
    /// Maps a caller-supplied off-chain reference (the DB row id) to the
    /// edition it registered — dedup, and how the backend resolves an
    /// edition id after the fact.
    EditionByRef(String),
    EditionPrices(u32),
    /// Resolves a specific token back to the edition it was minted from —
    /// how `art_meta`/royalty admin checks find a token's creator without
    /// storing a full copy of the edition's metadata per token.
    TokenEdition(u32),
    /// Resolves a purchase attempt to what it actually minted — see
    /// `PurchaseReceipt`.
    PurchaseByRef(String),
    Listing(u32),
    NextEditionId,
    PlatformFeeBps,
    Treasury,
    /// The hot key allowed to call `unlock_item_for` — separate from the
    /// `Ownable` owner (which can pause/upgrade the whole contract) since
    /// this one gets called automatically by the backend on every pin
    /// collection, not by a human operator. See `unlock_item_for`.
    UnlockAuthority,
    /// The hot key allowed to call `update_edition` — same rotation model
    /// as `UnlockAuthority`. Unset after a fresh `upgrade` (constructors
    /// only run at deploy), so `update_edition` must panic clearly rather
    /// than fall back to `owner` until `set_price_authority` is called.
    PriceAuthority,
    /// (token_id, media_index) -> bool, permanent once true. Keyed per item,
    /// not per token: one token can carry several independently-gated items.
    /// `media_index` is the app's `NftLockedMedia.chainIndex` — stable and
    /// never reused.
    Unlocked(u32, u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ArtError {
    InvalidAmount = 300,
    InvalidFee = 301,
    InvalidRoyalty = 302,
    NameTooLong = 303,
    DescriptionTooLong = 304,
    InvalidUri = 305,
    ListingNotFound = 306,
    SelfPurchase = 307,
    NotSeller = 308,
    /// The listing's seller no longer owns the token — it was transferred
    /// out from under the listing.
    ListingStale = 309,
    /// This `edition_ref` already registered an edition — guards against
    /// double-registering the same off-chain record.
    DuplicateRef = 311,
    RefTooLong = 312,
    InvalidSupply = 313,
    /// An edition's price grid is empty or has more currencies than
    /// `MAX_PRICE_ENTRIES`.
    TooManyPriceEntries = 314,
    DuplicatePaymentToken = 315,
    InvalidPrice = 316,
    /// `payment_token` isn't one of the currencies this edition is priced in.
    PaymentTokenNotAccepted = 317,
    /// This purchase would mint more copies than the edition has left.
    SupplyExhausted = 318,
    /// `quantity` is 0 or exceeds `MAX_QUANTITY_PER_BUY`.
    QuantityTooLarge = 319,
    EditionNotFound = 320,
    /// This `purchase_ref` was already used — guards against double-applying
    /// the same purchase attempt.
    DuplicatePurchaseRef = 321,
    PurchaseRefTooLong = 322,
    /// The caller of `unlock_item_for` isn't the registered unlock
    /// authority (or none has been set yet).
    NotUnlockAuthority = 323,
    /// The caller of `register_edition`/`update_edition` isn't the
    /// registered price authority.
    ///
    /// Also raised when no authority is set at all, which since v11 can
    /// only happen on a contract *upgraded* from a build predating the
    /// key — `__constructor` sets it, but a constructor never runs on an
    /// upgrade, so that one case still needs a `set_price_authority` call.
    NotPriceAuthority = 324,
    /// `keep_alive` was given more edition or token ids than
    /// `MAX_KEEP_ALIVE_IDS` in one call.
    TooManyKeepAliveIds = 325,
}

// =============================================================================
// Events
// =============================================================================

#[contractevent]
pub struct EditionCreated {
    #[topic]
    pub edition_id: u32,
    #[topic]
    pub creator: Address,
    pub royalty_bps: u32,
    pub supply: u32,
}

#[contractevent]
pub struct EditionMinted {
    #[topic]
    pub edition_id: u32,
    #[topic]
    pub buyer: Address,
    pub first_token_id: u32,
    pub last_token_id: u32,
    pub quantity: u32,
    pub payment_token: Address,
    pub unit_price: i128,
    /// Reimburses treasury for fee-bumping this purchase. Folded into the
    /// platform-fee transfer, recorded here so the buyer's true total is
    /// auditable from this one event.
    pub inclusion_fee_paid: i128,
    pub network_fee_paid: i128,
}

#[contractevent]
pub struct Listed {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub seller: Address,
    pub prices: Vec<PriceEntry>,
}

#[contractevent]
pub struct Purchased {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub buyer: Address,
    pub seller: Address,
    pub payment_token: Address,
    pub price: i128,
    pub royalty_paid: i128,
    pub platform_fee_paid: i128,
    /// Reimburses treasury for fee-bumping this purchase, folded into the
    /// platform-fee transfer. Always 0 under `buy_batch`, which charges the
    /// batch's fee once in its own aggregate transfer.
    pub inclusion_fee_paid: i128,
    pub network_fee_paid: i128,
}

#[contractevent]
pub struct ListingCancelled {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub seller: Address,
}

#[contractevent]
pub struct PlatformFeeUpdated {
    pub fee_bps: u32,
    pub treasury: Address,
}

#[contractevent]
pub struct EditionUpdated {
    #[topic]
    pub edition_id: u32,
    pub old_title: String,
    pub new_title: String,
    pub old_description: String,
    pub new_description: String,
    pub old_thumbnail_url: String,
    pub new_thumbnail_url: String,
    pub old_supply: u32,
    pub new_supply: u32,
    pub old_prices: Vec<PriceEntry>,
    pub new_prices: Vec<PriceEntry>,
}

#[contractevent]
pub struct ContentUnlocked {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub owner: Address,
    /// Which locked-content item on this token was just unlocked — see
    /// `DataKey::Unlocked`'s doc comment.
    pub media_index: u32,
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct ArtNft;

#[contractimpl]
impl ArtNft {
    /// Runs exactly once, at deploy. Using a constructor rather than an
    /// `initialize` entry point means there is no window in which an
    /// uninitialized contract can be claimed by whoever calls first.
    pub fn __constructor(
        e: &Env,
        owner: Address,
        treasury: Address,
        platform_fee_bps: u32,
        name: String,
        symbol: String,
        base_uri: String,
        unlock_authority: Address,
        price_authority: Address,
    ) {
        if platform_fee_bps > MAX_PLATFORM_FEE_BPS {
            panic_with_error!(e, ArtError::InvalidFee);
        }

        ownable::set_owner(e, &owner);
        Base::set_metadata(e, base_uri, name, symbol);

        e.storage().instance().set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
        e.storage().instance().set(&DataKey::UnlockAuthority, &unlock_authority);
        // Set here rather than left to a follow-up `set_price_authority`.
        // `register_edition` is gated on this key and every purchase now goes
        // through registration, so a deploy that omitted it left the whole
        // collection unusable — with nothing on-chain to say why. A required
        // constructor argument makes that state unreachable for a fresh
        // deploy; an *upgrade* from a build predating this key still has to
        // call `set_price_authority` once, since a constructor only ever runs
        // at deploy (`scripts/upgrade-contracts.ts` does this).
        e.storage().instance().set(&DataKey::PriceAuthority, &price_authority);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    // -------------------------------------------------------------------------
    // Buying (mints on demand — see the module doc for why there's no
    // separate "mint" entry point)
    // -------------------------------------------------------------------------

    /// Buys `quantity` copies of an edition, minting them straight to
    /// `buyer` in the same call that takes payment.
    ///
    /// Only *resolves* `edition_ref` — never creates. Creation used to happen
    /// here from a caller-supplied `EditionInput`, which let anyone front-run
    /// an unsold item and define its terms; it now lives in
    /// [`Self::register_edition`], behind the price authority.
    ///
    /// `purchase_ref` is a fresh caller id per attempt, recorded so the minted
    /// range can be read back with [`Self::purchase_by_ref`]: the pinned
    /// `stellar-sdk` can't decode protocol-27 meta, so neither the return
    /// value nor events survive a confirmed transaction, and re-deriving
    /// "the last N minted" would race concurrent buyers. Reuse is rejected,
    /// which also makes a retried submission safe.
    #[when_not_paused]
    pub fn buy_edition(
        e: &Env,
        buyer: Address,
        edition_ref: String,
        purchase_ref: String,
        payment_token: Address,
        quantity: u32,
        inclusion_fee: i128,
        network_fee: i128,
    ) -> (u32, u32) {
        buyer.require_auth();
        Self::require_treasury_auth(e);

        if quantity == 0 || quantity > MAX_QUANTITY_PER_BUY {
            panic_with_error!(e, ArtError::QuantityTooLarge);
        }
        if purchase_ref.len() == 0 || purchase_ref.len() > MAX_NAME_LEN {
            panic_with_error!(e, ArtError::PurchaseRefTooLong);
        }
        if e.storage().persistent().has(&DataKey::PurchaseByRef(purchase_ref.clone())) {
            panic_with_error!(e, ArtError::DuplicatePurchaseRef);
        }
        if inclusion_fee < 0 || network_fee < 0 {
            panic_with_error!(e, ArtError::InvalidAmount);
        }

        // Resolve only — never create. Edition creation is gated to the price
        // authority via `register_edition`; see that function for why letting
        // an arbitrary buyer define an edition's terms was exploitable.
        let edition_id: u32 = e
            .storage()
            .persistent()
            .get(&DataKey::EditionByRef(edition_ref))
            .unwrap_or_else(|| panic_with_error!(e, ArtError::EditionNotFound));
        let mut meta: EditionMeta =
            e.storage().persistent().get(&DataKey::Edition(edition_id)).unwrap();

        if quantity > meta.supply - meta.minted {
            panic_with_error!(e, ArtError::SupplyExhausted);
        }

        let prices: Vec<PriceEntry> =
            e.storage().persistent().get(&DataKey::EditionPrices(edition_id)).unwrap();
        let unit_price = Self::price_for(e, &prices, &payment_token);
        let total = unit_price * quantity as i128;

        // --- effects: mint, index and settle the edition's own state before
        // any external call, so a hostile `payment_token` can't reenter and
        // observe a half-applied purchase (checks-effects-interactions).
        let last_id = Consecutive::batch_mint(e, &buyer, quantity);
        // Not `last_id - quantity + 1`: token ids are 0-based, so the very
        // first mint has `last_id == 0` and subtracting `quantity` (>= 1)
        // first would underflow before the `+ 1` brings it back in range.
        let first_id = last_id + 1 - quantity;

        // Royalty is *not* recorded per token via the OZ royalties extension
        // here — `Base::set_token_royalty`/`Base::royalty_info` verify a
        // token exists by calling `Base::owner_of`, which only recognizes
        // `Consecutive`-minted ids that have an explicit `Owner` entry (the
        // last id of each batch); every other id in a multi-copy batch only
        // has a bucket bit set, so that check panics for them. Royalty is
        // instead resolved from `TokenEdition`/`EditionMeta` on demand — see
        // [`Self::royalty_info`] — which is also cheaper for a large edition
        // than writing one royalty record per copy.
        for id in first_id..=last_id {
            let key = DataKey::TokenEdition(id);
            e.storage().persistent().set(&key, &edition_id);
            e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
            // `batch_mint` above created these at OZ's 30 days. Lift them to
            // `BUMP_TO` now so a token minted just after a keep-alive sweep
            // isn't left to expire before the next one.
            Self::extend_ownership_ttl(e, id);
        }

        meta.minted += quantity;
        let edition_key = DataKey::Edition(edition_id);
        e.storage().persistent().set(&edition_key, &meta);
        e.storage().persistent().extend_ttl(&edition_key, BUMP_THRESHOLD, BUMP_TO);

        let receipt = PurchaseReceipt {
            edition_id,
            buyer: buyer.clone(),
            first_token_id: first_id,
            last_token_id: last_id,
            quantity,
            payment_token: payment_token.clone(),
            unit_price,
        };
        let purchase_key = DataKey::PurchaseByRef(purchase_ref);
        e.storage().persistent().set(&purchase_key, &receipt);
        e.storage().persistent().extend_ttl(&purchase_key, BUMP_THRESHOLD, BUMP_TO);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        // --- interactions: this *is* the primary sale, so payment goes
        // straight to the creator — there's no separate seller to route
        // through, and no royalty leg (the creator would just be paying
        // themselves).
        let fee_bps = Self::platform_fee_bps(e) as i128;
        let platform_fee = total * fee_bps / BPS_DENOM;

        let token = TokenClient::new(e, &payment_token);
        // Folded into one transfer rather than a separate call per fee —
        // cheaper, and there's no reason treasury's two cuts need to move
        // as two `TokenClient` invocations.
        let treasury_amount = platform_fee + inclusion_fee + network_fee;
        if treasury_amount > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            token.transfer(&buyer, &treasury, &treasury_amount);
        }
        token.transfer(&buyer, &meta.creator, &(total - platform_fee));

        EditionMinted {
            edition_id,
            buyer,
            first_token_id: first_id,
            last_token_id: last_id,
            quantity,
            payment_token,
            unit_price,
            inclusion_fee_paid: inclusion_fee,
            network_fee_paid: network_fee,
        }
        .publish(e);

        (first_id, last_id)
    }

    fn create_edition(e: &Env, edition_ref: String, edition: EditionInput) -> u32 {
        if edition_ref.len() == 0 || edition_ref.len() > MAX_NAME_LEN {
            panic_with_error!(e, ArtError::RefTooLong);
        }

        let EditionInput {
            title,
            description,
            thumbnail_url,
            media_url,
            media_type,
            creator,
            royalty_bps,
            supply,
            prices,
        } = edition;

        if title.len() == 0 || title.len() > MAX_NAME_LEN {
            panic_with_error!(e, ArtError::NameTooLong);
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            panic_with_error!(e, ArtError::DescriptionTooLong);
        }
        if thumbnail_url.len() == 0 || thumbnail_url.len() > MAX_URI_LEN {
            panic_with_error!(e, ArtError::InvalidUri);
        }
        if media_url.len() == 0 || media_url.len() > MAX_URI_LEN {
            panic_with_error!(e, ArtError::InvalidUri);
        }
        if royalty_bps > MAX_ROYALTY_BPS {
            panic_with_error!(e, ArtError::InvalidRoyalty);
        }
        if supply == 0 || supply > MAX_SUPPLY {
            panic_with_error!(e, ArtError::InvalidSupply);
        }
        Self::validate_prices(e, &prices);

        let edition_id: u32 = e.storage().instance().get(&DataKey::NextEditionId).unwrap_or(0);
        e.storage().instance().set(&DataKey::NextEditionId, &(edition_id + 1));

        let meta = EditionMeta {
            title,
            description,
            thumbnail_url,
            media_url,
            media_type,
            creator: creator.clone(),
            royalty_bps,
            supply,
            minted: 0,
        };
        let edition_key = DataKey::Edition(edition_id);
        e.storage().persistent().set(&edition_key, &meta);
        e.storage().persistent().extend_ttl(&edition_key, BUMP_THRESHOLD, BUMP_TO);

        let prices_key = DataKey::EditionPrices(edition_id);
        e.storage().persistent().set(&prices_key, &prices);
        e.storage().persistent().extend_ttl(&prices_key, BUMP_THRESHOLD, BUMP_TO);

        let ref_key = DataKey::EditionByRef(edition_ref);
        e.storage().persistent().set(&ref_key, &edition_id);
        e.storage().persistent().extend_ttl(&ref_key, BUMP_THRESHOLD, BUMP_TO);

        EditionCreated { edition_id, creator, royalty_bps, supply }.publish(e);

        edition_id
    }

    /// Requires the treasury account to have authorized this purchase.
    ///
    /// The buyer's signature proves who pays, not *how much*: `inclusion_fee`
    /// and `network_fee` are plain arguments, so a buyer building their own
    /// envelope can zero them, sign honestly, and have the backend fee-bump
    /// it. Every other check still passes. Treasury then pays the real cost
    /// and is reimbursed nothing.
    ///
    /// Consequence: a buyer acting alone can no longer assemble a purchase.
    /// Every purchase routes through the platform.
    fn require_treasury_auth(e: &Env) {
        let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
        treasury.require_auth();
    }

    /// Extends the OpenZeppelin `Consecutive` ownership entries covering
    /// `token_id` to this contract's own `BUMP_TO`.
    ///
    /// `stellar-tokens` hardcodes 30 days (`OWNER_EXTEND_AMOUNT`,
    /// `OWNERSHIP_EXTEND_AMOUNT`) as compile-time constants with no way to
    /// configure them — four times shorter than everything else this contract
    /// stores. Writing the same keys directly is the only way to lift it.
    ///
    /// Without it ownership dies 30 days after its last touch while every
    /// other key lives 175, pinning the sweep to a monthly cadence. Harmless
    /// alongside OZ's own calls, since `extend_ttl` never *shortens* — but OZ
    /// still *creates* entries at 30 days, so this must run at mint time too,
    /// or a token minted just after a sweep expires before the next one.
    ///
    /// Coupled to `stellar-tokens`' key layout by necessity;
    /// `keep_alive_extends_ownership_past_the_oz_default` fails loudly if a
    /// future version reorders them, which would silently target nothing.
    fn extend_ownership_ttl(e: &Env, token_id: u32) {
        let bucket_key =
            NFTConsecutiveStorageKey::OwnershipBucket(token_id / IDS_IN_BUCKET as u32);
        if e.storage().persistent().has(&bucket_key) {
            e.storage().persistent().extend_ttl(&bucket_key, BUMP_THRESHOLD, BUMP_TO);
        }

        // Only some ids carry an explicit `Owner` entry — a batch mint writes
        // one for the last id of the range and leaves the rest to bucket bits.
        let owner_key = NFTConsecutiveStorageKey::Owner(token_id);
        if e.storage().persistent().has(&owner_key) {
            e.storage().persistent().extend_ttl(&owner_key, BUMP_THRESHOLD, BUMP_TO);
        }
    }

    fn validate_prices(e: &Env, prices: &Vec<PriceEntry>) {
        let n = prices.len();
        if n == 0 || n > MAX_PRICE_ENTRIES {
            panic_with_error!(e, ArtError::TooManyPriceEntries);
        }
        for i in 0..n {
            let entry = prices.get(i).unwrap();
            if entry.price <= 0 {
                panic_with_error!(e, ArtError::InvalidPrice);
            }
            for j in (i + 1)..n {
                if prices.get(j).unwrap().payment_token == entry.payment_token {
                    panic_with_error!(e, ArtError::DuplicatePaymentToken);
                }
            }
        }
    }

    fn price_for(e: &Env, prices: &Vec<PriceEntry>, payment_token: &Address) -> i128 {
        for i in 0..prices.len() {
            let entry = prices.get(i).unwrap();
            if entry.payment_token == *payment_token {
                return entry.price;
            }
        }
        panic_with_error!(e, ArtError::PaymentTokenNotAccepted)
    }

    // -------------------------------------------------------------------------
    // Registration and editing — both gated by PriceAuthority (a backend hot
    // key, not the creator's own signature — see contracts/nft_oz/README.md).
    // -------------------------------------------------------------------------

    /// Registers an edition ahead of its first sale, returning its id.
    ///
    /// Gated to the price authority. This used to happen lazily inside
    /// `buy_edition`, so the first caller for an `edition_ref` — the app's own
    /// row id, visible in every listing URL — permanently set that edition's
    /// creator, prices, royalty and supply. Anyone could front-run an unsold
    /// item: name themselves `creator` to redirect payments, or set
    /// `supply: 1` and buy it to make the item unsellable.
    ///
    /// Idempotent — re-registering an existing ref returns its id, so a
    /// retried call is safe.
    #[when_not_paused]
    pub fn register_edition(
        e: &Env,
        caller: Address,
        edition_ref: String,
        edition: EditionInput,
    ) -> u32 {
        caller.require_auth();
        let authority: Address = e
            .storage()
            .instance()
            .get(&DataKey::PriceAuthority)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::NotPriceAuthority));
        if caller != authority {
            panic_with_error!(e, ArtError::NotPriceAuthority);
        }

        if let Some(id) =
            e.storage().persistent().get::<_, u32>(&DataKey::EditionByRef(edition_ref.clone()))
        {
            return id;
        }
        Self::create_edition(e, edition_ref, edition)
    }

    /// Rewrites title/description/thumbnail/supply/prices.
    ///
    /// `media_url`, `media_type`, `creator` and `royalty_bps` are **not
    /// parameters** — carried over from the existing meta, so nothing can
    /// alter them. `supply` may only move down to `meta.minted`: never
    /// diluting existing holders, never letting minted copies exceed the cap.
    #[when_not_paused]
    pub fn update_edition(
        e: &Env,
        caller: Address,
        edition_id: u32,
        title: String,
        description: String,
        thumbnail_url: String,
        supply: u32,
        prices: Vec<PriceEntry>,
    ) {
        caller.require_auth();
        let authority: Address = e
            .storage()
            .instance()
            .get(&DataKey::PriceAuthority)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::NotPriceAuthority));
        if caller != authority {
            panic_with_error!(e, ArtError::NotPriceAuthority);
        }

        let edition_key = DataKey::Edition(edition_id);
        let mut meta: EditionMeta = e
            .storage()
            .persistent()
            .get(&edition_key)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::EditionNotFound));

        if title.len() == 0 || title.len() > MAX_NAME_LEN {
            panic_with_error!(e, ArtError::NameTooLong);
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            panic_with_error!(e, ArtError::DescriptionTooLong);
        }
        if thumbnail_url.len() == 0 || thumbnail_url.len() > MAX_URI_LEN {
            panic_with_error!(e, ArtError::InvalidUri);
        }
        if supply < meta.minted || supply > meta.supply {
            panic_with_error!(e, ArtError::InvalidSupply);
        }
        Self::validate_prices(e, &prices);

        let old_title = meta.title.clone();
        let old_description = meta.description.clone();
        let old_thumbnail_url = meta.thumbnail_url.clone();
        let old_supply = meta.supply;
        let prices_key = DataKey::EditionPrices(edition_id);
        let old_prices: Vec<PriceEntry> =
            e.storage().persistent().get(&prices_key).unwrap_or(Vec::new(e));

        meta.title = title.clone();
        meta.description = description.clone();
        meta.thumbnail_url = thumbnail_url.clone();
        meta.supply = supply;
        e.storage().persistent().set(&edition_key, &meta);
        e.storage().persistent().extend_ttl(&edition_key, BUMP_THRESHOLD, BUMP_TO);

        e.storage().persistent().set(&prices_key, &prices);
        e.storage().persistent().extend_ttl(&prices_key, BUMP_THRESHOLD, BUMP_TO);

        EditionUpdated {
            edition_id,
            old_title,
            new_title: title,
            old_description,
            new_description: description,
            old_thumbnail_url,
            new_thumbnail_url: thumbnail_url,
            old_supply,
            new_supply: supply,
            old_prices,
            new_prices: prices,
        }
        .publish(e);
    }

    // -------------------------------------------------------------------------
    // Edition reads
    // -------------------------------------------------------------------------

    /// Resolves the caller's off-chain reference back to the registered
    /// edition id. This is how the backend confirms an edition exists
    /// on-chain and learns its id after the first purchase.
    pub fn edition_by_ref(e: &Env, edition_ref: String) -> Option<u32> {
        e.storage().persistent().get(&DataKey::EditionByRef(edition_ref))
    }

    pub fn edition_meta(e: &Env, edition_id: u32) -> Option<EditionMeta> {
        let key = DataKey::Edition(edition_id);
        let meta: Option<EditionMeta> = e.storage().persistent().get(&key);
        if meta.is_some() {
            e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        }
        meta
    }

    pub fn edition_prices(e: &Env, edition_id: u32) -> Vec<PriceEntry> {
        e.storage()
            .persistent()
            .get(&DataKey::EditionPrices(edition_id))
            .unwrap_or(Vec::new(e))
    }

    pub fn remaining_supply(e: &Env, edition_id: u32) -> u32 {
        match Self::edition_meta(e, edition_id) {
            Some(meta) => meta.supply - meta.minted,
            None => 0,
        }
    }

    /// Resolves what a specific purchase attempt actually minted — see
    /// [`Self::buy_edition`]'s doc comment for why this, and not the
    /// transaction's return value, is how a confirmation step learns the
    /// assigned token range.
    pub fn purchase_by_ref(e: &Env, purchase_ref: String) -> Option<PurchaseReceipt> {
        e.storage().persistent().get(&DataKey::PurchaseByRef(purchase_ref))
    }

    /// Synthesizes a single token's metadata from the edition it was minted
    /// from — editions store their descriptive fields once, not once per
    /// copy, so this is an indirection rather than a direct read.
    pub fn art_meta(e: &Env, token_id: u32) -> Option<ArtMeta> {
        let meta = Self::edition_meta_for_token(e, token_id)?;
        Some(ArtMeta {
            title: meta.title,
            description: meta.description,
            thumbnail_url: meta.thumbnail_url,
            media_url: meta.media_url,
            media_type: meta.media_type,
            creator: meta.creator,
        })
    }

    /// ERC2981-shaped royalty lookup, resolved from the token's edition
    /// rather than the OZ royalties extension's own storage — see the doc
    /// comment in `buy_edition` for why. A token with no edition (shouldn't
    /// happen for anything this contract minted) reports no royalty rather
    /// than panicking, matching the OZ default's own "nothing set" behavior.
    pub fn royalty_info(e: &Env, token_id: u32, sale_price: i128) -> (Address, i128) {
        match Self::edition_meta_for_token(e, token_id) {
            Some(meta) => (meta.creator, sale_price * meta.royalty_bps as i128 / BPS_DENOM),
            None => (e.current_contract_address(), 0),
        }
    }

    fn edition_meta_for_token(e: &Env, token_id: u32) -> Option<EditionMeta> {
        let token_key = DataKey::TokenEdition(token_id);
        let edition_id: u32 = e.storage().persistent().get(&token_key)?;
        e.storage().persistent().extend_ttl(&token_key, BUMP_THRESHOLD, BUMP_TO);

        let edition_key = DataKey::Edition(edition_id);
        let meta: EditionMeta = e.storage().persistent().get(&edition_key)?;
        e.storage().persistent().extend_ttl(&edition_key, BUMP_THRESHOLD, BUMP_TO);
        Some(meta)
    }

    // -------------------------------------------------------------------------
    // Secondary marketplace — unchanged from the 1-of-1 design: every
    // already-minted copy, regardless of which edition it came from, is one
    // token with one owner who can list and sell it exactly like a 1-of-1.
    // -------------------------------------------------------------------------

    /// Lists the caller's token for sale in one or more currencies, same
    /// shape as an edition's own price grid — a reseller isn't limited to
    /// whichever currencies the creator originally offered. Listing does not
    /// escrow the token — the owner keeps it and can still transfer it,
    /// which is why `buy` re-checks ownership rather than trusting the
    /// stored seller.
    #[when_not_paused]
    pub fn list(e: &Env, seller: Address, token_id: u32, prices: Vec<PriceEntry>) {
        seller.require_auth();
        Self::do_list(e, &seller, token_id, prices);
    }

    /// Lists several of the caller's tokens at once, all at the same price
    /// grid — one signature instead of one `list` call per token. The common
    /// case: a seller holding a consecutive run from one `buy_edition`
    /// purchase relists several of them together. Each token still gets its
    /// own independent `Listing` entry (and its own `Listed` event, via
    /// `do_list`) — this is purely a batching of the same per-token effect
    /// `list` has, not a new pooled-listing concept.
    #[when_not_paused]
    pub fn list_batch(e: &Env, seller: Address, token_ids: Vec<u32>, prices: Vec<PriceEntry>) {
        seller.require_auth();
        if token_ids.len() == 0 || token_ids.len() > MAX_QUANTITY_PER_BUY {
            panic_with_error!(e, ArtError::QuantityTooLarge);
        }
        for i in 0..token_ids.len() {
            Self::do_list(e, &seller, token_ids.get(i).unwrap(), prices.clone());
        }
    }

    fn do_list(e: &Env, seller: &Address, token_id: u32, prices: Vec<PriceEntry>) {
        Self::validate_prices(e, &prices);
        if Consecutive::owner_of(e, token_id) != *seller {
            panic_with_error!(e, ArtError::NotSeller);
        }

        let listing = Listing { seller: seller.clone(), prices: prices.clone() };
        let key = DataKey::Listing(token_id);
        e.storage().persistent().set(&key, &listing);
        e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        Listed { token_id, seller: seller.clone(), prices }.publish(e);
    }

    pub fn cancel_listing(e: &Env, seller: Address, token_id: u32) {
        seller.require_auth();

        let listing = Self::listing(e, token_id)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::ListingNotFound));
        if listing.seller != seller {
            panic_with_error!(e, ArtError::NotSeller);
        }

        e.storage().persistent().remove(&DataKey::Listing(token_id));
        ListingCancelled { token_id, seller }.publish(e);
    }

    pub fn listing(e: &Env, token_id: u32) -> Option<Listing> {
        e.storage().persistent().get(&DataKey::Listing(token_id))
    }

    /// Read-only preview of `buy`'s payment split for one of the listing's
    /// currencies, so the UI can show the buyer exactly where their money
    /// goes before they sign.
    pub fn sale_breakdown(e: &Env, token_id: u32, payment_token: Address) -> Option<SaleBreakdown> {
        let listing = Self::listing(e, token_id)?;
        let unit_price = Self::price_for(e, &listing.prices, &payment_token);
        Some(Self::compute_breakdown(e, token_id, &listing, unit_price))
    }

    /// Buys a listed (already-minted) token in a single invocation: payment
    /// out, token in. `payment_token` selects which of the listing's prices
    /// to pay — must be one the seller actually offered.
    ///
    /// Only the buyer signs. The seller's consent was given when they created
    /// the listing, and the token moves via [`Consecutive::update`] (the
    /// low-level, no-auth path) rather than a full `transfer`, which would
    /// demand the seller's signature at purchase time.
    #[when_not_paused]
    pub fn buy(
        e: &Env,
        buyer: Address,
        token_id: u32,
        payment_token: Address,
        inclusion_fee: i128,
        network_fee: i128,
    ) {
        buyer.require_auth();
        Self::require_treasury_auth(e);
        Self::do_buy(e, &buyer, token_id, &payment_token, inclusion_fee, network_fee);
    }

    /// Buys several listed tokens at once, all paid in the same currency —
    /// one signature instead of one `buy` call per token. The common case:
    /// a buyer picking N copies pooled across one or more resale listings
    /// for the same edition. Listings can belong to different sellers; each
    /// token still settles (payment split, ownership transfer, `Purchased`
    /// event) exactly as an individual `buy` would, just in one invocation.
    ///
    /// `inclusion_fee`/`network_fee` are charged once for the whole batch
    /// (there's only one real Soroban transaction underneath, regardless of
    /// how many tokens it settles), not once per token — capped against the
    /// sum of every token's own price, computed up front in a read-only
    /// pass before any listing is touched.
    #[when_not_paused]
    pub fn buy_batch(
        e: &Env,
        buyer: Address,
        token_ids: Vec<u32>,
        payment_token: Address,
        inclusion_fee: i128,
        network_fee: i128,
    ) {
        buyer.require_auth();
        Self::require_treasury_auth(e);
        if token_ids.len() == 0 || token_ids.len() > MAX_QUANTITY_PER_BUY {
            panic_with_error!(e, ArtError::QuantityTooLarge);
        }
        if inclusion_fee < 0 || network_fee < 0 {
            panic_with_error!(e, ArtError::InvalidAmount);
        }

        for i in 0..token_ids.len() {
            Self::do_buy(e, &buyer, token_ids.get(i).unwrap(), &payment_token, 0, 0);
        }

        let fee_total = inclusion_fee + network_fee;
        if fee_total > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            TokenClient::new(e, &payment_token).transfer(&buyer, &treasury, &fee_total);
        }
    }

    fn do_buy(
        e: &Env,
        buyer: &Address,
        token_id: u32,
        payment_token: &Address,
        inclusion_fee: i128,
        network_fee: i128,
    ) {
        if inclusion_fee < 0 || network_fee < 0 {
            panic_with_error!(e, ArtError::InvalidAmount);
        }

        let listing = Self::listing(e, token_id)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::ListingNotFound));

        if *buyer == listing.seller {
            panic_with_error!(e, ArtError::SelfPurchase);
        }
        // The seller could have transferred the token since listing; settling
        // against a stale listing would pay them for something they no longer
        // own.
        if Consecutive::owner_of(e, token_id) != listing.seller {
            panic_with_error!(e, ArtError::ListingStale);
        }

        let unit_price = Self::price_for(e, &listing.prices, payment_token);
        let split = Self::compute_breakdown(e, token_id, &listing, unit_price);

        // --- effects: all contract state settles before any external call, so
        // a hostile `payment_token` can't reenter and observe a half-applied
        // sale (checks-effects-interactions). Scoped per token, so a batch of
        // several tokens still settles each one atomically with its own
        // transfers rather than pooling effects across the whole batch.
        e.storage().persistent().remove(&DataKey::Listing(token_id));
        Consecutive::update(e, Some(&listing.seller), Some(buyer), token_id);
        emit_transfer(e, &listing.seller, buyer, token_id);

        // --- interactions
        let token = TokenClient::new(e, payment_token);
        // Folded into one transfer, same reasoning as `buy_edition`.
        let treasury_amount = split.platform_fee + inclusion_fee + network_fee;
        if treasury_amount > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            token.transfer(buyer, &treasury, &treasury_amount);
        }
        if split.royalty > 0 {
            token.transfer(buyer, &split.royalty_receiver, &split.royalty);
        }
        token.transfer(buyer, &listing.seller, &split.seller_amount);

        Purchased {
            token_id,
            buyer: buyer.clone(),
            seller: listing.seller,
            payment_token: payment_token.clone(),
            price: split.total,
            royalty_paid: split.royalty,
            platform_fee_paid: split.platform_fee,
            inclusion_fee_paid: inclusion_fee,
            network_fee_paid: network_fee,
        }
        .publish(e);
    }

    fn compute_breakdown(e: &Env, token_id: u32, listing: &Listing, unit_price: i128) -> SaleBreakdown {
        let total = unit_price;
        let fee_bps = Self::platform_fee_bps(e) as i128;
        let platform_fee = total * fee_bps / BPS_DENOM;

        let (royalty_receiver, mut royalty) = Self::royalty_info(e, token_id, total);
        // A reseller who is also the original creator would otherwise be
        // charged a royalty on their own resale — net it out to zero rather
        // than shuffle their money through an extra transfer.
        if royalty_receiver == listing.seller {
            royalty = 0;
        }

        SaleBreakdown {
            total,
            platform_fee,
            royalty,
            royalty_receiver,
            seller_amount: total - platform_fee - royalty,
        }
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    #[only_owner]
    pub fn set_platform_fee(e: &Env, fee_bps: u32, treasury: Address) {
        if fee_bps > MAX_PLATFORM_FEE_BPS {
            panic_with_error!(e, ArtError::InvalidFee);
        }
        e.storage().instance().set(&DataKey::PlatformFeeBps, &fee_bps);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        PlatformFeeUpdated { fee_bps, treasury }.publish(e);
    }

    pub fn platform_fee_bps(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::PlatformFeeBps).unwrap_or(0)
    }

    pub fn treasury(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::Treasury)
    }

    /// Rotates the unlock authority's hot key without a full upgrade — the
    /// backend process holding this key gets called automatically and
    /// often, so being able to swap it (e.g. after a suspected leak)
    /// without touching the owner's cold key matters more here than for
    /// most admin settings.
    #[only_owner]
    pub fn set_unlock_authority(e: &Env, new_authority: Address) {
        e.storage().instance().set(&DataKey::UnlockAuthority, &new_authority);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    /// Rotates the price authority's hot key — same rationale as
    /// `set_unlock_authority`: this key gets called by the backend on
    /// every creator edit, so being able to swap it without touching the
    /// owner's cold key matters.
    #[only_owner]
    pub fn set_price_authority(e: &Env, new_authority: Address) {
        e.storage().instance().set(&DataKey::PriceAuthority, &new_authority);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    pub fn price_authority(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::PriceAuthority)
    }

    /// The contract build currently running on-chain — bump
    /// `CONTRACT_VERSION` on every release that changes behavior so this
    /// stays truthful after an `upgrade`.
    pub fn version(_e: &Env) -> u32 {
        CONTRACT_VERSION
    }

    // -------------------------------------------------------------------------
    // Unlock — a locked-content item's off-chain unlock rule (e.g. "visit N
    // AR pin locations"), attested by the backend once it verifies the rule
    // was completed. Soroban has no way to verify real-world location
    // itself, so the backend necessarily remains the party attesting that;
    // what moves on-chain is the permanent, publicly-verifiable *result* of
    // that attestation, not the check itself. Keyed per (token, item): a
    // single token can carry several independently-gated reward items, each
    // unlocking on its own as its own rule completes, not waiting on the
    // token's other items.
    // -------------------------------------------------------------------------

    /// Called by the backend once it has independently verified (off-chain)
    /// that this specific token's specific locked-content item had its
    /// unlock rule completed. Idempotent — calling it again for an
    /// already-unlocked (token, item) pair is a no-op, not an error, so a
    /// retried backend call after a dropped response is safe. Keyed by
    /// `(token_id, media_index)` alone, not edition or owner: each item's
    /// rule applies to one specific minted copy, decided once, regardless
    /// of who holds it later.
    #[when_not_paused]
    pub fn unlock_item_for(e: &Env, caller: Address, token_id: u32, media_index: u32) {
        caller.require_auth();
        let authority: Address = e
            .storage()
            .instance()
            .get(&DataKey::UnlockAuthority)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::NotUnlockAuthority));
        if caller != authority {
            panic_with_error!(e, ArtError::NotUnlockAuthority);
        }

        let key = DataKey::Unlocked(token_id, media_index);
        if e.storage().persistent().get::<_, bool>(&key).unwrap_or(false) {
            return; // already unlocked — idempotent
        }
        e.storage().persistent().set(&key, &true);
        e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        let owner = Consecutive::owner_of(e, token_id);
        ContentUnlocked { token_id, owner, media_index }.publish(e);
    }

    /// Public, permissionless read — anyone (the buyer, a marketplace UI,
    /// an auditor) can verify on-chain whether a given token's given
    /// locked-content item was unlocked, without trusting the backend's
    /// word for it.
    pub fn is_item_unlocked(e: &Env, token_id: u32, media_index: u32) -> bool {
        e.storage().persistent().get(&DataKey::Unlocked(token_id, media_index)).unwrap_or(false)
    }

    // -------------------------------------------------------------------------
    // Keep-alive — Soroban archives (never deletes) a persistent or instance
    // entry once its TTL runs out; the next real transaction that touches it
    // pays a bit more to restore it, but a copy that never trades again (a
    // one-and-done buyer, a sold-out limited edition) would otherwise never
    // see another transaction to trigger that restore. This lets an
    // off-chain scheduler manufacture that touch on a fixed cadence instead
    // of waiting on real trading activity, for the exact ids it already
    // knows about from the app's own database — no on-chain enumeration
    // needed.
    // -------------------------------------------------------------------------

    /// Refreshes this contract's own TTL plus every persistent entry the
    /// caller names. Permissionless (no `require_auth` at all) — it only ever
    /// extends TTLs, never reads a balance, moves a token, or touches
    /// payment, so there's nothing here for an untrusted caller to abuse;
    /// anyone (typically a scheduled off-chain job) can pay to keep the
    /// collection warm.
    ///
    /// Every argument is a separate key family because they're keyed by
    /// different things, and **each one has to be named explicitly** — none
    /// of them can be derived on-chain from another. Reads don't help either:
    /// the getters are plain `get`s, and even if they extended, an app
    /// reading through simulation never persists the extension. So anything
    /// missing from this list simply expires:
    ///
    /// - `edition_ids` → `Edition` + `EditionPrices`
    /// - `edition_refs` → `EditionByRef`. The worst one to lose: without it
    ///   `buy_edition` can't resolve the ref, and `register_edition` would
    ///   register a *duplicate* edition rather than find the original.
    /// - `token_ids` → ownership (via `Consecutive`), `TokenEdition`, and any
    ///   `Listing`. `TokenEdition` matters as much as ownership — it's what
    ///   `art_meta`/`royalty_info` resolve through, so keeping a token alive
    ///   without it leaves a copy that's owned but has no metadata.
    /// - `unlocked` → `Unlocked(token_id, media_index)` for each pair. Losing
    ///   one silently re-locks reward content a holder already earned.
    ///
    /// `PurchaseByRef` is deliberately not covered: losing one costs only
    /// lookup data, and replaying a purchase still needs the buyer's
    /// signature and a fresh sequence number.
    ///
    /// Every id that resolves to nothing — never registered, wrong id, or
    /// since burned — is silently skipped, `token_ids` included. A sweep must
    /// not be brought down by one stale entry in the caller's list: the cost
    /// of failing is not a retry but the silent archival of everything else
    /// in that batch.
    fn extend_editions(e: &Env, edition_ids: &Vec<u32>) {
        for i in 0..edition_ids.len() {
            let edition_id = edition_ids.get(i).unwrap();

            let edition_key = DataKey::Edition(edition_id);
            if e.storage().persistent().has(&edition_key) {
                e.storage().persistent().extend_ttl(&edition_key, BUMP_THRESHOLD, BUMP_TO);
            }

            let prices_key = DataKey::EditionPrices(edition_id);
            if e.storage().persistent().has(&prices_key) {
                e.storage().persistent().extend_ttl(&prices_key, BUMP_THRESHOLD, BUMP_TO);
            }
        }
    }

    fn extend_edition_refs(e: &Env, edition_refs: &Vec<String>) {
        for i in 0..edition_refs.len() {
            let ref_key = DataKey::EditionByRef(edition_refs.get(i).unwrap());
            if e.storage().persistent().has(&ref_key) {
                e.storage().persistent().extend_ttl(&ref_key, BUMP_THRESHOLD, BUMP_TO);
            }
        }
    }

    fn extend_tokens(e: &Env, token_ids: &Vec<u32>) {
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();

            // Deliberately no `owner_of` existence assertion first. It panics
            // for a token never minted or since burned, and a Soroban panic
            // reverts everything — so one stale id in the caller's list would
            // renew *nothing* in the batch. The scheduler works from the app
            // database, which can hold ids the chain does not: a burned token,
            // a row from an earlier contract instance, a write that outlived
            // its transaction.
            //
            // `extend_ownership_ttl` guards each key with `has`, so an unknown
            // id simply extends nothing — matching every other kind here.
            Self::extend_ownership_ttl(e, token_id);

            let token_edition_key = DataKey::TokenEdition(token_id);
            if e.storage().persistent().has(&token_edition_key) {
                e.storage().persistent().extend_ttl(&token_edition_key, BUMP_THRESHOLD, BUMP_TO);
            }

            // Only listed tokens have one; an unlisted copy just skips.
            let listing_key = DataKey::Listing(token_id);
            if e.storage().persistent().has(&listing_key) {
                e.storage().persistent().extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);
            }
        }
    }

    fn extend_unlocked(e: &Env, unlocked: &Vec<(u32, u32)>) {
        for i in 0..unlocked.len() {
            let (token_id, media_index) = unlocked.get(i).unwrap();
            let unlocked_key = DataKey::Unlocked(token_id, media_index);
            if e.storage().persistent().has(&unlocked_key) {
                e.storage().persistent().extend_ttl(&unlocked_key, BUMP_THRESHOLD, BUMP_TO);
            }
        }
    }

    pub fn keep_alive(
        e: &Env,
        edition_ids: Vec<u32>,
        edition_refs: Vec<String>,
        token_ids: Vec<u32>,
        // `(token_id, media_index)` pairs — see `DataKey::Unlocked`.
        unlocked: Vec<(u32, u32)>,
    ) {
        if edition_ids.len() > MAX_KEEP_ALIVE_IDS
            || edition_refs.len() > MAX_KEEP_ALIVE_IDS
            || token_ids.len() > MAX_KEEP_ALIVE_IDS
            || unlocked.len() > MAX_KEEP_ALIVE_IDS
        {
            panic_with_error!(e, ArtError::TooManyKeepAliveIds);
        }

        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Self::extend_editions(e, &edition_ids);
        Self::extend_edition_refs(e, &edition_refs);
        Self::extend_tokens(e, &token_ids);
        Self::extend_unlocked(e, &unlocked);
    }

    /// Renews only this contract's own instance entry.
    ///
    /// The instance holds `Treasury`, `PriceAuthority`, `PlatformFeeBps`,
    /// `NextEditionId` and the wasm reference — lose it and nothing works, so
    /// this is the one worth being able to run on its own. Every other
    /// `keep_*_alive` renews it too; this is the no-argument case.
    pub fn keep_contract_alive(e: &Env) {
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    /// Renews `Edition` and `EditionPrices` for each id.
    ///
    /// One of the single-kind entry points, for an operator running a sweep by
    /// hand. They exist alongside [`Self::keep_alive`] because mixing kinds in
    /// one call is what makes a batch overflow the transaction footprint —
    /// here that is not expressible, and each cap is sized for its own kind.
    pub fn keep_editions_alive(e: &Env, edition_ids: Vec<u32>) {
        if edition_ids.len() > MAX_EDITIONS_PER_CALL {
            panic_with_error!(e, ArtError::TooManyKeepAliveIds);
        }
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Self::extend_editions(e, &edition_ids);
    }

    /// Renews `EditionByRef` for each ref — the entry whose loss is worst,
    /// since without it `buy_edition` cannot resolve a ref and
    /// `register_edition` would create a duplicate edition instead of finding
    /// the original.
    pub fn keep_edition_refs_alive(e: &Env, edition_refs: Vec<String>) {
        if edition_refs.len() > MAX_REFS_PER_CALL {
            panic_with_error!(e, ArtError::TooManyKeepAliveIds);
        }
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Self::extend_edition_refs(e, &edition_refs);
    }

    /// Renews ownership, `TokenEdition` and any `Listing` for each token.
    ///
    /// The lowest cap of the four: a token can touch four ledger entries where
    /// the other kinds touch one or two.
    pub fn keep_tokens_alive(e: &Env, token_ids: Vec<u32>) {
        if token_ids.len() > MAX_TOKENS_PER_CALL {
            panic_with_error!(e, ArtError::TooManyKeepAliveIds);
        }
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Self::extend_tokens(e, &token_ids);
    }

    /// Renews `Unlocked(token_id, media_index)` for each pair. Losing one
    /// silently re-locks reward content a holder already earned.
    pub fn keep_unlocked_alive(e: &Env, unlocked: Vec<(u32, u32)>) {
        if unlocked.len() > MAX_UNLOCKED_PER_CALL {
            panic_with_error!(e, ArtError::TooManyKeepAliveIds);
        }
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Self::extend_unlocked(e, &unlocked);
    }
}

// =============================================================================
// OpenZeppelin standard interfaces
// =============================================================================

#[contractimpl(contracttrait)]
impl NonFungibleToken for ArtNft {
    type ContractType = Consecutive;
}

// Deliberately no `NonFungibleBurnable`. Nothing ever called it, and it was
// the only way to reach a burned token with a live `Listing` — where `buy`
// panics inside OZ's `owner_of` instead of returning `ListingStale`. Removing
// it deletes the state rather than guarding it.

#[contractimpl(contracttrait)]
impl Ownable for ArtNft {}

#[contractimpl(contracttrait)]
impl Pausable for ArtNft {
    /// Emergency stop for `buy_edition`, `list`, `buy`, and
    /// `unlock_token_for`. Transfers, approvals, and `cancel_listing` stay
    /// open so holders can always exit a position while the platform is
    /// halted.
    #[only_owner]
    fn pause(e: &Env, _caller: Address) {
        pausable::pause(e);
    }

    #[only_owner]
    fn unpause(e: &Env, _caller: Address) {
        pausable::unpause(e);
    }
}

#[contractimpl]
impl Upgradeable for ArtNft {
    /// Replaces this contract's executable code in place — same address,
    /// same storage, so the platform can ship behavior changes (or fix a
    /// bug) without a redeploy and without anyone needing to be pointed at a
    /// new contract id. `#[only_owner]` ignores whatever address is passed
    /// as `_operator` and enforces the real owner from storage instead — see
    /// `stellar-macros`' docs on the macro.
    #[only_owner]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, _operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}
