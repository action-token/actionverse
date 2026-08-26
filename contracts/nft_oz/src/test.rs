#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, IntoVal, String, Vec,
};

use crate::{ArtNft, ArtNftClient, DataKey, EditionInput, PriceEntry, CONTRACT_VERSION};

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
    unlock_authority: Address,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
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
            unlock_authority.clone(),
        ),
    );

    Fixture {
        client: ArtNftClient::new(&env, &contract_id),
        env,
        payment,
        token,
        owner,
        treasury,
        unlock_authority,
    }
}

/// Funds `who` with `amount` of the payment asset so they can buy.
fn fund(f: &Fixture, who: &Address, amount: i128) {
    StellarAssetClient::new(&f.env, &f.payment).mint(who, &amount);
}

fn single_price(f: &Fixture, price: i128) -> Vec<PriceEntry> {
    let mut v = Vec::new(&f.env);
    v.push_back(PriceEntry { payment_token: f.payment.clone(), price });
    v
}

fn edition_input_with_prices(
    f: &Fixture,
    creator: &Address,
    royalty_bps: u32,
    supply: u32,
    prices: Vec<PriceEntry>,
) -> EditionInput {
    EditionInput {
        title: String::from_str(&f.env, "Sunset"),
        description: String::from_str(&f.env, "A sunset over the bay"),
        thumbnail_url: String::from_str(&f.env, "https://cdn.test/thumb.png"),
        media_url: String::from_str(&f.env, "https://cdn.test/full.png"),
        media_type: String::from_str(&f.env, "image/png"),
        creator: creator.clone(),
        royalty_bps,
        supply,
        prices,
    }
}

fn edition_input(f: &Fixture, creator: &Address, royalty_bps: u32, supply: u32, price: i128) -> EditionInput {
    edition_input_with_prices(f, creator, royalty_bps, supply, single_price(f, price))
}

/// Buys `quantity` copies of the edition registered under `edition_ref`
/// (registering it from `creator`/`royalty_bps`/`supply`/`price` the first
/// time it's seen), returning the `(first_token_id, last_token_id)` minted.
fn buy_ref(
    f: &Fixture,
    buyer: &Address,
    creator: &Address,
    edition_ref: &str,
    purchase_ref: &str,
    royalty_bps: u32,
    supply: u32,
    price: i128,
    quantity: u32,
) -> (u32, u32) {
    f.client.buy_edition(
        buyer,
        &String::from_str(&f.env, edition_ref),
        &edition_input(f, creator, royalty_bps, supply, price),
        &String::from_str(&f.env, purchase_ref),
        &f.payment,
        &quantity,
        &0,
        &0,
    )
}

/// A single-copy edition bought once — the equivalent of the old 1-of-1
/// `mint` helper, for tests that only care about standard token behavior.
fn buy_one(f: &Fixture, buyer: &Address, creator: &Address, royalty_bps: u32) -> u32 {
    let (first, last) = buy_ref(f, buyer, creator, "row-1", "purchase-1", royalty_bps, 1, PRICE, 1);
    assert_eq!(first, last);
    first
}

// =============================================================================
// Metadata & buying
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
fn buy_edition_assigns_sequential_ids_and_stores_metadata() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE * 2);

    let (first, _) = buy_ref(&f, &alice, &alice, "row-1", "purchase-1", ROYALTY_BPS, 1, PRICE, 1);
    let (second, _) = buy_ref(&f, &alice, &alice, "row-2", "purchase-2", ROYALTY_BPS, 1, PRICE, 1);

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

#[test]
fn distinct_editions_get_distinct_tokens() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    fund(&f, &bob, PRICE);

    let (a, _) = buy_ref(&f, &alice, &alice, "row-a", "purchase-a", 0, 1, PRICE, 1);
    let (b, _) = buy_ref(&f, &bob, &bob, "row-b", "purchase-b", 0, 1, PRICE, 1);

    assert_ne!(a, b);
    assert_eq!(f.client.owner_of(&a), alice);
    assert_eq!(f.client.owner_of(&b), bob);
}

#[test]
fn buying_multiple_copies_mints_a_consecutive_range_to_the_buyer() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE * 3);

    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", ROYALTY_BPS, 5, PRICE, 3);

    assert_eq!(last, first + 2, "a quantity-3 purchase must mint a 3-wide range");
    assert_eq!(f.client.balance(&bob), 3);
    for id in first..=last {
        assert_eq!(f.client.owner_of(&id), bob);
        let (receiver, _) = f.client.royalty_info(&id, &10_000);
        assert_eq!(receiver, alice, "every copy in the batch must carry the edition's royalty");
    }

    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();
    assert_eq!(f.client.remaining_supply(&edition_id), 2);
}

#[test]
fn a_second_purchase_of_the_same_edition_continues_the_range() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 2);
    fund(&f, &carol, PRICE * 2);

    let (_, last1) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 2);
    let (first2, _) = buy_ref(&f, &carol, &alice, "row-1", "purchase-2", 0, 10, PRICE, 2);

    assert_eq!(first2, last1 + 1);
}

