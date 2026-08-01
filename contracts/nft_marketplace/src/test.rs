#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

fn create_token_contract<'a>(env: &'a Env, admin: &Address) -> token::StellarAssetClient<'a> {
    token::StellarAssetClient::new(env, &env.register_stellar_asset_contract_v2(admin.clone()).address())
}

#[test]
fn test_constructor_and_metadata() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let name = String::from_str(&env, "Test NFT Collection");
    let symbol = String::from_str(&env, "TNFT");

    let contract_id = env.register(
        NftMarketplace,
        (admin.clone(), token.address.clone(), name.clone(), symbol.clone()),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    assert_eq!(client.name(), name);
    assert_eq!(client.symbol(), symbol);
    assert_eq!(client.version(), 2);
}

#[test]
fn test_mint_and_list() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(&env, "Test NFT"),
            String::from_str(&env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "My First NFT"),
        &String::from_str(&env, "A beautiful digital artwork"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &10,
        &1000,
    );

    assert_eq!(token_id, 1);
    assert_eq!(client.owner_of(&token_id), creator);
    assert_eq!(client.balance(&creator), 1);
    assert_eq!(client.token_uri(&token_id), String::from_str(&env, "https://s3.../thumb.png"));

    let listing = client.get_listing(&token_id);
    assert_eq!(listing.seller, creator);
    assert_eq!(listing.price, 1000);
    assert_eq!(listing.available_copies, 10);
    assert_eq!(listing.is_active, true);

    let metadata = client.get_token_metadata(&token_id);
    assert_eq!(metadata.thumbnail, String::from_str(&env, "https://s3.../thumb.png"));
    assert_eq!(metadata.content_url, String::from_str(&env, "https://s3.../content.png"));
}

#[test]
fn test_buy_nft() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    token.mint(&buyer, &10000);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(&env, "Test NFT"),
            String::from_str(&env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &5,
        &1000,
    );

    client.buy(&buyer, &token_id, &2);

    let listing = client.get_listing(&token_id);
    assert_eq!(listing.available_copies, 3);
    assert_eq!(listing.is_active, true);

    assert_eq!(client.balance(&buyer), 2);

    let token_client = token::TokenClient::new(&env, &token.address);
    assert_eq!(token_client.balance(&buyer), 8000);
    assert_eq!(token_client.balance(&creator), 2000);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(&env, "Test NFT"),
            String::from_str(&env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
    );

    assert_eq!(client.owner_of(&token_id), creator);

    client.transfer(&creator, &recipient, &token_id);

    assert_eq!(client.owner_of(&token_id), recipient);
    assert_eq!(client.balance(&creator), 0);
    assert_eq!(client.balance(&recipient), 1);
}

#[test]
fn test_approval() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let approved_addr = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(&env, "Test NFT"),
            String::from_str(&env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
    );

    let future_ledger = env.ledger().sequence() + 10000;
    client.approve(&creator, &approved_addr, &token_id, &future_ledger);

    assert_eq!(client.get_approved(&token_id), Some(approved_addr.clone()));

    client.transfer_from(&approved_addr, &creator, &recipient, &token_id);

    assert_eq!(client.owner_of(&token_id), recipient);
    assert_eq!(client.get_approved(&token_id), None);
}

#[test]
fn test_approve_for_all() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(&env, "Test NFT"),
            String::from_str(&env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    let future_ledger = env.ledger().sequence() + 10000;
    client.approve_for_all(&owner, &operator, &future_ledger);

    assert!(client.is_approved_for_all(&owner, &operator));
}

#[test]
fn test_cancel_listing() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(&env, "Test NFT"),
            String::from_str(&env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(&env, &contract_id);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &5,
        &1000,
    );

    client.cancel_listing(&creator, &token_id);

    let listing = client.get_listing(&token_id);
    assert_eq!(listing.is_active, false);
}
