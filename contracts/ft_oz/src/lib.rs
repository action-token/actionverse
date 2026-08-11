#![no_std]
//! Actionverse editioned-artwork token with a built-in marketplace.
//!
//! One deploy per artwork. An edition of 100 prints is genuinely fungible —
//! the copies are interchangeable — so an edition is modelled as a fungible
//! token whose total supply *is* the edition size and whose balance *is* how
//! many copies you hold. With `decimals = 0`, holding 3 units means owning 3
//! of the 100 prints.
//!
//! The whole supply is minted to the creator in the constructor and there is
//! no mint entry point afterwards. That is deliberate: "limited edition of
//! 100" is only a promise if the contract makes re-minting impossible. Supply
//! can only ever go down, via `burn`.
//!
//! Like `nft_oz`, the marketplace lives inside the token contract so that
//! `buy` settles payment and delivery in one invocation with only the buyer's
//! signature. Unlike `nft_oz`, many holders can each run their own listing of
//! the same edition, so listings are keyed by seller.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::TokenClient, Address, Env, MuxedAddress, String, Vec,
};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_macros::{only_owner, when_not_paused};
use stellar_tokens::fungible::{
    burnable::FungibleBurnable, emit_transfer, Base, FungibleToken,
};

mod test;

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

const BPS_DENOM: i128 = 10_000;
const MAX_PLATFORM_FEE_BPS: u32 = 1_000; // 10%
const MAX_ROYALTY_BPS: u32 = 5_000; // 50%

const MAX_NAME_LEN: u32 = 128;
const MAX_DESCRIPTION_LEN: u32 = 2_000;
const MAX_URI_LEN: u32 = 500;

/// Ceiling on how many distinct sellers can hold a listing for this edition at
/// once. `sellers` is walked linearly by `listings`, so it has to stay small
/// enough to read back in one invocation.
const MAX_SELLERS: u32 = 200;

// =============================================================================
// Data
// =============================================================================

/// The artwork this edition represents. Unlike the NFT contract, royalty basis
/// points live here — OpenZeppelin's royalties extension is non-fungible-only,
/// so this contract enforces the split itself in `buy`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtMeta {
    pub title: String,
    pub description: String,
    pub thumbnail_url: String,
    pub media_url: String,
    pub media_type: String,
    pub creator: Address,
    pub royalty_bps: u32,
    /// Edition size at deploy. `total_supply` drifts below this as holders
    /// burn copies, so this is kept as the original print run.
    pub edition_size: i128,
}

/// Author-supplied fields for a new edition, grouped into one argument.
///
/// Soroban's contract spec caps a function at 10 parameters
/// (`SCSpecFunctionV0.inputs<10>` in the XDR). The flat constructor had 13,
/// which the Rust CLI accepts but the JS SDK refuses to parse — every client
/// call then dies with "saw 13 length VarArray, max allowed is 10". Keep this
/// grouped rather than flattening it back out.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtInput {
    pub title: String,
    pub description: String,
    pub thumbnail_url: String,
    pub media_url: String,
    pub media_type: String,
    pub royalty_bps: u32,
}

/// One holder's offer to sell some of their copies.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    /// Price for a single copy, in `payment_token`'s raw units.
    pub price: i128,
    /// Copies still for sale under this listing.
    pub available: i128,
    pub payment_token: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleBreakdown {
    pub total: i128,
    pub platform_fee: i128,
    pub royalty: i128,
    pub seller_amount: i128,
}