/// A later purchase of an already-registered edition must not let a
/// different caller overwrite who the creator/royalty receiver is.
#[test]
fn second_purchase_of_same_edition_ignores_new_edition_fields() {
    let f = setup();
    let alice = Address::generate(&f.env); // real creator, fixed by the first purchase
    let mallory = Address::generate(&f.env); // tries to pose as creator on a later call
    fund(&f, &alice, PRICE * 2);

    buy_ref(&f, &alice, &alice, "row-1", "purchase-1", ROYALTY_BPS, 10, PRICE, 1);
    let (second, _) = buy_ref(&f, &alice, &mallory, "row-1", "purchase-2", 0, 10, PRICE, 1);

    let meta = f.client.art_meta(&second).unwrap();
    assert_eq!(meta.creator, alice);
    let (receiver, _) = f.client.royalty_info(&second, &10_000);
    assert_eq!(receiver, alice);
}

#[test]
fn edition_is_resolvable_by_its_off_chain_ref() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);

    buy_ref(&f, &alice, &alice, "nft-row-abc", "purchase-1", 0, 1, PRICE, 1);

    assert!(f.client.edition_by_ref(&String::from_str(&f.env, "nft-row-abc")).is_some());
    assert_eq!(f.client.edition_by_ref(&String::from_str(&f.env, "nope")), None);
}

/// The client can't decode a minted range out of transaction meta, so it
/// looks the purchase up by the reference it supplied.
#[test]
fn purchase_is_resolvable_by_its_own_ref() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);

    let (first, last) = buy_ref(&f, &alice, &alice, "row-1", "purchase-1", 0, 1, PRICE, 1);

    let receipt = f.client.purchase_by_ref(&String::from_str(&f.env, "purchase-1")).unwrap();
    assert_eq!(receipt.first_token_id, first);
    assert_eq!(receipt.last_token_id, last);
    assert_eq!(receipt.buyer, alice);
    assert_eq!(f.client.purchase_by_ref(&String::from_str(&f.env, "nope")), None);
}

/// A retried purchase attempt (same idempotency key) must not double-mint.
#[test]
#[should_panic(expected = "Error(Contract, #321)")]
fn reusing_a_purchase_ref_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE * 2);

    buy_ref(&f, &alice, &alice, "row-1", "dup-purchase", 0, 10, PRICE, 1);
    buy_ref(&f, &alice, &alice, "row-1", "dup-purchase", 0, 10, PRICE, 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #302)")]
fn buy_edition_rejects_royalty_over_cap() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    buy_ref(&f, &alice, &alice, "row-1", "purchase-1", 5_001, 1, PRICE, 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #303)")]
fn buy_edition_rejects_empty_title() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &EditionInput { title: String::from_str(&f.env, ""), ..edition_input(&f, &alice, 0, 1, PRICE) },
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #305)")]
fn buy_edition_rejects_empty_media_url() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &EditionInput { media_url: String::from_str(&f.env, ""), ..edition_input(&f, &alice, 0, 1, PRICE) },
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #313)")]
fn buy_edition_rejects_zero_supply() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 0, PRICE),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #314)")]
fn buy_edition_rejects_empty_price_grid() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input_with_prices(&f, &alice, 0, 1, Vec::new(&f.env)),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #315)")]
fn buy_edition_rejects_duplicate_payment_token_in_price_grid() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    let mut prices = Vec::new(&f.env);
    prices.push_back(PriceEntry { payment_token: f.payment.clone(), price: PRICE });
    prices.push_back(PriceEntry { payment_token: f.payment.clone(), price: PRICE * 2 });
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input_with_prices(&f, &alice, 0, 1, prices),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #316)")]
fn buy_edition_rejects_zero_price() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 1, 0),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #317)")]
fn buy_edition_rejects_unaccepted_payment_token() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    let other_admin = Address::generate(&f.env);
    let other_sac = f.env.register_stellar_asset_contract_v2(other_admin);
    let other_token = other_sac.address();

    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 1, PRICE),
        &String::from_str(&f.env, "purchase-1"),
        &other_token,
        &1,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #319)")]
fn buy_edition_rejects_zero_quantity() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 1, PRICE),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &0,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #319)")]
fn buy_edition_rejects_quantity_over_the_per_call_cap() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE * 100);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 1_000, PRICE),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &21,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #318)")]
fn buy_edition_rejects_purchase_exceeding_remaining_supply() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE * 5);
    buy_ref(&f, &alice, &alice, "row-1", "purchase-1", 0, 3, PRICE, 3);
    buy_ref(&f, &alice, &alice, "row-1", "purchase-2", 0, 3, PRICE, 1);
}

// =============================================================================
// Standard token surface
// =============================================================================

#[test]
fn owner_can_transfer_directly() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);

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
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);

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
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);

    f.client.burn(&alice, &id);
    assert_eq!(f.client.balance(&alice), 0);
}

// =============================================================================
// Marketplace (secondary/resale — every already-minted copy behaves like a
// 1-of-1 regardless of which edition it came from)
// =============================================================================

