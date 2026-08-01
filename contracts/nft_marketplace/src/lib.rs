#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token::TokenClient, Address, BytesN, Env, String,
};

const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

const CONTRACT_VERSION: u32 = 2;

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
    TokenOwner(u128),
    TokenUri(u128),
    TokenApproval(u128),
    OperatorApproval(Address, Address),
    Balance(Address),
    Listing(u128),
    TokenMetadata(u128),
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
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvalidAmount = 3,
    InvalidCopies = 4,
    TokenNotFound = 5,
    NotOwner = 6,
    NotApproved = 7,
    SelfTransfer = 8,
    ListingNotFound = 9,
    ListingNotActive = 10,
    NoCopiesAvailable = 11,
    InsufficientPayment = 12,
    Unauthorized = 13,
    ApprovalExpired = 14,
    InvalidTokenUri = 16,
    InvalidName = 17,
}

// =============================================================================
// Events (SEP-50 compliant)
// =============================================================================

#[contractevent]
pub struct Transfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub token_id: u128,
}

#[contractevent]
pub struct Approve {
    #[topic]
    pub owner: Address,
    #[topic]
    pub token_id: u128,
    pub approved: Address,
    pub expiration: u32,
}

#[contractevent]
pub struct ApproveForAll {
    #[topic]
    pub owner: Address,
    pub operator: Address,
    pub expiration: u32,
}

#[contractevent]
pub struct Mint {
    #[topic]
    pub to: Address,
    pub token_id: u128,
}

#[contractevent]
pub struct Listed {
    #[topic]
    pub token_id: u128,
    #[topic]
    pub seller: Address,
    pub price: i128,
    pub copies: u32,
}

#[contractevent]
pub struct Purchased {
    #[topic]
    pub token_id: u128,
    #[topic]
    pub buyer: Address,
    pub seller: Address,
    pub price: i128,
}

#[contractevent]
pub struct ListingCancelled {
    #[topic]
    pub token_id: u128,
    #[topic]
    pub seller: Address,
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
        env.storage().instance().set(&DataKey::NextTokenId, &1u128);
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