/// Variant *names* are what land in the ledger for `#[contracttype]` enums, so
/// these must not collide with OpenZeppelin's own `FungibleStorageKey`
/// (`Meta`, `TotalSupply`, `Balance`, `Allowance`) — a shared name silently
/// aliases the two structs onto the same storage entry.
#[contracttype]
pub enum DataKey {
    ArtInfo,
    Listing(Address),
    /// Every address that has ever listed, since Soroban storage has no prefix
    /// scan to enumerate `Listing` keys.
    Sellers,
    PlatformFeeBps,
    Treasury,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EditionError {
    InvalidAmount = 400,
    InvalidFee = 401,
    InvalidRoyalty = 402,
    NameTooLong = 403,
    DescriptionTooLong = 404,
    InvalidUri = 405,
    InvalidEditionSize = 406,
    ListingNotFound = 407,
    SelfPurchase = 408,
    NotEnoughAvailable = 409,
    /// The seller has fewer copies than their listing offers — they moved or
    /// burned some after listing.
    ListingStale = 410,
    TooManySellers = 411,
}

// =============================================================================
// Events
// =============================================================================

#[contractevent]
pub struct EditionCreated {
    #[topic]
    pub creator: Address,
    pub edition_size: i128,
    pub royalty_bps: u32,
}

#[contractevent]
pub struct Listed {
    #[topic]
    pub seller: Address,
    pub price: i128,
    pub available: i128,
    pub payment_token: Address,
}

#[contractevent]
pub struct Purchased {
    #[topic]
    pub buyer: Address,
    #[topic]
    pub seller: Address,
    pub quantity: i128,
    pub price: i128,
    pub royalty_paid: i128,
    pub platform_fee_paid: i128,
}

#[contractevent]
pub struct ListingCancelled {
    #[topic]
    pub seller: Address,
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct ArtEdition;

#[contractimpl]
impl ArtEdition {
    /// Deploys one artwork's edition and mints the entire print run to its
    /// creator, optionally listing that whole print run for sale in the same
    /// transaction — pass `price: 0` to skip listing and just mint (a
    /// negative price is rejected, same as it would be by `list`); pass a
    /// positive `price` to have the deploy transaction also create the
    /// listing atomically. There is no separate `mint`-only entry point the
    /// way `nft_oz` has `mint_art` alongside `mint_and_list`, because minting
    /// an edition can only ever happen once, at deploy — so this constructor
    /// covers both of `nft_oz`'s cases by making the listing optional rather
    /// than by being two functions. `list` remains available afterward for a
    /// mint-only deploy, or for anyone re-listing later.
    ///
    /// Deploy-and-list used to require deploy, then a separate follow-up
    /// `list` transaction. That second call had to read the deployed
    /// contract's address and state back through the public Soroban RPC pool,
    /// which can take a moment to agree with itself across backend nodes — a
    /// read landing on a lagging node sees a not-yet-existing contract, and a
    /// transaction built against that is invalid before it even reaches the
    /// network. Folding an *optional* listing into the constructor removes
    /// that second transaction for the common case without losing the
    /// mint-only case: there is nothing left to read back before selling can
    /// start, and nothing forcing a sale to start immediately either.
    ///
    /// `decimals` should be `0` for a normal print run so that one unit is one
    /// copy; it is a parameter only so fractional editions remain possible.
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        e: &Env,
        creator: Address,
        treasury: Address,
        platform_fee_bps: u32,
        edition_size: i128,
        decimals: u32,
        name: String,
        symbol: String,
        art: ArtInput,
        price: i128,
        payment_token: Address,
    ) {
        let ArtInput {
            title,
            description,
            thumbnail_url,
            media_url,
            media_type,
            royalty_bps,
        } = art;

        if platform_fee_bps > MAX_PLATFORM_FEE_BPS {
            panic_with_error!(e, EditionError::InvalidFee);
        }
        if royalty_bps > MAX_ROYALTY_BPS {
            panic_with_error!(e, EditionError::InvalidRoyalty);
        }
        if edition_size <= 0 {
            panic_with_error!(e, EditionError::InvalidEditionSize);
        }
        // `0` deliberately means "don't list yet" (checked in `do_list` for
        // every other caller too) rather than being rejected here; only a
        // genuinely malformed negative price is an error at this point.
        if price < 0 {
            panic_with_error!(e, EditionError::InvalidAmount);
        }
        if title.len() == 0 || title.len() > MAX_NAME_LEN {
            panic_with_error!(e, EditionError::NameTooLong);
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            panic_with_error!(e, EditionError::DescriptionTooLong);
        }
        if thumbnail_url.len() == 0 || thumbnail_url.len() > MAX_URI_LEN {
            panic_with_error!(e, EditionError::InvalidUri);
        }
        if media_url.len() == 0 || media_url.len() > MAX_URI_LEN {
            panic_with_error!(e, EditionError::InvalidUri);
        }

        ownable::set_owner(e, &creator);
        Base::set_metadata(e, decimals, name, symbol);

        let meta = ArtMeta {
            title,
            description,
            thumbnail_url,
            media_url,
            media_type,
            creator: creator.clone(),
            royalty_bps,
            edition_size,
        };
        e.storage().instance().set(&DataKey::ArtInfo, &meta);
        e.storage().instance().set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        e.storage().instance().set(&DataKey::Treasury, &treasury);

        Base::mint(e, &creator, edition_size);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        EditionCreated { creator: creator.clone(), edition_size, royalty_bps }.publish(e);

        if price > 0 {
            Self::do_list(e, &creator, price, edition_size, payment_token);
        }
    }