#[test]
fn primary_purchase_pays_creator_and_platform_but_no_royalty() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE * 2);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", ROYALTY_BPS, 1, PRICE, 1);

    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;

    assert_eq!(f.client.owner_of(&id), bob, "token must move to the buyer");
    assert_eq!(f.token.balance(&f.treasury), platform_fee);
    // Alice is the creator and there's no separate seller on a primary sale,
    // so she is not charged a royalty on her own edition — she receives
    // everything except the platform fee.
    assert_eq!(f.token.balance(&alice), PRICE - platform_fee);
    assert_eq!(f.token.balance(&bob), PRICE * 2 - PRICE);
}

#[test]
fn resale_pays_royalty_to_the_original_creator() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // first buyer, then reseller
    let carol = Address::generate(&f.env); // second buyer
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", ROYALTY_BPS, 1, PRICE, 1);
    let alice_after_primary = f.token.balance(&alice);

    f.client.list(&bob, &id, &single_price(&f, PRICE));
    f.client.buy(&carol, &id, &f.payment, &0, &0);

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

/// A reseller isn't limited to whichever currencies the creator originally
/// priced the edition in — they can offer their own copy in multiple
/// currencies at once, and the buyer picks which one to pay with.
#[test]
fn reseller_can_price_in_multiple_currencies() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer, then reseller
    let carol = Address::generate(&f.env); // second buyer, pays in the other currency
    fund(&f, &bob, PRICE);

    let other_admin = Address::generate(&f.env);
    let other_sac = f.env.register_stellar_asset_contract_v2(other_admin);
    let other_token = other_sac.address();
    StellarAssetClient::new(&f.env, &other_token).mint(&carol, &PRICE);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 1, PRICE, 1);

    let mut prices = Vec::new(&f.env);
    prices.push_back(PriceEntry { payment_token: f.payment.clone(), price: PRICE });
    prices.push_back(PriceEntry { payment_token: other_token.clone(), price: PRICE });
    f.client.list(&bob, &id, &prices);

    let listing = f.client.listing(&id).unwrap();
    assert_eq!(listing.prices.len(), 2);

    // Carol pays in the *second* currency, not the one the edition itself
    // was originally priced in.
    f.client.buy(&carol, &id, &other_token, &0, &0);

    assert_eq!(f.client.owner_of(&id), carol);
    assert_eq!(TokenClient::new(&f.env, &other_token).balance(&bob), PRICE - (PRICE * FEE_BPS as i128 / 10_000));
}

/// Listing several held copies at once is meant to collapse into one
/// signature instead of one `list` call per token — this is what backs the
/// manage page's "Hold N / list N for sale" control.
#[test]
fn list_batch_lists_every_token_at_the_same_price() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer, then reseller
    fund(&f, &bob, PRICE * 5);

    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 5);
    assert_eq!(last - first + 1, 5);

    let mut token_ids = Vec::new(&f.env);
    for id in first..=last {
        token_ids.push_back(id);
    }
    let prices = single_price(&f, PRICE);
    f.client.list_batch(&bob, &token_ids, &prices);

    for id in first..=last {
        let listing = f.client.listing(&id).unwrap();
        assert_eq!(listing.seller, bob);
        assert_eq!(listing.prices, prices);
    }
}

#[test]
#[should_panic(expected = "Error(Contract, #319)")]
fn list_batch_rejects_an_empty_batch() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 1, PRICE, 1);

    f.client.list_batch(&bob, &Vec::new(&f.env), &single_price(&f, PRICE));
}

#[test]
#[should_panic(expected = "Error(Contract, #308)")]
fn list_batch_rejects_a_token_the_caller_does_not_own() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 1, PRICE, 1);

    let mut token_ids = Vec::new(&f.env);
    token_ids.push_back(id);
    // Carol doesn't own token `id` — bob does.
    f.client.list_batch(&carol, &token_ids, &single_price(&f, PRICE));
}

