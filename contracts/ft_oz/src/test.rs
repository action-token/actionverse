#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal, String,
};

use crate::{ArtEdition, ArtEditionClient, ArtInput};

const FEE_BPS: u32 = 250; // 2.5%
const ROYALTY_BPS: u32 = 500; // 5%
const EDITION_SIZE: i128 = 100;
/// Price for one copy, at 7 decimals.
const PRICE: i128 = 50_0000000;

struct Fixture<'a> {
    env: Env,
    client: ArtEditionClient<'a>,
    payment: Address,
    token: TokenClient<'a>,
    creator: Address,
    treasury: Address,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let sac_admin = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let payment = sac.address();
    let token = TokenClient::new(&env, &payment);

    let contract_id = env.register(
        ArtEdition,
        (
            creator.clone(),
            treasury.clone(),
            FEE_BPS,
            EDITION_SIZE,
            0u32, // whole copies, no fractions
            String::from_str(&env, "Sunset Print"),
            String::from_str(&env, "SUNSET"),
            ArtInput {
                title: String::from_str(&env, "Sunset"),
                description: String::from_str(&env, "A sunset over the bay"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/thumb.png"),
                media_url: String::from_str(&env, "https://cdn.test/full.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: ROYALTY_BPS,
            },
            PRICE,
            payment.clone(),
        ),
    );

    Fixture {
        client: ArtEditionClient::new(&env, &contract_id),
        env,
        payment,
        token,
        creator,
        treasury,
    }
}

fn fund(f: &Fixture, who: &Address, amount: i128) {
    StellarAssetClient::new(&f.env, &f.payment).mint(who, &amount);
}

// =============================================================================
// Construction
// =============================================================================

#[test]
fn constructor_mints_the_whole_edition_to_the_creator() {
    let f = setup();

    assert_eq!(f.client.total_supply(), EDITION_SIZE);
    assert_eq!(f.client.balance(&f.creator), EDITION_SIZE);
    assert_eq!(f.client.decimals(), 0, "one unit must mean one copy");
    assert_eq!(f.client.symbol(), String::from_str(&f.env, "SUNSET"));
    assert_eq!(f.client.get_owner(), Some(f.creator.clone()));

    let meta = f.client.art_meta().unwrap();
    assert_eq!(meta.edition_size, EDITION_SIZE);
    assert_eq!(meta.royalty_bps, ROYALTY_BPS);
    assert_eq!(meta.media_url, String::from_str(&f.env, "https://cdn.test/full.png"));
    assert_eq!(meta.creator, f.creator);
}

/// Deploying is the storefront's whole "create for sale" action: one
/// signature both mints the print run to the creator and lists all of it,
/// with no second transaction that could read the contract back before it's
/// visible.
#[test]
fn constructor_lists_the_whole_edition_for_sale() {
    let f = setup();

    let listing = f.client.listing(&f.creator).unwrap();
    assert_eq!(listing.price, PRICE);
    assert_eq!(listing.available, EDITION_SIZE);
    assert_eq!(listing.payment_token, f.payment);
}

/// `nft_oz` gets its mint-without-listing case from a separate function
/// (`mint_art`, alongside `mint_and_list`). An edition can only ever mint once
/// — at deploy — so there's no second function to split the two cases across;
/// `price: 0` is how the same choice is made here instead.
#[test]
fn zero_price_at_deploy_mints_without_listing() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let sac_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let payment = sac.address();

    let contract_id = env.register(
        ArtEdition,
        (
            creator.clone(),
            treasury,
            FEE_BPS,
            EDITION_SIZE,
            0u32,
            String::from_str(&env, "Sunset Print"),
            String::from_str(&env, "SUNSET"),
            ArtInput {
                title: String::from_str(&env, "Sunset"),
                description: String::from_str(&env, "d"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
                media_url: String::from_str(&env, "https://cdn.test/f.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: ROYALTY_BPS,
            },
            0i128,
            payment.clone(),
        ),
    );
    let client = ArtEditionClient::new(&env, &contract_id);

    // Minted, but nothing for sale yet.
    assert_eq!(client.balance(&creator), EDITION_SIZE);
    assert_eq!(client.listing(&creator), None);
    assert_eq!(client.listings().len(), 0);

    // The standalone `list` composes with a mint-only deploy exactly like it
    // would for any other holder.
    client.list(&creator, &PRICE, &10, &payment);
    assert_eq!(client.listing(&creator).unwrap().available, 10);
}

#[test]
#[should_panic(expected = "Error(Contract, #400)")]
fn negative_price_at_deploy_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);

    env.register(
        ArtEdition,
        (
            creator,
            treasury,
            FEE_BPS,
            EDITION_SIZE,
            0u32,
            String::from_str(&env, "n"),
            String::from_str(&env, "S"),
            ArtInput {
                title: String::from_str(&env, "t"),
                description: String::from_str(&env, "d"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
                media_url: String::from_str(&env, "https://cdn.test/f.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: ROYALTY_BPS,
            },
            -1i128,
            Address::generate(&env),
        ),
    );
}

#[test]
fn a_freshly_deployed_edition_is_immediately_buyable() {
    let f = setup();
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 3);

    f.client.buy(&bob, &f.creator, &3);

    assert_eq!(f.client.balance(&bob), 3);
    assert_eq!(f.client.listing(&f.creator).unwrap().available, EDITION_SIZE - 3);
}

/// Supply is fixed at deploy. Burning is the only way it moves, and it only
/// moves down — that is what makes "edition of 100" a real promise.
#[test]
fn supply_can_only_shrink() {
    let f = setup();

    f.client.burn(&f.creator, &10);

    assert_eq!(f.client.total_supply(), EDITION_SIZE - 10);
    assert_eq!(f.client.balance(&f.creator), EDITION_SIZE - 10);
}

#[test]
#[should_panic(expected = "Error(Contract, #406)")]
fn zero_size_edition_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);

    // Rejected on `edition_size` before the constructor ever reaches its
    // trailing `do_list` call, so the price/payment_token here are dummies.
    env.register(
        ArtEdition,
        (
            creator,
            treasury,
            FEE_BPS,
            0i128,
            0u32,
            String::from_str(&env, "n"),
            String::from_str(&env, "S"),
            ArtInput {
                title: String::from_str(&env, "t"),
                description: String::from_str(&env, "d"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
                media_url: String::from_str(&env, "https://cdn.test/f.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: ROYALTY_BPS,
            },
            PRICE,
            Address::generate(&env),
        ),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #402)")]
fn royalty_over_cap_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);

    // Rejected on `royalty_bps` before the constructor ever reaches its
    // trailing `do_list` call, so the price/payment_token here are dummies.
    env.register(
        ArtEdition,
        (
            creator,
            treasury,
            FEE_BPS,
            EDITION_SIZE,
            0u32,
            String::from_str(&env, "n"),
            String::from_str(&env, "S"),
            ArtInput {
                title: String::from_str(&env, "t"),
                description: String::from_str(&env, "d"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
                media_url: String::from_str(&env, "https://cdn.test/f.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: 5_001u32,
            },
            PRICE,
            Address::generate(&env),
        ),
    );
}

// =============================================================================
// Marketplace
// =============================================================================

#[test]
fn primary_sale_moves_copies_and_pays_the_platform() {
    let f = setup();
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 10);

    f.client.list(&f.creator, &PRICE, &20, &f.payment);
    f.client.buy(&bob, &f.creator, &3);

    let total = PRICE * 3;
    let platform_fee = total * FEE_BPS as i128 / 10_000;

    assert_eq!(f.client.balance(&bob), 3, "buyer holds 3 copies");
    assert_eq!(f.client.balance(&f.creator), EDITION_SIZE - 3);
    assert_eq!(f.token.balance(&f.treasury), platform_fee);
    // Creator is the seller here, so no royalty leg.
    assert_eq!(f.token.balance(&f.creator), total - platform_fee);

    let listing = f.client.listing(&f.creator).unwrap();
    assert_eq!(listing.available, 17, "remaining copies stay listed");
}

#[test]
fn resale_pays_royalty_to_the_creator() {
    let f = setup();
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 10);
    fund(&f, &carol, PRICE * 10);

    // Primary: creator sells 5 to bob.
    f.client.list(&f.creator, &PRICE, &5, &f.payment);
    f.client.buy(&bob, &f.creator, &5);
    let creator_after_primary = f.token.balance(&f.creator);
    let bob_after_primary = f.token.balance(&bob);

    // Secondary: bob resells 2 to carol.
    f.client.list(&bob, &PRICE, &2, &f.payment);
    f.client.buy(&carol, &bob, &2);

    let total = PRICE * 2;
    let platform_fee = total * FEE_BPS as i128 / 10_000;
    let royalty = total * ROYALTY_BPS as i128 / 10_000;

    assert_eq!(f.client.balance(&carol), 2);
    assert_eq!(f.client.balance(&bob), 3);
    assert_eq!(
        f.token.balance(&f.creator) - creator_after_primary,
        royalty,
        "creator earns a royalty on the resale of their edition"
    );
    assert_eq!(
        f.token.balance(&bob) - bob_after_primary,
        total - platform_fee - royalty
    );
}

/// Regression guard for a storage-key collision: `#[contracttype]` unit
/// variants are keyed by name, so naming one `Meta` aliased this contract's
/// `ArtMeta` onto OpenZeppelin's `FungibleStorageKey::Meta` and corrupted the
/// token's own decimals/name/symbol.
#[test]
fn art_metadata_does_not_clobber_token_metadata() {
    let f = setup();

    assert_eq!(f.client.decimals(), 0);
    assert_eq!(f.client.name(), String::from_str(&f.env, "Sunset Print"));
    assert_eq!(f.client.symbol(), String::from_str(&f.env, "SUNSET"));
    assert_eq!(f.client.art_meta().unwrap().title, String::from_str(&f.env, "Sunset"));
}

#[test]
fn many_holders_can_list_the_same_edition_independently() {
    let f = setup();
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    let dave = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 20);
    fund(&f, &carol, PRICE * 20);
    fund(&f, &dave, PRICE * 20);

    f.client.list(&f.creator, &PRICE, &10, &f.payment);
    f.client.buy(&bob, &f.creator, &4);
    f.client.buy(&carol, &f.creator, &3);

    // Both resellers now compete with the creator at their own prices.
    f.client.list(&bob, &(PRICE * 2), &4, &f.payment);
    f.client.list(&carol, &(PRICE * 3), &3, &f.payment);

    let listings = f.client.listings();
    assert_eq!(listings.len(), 3, "creator, bob and carol each have a listing");

    f.client.buy(&dave, &bob, &1);
    assert_eq!(f.client.balance(&dave), 1);
    assert_eq!(f.client.listing(&bob).unwrap().available, 3);
    assert_eq!(f.client.listing(&carol).unwrap().available, 3, "carol untouched");
}

