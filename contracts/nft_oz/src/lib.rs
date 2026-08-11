#![no_std]
//! Actionverse 1-of-1 art NFT collection with a built-in marketplace.
//!
//! One shared collection contract that every creator mints into — there is no
//! per-creator deploy, so minting costs a creator nothing beyond the mint fee.
//! `Nft.collectionId` in the database groups pieces for display; on-chain they
//! all live here and are told apart by `token_id`.
//!
//! The marketplace lives *inside* the token contract on purpose. A standalone
//! market contract would need the seller to `approve` it before listing (an
//! extra signature and an extra failure mode); because settlement happens in
//! the same contract that owns the ledger entries, `buy` moves the token via
//! the low-level [`Base::update`] and the seller never signs the purchase.
//!
//! Editioned artwork is *not* handled here — an edition is a fungible supply,
//! so it gets its own `ft_oz` contract per piece. This contract is strictly
//! one token, one owner.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::TokenClient, Address, Env, String,
};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_macros::{only_owner, when_not_paused};
use stellar_tokens::non_fungible::{
    burnable::NonFungibleBurnable, emit_transfer, royalties::NonFungibleRoyalties, Base,
    NonFungibleToken,
};

mod test;

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

/// Basis-points denominator for fee/royalty math (10_000 = 100%).
const BPS_DENOM: i128 = 10_000;
/// Hard ceiling on what the platform can ever charge, enforced in the
/// constructor and in `set_platform_fee` so an admin key can't be used to
/// silently take an unbounded cut of every sale.
const MAX_PLATFORM_FEE_BPS: u32 = 1_000; // 10%
const MAX_ROYALTY_BPS: u32 = 5_000; // 50%

// Bounded string lengths so one mint can't bloat ledger storage unboundedly.
const MAX_NAME_LEN: u32 = 128;
const MAX_DESCRIPTION_LEN: u32 = 2_000;
const MAX_URI_LEN: u32 = 500;

// =============================================================================
// Data
// =============================================================================

/// Off-chain-media descriptor for one piece. Royalty basis points are
/// deliberately absent — those live in the OpenZeppelin royalties extension so
/// `royalty_info` stays the single source of truth for any marketplace reading
/// this collection.
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

/// Author-supplied fields for a new piece, grouped into one argument so
/// `mint_and_list` (which also needs `price` and `payment_token`) stays under
/// Soroban's 10-parameter-per-function cap (`SCSpecFunctionV0.inputs<10>`) —
/// the same limit that forced `ft_oz::ArtInput` into existence.
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

/// At most one listing per token, since a 1-of-1 has exactly one owner who
/// could be selling it.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub price: i128,
    /// SEP-41 token the price is denominated in — the native XLM SAC by
    /// default, but stored per listing so a platform token or USDC can be
    /// accepted later without changing this contract.
    pub payment_token: Address,
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
/// these must not collide with OpenZeppelin's own `NFTStorageKey` (`Owner`,
/// `Balance`, `Approval`, `ApprovalForAll`, `Metadata`) — a shared name
/// silently aliases two different structs onto the same storage entry.
#[contracttype]
pub enum DataKey {
    ArtMeta(u32),
    Listing(u32),
    /// Maps a caller-supplied off-chain reference to the token it minted.
    TokenByRef(String),
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
    NotCreator = 310,
    /// This `ref` already minted a token — guards against double-minting the
    /// same off-chain record.
    DuplicateRef = 311,
    RefTooLong = 312,
}

// =============================================================================
// Events
// =============================================================================

#[contractevent]
pub struct ArtMinted {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub creator: Address,
    pub royalty_bps: u32,
}

#[contractevent]
pub struct Listed {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub seller: Address,
    pub price: i128,
    pub payment_token: Address,
}

#[contractevent]
pub struct Purchased {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub buyer: Address,
    pub seller: Address,
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
    // Minting
    // -------------------------------------------------------------------------

    /// Mints a 1-of-1 to `creator` and returns its `token_id`.
    ///
    /// Open to any address that signs as its own `creator` — this is a public
    /// collection, and gating it behind an allowlist is a product decision
    /// made off-chain (the tRPC layer only offers this to approved creators).
    /// Note the auth is on `creator`, the *minter*, not on a recipient: a
    /// recipient-authorized mint would let anyone mint tokens to themselves in
    /// someone else's name.
    ///
    /// `art_ref` is the caller's own identifier for this piece (the database
    /// row id). It is recorded so the minted `token_id` can be looked up later
    /// with [`Self::token_by_ref`] — the client cannot read it out of the
    /// transaction result, because this repo's pinned `stellar-sdk` cannot
    /// decode protocol-27 transaction meta. Minting twice under one `art_ref`
    /// is rejected, which also makes a retried mint safe.
    ///
    /// Mints without listing. Kept for programmatic use (e.g. minting into a
    /// collection without immediately selling); the storefront's "create for
    /// sale" flow uses [`Self::mint_and_list`] instead — see its docs for why.
    #[when_not_paused]
    pub fn mint_art(e: &Env, creator: Address, art_ref: String, art: ArtInput) -> u32 {
        creator.require_auth();
        Self::do_mint(e, &creator, art_ref, art)
    }