/// Buying several pooled resale listings at once is meant to collapse into
/// one signature instead of one `buy` call per token — this is what backs
/// the buy page's quantity stepper over pooled resale listings.
#[test]
fn buy_batch_buys_every_token_and_pays_each_seller() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer, then reseller of all 5
    let carol = Address::generate(&f.env); // batch buyer
    fund(&f, &bob, PRICE * 5);
    fund(&f, &carol, PRICE * 5);

    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", ROYALTY_BPS, 5, PRICE, 5);
    let mut token_ids = Vec::new(&f.env);
    for id in first..=last {
        token_ids.push_back(id);
    }
    f.client.list_batch(&bob, &token_ids, &single_price(&f, PRICE));

    let bob_before = f.token.balance(&bob);
    let alice_before = f.token.balance(&alice);
    let treasury_before = f.token.balance(&f.treasury);

    f.client.buy_batch(&carol, &token_ids, &f.payment, &0, &0);

    for id in first..=last {
        assert_eq!(f.client.owner_of(&id), carol);
        assert!(f.client.listing(&id).is_none());
    }

    let royalty_per = PRICE * ROYALTY_BPS as i128 / 10_000;
    let platform_fee_per = PRICE * FEE_BPS as i128 / 10_000;
    assert_eq!(f.token.balance(&alice) - alice_before, royalty_per * 5);
    assert_eq!(f.token.balance(&f.treasury) - treasury_before, platform_fee_per * 5);
    assert_eq!(
        f.token.balance(&bob) - bob_before,
        (PRICE - royalty_per - platform_fee_per) * 5,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #319)")]
fn buy_batch_rejects_an_empty_batch() {
    let f = setup();
    let carol = Address::generate(&f.env);
    fund(&f, &carol, PRICE);

    f.client.buy_batch(&carol, &Vec::new(&f.env), &f.payment, &0, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #306)")]
fn buy_batch_rejects_an_unlisted_token() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 1, PRICE, 1);
    // `id` was never listed.
    let mut token_ids = Vec::new(&f.env);
    token_ids.push_back(id);
    f.client.buy_batch(&carol, &token_ids, &f.payment, &0, &0);
}

#[test]
fn sale_breakdown_matches_what_buy_actually_pays() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", ROYALTY_BPS, 1, PRICE, 1);

    f.client.list(&bob, &id, &single_price(&f, PRICE));
    let quoted = f.client.sale_breakdown(&id, &f.payment).unwrap();

    let treasury_before = f.token.balance(&f.treasury);
    let creator_before = f.token.balance(&alice);
    let seller_before = f.token.balance(&bob);

    f.client.buy(&carol, &id, &f.payment, &0, &0);

    assert_eq!(f.token.balance(&f.treasury) - treasury_before, quoted.platform_fee);
    assert_eq!(f.token.balance(&alice) - creator_before, quoted.royalty);
    assert_eq!(f.token.balance(&bob) - seller_before, quoted.seller_amount);
    assert_eq!(
        quoted.platform_fee + quoted.royalty + quoted.seller_amount,
        quoted.total,
        "the split must account for every unit of the price"
    );
}

/// The creator signs nothing at all — not at creation, not at first sale.
/// Only the buyer signs a primary purchase, which is the whole reason
/// `buy_edition` can register-and-mint an edition on a total stranger's
/// first purchase of it.
///
/// The auth tree spelled out here is exactly what the client has to produce:
/// `buy_edition` plus one payment sub-invocation per recipient, all
/// authorized by the buyer. On-chain these are covered automatically because
/// the buyer is the transaction source account, but simulation still has to
/// discover them — which is why the frontend must simulate rather than
/// hand-build this XDR.
#[test]
fn buy_edition_requires_only_the_buyers_signature() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
    let sac_admin = Address::generate(&env);
    let alice = Address::generate(&env); // creator, never signs
    let bob = Address::generate(&env); // buyer

    let sac = env.register_stellar_asset_contract_v2(sac_admin);
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
            unlock_authority,
        ),
    );
    let client = ArtNftClient::new(&env, &contract_id);

    env.mock_all_auths();
    StellarAssetClient::new(&env, &payment).mint(&bob, &PRICE);

    let mut prices = Vec::new(&env);
    prices.push_back(PriceEntry { payment_token: payment.clone(), price: PRICE });
    let edition = EditionInput {
        title: String::from_str(&env, "Sunset"),
        description: String::from_str(&env, "d"),
        thumbnail_url: String::from_str(&env, "https://cdn.test/t.png"),
        media_url: String::from_str(&env, "https://cdn.test/f.png"),
        media_type: String::from_str(&env, "image/png"),
        creator: alice.clone(),
        royalty_bps: ROYALTY_BPS,
        supply: 1,
        prices,
    };

    // Alice is the creator, so this primary purchase pays only the treasury
    // and alice — no royalty leg.
    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;
    let creator_amount = PRICE - platform_fee;

    let fee_leg = MockAuthInvoke {
        contract: &payment,
        fn_name: "transfer",
        args: (bob.clone(), treasury.clone(), platform_fee).into_val(&env),
        sub_invokes: &[],
    };
    let creator_leg = MockAuthInvoke {
        contract: &payment,
        fn_name: "transfer",
        args: (bob.clone(), alice.clone(), creator_amount).into_val(&env),
        sub_invokes: &[],
    };

    // From here on only bob's authorization exists. If this needed alice to
    // sign anything, this call would fail.
    env.set_auths(&[]);
    let edition_ref = String::from_str(&env, "row-1");
    let purchase_ref = String::from_str(&env, "purchase-1");
    let (first, last) = client
        .mock_auths(&[MockAuth {
            address: &bob,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "buy_edition",
                args: (
                    bob.clone(),
                    edition_ref.clone(),
                    edition.clone(),
                    purchase_ref.clone(),
                    payment.clone(),
                    1u32,
                    0i128,
                    0i128,
                )
                    .into_val(&env),
                sub_invokes: &[fee_leg, creator_leg],
            },
        }])
        .buy_edition(&bob, &edition_ref, &edition, &purchase_ref, &payment, &1, &0, &0);

    assert_eq!(first, last);
    assert_eq!(client.owner_of(&first), bob);
    assert_eq!(TokenClient::new(&env, &payment).balance(&alice), creator_amount);
}

