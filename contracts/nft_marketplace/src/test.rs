#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

fn create_token_contract<'a>(env: &'a Env, admin: &Address) -> token::StellarAssetClient<'a> {
    token::StellarAssetClient::new(env, &env.register_stellar_asset_contract_v2(admin.clone()).address())
}

fn setup(env: &Env) -> (Address, Address, token::StellarAssetClient<'_>, NftMarketplaceClient<'_>) {
    let admin = Address::generate(env);
    let token_admin = Address::generate(env);
    let token = create_token_contract(env, &token_admin);

    let contract_id = env.register(
        NftMarketplace,
        (
            admin.clone(),
            token.address.clone(),
            String::from_str(env, "Test NFT"),
            String::from_str(env, "TNFT"),
        ),
    );
    let client = NftMarketplaceClient::new(env, &contract_id);
    (admin, token_admin, token, client)
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
    assert_eq!(client.version(), 4);
    assert_eq!(client.is_paused(), false);
    assert_eq!(client.get_platform_fee(), 0);
    assert_eq!(client.get_treasury(), admin);
}

#[test]
fn test_mint_and_list() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "My First NFT"),
        &String::from_str(&env, "A beautiful digital artwork"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &10,
        &1000,
        &0,
    );

    assert_eq!(token_id, 1);
    assert_eq!(client.owner_of(&token_id), creator);
    assert_eq!(client.balance(&creator), 1);
    assert_eq!(client.token_uri(&token_id), String::from_str(&env, "https://s3.../thumb.png"));

    let listing = client.get_listing(&token_id, &creator);
    assert_eq!(listing.seller, creator);
    assert_eq!(listing.price, 1000);
    assert_eq!(listing.available_copies, 10);
    assert_eq!(listing.is_active, true);
    assert_eq!(client.token_balance_of(&token_id, &creator), 10);
    assert_eq!(client.get_listings(&token_id).len(), 1);

    let metadata = client.get_token_metadata(&token_id);
    assert_eq!(metadata.thumbnail, String::from_str(&env, "https://s3.../thumb.png"));
    assert_eq!(metadata.content_url, String::from_str(&env, "https://s3.../content.png"));
    assert_eq!(metadata.royalty_bps, 0);
}

#[test]
fn test_mint_rejects_invalid_input() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    // royalty above the 50% cap
    let res = client.try_mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
        &5001,
    );
    assert_eq!(res, Err(Ok(Error::InvalidFee)));

    // empty name
    let res = client.try_mint(
        &creator,
        &String::from_str(&env, ""),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
        &0,
    );
    assert_eq!(res, Err(Ok(Error::InvalidName)));

    // zero copies
    let res = client.try_mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &0,
        &1000,
        &0,
    );
    assert_eq!(res, Err(Ok(Error::InvalidCopies)));
}

#[test]
fn test_buy_nft() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let (_admin, _token_admin, token, client) = setup(&env);

    token.mint(&buyer, &10000);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &5,
        &1000,
        &0,
    );

    client.buy(&buyer, &creator, &token_id, &2);

    let listing = client.get_listing(&token_id, &creator);
    assert_eq!(listing.available_copies, 3);
    assert_eq!(listing.is_active, true);

    assert_eq!(client.balance(&buyer), 2);
    assert_eq!(client.token_balance_of(&token_id, &buyer), 2);
    assert_eq!(client.token_balance_of(&token_id, &creator), 3);

    let token_client = token::TokenClient::new(&env, &token.address);
    assert_eq!(token_client.balance(&buyer), 8000);
    assert_eq!(token_client.balance(&creator), 2000);
}

#[test]
fn test_buy_rejects_self_purchase() {
    // A seller buying their own listing wouldn't be exploitable (balance
    // bookkeeping nets to zero, royalty is 0 on a primary sale) but would
    // still cost the real, non-refundable platform fee for no actual change
    // in ownership — a wash-trading vector worth rejecting outright.
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let (_admin, _token_admin, token, client) = setup(&env);
    token.mint(&creator, &10000);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &5,
        &1000,
        &0,
    );

    let res = client.try_buy(&creator, &creator, &token_id, &1);
    assert_eq!(res, Err(Ok(Error::SelfPurchase)));

    // Listing and balances are untouched — the call rejected before any
    // state mutation.
    let listing = client.get_listing(&token_id, &creator);
    assert_eq!(listing.available_copies, 5);
    assert_eq!(client.token_balance_of(&token_id, &creator), 5);
}