    pub fn art_meta(e: &Env) -> Option<ArtMeta> {
        e.storage().instance().get(&DataKey::ArtInfo)
    }

    // -------------------------------------------------------------------------
    // Marketplace
    // -------------------------------------------------------------------------

    /// Offers `quantity` of the caller's copies at `price` each, replacing any
    /// previous listing by the same seller.
    ///
    /// Copies are not escrowed — the seller keeps them and can still transfer
    /// or burn — so `buy` re-checks the seller's balance before settling.
    #[when_not_paused]
    pub fn list(e: &Env, seller: Address, price: i128, quantity: i128, payment_token: Address) {
        seller.require_auth();
        Self::do_list(e, &seller, price, quantity, payment_token);
    }

    fn do_list(e: &Env, seller: &Address, price: i128, quantity: i128, payment_token: Address) {
        if price <= 0 || quantity <= 0 {
            panic_with_error!(e, EditionError::InvalidAmount);
        }
        if Base::balance(e, seller) < quantity {
            panic_with_error!(e, EditionError::ListingStale);
        }

        let listing = Listing {
            seller: seller.clone(),
            price,
            available: quantity,
            payment_token: payment_token.clone(),
        };
        Self::put_listing(e, &listing);
        Self::register_seller(e, seller);

        Listed { seller: seller.clone(), price, available: quantity, payment_token }.publish(e);
    }

    pub fn cancel_listing(e: &Env, seller: Address) {
        seller.require_auth();

        if Self::listing(e, seller.clone()).is_none() {
            panic_with_error!(e, EditionError::ListingNotFound);
        }
        e.storage().persistent().remove(&DataKey::Listing(seller.clone()));

        ListingCancelled { seller }.publish(e);
    }

    pub fn listing(e: &Env, seller: Address) -> Option<Listing> {
        e.storage().persistent().get(&DataKey::Listing(seller))
    }

    /// Every live listing for this edition, so buyers can pick who to buy from.
    pub fn listings(e: &Env) -> Vec<Listing> {
        let sellers: Vec<Address> =
            e.storage().instance().get(&DataKey::Sellers).unwrap_or(Vec::new(e));

        let mut out = Vec::new(e);
        for seller in sellers.iter() {
            if let Some(listing) = Self::listing(e, seller) {
                if listing.available > 0 {
                    out.push_back(listing);
                }
            }
        }
        out
    }

    /// Read-only preview of what buying `quantity` from `seller` costs and how
    /// it splits, for showing the buyer before they sign.
    pub fn sale_breakdown(e: &Env, seller: Address, quantity: i128) -> Option<SaleBreakdown> {
        let listing = Self::listing(e, seller)?;
        Some(Self::compute_breakdown(e, &listing, quantity))
    }