#[test]
#[should_panic(expected = "Error(Contract, #307)")]
fn cannot_buy_your_own_listing() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE * 2);

    let id = buy_one(&f, &alice, &alice, 0);
    f.client.list(&alice, &id, &single_price(&f, PRICE));
    f.client.buy(&alice, &id, &f.payment, &0, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #308)")]
fn cannot_list_a_token_you_do_not_own() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &alice, PRICE);

    let id = buy_one(&f, &alice, &alice, 0);
    f.client.list(&bob, &id, &single_price(&f, PRICE));
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
    fund(&f, &alice, PRICE);
    fund(&f, &carol, PRICE);

    let id = buy_one(&f, &alice, &alice, 0);
    f.client.list(&alice, &id, &single_price(&f, PRICE));
    f.client.transfer(&alice, &bob, &id);

    f.client.buy(&carol, &id, &f.payment, &0, &0);
}

#[test]
fn cancel_listing_removes_it() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);

    f.client.list(&alice, &id, &single_price(&f, PRICE));
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
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);

    f.client.list(&alice, &id, &single_price(&f, PRICE));
    f.client.cancel_listing(&bob, &id);
}

#[test]
#[should_panic(expected = "Error(Contract, #316)")]
fn listing_at_zero_price_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);
    f.client.list(&alice, &id, &single_price(&f, 0));
}

// =============================================================================
// Royalties
// =============================================================================

/// Royalty is fixed by the edition's own creation — there's no admin
/// entrypoint to change it afterwards, so a buyer (or anyone else) can never
/// strip or rewrite the royalty off a piece post-mint.
#[test]
fn royalty_amount_matches_the_editions_bps_and_is_uniform_across_a_batch() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE * 3);

    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", ROYALTY_BPS, 5, PRICE, 3);

    for id in first..=last {
        let (receiver, amount) = f.client.royalty_info(&id, &10_000);
        assert_eq!(receiver, alice);
        assert_eq!(amount, ROYALTY_BPS as i128);
    }
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
    let unlock_authority = Address::generate(&env);
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
            unlock_authority,
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
fn pause_blocks_buy_edition_list_and_buy_but_not_exits() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    fund(&f, &bob, PRICE);

    let authority = Address::generate(&f.env);
    f.client.set_price_authority(&authority);

    let id = buy_one(&f, &alice, &alice, 0);
    f.client.list(&alice, &id, &single_price(&f, PRICE));
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    f.client.pause(&f.owner);
    assert!(f.client.paused());

    assert!(f.client.try_buy(&bob, &id, &f.payment, &0, &0).is_err());
    assert!(f.client.try_list(&alice, &id, &single_price(&f, PRICE)).is_err());
    assert!(f
        .client
        .try_buy_edition(
            &alice,
            &String::from_str(&f.env, "row-2"),
            &edition_input(&f, &alice, 0, 1, PRICE),
            &String::from_str(&f.env, "purchase-2"),
            &f.payment,
            &1,
            &0,
            &0,
        )
        .is_err());
    assert!(f
        .client
        .try_update_edition(
            &authority,
            &edition_id,
            &String::from_str(&f.env, "New title"),
            &String::from_str(&f.env, "New description"),
            &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
            &1,
            &single_price(&f, PRICE),
        )
        .is_err());

    // Holders must still be able to get out while the platform is halted.
    f.client.cancel_listing(&alice, &id);
    f.client.transfer(&alice, &bob, &id);
    assert_eq!(f.client.owner_of(&id), bob);

    f.client.unpause(&f.owner);
    assert!(!f.client.paused());
}

// =============================================================================
// Editing — post-first-sale creator edits, gated by PriceAuthority (see
// contracts/nft_oz/README.md and the price-editing design spec).
// =============================================================================

#[test]
#[should_panic(expected = "Error(Contract, #324)")]
fn update_edition_before_authority_set_panics() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client
        .buy_edition(
            &bob,
            &String::from_str(&f.env, "row-1"),
            &edition_input(&f, &alice, 0, 10, PRICE),
            &String::from_str(&f.env, "purchase-1"),
            &f.payment,
            &1,
            &0,
            &0,
        );

    // f.owner is a plausible-looking caller, but PriceAuthority was never
    // set on this fresh fixture — must be rejected, not silently accepted.
    f.client.update_edition(
        &f.owner,
        &0,
        &String::from_str(&f.env, "New title"),
        &String::from_str(&f.env, "New description"),
        &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
        &10,
        &single_price(&f, PRICE),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #324)")]
fn only_price_authority_can_update_edition() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    let mallory = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 1);

    f.client.update_edition(
        &mallory,
        &0,
        &String::from_str(&f.env, "New title"),
        &String::from_str(&f.env, "New description"),
        &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
        &10,
        &single_price(&f, PRICE),
    );
}

