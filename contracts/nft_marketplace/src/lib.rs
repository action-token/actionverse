#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token::TokenClient, Address, Bytes, BytesN, Env, String, Symbol, Vec,
};

const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

const CONTRACT_VERSION: u32 = 4;

// Basis-points denominator for platform fee / creator royalty math (10_000 = 100%).
const BPS_DENOM: i128 = 10_000;
const MAX_PLATFORM_FEE_BPS: u32 = 1_000; // 10% cap
const MAX_ROYALTY_BPS: u32 = 5_000; // 50% cap

// Bounded string lengths so a single mint can't bloat ledger storage unboundedly.
const MAX_NAME_LEN: u32 = 128;
const MAX_DESCRIPTION_LEN: u32 = 2_000;
const MAX_URI_LEN: u32 = 500;

// =============================================================================
// Data Keys
// SEP-50: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md
// =============================================================================

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PaymentToken,
    Name,
    Symbol,
    NextTokenId,
    TokenOwner(u32),
    TokenUri(u32),
    TokenApproval(u32),
    OperatorApproval(Address, Address),
    Balance(Address),
    // Per-holder copy count for an edition token — the source of truth for
    // who can list/resell how many copies (see `Listing` below).
    TokenBalance(u32, Address),
    // Keyed by (token_id, seller) so multiple holders can each run their own
    // independent listing for the same token_id.
    Listing(u32, Address),
    // Index of every address that has ever listed a given token_id, since
    // Soroban storage has no prefix scan to enumerate `Listing` keys.
    ListingSellers(u32),
    TokenMetadata(u32),
    Paused,
    PlatformFeeBps,
    Treasury,
}

// =============================================================================
// Data Types
// =============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: String,
    pub description: String,
    pub thumbnail: String,
    pub content_url: String,
    pub media_type: String,
    pub creator: Address,
    pub royalty_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub price: i128,
    pub payment_token: Address,
    pub available_copies: u32,
    pub total_copies: u32,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approval {
    pub approved: Address,
    pub live_until_ledger: u32,
}

// =============================================================================
// Errors
// =============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    // --- SEP-50 / OpenZeppelin standard errors (2XX band) ---
    NonExistentToken = 200,
    IncorrectOwner = 201,
    InsufficientApproval = 202,
    InvalidApprover = 203,
    InvalidLiveUntilLedger = 204,
    MathOverflow = 205,
    TokenIDsAreDepleted = 206,
    InvalidAmount = 207,
    TokenNotFoundInOwnerList = 208,
    TokenNotFoundInGlobalList = 209,
    UnsetMetadata = 210,
    BaseUriMaxLenExceeded = 211,
    InvalidRoyaltyAmount = 212,
    NameMaxLenExceeded = 213,
    SymbolMaxLenExceeded = 214,
    // --- Marketplace-specific errors (3XX band) ---
    NotInitialized = 300,
    AlreadyInitialized = 301,
    InvalidCopies = 302,
    SelfTransfer = 303,
    ListingNotFound = 304,
    ListingNotActive = 305,
    NoCopiesAvailable = 306,
    InsufficientPayment = 307,
    Paused = 308,
    InvalidTokenUri = 309,
    InvalidDescription = 310,
    InvalidFee = 311,
    InsufficientBalance = 312,
    SelfPurchase = 313,
}

// =============================================================================
// Events (SEP-50 compliant)
// =============================================================================

#[contractevent]
pub struct Transfer {
    #[topic]
    pub sym: Symbol,
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub token_id: u32,
}

#[contractevent]
pub struct Approve {
    #[topic]
    pub sym: Symbol,
    #[topic]
    pub owner: Address,
    #[topic]
    pub token_id: u32,
    pub approved: Address,
    pub expiration: u32,
}

#[contractevent]
pub struct ApproveForAll {
    #[topic]
    pub sym: Symbol,
    #[topic]
    pub owner: Address,
    pub operator: Address,
    pub expiration: u32,
}