#[test]
fn selling_out_a_listing_removes_it() {
    let f = setup();
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 10);

    f.client.list(&f.creator, &PRICE, &2, &f.payment);
    f.client.buy(&bob, &f.creator, &2);

    assert_eq!(f.client.listing(&f.creator), None);
    assert_eq!(f.client.listings().len(), 0);
}

#[test]
fn sale_breakdown_matches_what_buy_actually_pays() {
    let f = setup();
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 10);
    fund(&f, &carol, PRICE * 10);

    f.client.list(&f.creator, &PRICE, &5, &f.payment);
    f.client.buy(&bob, &f.creator, &5);

    f.client.list(&bob, &PRICE, &4, &f.payment);
    let quoted = f.client.sale_breakdown(&bob, &3).unwrap();

    let treasury_before = f.token.balance(&f.treasury);
    let creator_before = f.token.balance(&f.creator);
    let seller_before = f.token.balance(&bob);

    f.client.buy(&carol, &bob, &3);

    assert_eq!(f.token.balance(&f.treasury) - treasury_before, quoted.platform_fee);
    assert_eq!(f.token.balance(&f.creator) - creator_before, quoted.royalty);
    assert_eq!(f.token.balance(&bob) - seller_before, quoted.seller_amount);
    assert_eq!(
        quoted.platform_fee + quoted.royalty + quoted.seller_amount,
        quoted.total,
        "the split must account for every unit of the price"
    );
}