#[test]
fn update_edition_updates_title_description_thumbnail_supply_and_prices() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 500, 10, PRICE, 1);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    let new_prices = single_price(&f, PRICE * 2);
    f.client.update_edition(
        &authority,
        &edition_id,
        &String::from_str(&f.env, "New title"),
        &String::from_str(&f.env, "New description"),
        &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
        &6,
        &new_prices,
    );

    let meta = f.client.edition_meta(&edition_id).unwrap();
    assert_eq!(meta.title, String::from_str(&f.env, "New title"));
    assert_eq!(meta.description, String::from_str(&f.env, "New description"));
    assert_eq!(meta.thumbnail_url, String::from_str(&f.env, "https://cdn.test/new-thumb.png"));
    assert_eq!(meta.supply, 6);
    assert_eq!(f.client.edition_prices(&edition_id), new_prices);
}

#[test]
fn update_edition_preserves_media_url_type_creator_and_royalty() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 500, 10, PRICE, 1);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();
    let before = f.client.edition_meta(&edition_id).unwrap();

    f.client.update_edition(
        &authority,
        &edition_id,
        &String::from_str(&f.env, "New title"),
        &String::from_str(&f.env, "New description"),
        &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
        &6,
        &single_price(&f, PRICE),
    );

    let after = f.client.edition_meta(&edition_id).unwrap();
    assert_eq!(after.media_url, before.media_url);
    assert_eq!(after.media_type, before.media_type);
    assert_eq!(after.creator, before.creator);
    assert_eq!(after.royalty_bps, before.royalty_bps);
    assert_eq!(after.royalty_bps, 500);
}

#[test]
#[should_panic(expected = "Error(Contract, #313)")]
fn update_edition_rejects_supply_above_current() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 1);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    f.client.update_edition(
        &authority,
        &edition_id,
        &String::from_str(&f.env, "Sunset"),
        &String::from_str(&f.env, "A sunset over the bay"),
        &String::from_str(&f.env, "https://cdn.test/thumb.png"),
        &11, // above the registered supply of 10
        &single_price(&f, PRICE),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #313)")]
fn update_edition_rejects_supply_below_minted() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 3);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 3);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    f.client.update_edition(
        &authority,
        &edition_id,
        &String::from_str(&f.env, "Sunset"),
        &String::from_str(&f.env, "A sunset over the bay"),
        &String::from_str(&f.env, "https://cdn.test/thumb.png"),
        &2, // below the 3 already minted
        &single_price(&f, PRICE),
    );
}

