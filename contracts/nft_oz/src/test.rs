#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal, String,
};

use crate::{ArtInput, ArtNft, ArtNftClient};

const FEE_BPS: u32 = 250; // 2.5%
const ROYALTY_BPS: u32 = 500; // 5%
const PRICE: i128 = 1_000_0000000; // 1000 units at 7 decimals

struct Fixture<'a> {
    env: Env,
    client: ArtNftClient<'a>,
    payment: Address,
    token: TokenClient<'a>,
    owner: Address,
    treasury: Address,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let sac_admin = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let payment = sac.address();
    let token = TokenClient::new(&env, &payment);

    let contract_id = env.register(
        ArtNft,
        (
            owner.clone(),
            treasury.clone(),
            FEE_BPS,
            String::from_str(&env, "Actionverse Art"),
            String::from_str(&env, "AVART"),
            String::from_str(&env, "https://actionverse.test/nft/"),
        ),
    );

    Fixture {
        client: ArtNftClient::new(&env, &contract_id),
        env,
        payment,
        token,
        owner,
        treasury,
    }
}

/// Funds `who` with `amount` of the payment asset so they can buy.
fn fund(f: &Fixture, who: &Address, amount: i128) {
    StellarAssetClient::new(&f.env, &f.payment).mint(who, &amount);
}

fn mint(f: &Fixture, creator: &Address, royalty_bps: u32) -> u32 {
    mint_ref(f, creator, "row-1", royalty_bps)
}

fn mint_ref(f: &Fixture, creator: &Address, art_ref: &str, royalty_bps: u32) -> u32 {
    f.client.mint_art(creator, &String::from_str(&f.env, art_ref), &art_input(f, royalty_bps))
}

fn art_input(f: &Fixture, royalty_bps: u32) -> ArtInput {
    ArtInput {
        title: String::from_str(&f.env, "Sunset"),
        description: String::from_str(&f.env, "A sunset over the bay"),
        thumbnail_url: String::from_str(&f.env, "https://cdn.test/thumb.png"),
        media_url: String::from_str(&f.env, "https://cdn.test/full.png"),
        media_type: String::from_str(&f.env, "image/png"),
        royalty_bps,
    }
}

// =============================================================================
// Metadata & minting
// =============================================================================

#[test]
fn constructor_sets_metadata_and_fee() {
    let f = setup();

    assert_eq!(f.client.name(), String::from_str(&f.env, "Actionverse Art"));
    assert_eq!(f.client.symbol(), String::from_str(&f.env, "AVART"));
    assert_eq!(f.client.platform_fee_bps(), FEE_BPS);
    assert_eq!(f.client.treasury(), Some(f.treasury.clone()));
    assert_eq!(f.client.get_owner(), Some(f.owner.clone()));
    assert!(!f.client.paused());
}

#[test]
fn mint_assigns_sequential_ids_and_stores_metadata() {
    let f = setup();
    let alice = Address::generate(&f.env);

    let first = mint_ref(&f, &alice, "row-1", ROYALTY_BPS);
    let second = mint_ref(&f, &alice, "row-2", ROYALTY_BPS);

    assert_eq!(second, first + 1, "token ids must be sequential, not hashed");
    assert_eq!(f.client.owner_of(&first), alice);
    assert_eq!(f.client.balance(&alice), 2);

    let meta = f.client.art_meta(&first).unwrap();
    assert_eq!(meta.title, String::from_str(&f.env, "Sunset"));
    assert_eq!(meta.media_url, String::from_str(&f.env, "https://cdn.test/full.png"));
    assert_eq!(meta.creator, alice);

    // Royalty is recorded in the OZ extension, not duplicated in ArtMeta.
    let (receiver, amount) = f.client.royalty_info(&first, &10_000);
    assert_eq!(receiver, alice);
    assert_eq!(amount, 500);
}

/// Two creators minting concurrently must never collide — the old hash-mod-1e6
/// token id scheme silently overwrote ownership on collision.
#[test]
fn distinct_creators_get_distinct_tokens() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);

    let a = mint_ref(&f, &alice, "row-a", 0);
    let b = mint_ref(&f, &bob, "row-b", 0);

    assert_ne!(a, b);
    assert_eq!(f.client.owner_of(&a), alice);
    assert_eq!(f.client.owner_of(&b), bob);
}

/// The client can't decode the minted id out of transaction meta, so it looks
/// the token up by the reference it supplied.
#[test]
fn token_is_resolvable_by_its_off_chain_ref() {
    let f = setup();
    let alice = Address::generate(&f.env);

    let id = mint_ref(&f, &alice, "nft-row-abc", 0);

    assert_eq!(f.client.token_by_ref(&String::from_str(&f.env, "nft-row-abc")), Some(id));
    assert_eq!(f.client.token_by_ref(&String::from_str(&f.env, "nope")), None);
}