#[test]
fn test_resale_by_buyer_pays_royalty_to_original_creator() {
    // A buyer who purchases copies becomes a recognized holder via
    // `TokenBalance`, so they can list_for_sale and resell their own share —
    // no `transfer()` workaround needed. Royalty still flows to the
    // original creator on this second-hand sale.
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let buyer1 = Address::generate(&env);
    let buyer2 = Address::generate(&env);
    let (admin, _token_admin, token, client) = setup(&env);

    token.mint(&buyer1, &1_000_000);
    token.mint(&buyer2, &1_000_000);

    // 10% royalty to creator, 5% platform fee (within caps)
    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &2,
        &1000,
        &1000, // 10% royalty
    );
    client.set_platform_fee(&500); // 5%

    // Primary sale: buyer1 buys 1 copy directly from the creator's listing.
    // Seller == creator here, so no royalty is due on this leg.
    client.buy(&buyer1, &creator, &token_id, &1);
    assert_eq!(client.token_balance_of(&token_id, &buyer1), 1);
    assert_eq!(client.token_balance_of(&token_id, &creator), 1);

    // buyer1 now lists their own copy — this is the flow that used to be
    // impossible before TokenBalance existed.
    client.list_for_sale(&buyer1, &token_id, &2000, &1);
    assert_eq!(client.get_listings(&token_id).len(), 2); // creator's + buyer1's

    // Secondary sale: buyer2 buys from buyer1. Seller != creator, so royalty
    // is due to the original creator.
    client.buy(&buyer2, &buyer1, &token_id, &1);

    assert_eq!(client.token_balance_of(&token_id, &buyer1), 0);
    assert_eq!(client.token_balance_of(&token_id, &buyer2), 1);
    assert_eq!(client.get_listing(&token_id, &buyer1).is_active, false);

    let token_client = token::TokenClient::new(&env, &token.address);
    // Primary sale: total=1000, platform 5%=50, royalty 0 (seller is creator), creator nets 950.
    // Secondary sale: total=2000, platform 5%=100, royalty 10%=200 to creator, buyer1 nets 1700.
    assert_eq!(token_client.balance(&creator), 950 + 200);
    assert_eq!(token_client.balance(&admin), 50 + 100); // treasury defaults to admin
    assert_eq!(token_client.balance(&buyer1), 1_000_000 - 1000 + 1700);
    assert_eq!(token_client.balance(&buyer2), 1_000_000 - 2000);
}

#[test]
fn test_list_for_sale_rejects_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let stranger = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
        &0,
    );

    // stranger holds zero copies of this token, so they can't list it.
    let res = client.try_list_for_sale(&stranger, &token_id, &500, &1);
    assert_eq!(res, Err(Ok(Error::InsufficientBalance)));
}

#[test]
fn test_pause_blocks_mint_list_and_buy() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let (_admin, _token_admin, token, client) = setup(&env);
    token.mint(&buyer, &10000);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &5,
        &1000,
        &0,
    );

    client.pause();
    assert!(client.is_paused());

    let mint_res = client.try_mint(
        &creator,
        &String::from_str(&env, "NFT2"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
        &0,
    );
    assert_eq!(mint_res, Err(Ok(Error::Paused)));

    let list_res = client.try_list_for_sale(&creator, &token_id, &500, &1);
    assert_eq!(list_res, Err(Ok(Error::Paused)));

    let buy_res = client.try_buy(&buyer, &creator, &token_id, &1);
    assert_eq!(buy_res, Err(Ok(Error::Paused)));

    // cancel_listing still works while paused
    client.cancel_listing(&creator, &token_id);
    assert_eq!(client.get_listing(&token_id, &creator).is_active, false);

    client.unpause();
    assert!(!client.is_paused());
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
        &0,
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

    let creator = Address::generate(&env);
    let approved_addr = Address::generate(&env);
    let recipient = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &1,
        &1000,
        &0,
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

    let owner = Address::generate(&env);
    let operator = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    let future_ledger = env.ledger().sequence() + 10000;
    client.approve_for_all(&owner, &operator, &future_ledger);

    assert!(client.is_approved_for_all(&owner, &operator));
}

#[test]
fn test_cancel_listing() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let (_admin, _token_admin, _token, client) = setup(&env);

    let token_id = client.mint(
        &creator,
        &String::from_str(&env, "NFT"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "https://s3.../thumb.png"),
        &String::from_str(&env, "https://s3.../content.png"),
        &String::from_str(&env, "image/png"),
        &5,
        &1000,
        &0,
    );

    client.cancel_listing(&creator, &token_id);

    let listing = client.get_listing(&token_id, &creator);
    assert_eq!(listing.is_active, false);
}

#[test]
fn test_set_platform_fee_rejects_over_cap() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, _token_admin, _token, client) = setup(&env);

    let res = client.try_set_platform_fee(&1001);
    assert_eq!(res, Err(Ok(Error::InvalidFee)));

    client.set_platform_fee(&1000);
    assert_eq!(client.get_platform_fee(), 1000);
}