#[test]
fn update_edition_allows_supply_down_to_exactly_minted() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 3);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 3);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    f.client.update_edition(
        &authority,
        &edition_id,
        &String::from_str(&f.env, "Sunset"),
        &String::from_str(&f.env, "A sunset over the bay"),
        &String::from_str(&f.env, "https://cdn.test/thumb.png"),
        &3,
        &single_price(&f, PRICE),
    );

    assert_eq!(f.client.remaining_supply(&edition_id), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #314)")]
fn update_edition_rejects_empty_price_grid() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client.set_price_authority(&authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 1);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    f.client.update_edition(
        &authority,
        &edition_id,
        &String::from_str(&f.env, "Sunset"),
        &String::from_str(&f.env, "A sunset over the bay"),
        &String::from_str(&f.env, "https://cdn.test/thumb.png"),
        &10,
        &Vec::new(&f.env),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #320)")]
fn update_edition_rejects_unknown_edition_id() {
    let f = setup();
    let authority = Address::generate(&f.env);
    f.client.set_price_authority(&authority);

    f.client.update_edition(
        &authority,
        &999,
        &String::from_str(&f.env, "Sunset"),
        &String::from_str(&f.env, "A sunset over the bay"),
        &String::from_str(&f.env, "https://cdn.test/thumb.png"),
        &10,
        &single_price(&f, PRICE),
    );
}

#[test]
fn owner_can_rotate_the_price_authority() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let old_authority = Address::generate(&f.env);
    let new_authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    f.client.set_price_authority(&old_authority);
    let (_, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 10, PRICE, 1);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    f.client.set_price_authority(&new_authority);

    // The old authority is no longer recognized...
    let _ = f
        .client
        .try_update_edition(
            &old_authority,
            &edition_id,
            &String::from_str(&f.env, "New title"),
            &String::from_str(&f.env, "New description"),
            &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
            &10,
            &single_price(&f, PRICE),
        )
        .expect_err("the old price authority must be rejected after rotation");

    // ...while the new one works.
    f.client.update_edition(
        &new_authority,
        &edition_id,
        &String::from_str(&f.env, "New title"),
        &String::from_str(&f.env, "New description"),
        &String::from_str(&f.env, "https://cdn.test/new-thumb.png"),
        &10,
        &single_price(&f, PRICE),
    );
    assert_eq!(f.client.edition_meta(&edition_id).unwrap().title, String::from_str(&f.env, "New title"));
}

// =============================================================================
// Upgradeability
// =============================================================================

#[test]
fn version_reports_current_contract_version() {
    let f = setup();
    assert_eq!(f.client.version(), CONTRACT_VERSION);
}

#[test]
fn owner_can_set_and_read_price_authority() {
    let f = setup();
    let authority = Address::generate(&f.env);

    assert_eq!(f.client.price_authority(), None);

    f.client.set_price_authority(&authority);

    assert_eq!(f.client.price_authority(), Some(authority));
}

#[test]
#[should_panic]
fn non_owner_cannot_set_price_authority() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
    let mallory = Address::generate(&env);

    let contract_id = env.register(
        ArtNft,
        (
            owner,
            treasury,
            FEE_BPS,
            String::from_str(&env, "Actionverse Art"),
            String::from_str(&env, "AVART"),
            String::from_str(&env, "https://actionverse.test/nft/"),
            unlock_authority,
        ),
    );
    let client = ArtNftClient::new(&env, &contract_id);
    let new_authority = Address::generate(&env);

    client
        .mock_auths(&[MockAuth {
            address: &mallory,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_price_authority",
                args: (new_authority.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .set_price_authority(&new_authority);
}

#[test]
#[should_panic]
fn upgrade_to_unknown_wasm_hash_panics() {
    let f = setup();
    let bogus_hash = BytesN::from_array(&f.env, &[0u8; 32]);
    f.client.upgrade(&bogus_hash, &f.owner);
}

#[test]
#[should_panic]
fn non_owner_cannot_upgrade() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
    let mallory = Address::generate(&env);

    let contract_id = env.register(
        ArtNft,
        (
            owner,
            treasury,
            FEE_BPS,
            String::from_str(&env, "Actionverse Art"),
            String::from_str(&env, "AVART"),
            String::from_str(&env, "https://actionverse.test/nft/"),
            unlock_authority,
        ),
    );
    let client = ArtNftClient::new(&env, &contract_id);
    let bogus_hash = BytesN::from_array(&env, &[0u8; 32]);

    client
        .mock_auths(&[MockAuth {
            address: &mallory,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: (bogus_hash.clone(), mallory.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .upgrade(&bogus_hash, &mallory);
}

// =============================================================================
// Unlock — off-chain unlock-rule attestation (see the module doc on
// `unlock_item_for`)
// =============================================================================

#[test]
fn unlock_item_for_marks_an_item_unlocked() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE);

    let (token_id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 1);

    assert!(!f.client.is_item_unlocked(&token_id, &0));
    f.client.unlock_item_for(&f.unlock_authority, &token_id, &0);
    assert!(f.client.is_item_unlocked(&token_id, &0));
}

#[test]
fn unlock_item_for_is_idempotent() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let (token_id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 1);

    f.client.unlock_item_for(&f.unlock_authority, &token_id, &0);
    f.client.unlock_item_for(&f.unlock_authority, &token_id, &0); // must not panic
    assert!(f.client.is_item_unlocked(&token_id, &0));
}

#[test]
#[should_panic(expected = "Error(Contract, #323)")]
fn only_unlock_authority_can_unlock() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let mallory = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let (token_id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 1);

    f.client.unlock_item_for(&mallory, &token_id, &0);
}

#[test]
fn unlocking_one_item_does_not_unlock_a_sibling_item_on_the_same_token() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let (token_id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 1);

    f.client.unlock_item_for(&f.unlock_authority, &token_id, &0);

    assert!(f.client.is_item_unlocked(&token_id, &0));
    assert!(
        !f.client.is_item_unlocked(&token_id, &1),
        "unlocking one locked-content item must not unlock a different item on the same token"
    );
}

#[test]
fn unlocking_one_token_does_not_unlock_a_sibling_from_the_same_edition() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 2);

    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 2);
    assert_eq!(last, first + 1);

    f.client.unlock_item_for(&f.unlock_authority, &first, &0);

    assert!(f.client.is_item_unlocked(&first, &0));
    assert!(
        !f.client.is_item_unlocked(&last, &0),
        "unlocking one copy must not unlock another"
    );
}

#[test]
fn owner_can_rotate_the_unlock_authority() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let new_authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let (token_id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 1);

    f.client.set_unlock_authority(&new_authority);

    // The old authority is no longer recognized...
    let _ = f
        .client
        .try_unlock_item_for(&f.unlock_authority, &token_id, &0)
        .expect_err("the old unlock authority must be rejected after rotation");

    // ...while the new one works.
    f.client.unlock_item_for(&new_authority, &token_id, &0);
    assert!(f.client.is_item_unlocked(&token_id, &0));
}

