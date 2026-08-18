#![no_std]
//! Actionverse art NFT collection with a built-in marketplace.
//!
//! One shared collection contract that every creator's work lives in — there
//! is no per-creator deploy. A creator's submission ("edition") is bounded
//! artwork with a fixed `supply` (1 for a classic 1-of-1, N for a limited
//! run); `Nft.collectionId` in the database groups pieces for display, and
//! `EditionMeta.creator`/`royalty_bps` groups every token minted from one
//! edition on-chain.
//!
//! **Creation never touches this contract.** An edition's metadata and price
//! grid are decided entirely off-chain (the storefront's create form writes a
//! database row and nothing else) and only reach the chain the first time
//! someone buys — [`Self::buy_edition`] both registers the edition (the first
//! time its `edition_ref` is seen) and mints straight to the buyer in the
//! same call, so the creator never signs a transaction and pays no gas to
//! list. Every following purchase of the same edition just mints the next
//! consecutive range of token ids to that buyer.
//!
//! The marketplace lives *inside* the token contract on purpose. A standalone
//! market contract would need the seller to `approve` it before listing (an
//! extra signature and an extra failure mode); because settlement happens in
//! the same contract that owns the ledger entries, both primary purchase and
//! resale `buy` move the token via the low-level [`Consecutive::update`] and
//! the party giving up the token never signs the purchase itself.
//!
//! Bulk minting uses OpenZeppelin's [`Consecutive`] extension rather than
//! [`Base`]'s one-write-per-token `sequential_mint`: a purchase of `n` copies
//! stores ownership once per bucket instead of once per token, which is what
//! makes minting an entire edition run to one buyer in a single call
//! affordable. Royalty/metadata storage (from [`Base`]) is independent of the
//! ownership engine and stays in use unchanged alongside `Consecutive`.

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
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, consecutive::Consecutive, emit_transfer, Base, NonFungibleToken};

mod test;

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

/// Bump this before building/deploying each new wasm so `version()` reflects
/// what's actually running on-chain — paired with the `Upgradeable` impl
/// below, this is how future changes ship without a redeploy (new address).
const CONTRACT_VERSION: u32 = 3;

/// Basis-points denominator for fee/royalty math (10_000 = 100%).
const BPS_DENOM: i128 = 10_000;
/// Hard ceiling on what the platform can ever charge, enforced in the
/// constructor and in `set_platform_fee` so an admin key can't be used to
/// silently take an unbounded cut of every sale.
const MAX_PLATFORM_FEE_BPS: u32 = 1_000; // 10%
const MAX_ROYALTY_BPS: u32 = 5_000; // 50%

// Bounded string lengths so one entry can't bloat ledger storage unboundedly.
const MAX_NAME_LEN: u32 = 128;
const MAX_DESCRIPTION_LEN: u32 = 2_000;
const MAX_URI_LEN: u32 = 500;

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

// =============================================================================
// Data
// =============================================================================

/// Off-chain-media descriptor returned by [`ArtNft::art_meta`] for a single
/// token — synthesized from that token's edition, not stored per-token.
/// Royalty basis points are deliberately absent — [`ArtNft::royalty_info`]
/// stays the single source of truth for any marketplace reading this
/// collection.
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

/// Author-supplied fields for a new edition, grouped into one argument so
/// `buy_edition` (which also needs `purchase_ref`, `payment_token` and
/// `quantity`) stays under Soroban's 10-parameter-per-function cap
/// (`SCSpecFunctionV0.inputs<10>`).
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

/// What a single `buy_edition` call minted, recorded so the caller can
/// resolve exactly which token ids they were assigned after the fact — see
/// the doc comment on [`ArtNft::buy_edition`] for why this exists instead of
/// reading the call's return value back off a confirmed transaction.
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