/// A retried mint of the same database row must not create a second token.
#[test]
#[should_panic(expected = "Error(Contract, #311)")]
fn minting_the_same_ref_twice_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);

    mint_ref(&f, &alice, "nft-row-abc", 0);
    mint_ref(&f, &alice, "nft-row-abc", 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #302)")]
fn mint_rejects_royalty_over_cap() {
    let f = setup();
    let alice = Address::generate(&f.env);
    mint(&f, &alice, 5_001);
}

#[test]
#[should_panic(expected = "Error(Contract, #303)")]
fn mint_rejects_empty_title() {
    let f = setup();
    let alice = Address::generate(&f.env);
    f.client.mint_art(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &ArtInput {
            title: String::from_str(&f.env, ""),
            description: String::from_str(&f.env, "d"),
            thumbnail_url: String::from_str(&f.env, "https://cdn.test/t.png"),
            media_url: String::from_str(&f.env, "https://cdn.test/f.png"),
            media_type: String::from_str(&f.env, "image/png"),
            royalty_bps: 0,
        },
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #305)")]
fn mint_rejects_empty_media_url() {
    let f = setup();
    let alice = Address::generate(&f.env);
    f.client.mint_art(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &ArtInput {
            title: String::from_str(&f.env, "t"),
            description: String::from_str(&f.env, "d"),
            thumbnail_url: String::from_str(&f.env, "https://cdn.test/t.png"),
            media_url: String::from_str(&f.env, ""),
            media_type: String::from_str(&f.env, "image/png"),
            royalty_bps: 0,
        },
    );
}

// =============================================================================
// Standard token surface
// =============================================================================

#[test]
fn owner_can_transfer_directly() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let id = mint(&f, &alice, 0);

    f.client.transfer(&alice, &bob, &id);

    assert_eq!(f.client.owner_of(&id), bob);
    assert_eq!(f.client.balance(&alice), 0);
    assert_eq!(f.client.balance(&bob), 1);
}

#[test]
fn approved_spender_can_transfer_from() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let id = mint(&f, &alice, 0);

    let expiry = f.env.ledger().sequence() + 1_000;
    f.client.approve(&alice, &bob, &id, &expiry);
    assert_eq!(f.client.get_approved(&id), Some(bob.clone()));

    f.client.transfer_from(&bob, &alice, &bob, &id);
    assert_eq!(f.client.owner_of(&id), bob);
}

#[test]
fn holder_can_burn() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let id = mint(&f, &alice, 0);

    f.client.burn(&alice, &id);
    assert_eq!(f.client.balance(&alice), 0);
}

// =============================================================================
// Marketplace
// =============================================================================

/// The storefront's "create for sale" path: one signature mints and lists
/// atomically, so there is no second transaction that could read a stale
/// `token_id` or a stale account sequence.
#[test]
fn mint_and_list_creates_a_token_with_a_live_listing_in_one_call() {
    let f = setup();
    let alice = Address::generate(&f.env);

    let id = f.client.mint_and_list(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &art_input(&f, ROYALTY_BPS),
        &PRICE,
        &f.payment,
    );

    assert_eq!(f.client.owner_of(&id), alice);
    let listing = f.client.listing(&id).unwrap();
    assert_eq!(listing.seller, alice);
    assert_eq!(listing.price, PRICE);
    assert_eq!(listing.payment_token, f.payment);
}

#[test]
fn a_token_from_mint_and_list_is_immediately_buyable() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let id = f.client.mint_and_list(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &art_input(&f, ROYALTY_BPS),
        &PRICE,
        &f.payment,
    );
    f.client.buy(&bob, &id);

    assert_eq!(f.client.owner_of(&id), bob);
    assert_eq!(f.client.listing(&id), None);
}

#[test]
#[should_panic(expected = "Error(Contract, #300)")]
fn mint_and_list_rejects_zero_price() {
    let f = setup();
    let alice = Address::generate(&f.env);
    f.client.mint_and_list(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &art_input(&f, 0),
        &0,
        &f.payment,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #311)")]
fn mint_and_list_rejects_a_duplicate_ref_like_plain_mint_does() {
    let f = setup();
    let alice = Address::generate(&f.env);
    f.client.mint_and_list(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &art_input(&f, 0),
        &PRICE,
        &f.payment,
    );
    f.client.mint_and_list(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &art_input(&f, 0),
        &PRICE,
        &f.payment,
    );
}

#[test]
fn primary_sale_pays_seller_and_platform_but_no_royalty() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 2);

    let id = mint(&f, &alice, ROYALTY_BPS);
    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.buy(&bob, &id);

    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;

    assert_eq!(f.client.owner_of(&id), bob, "token must move to the buyer");
    assert_eq!(f.token.balance(&f.treasury), platform_fee);
    // Alice is both seller and creator, so she is not charged a royalty on her
    // own sale — she receives everything except the platform fee.
    assert_eq!(f.token.balance(&alice), PRICE - platform_fee);
    assert_eq!(f.token.balance(&bob), PRICE * 2 - PRICE);
    assert_eq!(f.client.listing(&id), None, "listing must be consumed");
}