#[test]
#[should_panic]
fn non_owner_cannot_set_unlock_authority() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
    let mallory = Address::generate(&env);

    let contract_id = env.register(
        ArtNft,
        (
            owner,
            treasury,
            FEE_BPS,
            String::from_str(&env, "Actionverse Art"),
            String::from_str(&env, "AVART"),
            String::from_str(&env, "https://actionverse.test/nft/"),
            unlock_authority,
        ),
    );
    let client = ArtNftClient::new(&env, &contract_id);
    let new_authority = Address::generate(&env);

    client
        .mock_auths(&[MockAuth {
            address: &mallory,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_unlock_authority",
                args: (new_authority.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .set_unlock_authority(&new_authority);
}

// =============================================================================
// Fee-bump reimbursement — inclusion_fee / network_fee
// =============================================================================
// These two fields let treasury recover what it spends to fee-bump the
// buyer's transaction (see src/lib/stellar/oz/nft.ts) — charged to the
// buyer alongside the item's own price, capped so the reimbursement can
// never exceed what the item itself is worth.

#[test]
fn buy_edition_charges_inclusion_and_network_fee_to_treasury() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    let inclusion_fee = 100_0000000i128;
    let network_fee = 50_0000000i128;
    fund(&f, &bob, PRICE + inclusion_fee + network_fee);

    let treasury_before = f.token.balance(&f.treasury);
    let creator_before = f.token.balance(&alice);

    f.client.buy_edition(
        &bob,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 1, PRICE),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &inclusion_fee,
        &network_fee,
    );

    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;
    assert_eq!(
        f.token.balance(&f.treasury) - treasury_before,
        platform_fee + inclusion_fee + network_fee,
    );
    assert_eq!(f.token.balance(&alice) - creator_before, PRICE - platform_fee);
}

#[test]
fn buy_charges_inclusion_and_network_fee_to_treasury() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // first buyer, then reseller
    let carol = Address::generate(&f.env); // second buyer
    let inclusion_fee = 100_0000000i128;
    let network_fee = 50_0000000i128;
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE + inclusion_fee + network_fee);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 1, PRICE, 1);
    f.client.list(&bob, &id, &single_price(&f, PRICE));

    let treasury_before = f.token.balance(&f.treasury);
    let seller_before = f.token.balance(&bob);

    f.client.buy(&carol, &id, &f.payment, &inclusion_fee, &network_fee);

    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;
    assert_eq!(
        f.token.balance(&f.treasury) - treasury_before,
        platform_fee + inclusion_fee + network_fee,
    );
    assert_eq!(f.token.balance(&bob) - seller_before, PRICE - platform_fee);
}

#[test]
fn buy_batch_charges_the_fee_once_for_the_whole_batch_not_per_token() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer, then reseller of all 5
    let carol = Address::generate(&f.env); // batch buyer
    let inclusion_fee = 100_0000000i128;
    let network_fee = 50_0000000i128;
    fund(&f, &bob, PRICE * 5);
    fund(&f, &carol, PRICE * 5 + inclusion_fee + network_fee);

    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 5, PRICE, 5);
    let mut token_ids = Vec::new(&f.env);
    for id in first..=last {
        token_ids.push_back(id);
    }
    f.client.list_batch(&bob, &token_ids, &single_price(&f, PRICE));

    let treasury_before = f.token.balance(&f.treasury);

    f.client.buy_batch(&carol, &token_ids, &f.payment, &inclusion_fee, &network_fee);

    let platform_fee_per = PRICE * FEE_BPS as i128 / 10_000;
    assert_eq!(
        f.token.balance(&f.treasury) - treasury_before,
        platform_fee_per * 5 + inclusion_fee + network_fee,
        "the fee is charged once for the whole batch, not once per token",
    );
}

// =============================================================================
// Keep-alive
// =============================================================================

#[test]
fn keep_alive_extends_instance_edition_and_token_ttl() {
    use soroban_sdk::testutils::{
        storage::{Instance as _, Persistent as _},
        Ledger as _,
    };

    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE);

    let id = buy_one(&f, &bob, &alice, 0);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    // Jump the ledger far enough forward that the 120-day extend from mint
    // time has dropped under the 30-day renewal threshold (120 - 100 = 20
    // days left, which is < 30), so `keep_alive`'s `extend_ttl` calls are
    // guaranteed to actually bump something rather than no-op.
    let sequence = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = sequence + 100 * 17_280);

    f.client.keep_alive(
        &Vec::from_array(&f.env, [edition_id]),
        &Vec::from_array(&f.env, [id]),
    );

    f.env.as_contract(&f.client.address, || {
        let instance_ttl = f.env.storage().instance().get_ttl();
        assert!(instance_ttl > 100 * 17_280, "instance TTL should be freshly bumped: {instance_ttl}");

        let edition_ttl = f.env.storage().persistent().get_ttl(&DataKey::Edition(edition_id));
        assert!(edition_ttl > 100 * 17_280, "Edition TTL should be freshly bumped: {edition_ttl}");

        let prices_ttl = f.env.storage().persistent().get_ttl(&DataKey::EditionPrices(edition_id));
        assert!(prices_ttl > 100 * 17_280, "EditionPrices TTL should be freshly bumped: {prices_ttl}");
    });

    // A plain client call still resolves the token's owner — proof the
    // ownership entry survived (and was renewed), not left to expire.
    assert_eq!(f.client.owner_of(&id), bob);
}

#[test]
fn keep_alive_skips_edition_ids_that_do_not_exist() {
    let f = setup();
    // No editions registered at all yet — should be a silent no-op, not a panic.
    f.client.keep_alive(&Vec::from_array(&f.env, [0, 1, 2]), &Vec::new(&f.env));
}

#[test]
#[should_panic(expected = "Error(Contract, #325)")]
fn keep_alive_rejects_too_many_edition_ids() {
    let f = setup();
    let mut edition_ids = Vec::new(&f.env);
    for i in 0..201 {
        edition_ids.push_back(i);
    }
    f.client.keep_alive(&edition_ids, &Vec::new(&f.env));
}