#[contractevent]
pub struct Mint {
    #[topic]
    pub sym: Symbol,
    #[topic]
    pub to: Address,
    pub token_id: u32,
}

#[contractevent]
pub struct Listed {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub seller: Address,
    pub price: i128,
    pub copies: u32,
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
pub struct PauseUpdated {
    pub paused: bool,
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct NftMarketplace;

#[contractimpl]
impl NftMarketplace {
    // =========================================================================
    // Constructor
    // =========================================================================

    pub fn __constructor(
        env: Env,
        admin: Address,
        payment_token: Address,
        name: String,
        symbol: String,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PaymentToken, &payment_token);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::NextTokenId, &1u32);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &0u32);
        env.storage().instance().set(&DataKey::Treasury, &admin);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    // =========================================================================
    // SEP-50 Core Interface
    // =========================================================================

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or(String::from_str(&env, "NFT Collection"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or(String::from_str(&env, "NFT"))
    }

    pub fn balance(env: Env, owner: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0u32)
    }

    pub fn owner_of(env: Env, token_id: u32) -> Result<Address, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .ok_or(Error::NonExistentToken)
    }

    pub fn token_uri(env: Env, token_id: u32) -> Result<String, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenUri(token_id))
            .ok_or(Error::NonExistentToken)
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) -> Result<(), Error> {
        from.require_auth();

        if from == to {
            return Err(Error::SelfTransfer);
        }

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != from {
            return Err(Error::IncorrectOwner);
        }

        Self::execute_transfer(&env, &from, &to, token_id);
        Ok(())
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        token_id: u32,
    ) -> Result<(), Error> {
        spender.require_auth();

        if from == to {
            return Err(Error::SelfTransfer);
        }

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != from {
            return Err(Error::IncorrectOwner);
        }

        if !Self::is_approved_or_owner(&env, &spender, &from, token_id) {
            return Err(Error::InsufficientApproval);
        }

        Self::execute_transfer(&env, &from, &to, token_id);
        Ok(())
    }

    pub fn approve(
        env: Env,
        approver: Address,
        approved: Address,
        token_id: u32,
        live_until_ledger: u32,
    ) -> Result<(), Error> {
        approver.require_auth();

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != approver && !Self::is_approved_for_all(env.clone(), owner.clone(), approver.clone())
        {
            return Err(Error::InvalidApprover);
        }

        let approval = Approval {
            approved: approved.clone(),
            live_until_ledger,
        };
        let key = DataKey::TokenApproval(token_id);
        env.storage().persistent().set(&key, &approval);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        Approve {
            sym: Symbol::new(&env, "approve"),
            owner,
            token_id,
            approved,
            expiration: live_until_ledger,
        }
        .publish(&env);

        Ok(())
    }

    pub fn approve_for_all(
        env: Env,
        owner: Address,
        operator: Address,
        live_until_ledger: u32,
    ) -> Result<(), Error> {
        owner.require_auth();

        let key = DataKey::OperatorApproval(owner.clone(), operator.clone());
        env.storage().persistent().set(&key, &live_until_ledger);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        ApproveForAll {
            sym: Symbol::new(&env, "approve_for_all"),
            owner,
            operator,
            expiration: live_until_ledger,
        }
        .publish(&env);

        Ok(())
    }

    pub fn get_approved(env: Env, token_id: u32) -> Option<Address> {
        let approval: Option<Approval> = env
            .storage()
            .persistent()
            .get(&DataKey::TokenApproval(token_id));

        if let Some(a) = approval {
            if env.ledger().sequence() <= a.live_until_ledger {
                return Some(a.approved);
            }
        }
        None
    }

    pub fn is_approved_for_all(env: Env, owner: Address, operator: Address) -> bool {
        let key = DataKey::OperatorApproval(owner, operator);
        let expiration: Option<u32> = env.storage().persistent().get(&key);

        if let Some(exp) = expiration {
            return env.ledger().sequence() <= exp;
        }
        false
    }

    // =========================================================================
    // Minting (No Collections - Direct Mint)
    // Any authenticated address may call this as its own `creator` — there is
    // no admin/allowlist gate. `creator.require_auth()` is the only guard.
    // =========================================================================

    pub fn mint(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        thumbnail: String,
        content_url: String,
        media_type: String,
        copies: u32,
        price: i128,
        royalty_bps: u32,
    ) -> Result<u32, Error> {
        creator.require_auth();

        if Self::is_paused(env.clone()) {
            return Err(Error::Paused);
        }
        if copies == 0 {
            return Err(Error::InvalidCopies);
        }
        if price <= 0 {
            return Err(Error::InvalidAmount);
        }
        if thumbnail.len() == 0 || thumbnail.len() > MAX_URI_LEN {
            return Err(Error::InvalidTokenUri);
        }
        if content_url.len() == 0 || content_url.len() > MAX_URI_LEN {
            return Err(Error::InvalidTokenUri);
        }
        if name.len() == 0 || name.len() > MAX_NAME_LEN {
            return Err(Error::NameMaxLenExceeded);
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            return Err(Error::InvalidDescription);
        }
        if royalty_bps > MAX_ROYALTY_BPS {
            return Err(Error::InvalidRoyaltyAmount);
        }

        let token_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1u32);

        let metadata = TokenMetadata {
            name,
            description,
            thumbnail: thumbnail.clone(),
            content_url,
            media_type,
            creator: creator.clone(),
            royalty_bps,
        };

        let owner_key = DataKey::TokenOwner(token_id);
        env.storage()
            .persistent()
            .set(&owner_key, &creator);
        env.storage()
            .persistent()
            .extend_ttl(&owner_key, BUMP_THRESHOLD, BUMP_TO);

        // SEP-50: token_uri points to a JSON document conforming to the
        // "Non-Fungible Metadata JSON Schema", so wallets/explorers can
        // render the NFT from on-chain data alone.
        let uri = Self::build_token_uri_json(&env, &metadata);
        let uri_key = DataKey::TokenUri(token_id);
        env.storage().persistent().set(&uri_key, &uri);
        env.storage()
            .persistent()
            .extend_ttl(&uri_key, BUMP_THRESHOLD, BUMP_TO);

        let metadata_key = DataKey::TokenMetadata(token_id);
        env.storage().persistent().set(&metadata_key, &metadata);
        env.storage()
            .persistent()
            .extend_ttl(&metadata_key, BUMP_THRESHOLD, BUMP_TO);

        // SEP-50 `balance(owner)` counts every copy the owner holds across
        // all editions, so minting an edition must add `copies`, not 1.
        let balance_key = DataKey::Balance(creator.clone());
        let current_balance: u32 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance + copies));
        env.storage()
            .persistent()
            .extend_ttl(&balance_key, BUMP_THRESHOLD, BUMP_TO);

        let token_balance_key = DataKey::TokenBalance(token_id, creator.clone());
        env.storage().persistent().set(&token_balance_key, &copies);
        env.storage()
            .persistent()
            .extend_ttl(&token_balance_key, BUMP_THRESHOLD, BUMP_TO);

        env.storage()
            .instance()
            .set(&DataKey::NextTokenId, &(token_id + 1));
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        let payment_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::PaymentToken)
            .unwrap();

        let listing = Listing {
            seller: creator.clone(),
            price,
            payment_token,
            available_copies: copies,
            total_copies: copies,
            is_active: true,
        };
        let listing_key = DataKey::Listing(token_id, creator.clone());
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);
        Self::register_seller(&env, token_id, &creator);

        Mint {
            sym: Symbol::new(&env, "mint"),
            to: creator.clone(),
            token_id,
        }
        .publish(&env);

        Listed {
            token_id,
            seller: creator,
            price,
            copies,
        }
        .publish(&env);

        Ok(token_id)
    }

    // =========================================================================
    // Marketplace
    // =========================================================================

    pub fn list_for_sale(
        env: Env,
        seller: Address,
        token_id: u32,
        price: i128,
        copies: u32,
    ) -> Result<(), Error> {
        seller.require_auth();

        if Self::is_paused(env.clone()) {
            return Err(Error::Paused);
        }
        if price <= 0 {
            return Err(Error::InvalidAmount);
        }
        if copies == 0 {
            return Err(Error::InvalidCopies);
        }

        // `owner_of` here only confirms the token was actually minted — for
        // an edition token there's no single "owner", so eligibility to list
        // is decided by `TokenBalance` below, not this call's return value.
        Self::owner_of(env.clone(), token_id)?;
        let held = Self::token_balance_of(env.clone(), token_id, seller.clone());
        if held < copies {
            return Err(Error::InsufficientBalance);
        }

        let payment_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::PaymentToken)
            .unwrap();

        let listing = Listing {
            seller: seller.clone(),
            price,
            payment_token,
            available_copies: copies,
            total_copies: copies,
            is_active: true,
        };

        let key = DataKey::Listing(token_id, seller.clone());
        env.storage().persistent().set(&key, &listing);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        Self::register_seller(&env, token_id, &seller);

        Listed {
            token_id,
            seller,
            price,
            copies,
        }
        .publish(&env);

        Ok(())
    }

    /// Buys `quantity` copies of `token_id`. Storage is fully updated
    /// (checks-effects) before any external token transfer (interactions),
    /// so a non-standard/malicious `payment_token` contract can't reenter
    /// this call and observe or exploit stale listing/balance state.
    pub fn buy(
        env: Env,
        buyer: Address,
        seller: Address,
        token_id: u32,
        quantity: u32,
    ) -> Result<(), Error> {
        buyer.require_auth();

        if buyer == seller {
            return Err(Error::SelfPurchase);
        }
        if Self::is_paused(env.clone()) {
            return Err(Error::Paused);
        }
        if quantity == 0 {
            return Err(Error::InvalidCopies);
        }

        let listing_key = DataKey::Listing(token_id, seller.clone());
        let mut listing: Listing = env
            .storage()
            .persistent()
            .get(&listing_key)
            .ok_or(Error::ListingNotFound)?;

        if !listing.is_active {
            return Err(Error::ListingNotActive);
        }
        if listing.available_copies < quantity {
            return Err(Error::NoCopiesAvailable);
        }

        let metadata: TokenMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::TokenMetadata(token_id))
            .ok_or(Error::NonExistentToken)?;

        let total_price = listing.price * (quantity as i128);
        let platform_fee_bps = Self::get_platform_fee(env.clone()) as i128;
        let platform_fee = total_price * platform_fee_bps / BPS_DENOM;

        // Royalty only applies on secondary sales (seller isn't the original
        // creator); on a primary sale the creator *is* the seller already.
        let royalty = if listing.seller != metadata.creator {
            total_price * (metadata.royalty_bps as i128) / BPS_DENOM
        } else {
            0
        };
        let seller_amount = total_price - platform_fee - royalty;

        // --- effects: mutate all contract state before any token transfer ---
        listing.available_copies -= quantity;
        if listing.available_copies == 0 {
            listing.is_active = false;
        }
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);

        let buyer_balance_key = DataKey::Balance(buyer.clone());
        let buyer_balance: u32 = env
            .storage()
            .persistent()
            .get(&buyer_balance_key)
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&buyer_balance_key, &(buyer_balance + quantity));
        env.storage()
            .persistent()
            .extend_ttl(&buyer_balance_key, BUMP_THRESHOLD, BUMP_TO);

        // Seller's aggregate Balance must shrink too — they no longer hold
        // the copies they just sold.
        let seller_balance_key = DataKey::Balance(seller.clone());
        let seller_balance: u32 = env
            .storage()
            .persistent()
            .get(&seller_balance_key)
            .unwrap_or(0u32);
        env.storage().persistent().set(
            &seller_balance_key,
            &seller_balance.saturating_sub(quantity),
        );
        env.storage()
            .persistent()
            .extend_ttl(&seller_balance_key, BUMP_THRESHOLD, BUMP_TO);

        // Per-token holdings move from seller to buyer, so the buyer can
        // list_for_sale their own copies afterward.
        let seller_token_balance_key = DataKey::TokenBalance(token_id, seller.clone());
        let seller_token_balance: u32 = env
            .storage()
            .persistent()
            .get(&seller_token_balance_key)
            .unwrap_or(0u32);
        env.storage().persistent().set(
            &seller_token_balance_key,
            &seller_token_balance.saturating_sub(quantity),
        );
        env.storage()
            .persistent()
            .extend_ttl(&seller_token_balance_key, BUMP_THRESHOLD, BUMP_TO);

        let buyer_token_balance_key = DataKey::TokenBalance(token_id, buyer.clone());
        let buyer_token_balance: u32 = env
            .storage()
            .persistent()
            .get(&buyer_token_balance_key)
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&buyer_token_balance_key, &(buyer_token_balance + quantity));
        env.storage()
            .persistent()
            .extend_ttl(&buyer_token_balance_key, BUMP_THRESHOLD, BUMP_TO);

        // --- interactions: external token transfers happen last ---
        let token_client = TokenClient::new(&env, &listing.payment_token);
        if platform_fee > 0 {
            let treasury: Address = env
                .storage()
                .instance()
                .get(&DataKey::Treasury)
                .unwrap();
            token_client.transfer(&buyer, &treasury, &platform_fee);
        }
        if royalty > 0 {
            token_client.transfer(&buyer, &metadata.creator, &royalty);
        }
        token_client.transfer(&buyer, &listing.seller, &seller_amount);

        Purchased {
            token_id,
            buyer: buyer.clone(),
            seller: listing.seller,
            price: total_price,
            royalty_paid: royalty,
            platform_fee_paid: platform_fee,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_listing(env: Env, seller: Address, token_id: u32) -> Result<(), Error> {
        seller.require_auth();

        let listing_key = DataKey::Listing(token_id, seller.clone());
        let mut listing: Listing = env
            .storage()
            .persistent()
            .get(&listing_key)
            .ok_or(Error::ListingNotFound)?;

        listing.is_active = false;
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);

        ListingCancelled { token_id, seller }.publish(&env);

        Ok(())
    }

    pub fn get_listing(env: Env, token_id: u32, seller: Address) -> Result<Listing, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(token_id, seller))
            .ok_or(Error::ListingNotFound)
    }

    /// Every active listing for a token_id, one per seller who currently has
    /// copies up for sale. This is what buyers browse to pick who to buy from.
    pub fn get_listings(env: Env, token_id: u32) -> Vec<Listing> {
        let sellers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::ListingSellers(token_id))
            .unwrap_or(Vec::new(&env));

        let mut out = Vec::new(&env);
        for seller in sellers.iter() {
            let listing: Option<Listing> = env
                .storage()
                .persistent()
                .get(&DataKey::Listing(token_id, seller));
            if let Some(listing) = listing {
                if listing.is_active {
                    out.push_back(listing);
                }
            }
        }
        out
    }

    /// How many copies of `token_id` a specific address currently holds.
    pub fn token_balance_of(env: Env, token_id: u32, owner: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::TokenBalance(token_id, owner))
            .unwrap_or(0u32)
    }

    pub fn get_token_metadata(env: Env, token_id: u32) -> Result<TokenMetadata, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenMetadata(token_id))
            .ok_or(Error::NonExistentToken)
    }

    // =========================================================================
    // Admin
    // =========================================================================

    pub fn set_payment_token(env: Env, new_token: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::PaymentToken, &new_token);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        Ok(())
    }

    /// Emergency circuit breaker: blocks `mint`, `list_for_sale`, and `buy`
    /// while paused. Ownership transfer/approval and listing cancellation
    /// stay available so users can still self-serve out of an incident.
    pub fn pause(env: Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        PauseUpdated { paused: true }.publish(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        PauseUpdated { paused: false }.publish(&env);
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn set_platform_fee(env: Env, fee_bps: u32) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        if fee_bps > MAX_PLATFORM_FEE_BPS {
            return Err(Error::InvalidFee);
        }

        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &fee_bps);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Ok(())
    }

    pub fn get_platform_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .unwrap_or(0u32)
    }

    pub fn set_treasury(env: Env, new_treasury: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::Treasury, &new_treasury);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Ok(())
    }

    pub fn get_treasury(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    pub fn admin_extend_instance_ttl(env: Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Ok(())
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /// Builds the SEP-50 "Non-Fungible Metadata JSON Schema" document for a
    /// token, returned by `token_uri`. Kept on-chain so wallets/explorers can
    /// render the NFT without an off-chain metadata service.
    fn build_token_uri_json(env: &Env, metadata: &TokenMetadata) -> String {
        let mut json = Bytes::new(env);

        // {"name":"...","description":"...","image":"...","external_url":"...","attributes":[{"trait_type":"media_type","value":"..."},{"trait_type":"royalty_bps","value":N},{"trait_type":"creator","value":"..."}]}
        json.append(&Bytes::from_slice(env, b"{"));
        Self::append_json_string(env, &mut json, &"name", &metadata.name);
        json.append(&Bytes::from_slice(env, b","));
        Self::append_json_string(env, &mut json, &"description", &metadata.description);
        json.append(&Bytes::from_slice(env, b","));
        Self::append_json_string(env, &mut json, &"image", &metadata.thumbnail);
        json.append(&Bytes::from_slice(env, b","));
        Self::append_json_string(env, &mut json, &"external_url", &metadata.content_url);
        json.append(&Bytes::from_slice(env, b",\"attributes\":["));
        Self::append_json_attr(env, &mut json, &"media_type", &metadata.media_type);
        json.append(&Bytes::from_slice(env, b",{\"trait_type\":\"royalty_bps\",\"value\":"));
        let royalty = Self::u32_to_string(env, metadata.royalty_bps);
        json.append(&royalty.to_bytes());
        json.append(&Bytes::from_slice(env, b"},{\"trait_type\":\"creator\",\"value\":\""));
        json.append(&metadata.creator.to_string().to_bytes());
        json.append(&Bytes::from_slice(env, b"\"}]}"));

        json.into()
    }

    fn append_json_attr(env: &Env, out: &mut Bytes, key: &str, value: &String) {
        out.append(&Bytes::from_slice(env, b"{\"trait_type\":\""));
        out.append(&Bytes::from_slice(env, key.as_bytes()));
        out.append(&Bytes::from_slice(env, b"\",\"value\":\""));
        for b in value.to_bytes().iter() {
            match b {
                b'"' => out.append(&Bytes::from_slice(env, b"\\\"")),
                b'\\' => out.append(&Bytes::from_slice(env, b"\\\\")),
                b'\n' => out.append(&Bytes::from_slice(env, b"\\n")),
                b'\r' => out.append(&Bytes::from_slice(env, b"\\r")),
                b'\t' => out.append(&Bytes::from_slice(env, b"\\t")),
                _ => out.append(&Bytes::from_slice(env, &[b])),
            }
        }
        out.append(&Bytes::from_slice(env, b"\"}"));
    }

    fn u32_to_string(env: &Env, mut n: u32) -> String {
        if n == 0 {
            return String::from_str(env, "0");
        }
        let mut buf = [0u8; 10];
        let mut i = 10;
        while n > 0 {
            i -= 1;
            buf[i] = (n % 10) as u8 + b'0';
            n /= 10;
        }
        String::from_str(env, core::str::from_utf8(&buf[i..]).unwrap())
    }

    fn append_json_string(env: &Env, out: &mut Bytes, key: &str, value: &String) {
        out.append(&Bytes::from_slice(env, b"\""));
        out.append(&Bytes::from_slice(env, key.as_bytes()));
        out.append(&Bytes::from_slice(env, b"\":\""));
        for b in value.to_bytes().iter() {
            match b {
                b'"' => out.append(&Bytes::from_slice(env, b"\\\"")),
                b'\\' => out.append(&Bytes::from_slice(env, b"\\\\")),
                b'\n' => out.append(&Bytes::from_slice(env, b"\\n")),
                b'\r' => out.append(&Bytes::from_slice(env, b"\\r")),
                b'\t' => out.append(&Bytes::from_slice(env, b"\\t")),
                _ => out.append(&Bytes::from_slice(env, &[b])),
            }
        }
        out.append(&Bytes::from_slice(env, b"\""));
    }

    /// Adds `seller` to the token's seller index (if not already present) so
    /// `get_listings` can enumerate every address with an active listing —
    /// Soroban storage has no way to scan for keys by prefix.
    fn register_seller(env: &Env, token_id: u32, seller: &Address) {
        let key = DataKey::ListingSellers(token_id);
        let mut sellers: Vec<Address> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        if !sellers.contains(seller) {
            sellers.push_back(seller.clone());
            env.storage().persistent().set(&key, &sellers);
            env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        }
    }

    /// Moves a single copy of `token_id` from `from` to `to`. Keeps the
    /// per-holder `TokenBalance` and the aggregate `Balance` in sync so a
    /// transferred copy can be listed for sale by the recipient afterward.
    fn execute_transfer(env: &Env, from: &Address, to: &Address, token_id: u32) {
        let owner_key = DataKey::TokenOwner(token_id);
        env.storage().persistent().set(&owner_key, to);
        env.storage()
            .persistent()
            .extend_ttl(&owner_key, BUMP_THRESHOLD, BUMP_TO);

        env.storage()
            .persistent()
            .remove(&DataKey::TokenApproval(token_id));

        let from_balance_key = DataKey::Balance(from.clone());
        let from_balance: u32 = env
            .storage()
            .persistent()
            .get(&from_balance_key)
            .unwrap_or(0u32);
        if from_balance > 0 {
            env.storage()
                .persistent()
                .set(&from_balance_key, &(from_balance - 1));
            env.storage()
                .persistent()
                .extend_ttl(&from_balance_key, BUMP_THRESHOLD, BUMP_TO);
        }

        let to_balance_key = DataKey::Balance(to.clone());
        let to_balance: u32 = env
            .storage()
            .persistent()
            .get(&to_balance_key)
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&to_balance_key, &(to_balance + 1));
        env.storage()
            .persistent()
            .extend_ttl(&to_balance_key, BUMP_THRESHOLD, BUMP_TO);

        let from_token_key = DataKey::TokenBalance(token_id, from.clone());
        let from_token: u32 = env
            .storage()
            .persistent()
            .get(&from_token_key)
            .unwrap_or(0u32);
        env.storage().persistent().set(
            &from_token_key,
            &from_token.saturating_sub(1),
        );
        env.storage()
            .persistent()
            .extend_ttl(&from_token_key, BUMP_THRESHOLD, BUMP_TO);

        let to_token_key = DataKey::TokenBalance(token_id, to.clone());
        let to_token: u32 = env
            .storage()
            .persistent()
            .get(&to_token_key)
            .unwrap_or(0u32);
        env.storage().persistent().set(&to_token_key, &(to_token + 1));
        env.storage()
            .persistent()
            .extend_ttl(&to_token_key, BUMP_THRESHOLD, BUMP_TO);

        Transfer {
            sym: Symbol::new(env, "transfer"),
            from: from.clone(),
            to: to.clone(),
            token_id,
        }
        .publish(env);
    }

    fn is_approved_or_owner(env: &Env, spender: &Address, owner: &Address, token_id: u32) -> bool {
        if spender == owner {
            return true;
        }

        if Self::is_approved_for_all(env.clone(), owner.clone(), spender.clone()) {
            return true;
        }

        if let Some(approved) = Self::get_approved(env.clone(), token_id) {
            if &approved == spender {
                return true;
            }
        }

        false
    }
}

mod test;