    /// Buys `quantity` copies from `seller` in one invocation.
    ///
    /// Only the buyer signs — the seller consented by listing, and copies move
    /// through the low-level [`Base::update`] rather than [`Base::transfer`],
    /// which would require the seller's signature at purchase time.
    #[when_not_paused]
    pub fn buy(e: &Env, buyer: Address, seller: Address, quantity: i128) {
        buyer.require_auth();

        if buyer == seller {
            panic_with_error!(e, EditionError::SelfPurchase);
        }
        if quantity <= 0 {
            panic_with_error!(e, EditionError::InvalidAmount);
        }

        let mut listing = Self::listing(e, seller.clone())
            .unwrap_or_else(|| panic_with_error!(e, EditionError::ListingNotFound));

        if listing.available < quantity {
            panic_with_error!(e, EditionError::NotEnoughAvailable);
        }
        // The seller may have moved or burned copies since listing; settling
        // would otherwise pay them for copies they can no longer deliver.
        if Base::balance(e, &seller) < quantity {
            panic_with_error!(e, EditionError::ListingStale);
        }

        let split = Self::compute_breakdown(e, &listing, quantity);
        let meta: ArtMeta = e.storage().instance().get(&DataKey::ArtInfo).unwrap();

        // --- effects: settle all contract state before any external call, so a
        // hostile `payment_token` can't reenter mid-sale.
        listing.available -= quantity;
        if listing.available == 0 {
            e.storage().persistent().remove(&DataKey::Listing(seller.clone()));
        } else {
            Self::put_listing(e, &listing);
        }
        Base::update(e, Some(&seller), Some(&buyer), quantity);
        emit_transfer(e, &seller, &buyer, None, quantity);

        // --- interactions
        let token = TokenClient::new(e, &listing.payment_token);
        if split.platform_fee > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            token.transfer(&buyer, &treasury, &split.platform_fee);
        }
        if split.royalty > 0 {
            token.transfer(&buyer, &meta.creator, &split.royalty);
        }
        token.transfer(&buyer, &seller, &split.seller_amount);

        Purchased {
            buyer,
            seller,
            quantity,
            price: split.total,
            royalty_paid: split.royalty,
            platform_fee_paid: split.platform_fee,
        }
        .publish(e);
    }

    fn compute_breakdown(e: &Env, listing: &Listing, quantity: i128) -> SaleBreakdown {
        let meta: ArtMeta = e.storage().instance().get(&DataKey::ArtInfo).unwrap();
        let total = listing.price * quantity;

        let fee_bps = Self::platform_fee_bps(e) as i128;
        let platform_fee = total * fee_bps / BPS_DENOM;

        // Royalty is a resale mechanism. On the primary sale the creator is
        // the seller, so paying it would just route their own money back to
        // them through an extra transfer.
        let royalty = if listing.seller == meta.creator {
            0
        } else {
            total * (meta.royalty_bps as i128) / BPS_DENOM
        };

        SaleBreakdown {
            total,
            platform_fee,
            royalty,
            seller_amount: total - platform_fee - royalty,
        }
    }

    fn put_listing(e: &Env, listing: &Listing) {
        let key = DataKey::Listing(listing.seller.clone());
        e.storage().persistent().set(&key, listing);
        e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
    }

    fn register_seller(e: &Env, seller: &Address) {
        let mut sellers: Vec<Address> =
            e.storage().instance().get(&DataKey::Sellers).unwrap_or(Vec::new(e));
        if sellers.contains(seller) {
            return;
        }
        if sellers.len() >= MAX_SELLERS {
            panic_with_error!(e, EditionError::TooManySellers);
        }
        sellers.push_back(seller.clone());
        e.storage().instance().set(&DataKey::Sellers, &sellers);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// The platform fee and treasury are fixed at deploy and have no setter.
    ///
    /// The creator is this contract's `owner` (so they can pause their own
    /// edition), and an owner-gated setter would therefore let them drop the
    /// platform's cut to zero on their own sales. Freezing it also means a
    /// collector can read the fee once and know it can't be raised under them
    /// later. New fee levels apply to newly deployed editions only.
    pub fn platform_fee_bps(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::PlatformFeeBps).unwrap_or(0)
    }

    pub fn treasury(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::Treasury)
    }
}

// =============================================================================
// OpenZeppelin standard interfaces
// =============================================================================

/// SEP-41 compliance needs both `FungibleToken` and `FungibleBurnable`, so
/// wallets and explorers treat an edition as a first-class token.
#[contractimpl(contracttrait)]
impl FungibleToken for ArtEdition {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl FungibleBurnable for ArtEdition {}

#[contractimpl(contracttrait)]
impl Ownable for ArtEdition {}

#[contractimpl(contracttrait)]
impl Pausable for ArtEdition {
    /// Halts `list` and `buy`. Direct transfers, approvals, and
    /// `cancel_listing` stay open so holders can always exit.
    #[only_owner]
    fn pause(e: &Env, _caller: Address) {
        pausable::pause(e);
    }

    #[only_owner]
    fn unpause(e: &Env, _caller: Address) {
        pausable::unpause(e);
    }
}