#[test]
fn resale_pays_royalty_to_the_original_creator() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // first buyer, then reseller
    let carol = Address::generate(&f.env); // second buyer
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    let id = mint(&f, &alice, ROYALTY_BPS);

    // Primary sale.
    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.buy(&bob, &id);
    let alice_after_primary = f.token.balance(&alice);

    // Resale by bob at the same price.
    f.client.list(&bob, &id, &PRICE, &f.payment);
    f.client.buy(&carol, &id);

    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;
    let royalty = PRICE * ROYALTY_BPS as i128 / 10_000;

    assert_eq!(f.client.owner_of(&id), carol);
    assert_eq!(
        f.token.balance(&alice) - alice_after_primary,
        royalty,
        "creator must be paid a royalty on the secondary sale"
    );
    assert_eq!(f.token.balance(&f.treasury), platform_fee * 2);
    assert_eq!(f.token.balance(&bob), PRICE - platform_fee - royalty);
}

#[test]
fn sale_breakdown_matches_what_buy_actually_pays() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    let id = mint(&f, &alice, ROYALTY_BPS);
    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.buy(&bob, &id);

    f.client.list(&bob, &id, &PRICE, &f.payment);
    let quoted = f.client.sale_breakdown(&id).unwrap();

    let treasury_before = f.token.balance(&f.treasury);
    let creator_before = f.token.balance(&alice);
    let seller_before = f.token.balance(&bob);

    f.client.buy(&carol, &id);

    assert_eq!(f.token.balance(&f.treasury) - treasury_before, quoted.platform_fee);
    assert_eq!(f.token.balance(&alice) - creator_before, quoted.royalty);
    assert_eq!(f.token.balance(&bob) - seller_before, quoted.seller_amount);
    assert_eq!(
        quoted.platform_fee + quoted.royalty + quoted.seller_amount,
        quoted.total,
        "the split must account for every unit of the price"
    );
}

/// The seller signs only when listing. A purchase must go through with the
/// buyer's signature alone, which is the whole reason the marketplace lives
/// inside the token contract.
///
/// The auth tree spelled out here is exactly what the client has to produce:
/// `buy` plus one payment sub-invocation per recipient, all authorized by the
/// buyer. On-chain these are covered automatically because the buyer is the
/// transaction source account, but simulation still has to discover them —
/// which is why the frontend must simulate rather than hand-build this XDR.
#[test]
fn buy_requires_only_the_buyers_signature() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let sac_admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(sac_admin.clone());
    let payment = sac.address();

    let contract_id = env.register(
        ArtNft,
        (
            owner,
            treasury.clone(),
            FEE_BPS,
            String::from_str(&env, "Actionverse Art"),
            String::from_str(&env, "AVART"),
            String::from_str(&env, "https://actionverse.test/nft/"),
        ),
    );
    let client = ArtNftClient::new(&env, &contract_id);

    env.mock_all_auths();
    StellarAssetClient::new(&env, &payment).mint(&bob, &PRICE);
    let id = client.mint_and_list(
        &alice,
        &String::from_str(&env, "row-1"),
        &ArtInput {
            title: String::from_str(&env, "Sunset"),
            description: String::from_str(&env, "d"),
            thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
            media_url: String::from_str(&env, "https://cdn.test/f.png"),
            media_type: String::from_str(&env, "image/png"),
            royalty_bps: ROYALTY_BPS,
        },
        &PRICE,
        &payment,
    );

    // Alice is the creator, so this primary sale pays only the treasury and
    // alice — no royalty leg.
    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;
    let seller_amount = PRICE - platform_fee;

    let fee_leg = MockAuthInvoke {
        contract: &payment,
        fn_name: "transfer",
        args: (bob.clone(), treasury.clone(), platform_fee).into_val(&env),
        sub_invokes: &[],
    };
    let seller_leg = MockAuthInvoke {
        contract: &payment,
        fn_name: "transfer",
        args: (bob.clone(), alice.clone(), seller_amount).into_val(&env),
        sub_invokes: &[],
    };

    // From here on only bob's authorization exists. If settlement needed
    // alice to sign, this call would fail.
    env.set_auths(&[]);
    client
        .mock_auths(&[MockAuth {
            address: &bob,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "buy",
                args: (bob.clone(), id).into_val(&env),
                sub_invokes: &[fee_leg, seller_leg],
            },
        }])
        .buy(&bob, &id);

    assert_eq!(client.owner_of(&id), bob);
    assert_eq!(TokenClient::new(&env, &payment).balance(&alice), seller_amount);
}