    pub fn balance(env: Env, owner: Address) -> u128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0u128)
    }

    pub fn owner_of(env: Env, token_id: u128) -> Result<Address, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .ok_or(Error::TokenNotFound)
    }

    pub fn token_uri(env: Env, token_id: u128) -> Result<String, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenUri(token_id))
            .ok_or(Error::TokenNotFound)
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u128) -> Result<(), Error> {
        from.require_auth();

        if from == to {
            return Err(Error::SelfTransfer);
        }

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != from {
            return Err(Error::NotOwner);
        }

        Self::execute_transfer(&env, &from, &to, token_id);
        Ok(())
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        token_id: u128,
    ) -> Result<(), Error> {
        spender.require_auth();

        if from == to {
            return Err(Error::SelfTransfer);
        }

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != from {
            return Err(Error::NotOwner);
        }

        if !Self::is_approved_or_owner(&env, &spender, &from, token_id) {
            return Err(Error::NotApproved);
        }

        Self::execute_transfer(&env, &from, &to, token_id);
        Ok(())
    }

    pub fn approve(
        env: Env,
        approver: Address,
        approved: Address,
        token_id: u128,
        live_until_ledger: u32,
    ) -> Result<(), Error> {
        approver.require_auth();

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != approver && !Self::is_approved_for_all(env.clone(), owner.clone(), approver.clone()) {
            return Err(Error::Unauthorized);
        }

        let approval = Approval {
            approved: approved.clone(),
            live_until_ledger,
        };
        let key = DataKey::TokenApproval(token_id);
        env.storage().persistent().set(&key, &approval);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        Approve {
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
            owner,
            operator,
            expiration: live_until_ledger,
        }
        .publish(&env);

        Ok(())
    }

    pub fn get_approved(env: Env, token_id: u128) -> Option<Address> {
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
    ) -> Result<u128, Error> {
        creator.require_auth();

        if copies == 0 {
            return Err(Error::InvalidCopies);
        }
        if price <= 0 {
            return Err(Error::InvalidAmount);
        }
        if thumbnail.len() == 0 || content_url.len() == 0 {
            return Err(Error::InvalidTokenUri);
        }
        if name.len() == 0 {
            return Err(Error::InvalidName);
        }

        let token_id: u128 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1u128);

        let metadata = TokenMetadata {
            name,
            description,
            thumbnail: thumbnail.clone(),
            content_url,
            media_type,
            creator: creator.clone(),
        };

        let owner_key = DataKey::TokenOwner(token_id);
        env.storage()
            .persistent()
            .set(&owner_key, &creator);
        env.storage()
            .persistent()
            .extend_ttl(&owner_key, BUMP_THRESHOLD, BUMP_TO);

        let uri_key = DataKey::TokenUri(token_id);
        env.storage().persistent().set(&uri_key, &thumbnail);
        env.storage()
            .persistent()
            .extend_ttl(&uri_key, BUMP_THRESHOLD, BUMP_TO);

        let metadata_key = DataKey::TokenMetadata(token_id);
        env.storage().persistent().set(&metadata_key, &metadata);
        env.storage()
            .persistent()
            .extend_ttl(&metadata_key, BUMP_THRESHOLD, BUMP_TO);

        let balance_key = DataKey::Balance(creator.clone());
        let current_balance: u128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0u128);
        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance + 1));
        env.storage()
            .persistent()
            .extend_ttl(&balance_key, BUMP_THRESHOLD, BUMP_TO);

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
        let listing_key = DataKey::Listing(token_id);
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);

        Mint {
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
        token_id: u128,
        price: i128,
        copies: u32,
    ) -> Result<(), Error> {
        seller.require_auth();

        if price <= 0 {
            return Err(Error::InvalidAmount);
        }
        if copies == 0 {
            return Err(Error::InvalidCopies);
        }

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != seller {
            return Err(Error::NotOwner);
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

        let key = DataKey::Listing(token_id);
        env.storage().persistent().set(&key, &listing);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        Listed {
            token_id,
            seller,
            price,
            copies,
        }
        .publish(&env);

        Ok(())
    }

    pub fn buy(env: Env, buyer: Address, token_id: u128, quantity: u32) -> Result<(), Error> {
        buyer.require_auth();

        if quantity == 0 {
            return Err(Error::InvalidCopies);
        }

        let listing_key = DataKey::Listing(token_id);
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

        let total_price = listing.price * (quantity as i128);

        TokenClient::new(&env, &listing.payment_token).transfer(
            &buyer,
            &listing.seller,
            &total_price,
        );

        listing.available_copies -= quantity;
        if listing.available_copies == 0 {
            listing.is_active = false;
        }
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);

        let buyer_balance_key = DataKey::Balance(buyer.clone());
        let buyer_balance: u128 = env
            .storage()
            .persistent()
            .get(&buyer_balance_key)
            .unwrap_or(0u128);
        env.storage()
            .persistent()
            .set(&buyer_balance_key, &(buyer_balance + quantity as u128));
        env.storage()
            .persistent()
            .extend_ttl(&buyer_balance_key, BUMP_THRESHOLD, BUMP_TO);

        Purchased {
            token_id,
            buyer: buyer.clone(),
            seller: listing.seller,
            price: total_price,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_listing(env: Env, seller: Address, token_id: u128) -> Result<(), Error> {
        seller.require_auth();

        let listing_key = DataKey::Listing(token_id);
        let mut listing: Listing = env
            .storage()
            .persistent()
            .get(&listing_key)
            .ok_or(Error::ListingNotFound)?;

        if listing.seller != seller {
            return Err(Error::Unauthorized);
        }

        listing.is_active = false;
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, BUMP_THRESHOLD, BUMP_TO);

        ListingCancelled { token_id, seller }.publish(&env);

        Ok(())
    }

    pub fn get_listing(env: Env, token_id: u128) -> Result<Listing, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(token_id))
            .ok_or(Error::ListingNotFound)
    }

    pub fn get_token_metadata(env: Env, token_id: u128) -> Result<TokenMetadata, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenMetadata(token_id))
            .ok_or(Error::TokenNotFound)
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

    fn execute_transfer(env: &Env, from: &Address, to: &Address, token_id: u128) {
        let owner_key = DataKey::TokenOwner(token_id);
        env.storage().persistent().set(&owner_key, to);
        env.storage()
            .persistent()
            .extend_ttl(&owner_key, BUMP_THRESHOLD, BUMP_TO);

        env.storage()
            .persistent()
            .remove(&DataKey::TokenApproval(token_id));

        let from_balance_key = DataKey::Balance(from.clone());
        let from_balance: u128 = env
            .storage()
            .persistent()
            .get(&from_balance_key)
            .unwrap_or(0u128);
        if from_balance > 0 {
            env.storage()
                .persistent()
                .set(&from_balance_key, &(from_balance - 1));
            env.storage()
                .persistent()
                .extend_ttl(&from_balance_key, BUMP_THRESHOLD, BUMP_TO);
        }

        let to_balance_key = DataKey::Balance(to.clone());
        let to_balance: u128 = env
            .storage()
            .persistent()
            .get(&to_balance_key)
            .unwrap_or(0u128);
        env.storage()
            .persistent()
            .set(&to_balance_key, &(to_balance + 1));
        env.storage()
            .persistent()
            .extend_ttl(&to_balance_key, BUMP_THRESHOLD, BUMP_TO);

        Transfer {
            from: from.clone(),
            to: to.clone(),
            token_id,
        }
        .publish(env);
    }

    fn is_approved_or_owner(env: &Env, spender: &Address, owner: &Address, token_id: u128) -> bool {
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