    /// Mints and lists in one signed call.
    ///
    /// Two separate transactions here — mint, then a follow-up `list` — used
    /// to be how the storefront created a for-sale piece. That shape needs the
    /// second transaction to read back the first one's effects (the new
    /// `token_id`, the account's bumped sequence number) through the public
    /// Soroban RPC pool, which propagates those effects to different backend
    /// nodes at different times. A read landing on a lagging node reads stale
    /// state, and a transaction built from stale state is invalid — sometimes
    /// caught here as a clear contract error, sometimes only failing deep
    /// inside a wallet as an opaque submission error. There is no gap to lose
    /// a race in when it's one call: mint and list happen atomically, so there
    /// is nothing for a second transaction to read back before it can proceed.
    #[when_not_paused]
    pub fn mint_and_list(
        e: &Env,
        creator: Address,
        art_ref: String,
        art: ArtInput,
        price: i128,
        payment_token: Address,
    ) -> u32 {
        creator.require_auth();
        let token_id = Self::do_mint(e, &creator, art_ref, art);
        Self::do_list(e, &creator, token_id, price, payment_token);
        token_id
    }

    fn do_mint(e: &Env, creator: &Address, art_ref: String, art: ArtInput) -> u32 {
        let ArtInput { title, description, thumbnail_url, media_url, media_type, royalty_bps } = art;

        if art_ref.len() == 0 || art_ref.len() > MAX_NAME_LEN {
            panic_with_error!(e, ArtError::RefTooLong);
        }
        if e.storage().persistent().has(&DataKey::TokenByRef(art_ref.clone())) {
            panic_with_error!(e, ArtError::DuplicateRef);
        }
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

        let token_id = Base::sequential_mint(e, creator);
        Base::set_token_royalty(e, token_id, creator, royalty_bps);

        let meta = ArtMeta {
            title,
            description,
            thumbnail_url,
            media_url,
            media_type,
            creator: creator.clone(),
        };
        let key = DataKey::ArtMeta(token_id);
        e.storage().persistent().set(&key, &meta);
        e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        let ref_key = DataKey::TokenByRef(art_ref);
        e.storage().persistent().set(&ref_key, &token_id);
        e.storage().persistent().extend_ttl(&ref_key, BUMP_THRESHOLD, BUMP_TO);

        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        ArtMinted { token_id, creator: creator.clone(), royalty_bps }.publish(e);

        token_id
    }

    /// Resolves the caller's off-chain reference back to the minted token id.
    /// This is how the backend confirms a mint landed and learns its id.
    pub fn token_by_ref(e: &Env, art_ref: String) -> Option<u32> {
        e.storage().persistent().get(&DataKey::TokenByRef(art_ref))
    }

    pub fn art_meta(e: &Env, token_id: u32) -> Option<ArtMeta> {
        let key = DataKey::ArtMeta(token_id);
        let meta: Option<ArtMeta> = e.storage().persistent().get(&key);
        if meta.is_some() {
            e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        }
        meta
    }

    // -------------------------------------------------------------------------
    // Marketplace
    // -------------------------------------------------------------------------

    /// Lists the caller's token for sale. Listing does not escrow the token —
    /// the owner keeps it and can still transfer or burn it, which is why
    /// `buy` re-checks ownership rather than trusting the stored seller.
    #[when_not_paused]
    pub fn list(e: &Env, seller: Address, token_id: u32, price: i128, payment_token: Address) {
        seller.require_auth();
        Self::do_list(e, &seller, token_id, price, payment_token);
    }