#[test]
#[should_panic(expected = "Error(Contract, #307)")]
fn cannot_buy_your_own_listing() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);

    let id = mint(&f, &alice, 0);
    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.buy(&alice, &id);
}

#[test]
#[should_panic(expected = "Error(Contract, #308)")]
fn cannot_list_a_token_you_do_not_own() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);

    let id = mint(&f, &alice, 0);
    f.client.list(&bob, &id, &PRICE, &f.payment);
}

/// Listing does not escrow, so a seller can transfer the token away while the
/// listing is still live. Settling then would pay them for nothing.
#[test]
#[should_panic(expected = "Error(Contract, #309)")]
fn buying_a_stale_listing_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &carol, PRICE);

    let id = mint(&f, &alice, 0);
    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.transfer(&alice, &bob, &id);

    f.client.buy(&carol, &id);
}

#[test]
fn cancel_listing_removes_it() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let id = mint(&f, &alice, 0);

    f.client.list(&alice, &id, &PRICE, &f.payment);
    assert!(f.client.listing(&id).is_some());

    f.client.cancel_listing(&alice, &id);
    assert_eq!(f.client.listing(&id), None);
}

#[test]
#[should_panic(expected = "Error(Contract, #308)")]
fn only_the_seller_can_cancel() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let id = mint(&f, &alice, 0);

    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.cancel_listing(&bob, &id);
}

#[test]
#[should_panic(expected = "Error(Contract, #300)")]
fn listing_at_zero_price_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let id = mint(&f, &alice, 0);
    f.client.list(&alice, &id, &0, &f.payment);
}

// =============================================================================
// Royalties
// =============================================================================

/// A buyer must not be able to strip the royalty off a piece before flipping
/// it — only the original creator can change it.
#[test]
#[should_panic(expected = "Error(Contract, #310)")]
fn holder_cannot_rewrite_royalty() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let id = mint(&f, &alice, ROYALTY_BPS);
    f.client.list(&alice, &id, &PRICE, &f.payment);
    f.client.buy(&bob, &id);

    f.client.set_token_royalty(&id, &bob, &0, &bob);
}

#[test]
fn creator_can_adjust_their_own_royalty() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let id = mint(&f, &alice, ROYALTY_BPS);

    f.client.set_token_royalty(&id, &alice, &1_000, &alice);

    let (receiver, amount) = f.client.royalty_info(&id, &10_000);
    assert_eq!(receiver, alice);
    assert_eq!(amount, 1_000);
}

// =============================================================================
// Admin
// =============================================================================

#[test]
fn owner_can_update_platform_fee() {
    let f = setup();
    let new_treasury = Address::generate(&f.env);

    f.client.set_platform_fee(&100, &new_treasury);

    assert_eq!(f.client.platform_fee_bps(), 100);
    assert_eq!(f.client.treasury(), Some(new_treasury));
}

#[test]
#[should_panic(expected = "Error(Contract, #301)")]
fn platform_fee_cannot_exceed_the_cap() {
    let f = setup();
    let t = Address::generate(&f.env);
    f.client.set_platform_fee(&1_001, &t);
}

#[test]
#[should_panic]
fn non_owner_cannot_update_platform_fee() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let mallory = Address::generate(&env);

    let contract_id = env.register(
        ArtNft,
        (
            owner,
            treasury.clone(),
            FEE_BPS,
            String::from_str(&env, "Actionverse Art"),
            String::from_str(&env, "AVART"),
            String::from_str(&env, "https://actionverse.test/nft/"),
        ),
    );
    let client = ArtNftClient::new(&env, &contract_id);

    client
        .mock_auths(&[MockAuth {
            address: &mallory,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_platform_fee",
                args: (9u32, treasury.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .set_platform_fee(&9, &treasury);
}

#[test]
fn pause_blocks_mint_list_and_buy_but_not_exits() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let id = mint(&f, &alice, 0);
    f.client.list(&alice, &id, &PRICE, &f.payment);

    f.client.pause(&f.owner);
    assert!(f.client.paused());

    assert!(f.client.try_buy(&bob, &id).is_err());
    assert!(f.client.try_list(&alice, &id, &PRICE, &f.payment).is_err());
    assert!(f
        .client
        .try_mint_and_list(&alice, &String::from_str(&f.env, "row-2"), &art_input(&f, 0), &PRICE, &f.payment)
        .is_err());

    // Holders must still be able to get out while the platform is halted.
    f.client.cancel_listing(&alice, &id);
    f.client.transfer(&alice, &bob, &id);
    assert_eq!(f.client.owner_of(&id), bob);

    f.client.unpause(&f.owner);
    assert!(!f.client.paused());
}