/// Only the buyer signs a purchase — the seller consented when they listed.
#[test]
fn buy_requires_only_the_buyers_signature() {
    let env = Env::default();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let sac_admin = Address::generate(&env);
    let bob = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let payment = sac.address();

    let contract_id = env.register(
        ArtEdition,
        (
            creator.clone(),
            treasury.clone(),
            FEE_BPS,
            EDITION_SIZE,
            0u32,
            String::from_str(&env, "Sunset Print"),
            String::from_str(&env, "SUNSET"),
            ArtInput {
                title: String::from_str(&env, "Sunset"),
                description: String::from_str(&env, "d"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
                media_url: String::from_str(&env, "https://cdn.test/f.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: ROYALTY_BPS,
            },
            PRICE,
            payment.clone(),
        ),
    );
    let client = ArtEditionClient::new(&env, &contract_id);

    env.mock_all_auths();
    StellarAssetClient::new(&env, &payment).mint(&bob, &(PRICE * 10));
    client.list(&creator, &PRICE, &5, &payment);

    let total = PRICE * 2;
    let platform_fee = total * FEE_BPS as i128 / 10_000;
    let seller_amount = total - platform_fee;

    let fee_leg = MockAuthInvoke {
        contract: &payment,
        fn_name: "transfer",
        args: (bob.clone(), treasury.clone(), platform_fee).into_val(&env),
        sub_invokes: &[],
    };
    let seller_leg = MockAuthInvoke {
        contract: &payment,
        fn_name: "transfer",
        args: (bob.clone(), creator.clone(), seller_amount).into_val(&env),
        sub_invokes: &[],
    };

    env.set_auths(&[]);
    client
        .mock_auths(&[MockAuth {
            address: &bob,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "buy",
                args: (bob.clone(), creator.clone(), 2i128).into_val(&env),
                sub_invokes: &[fee_leg, seller_leg],
            },
        }])
        .buy(&bob, &creator, &2);

    assert_eq!(client.balance(&bob), 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #408)")]
fn cannot_buy_from_yourself() {
    let f = setup();
    fund(&f, &f.creator, PRICE * 10);

    f.client.list(&f.creator, &PRICE, &5, &f.payment);
    f.client.buy(&f.creator, &f.creator, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #409)")]
fn cannot_buy_more_than_is_listed() {
    let f = setup();
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 100);

    f.client.list(&f.creator, &PRICE, &2, &f.payment);
    f.client.buy(&bob, &f.creator, &3);
}

#[test]
#[should_panic(expected = "Error(Contract, #410)")]
fn cannot_list_more_copies_than_you_hold() {
    let f = setup();
    let bob = Address::generate(&f.env);

    f.client.list(&bob, &PRICE, &1, &f.payment);
}

/// Listings don't escrow, so a seller can move copies away after listing.
/// Settling then would pay them for copies they can't deliver.
#[test]
#[should_panic(expected = "Error(Contract, #410)")]
fn buying_a_stale_listing_is_rejected() {
    let f = setup();
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 10);
    fund(&f, &carol, PRICE * 10);

    f.client.list(&f.creator, &PRICE, &10, &f.payment);
    f.client.buy(&bob, &f.creator, &5);

    // Bob lists 5 then gives them all away before anyone buys.
    f.client.list(&bob, &PRICE, &5, &f.payment);
    f.client.transfer(&bob, &carol, &5);

    f.client.buy(&carol, &bob, &5);
}

#[test]
fn cancel_listing_removes_it() {
    let f = setup();

    f.client.list(&f.creator, &PRICE, &5, &f.payment);
    assert!(f.client.listing(&f.creator).is_some());

    f.client.cancel_listing(&f.creator);
    assert_eq!(f.client.listing(&f.creator), None);
    assert_eq!(f.client.listings().len(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #407)")]
fn cancelling_a_missing_listing_fails() {
    let f = setup();
    let bob = Address::generate(&f.env);
    f.client.cancel_listing(&bob);
}

#[test]
#[should_panic(expected = "Error(Contract, #400)")]
fn listing_at_zero_price_is_rejected() {
    let f = setup();
    f.client.list(&f.creator, &0, &5, &f.payment);
}

// =============================================================================
// Standard token surface
// =============================================================================

#[test]
fn approved_spender_can_transfer_from() {
    let f = setup();
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);

    let expiry = f.env.ledger().sequence() + 1_000;
    f.client.approve(&f.creator, &bob, &10, &expiry);
    assert_eq!(f.client.allowance(&f.creator, &bob), 10);

    f.client.transfer_from(&bob, &f.creator, &carol, &4);
    assert_eq!(f.client.balance(&carol), 4);
    assert_eq!(f.client.allowance(&f.creator, &bob), 6);
}

// =============================================================================
// Admin
// =============================================================================

/// The creator owns their edition contract, so an owner-gated fee setter would
/// let them zero out the platform's cut. There must be no setter at all.
#[test]
fn platform_fee_is_frozen_at_deploy() {
    let f = setup();

    assert_eq!(f.client.platform_fee_bps(), FEE_BPS);
    assert_eq!(f.client.treasury(), Some(f.treasury.clone()));
    // `set_platform_fee` intentionally does not exist on this contract; if it
    // is ever reintroduced, this test won't compile against the client.
}

#[test]
#[should_panic(expected = "Error(Contract, #401)")]
fn platform_fee_over_the_cap_is_rejected_at_deploy() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);

    // Rejected on `platform_fee_bps`, the constructor's very first check, so
    // the price/payment_token here are dummies.
    env.register(
        ArtEdition,
        (
            creator,
            treasury,
            1_001u32,
            EDITION_SIZE,
            0u32,
            String::from_str(&env, "n"),
            String::from_str(&env, "S"),
            ArtInput {
                title: String::from_str(&env, "t"),
                description: String::from_str(&env, "d"),
                thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
                media_url: String::from_str(&env, "https://cdn.test/f.png"),
                media_type: String::from_str(&env, "image/png"),
                royalty_bps: ROYALTY_BPS,
            },
            PRICE,
            Address::generate(&env),
        ),
    );
}

#[test]
fn pause_blocks_list_and_buy_but_not_exits() {
    let f = setup();
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 10);

    f.client.list(&f.creator, &PRICE, &5, &f.payment);
    f.client.pause(&f.creator);
    assert!(f.client.paused());

    assert!(f.client.try_buy(&bob, &f.creator, &1).is_err());
    assert!(f.client.try_list(&f.creator, &PRICE, &1, &f.payment).is_err());

    // Holders can still exit while halted.
    f.client.cancel_listing(&f.creator);
    f.client.transfer(&f.creator, &bob, &2);
    assert_eq!(f.client.balance(&bob), 2);

    f.client.unpause(&f.creator);
    assert!(!f.client.paused());
}