    fn do_list(e: &Env, seller: &Address, token_id: u32, price: i128, payment_token: Address) {
        if price <= 0 {
            panic_with_error!(e, ArtError::InvalidAmount);
        }
        if Base::owner_of(e, token_id) != *seller {
            panic_with_error!(e, ArtError::NotSeller);
        }

        let listing = Listing { seller: seller.clone(), price, payment_token: payment_token.clone() };
        let key = DataKey::Listing(token_id);
        e.storage().persistent().set(&key, &listing);
        e.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        Listed { token_id, seller: seller.clone(), price, payment_token }.publish(e);
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

    /// Read-only preview of `buy`'s payment split, so the UI can show the
    /// buyer exactly where their money goes before they sign.
    pub fn sale_breakdown(e: &Env, token_id: u32) -> Option<SaleBreakdown> {
        let listing = Self::listing(e, token_id)?;
        Some(Self::compute_breakdown(e, token_id, &listing))
    }

    /// Buys a listed token in a single invocation: payment out, token in.
    ///
    /// Only the buyer signs. The seller's consent was given when they created
    /// the listing, and the token moves via [`Base::update`] (the low-level,
    /// no-auth path) rather than [`Base::transfer`], which would demand the
    /// seller's signature at purchase time.
    #[when_not_paused]
    pub fn buy(e: &Env, buyer: Address, token_id: u32) {
        buyer.require_auth();

        let listing = Self::listing(e, token_id)
            .unwrap_or_else(|| panic_with_error!(e, ArtError::ListingNotFound));

        if buyer == listing.seller {
            panic_with_error!(e, ArtError::SelfPurchase);
        }
        // The seller could have transferred or burned the token since listing;
        // settling against a stale listing would pay them for something they
        // no longer own.
        if Base::owner_of(e, token_id) != listing.seller {
            panic_with_error!(e, ArtError::ListingStale);
        }

        let split = Self::compute_breakdown(e, token_id, &listing);

        // --- effects: all contract state settles before any external call, so
        // a hostile `payment_token` can't reenter and observe a half-applied
        // sale (checks-effects-interactions).
        e.storage().persistent().remove(&DataKey::Listing(token_id));
        Base::update(e, Some(&listing.seller), Some(&buyer), token_id);
        emit_transfer(e, &listing.seller, &buyer, token_id);

        // --- interactions
        let token = TokenClient::new(e, &listing.payment_token);
        if split.platform_fee > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            token.transfer(&buyer, &treasury, &split.platform_fee);
        }
        if split.royalty > 0 {
            token.transfer(&buyer, &split.royalty_receiver, &split.royalty);
        }
        token.transfer(&buyer, &listing.seller, &split.seller_amount);

        Purchased {
            token_id,
            buyer,
            seller: listing.seller,
            price: split.total,
            royalty_paid: split.royalty,
            platform_fee_paid: split.platform_fee,
        }
        .publish(e);
    }

    fn compute_breakdown(e: &Env, token_id: u32, listing: &Listing) -> SaleBreakdown {
        let total = listing.price;
        let fee_bps = Self::platform_fee_bps(e) as i128;
        let platform_fee = total * fee_bps / BPS_DENOM;

        let (royalty_receiver, mut royalty) = Base::royalty_info(e, token_id, total);
        // Primary sale: the creator is the one being paid already, so charging
        // them a royalty on their own sale would just shuffle their money
        // through an extra transfer.
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
}

// =============================================================================
// OpenZeppelin standard interfaces
// =============================================================================

#[contractimpl(contracttrait)]
impl NonFungibleToken for ArtNft {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for ArtNft {}

#[contractimpl(contracttrait)]
impl NonFungibleRoyalties for ArtNft {
    /// Collection-wide fallback royalty, for tokens with none of their own.
    fn set_default_royalty(e: &Env, receiver: Address, basis_points: u32, operator: Address) {
        let owner = ownable::get_owner(e).unwrap_or_else(|| panic_with_error!(e, ArtError::NotCreator));
        if operator != owner {
            panic_with_error!(e, ArtError::NotCreator);
        }
        operator.require_auth();

        if basis_points > MAX_ROYALTY_BPS {
            panic_with_error!(e, ArtError::InvalidRoyalty);
        }
        Base::set_default_royalty(e, &receiver, basis_points);
    }

    /// Per-token royalty, changeable only by the piece's original creator —
    /// not by whoever currently holds it, so a buyer can't strip the royalty
    /// off a work before flipping it.
    fn set_token_royalty(
        e: &Env,
        token_id: u32,
        receiver: Address,
        basis_points: u32,
        operator: Address,
    ) {
        Self::require_creator(e, token_id, &operator);
        if basis_points > MAX_ROYALTY_BPS {
            panic_with_error!(e, ArtError::InvalidRoyalty);
        }
        Base::set_token_royalty(e, token_id, &receiver, basis_points);
    }

    fn remove_token_royalty(e: &Env, token_id: u32, operator: Address) {
        Self::require_creator(e, token_id, &operator);
        Base::remove_token_royalty(e, token_id);
    }
}

impl ArtNft {
    fn require_creator(e: &Env, token_id: u32, operator: &Address) {
        let meta: ArtMeta = e
            .storage()
            .persistent()
            .get(&DataKey::ArtMeta(token_id))
            .unwrap_or_else(|| panic_with_error!(e, ArtError::NotCreator));
        if meta.creator != *operator {
            panic_with_error!(e, ArtError::NotCreator);
        }
        operator.require_auth();
    }
}

#[contractimpl(contracttrait)]
impl Ownable for ArtNft {}

#[contractimpl(contracttrait)]
impl Pausable for ArtNft {
    /// Emergency stop for `mint_art`, `mint_and_list`, `list`, and `buy`. Transfers, approvals,
    /// and `cancel_listing` stay open so holders can always exit a position
    /// while the platform is halted.
    #[only_owner]
    fn pause(e: &Env, _caller: Address) {
        pausable::pause(e);
    }

    #[only_owner]
    fn unpause(e: &Env, _caller: Address) {
        pausable::unpause(e);
    }
}