/// At most one listing per token, since a specific minted copy has exactly
/// one owner who could be selling it. Purely secondary-market: an edition's
/// primary sale is priced via `EditionPrices`, not a `Listing`. A reseller
/// prices their own copy independently of whatever currencies the creator
/// originally offered — `prices` is the same shape as `EditionPrices`, just
/// scoped to one token instead of a whole edition, so a buyer picks which
/// currency to pay in exactly like a primary purchase does.
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

/// Variant *names* are what land in the ledger for `#[contracttype]` enums, so
/// these must not collide with OpenZeppelin's own storage keys (`Owner`,
/// `Balance`, `Approval`, `OwnershipBucket`, `BurnedToken`,
/// `TokenRoyalty`/`DefaultRoyalty`, `Metadata`) — a shared name silently
/// aliases two different structs onto the same storage entry.
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
    /// The listing's seller no longer owns the token — it was transferred or
    /// burned out from under the listing.
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
    ) {
        if platform_fee_bps > MAX_PLATFORM_FEE_BPS {
            panic_with_error!(e, ArtError::InvalidFee);
        }

        ownable::set_owner(e, &owner);
        Base::set_metadata(e, base_uri, name, symbol);

        e.storage().instance().set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    // -------------------------------------------------------------------------
    // Buying (mints on demand — see the module doc for why there's no
    // separate "mint" entry point)
    // -------------------------------------------------------------------------

    /// Buys `quantity` copies of an edition, minting them straight to
    /// `buyer` in the same call that takes payment.
    ///
    /// The *first* purchase of a given `edition_ref` also registers the
    /// edition from `edition` — every later purchase of the same ref ignores
    /// `edition` entirely and just mints the next range against the already-
    /// registered data. This is why the creator never has to sign anything
    /// to "list": `edition`'s fields are backend-supplied from the trusted
    /// database row (the same trust model `mint_and_list` used to build its
    /// XDR server-side under), and `EditionByRef` dedup means only that first
    /// call can ever set them — nothing here requires the creator's
    /// authorization, only the buyer's.
    ///
    /// `purchase_ref` is the caller's own identifier for this purchase
    /// attempt (a fresh id per attempt, not per edition). It's recorded so
    /// the minted range can be looked up afterwards with
    /// [`Self::purchase_by_ref`] — this repo's pinned `stellar-sdk` cannot
    /// decode protocol-27 transaction meta, so neither the return value nor
    /// emitted events can be read back off a *confirmed* transaction (see
    /// `contracts/nft_oz/README.md`/`src/lib/stellar/oz/nft.ts`). Re-deriving
    /// "the last N minted" from `EditionMeta.minted` after the fact isn't
    /// safe either — two buyers purchasing the same edition concurrently
    /// would race for it — so instead each purchase gets a receipt keyed by
    /// its own caller-chosen reference, the same idiom `art_ref`/
    /// `token_by_ref` already used for single mints, generalized to a range.
    /// Reusing a `purchase_ref` is rejected, which also makes a retried
    /// purchase attempt safe to re-submit.
    #[when_not_paused]
    pub fn buy_edition(
        e: &Env,
        buyer: Address,
        edition_ref: String,
        edition: EditionInput,
        purchase_ref: String,
        payment_token: Address,
        quantity: u32,
    ) -> (u32, u32) {
        buyer.require_auth();

        if quantity == 0 || quantity > MAX_QUANTITY_PER_BUY {
            panic_with_error!(e, ArtError::QuantityTooLarge);
        }
        if purchase_ref.len() == 0 || purchase_ref.len() > MAX_NAME_LEN {
            panic_with_error!(e, ArtError::PurchaseRefTooLong);
        }
        if e.storage().persistent().has(&DataKey::PurchaseByRef(purchase_ref.clone())) {
            panic_with_error!(e, ArtError::DuplicatePurchaseRef);
        }

        let edition_id = Self::resolve_or_create_edition(e, edition_ref, edition);
        let mut meta: EditionMeta =
            e.storage().persistent().get(&DataKey::Edition(edition_id)).unwrap();

        if quantity > meta.supply - meta.minted {
            panic_with_error!(e, ArtError::SupplyExhausted);
        }

        let prices: Vec<PriceEntry> =
            e.storage().persistent().get(&DataKey::EditionPrices(edition_id)).unwrap();
        let unit_price = Self::price_for(e, &prices, &payment_token);

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
        let total = unit_price * quantity as i128;
        let fee_bps = Self::platform_fee_bps(e) as i128;
        let platform_fee = total * fee_bps / BPS_DENOM;

        let token = TokenClient::new(e, &payment_token);
        if platform_fee > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            token.transfer(&buyer, &treasury, &platform_fee);
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
        }
        .publish(e);

        (first_id, last_id)
    }

    fn resolve_or_create_edition(e: &Env, edition_ref: String, edition: EditionInput) -> u32 {
        let ref_key = DataKey::EditionByRef(edition_ref.clone());
        if let Some(id) = e.storage().persistent().get::<_, u32>(&ref_key) {
            return id;
        }

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

        e.storage().persistent().set(&ref_key, &edition_id);
        e.storage().persistent().extend_ttl(&ref_key, BUMP_THRESHOLD, BUMP_TO);

        EditionCreated { edition_id, creator, royalty_bps, supply }.publish(e);

        edition_id
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
    /// escrow the token — the owner keeps it and can still transfer or burn
    /// it, which is why `buy` re-checks ownership rather than trusting the
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
    pub fn buy(e: &Env, buyer: Address, token_id: u32, payment_token: Address) {
        buyer.require_auth();
        Self::do_buy(e, &buyer, token_id, &payment_token);
    }

    /// Buys several listed tokens at once, all paid in the same currency —
    /// one signature instead of one `buy` call per token. The common case:
    /// a buyer picking N copies pooled across one or more resale listings
    /// for the same edition. Listings can belong to different sellers; each
    /// token still settles (payment split, ownership transfer, `Purchased`
    /// event) exactly as an individual `buy` would, just in one invocation.
    #[when_not_paused]
    pub fn buy_batch(e: &Env, buyer: Address, token_ids: Vec<u32>, payment_token: Address) {
        buyer.require_auth();
        if token_ids.len() == 0 || token_ids.len() > MAX_QUANTITY_PER_BUY {
            panic_with_error!(e, ArtError::QuantityTooLarge);
        }
        for i in 0..token_ids.len() {
            Self::do_buy(e, &buyer, token_ids.get(i).unwrap(), &payment_token);
        }
    }

    fn do_buy(e: &Env, buyer: &Address, token_id: u32, payment_token: &Address) {
        let listing = Self::listing(e, token_id)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::ListingNotFound));

        if *buyer == listing.seller {
            panic_with_error!(e, ArtError::SelfPurchase);
        }
        // The seller could have transferred or burned the token since listing;
        // settling against a stale listing would pay them for something they
        // no longer own.
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
        if split.platform_fee > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            token.transfer(buyer, &treasury, &split.platform_fee);
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

    /// The contract build currently running on-chain — bump
    /// `CONTRACT_VERSION` on every release that changes behavior so this
    /// stays truthful after an `upgrade`.
    pub fn version(_e: &Env) -> u32 {
        CONTRACT_VERSION
    }
}

// =============================================================================
// OpenZeppelin standard interfaces
// =============================================================================

#[contractimpl(contracttrait)]
impl NonFungibleToken for ArtNft {
    type ContractType = Consecutive;
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for ArtNft {}

#[contractimpl(contracttrait)]
impl Ownable for ArtNft {}

#[contractimpl(contracttrait)]
impl Pausable for ArtNft {
    /// Emergency stop for `buy_edition`, `list`, and `buy`. Transfers,
    /// approvals, and `cancel_listing` stay open so holders can always exit a
    /// position while the platform is halted.
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
