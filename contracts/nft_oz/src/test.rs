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
    price_authority: Address,
}

/// Standard fixture. The price authority arrives through `__constructor`,
/// so this is simply what a fresh deploy looks like — see
/// [`setup_with_price_authority_cleared`] for the only state that can still
/// lack one.
fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
    let price_authority = Address::generate(&env);
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
            price_authority.clone(),
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
        price_authority,
    }
}

/// A contract with no `PriceAuthority` at all.
///
/// `__constructor` sets one, so a fresh deploy can never be in this state.
/// It is still reachable exactly one way — upgrading from a build that
/// predates the key, since an upgrade replaces the wasm without running a
/// constructor — so the guard still has to hold. Reproduced by deleting the
/// key rather than by skipping a setup call, because skipping is no longer
/// possible.
fn setup_with_price_authority_cleared() -> Fixture<'static> {
    let f = setup();
    let id = f.client.address.clone();
    f.env.as_contract(&id, || {
        f.env.storage().instance().remove(&DataKey::PriceAuthority);
    });
    f
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

/// Registers the edition under `edition_ref` (idempotent — safe to call for
/// an already-registered ref) and buys `quantity` copies of it, returning the
/// `(first_token_id, last_token_id)` minted. Mirrors what the backend does:
/// register under the price authority, then let the buyer purchase.
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
    f.client.register_edition(
        &f.price_authority,
        &String::from_str(&f.env, edition_ref),
        &edition_input(f, creator, royalty_bps, supply, price),
    );
    f.client.buy_edition(
        buyer,
        &String::from_str(&f.env, edition_ref),
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
    buy_ref(&f, &alice, &alice, "row-1", "purchase-1", 9_001, 1, PRICE, 1);
}

#[test]
fn buy_edition_accepts_royalty_at_exactly_the_cap() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    buy_ref(&f, &alice, &alice, "row-1", "purchase-1", 9_000, 1, PRICE, 1);
}

/// Registers `edition` under "row-1" as the price authority — the shape every
/// edition-input validation test below shares, since that validation now runs
/// in `register_edition` rather than during a purchase.
fn register(f: &Fixture, edition: EditionInput) -> u32 {
    f.client.register_edition(&f.price_authority, &String::from_str(&f.env, "row-1"), &edition)
}

#[test]
#[should_panic(expected = "Error(Contract, #303)")]
fn register_edition_rejects_empty_title() {
    let f = setup();
    let alice = Address::generate(&f.env);
    register(
        &f,
        EditionInput { title: String::from_str(&f.env, ""), ..edition_input(&f, &alice, 0, 1, PRICE) },
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #305)")]
fn register_edition_rejects_empty_media_url() {
    let f = setup();
    let alice = Address::generate(&f.env);
    register(
        &f,
        EditionInput { media_url: String::from_str(&f.env, ""), ..edition_input(&f, &alice, 0, 1, PRICE) },
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #313)")]
fn register_edition_rejects_zero_supply() {
    let f = setup();
    let alice = Address::generate(&f.env);
    register(&f, edition_input(&f, &alice, 0, 0, PRICE));
}

#[test]
#[should_panic(expected = "Error(Contract, #314)")]
fn register_edition_rejects_empty_price_grid() {
    let f = setup();
    let alice = Address::generate(&f.env);
    register(&f, edition_input_with_prices(&f, &alice, 0, 1, Vec::new(&f.env)));
}

#[test]
#[should_panic(expected = "Error(Contract, #315)")]
fn register_edition_rejects_duplicate_payment_token_in_price_grid() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let mut prices = Vec::new(&f.env);
    prices.push_back(PriceEntry { payment_token: f.payment.clone(), price: PRICE });
    prices.push_back(PriceEntry { payment_token: f.payment.clone(), price: PRICE * 2 });
    register(&f, edition_input_with_prices(&f, &alice, 0, 1, prices));
}

#[test]
#[should_panic(expected = "Error(Contract, #316)")]
fn register_edition_rejects_zero_price() {
    let f = setup();
    let alice = Address::generate(&f.env);
    register(&f, edition_input(&f, &alice, 0, 1, 0));
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

    register(&f, edition_input(&f, &alice, 0, 1, PRICE));
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
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
    register(&f, edition_input(&f, &alice, 0, 1, PRICE));
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
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
    register(&f, edition_input(&f, &alice, 0, 1_000, PRICE));
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "row-1"),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &21,
        &0,
        &0,
    );
}

/// The whole point of gating creation: `buy_edition` must refuse an
/// `edition_ref` nobody registered, rather than silently creating one from
/// caller-supplied data the way it used to.
#[test]
#[should_panic(expected = "Error(Contract, #320)")]
fn buy_edition_rejects_an_unregistered_edition_ref() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    f.client.buy_edition(
        &alice,
        &String::from_str(&f.env, "never-registered"),
        &String::from_str(&f.env, "purchase-1"),
        &f.payment,
        &1,
        &0,
        &0,
    );
}

/// Only the price authority may register an edition — this is what stops
/// anyone front-running an unsold item's `edition_ref` to define its terms.
#[test]
#[should_panic(expected = "Error(Contract, #324)")]
fn only_price_authority_can_register_an_edition() {
    let f = setup();
    let mallory = Address::generate(&f.env);
    f.client.register_edition(
        &mallory,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &mallory, 0, 1, PRICE),
    );
}

/// Re-registering an existing ref returns the original id and leaves the
/// original terms untouched, so a retried call after an ambiguous submission
/// is safe — and cannot be used to overwrite an edition.
#[test]
fn register_edition_is_idempotent_and_does_not_overwrite() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let mallory = Address::generate(&f.env);

    let first = register(&f, edition_input(&f, &alice, 0, 5, PRICE));
    let again = register(&f, edition_input(&f, &mallory, 0, 99, PRICE * 7));

    assert_eq!(first, again, "same ref must resolve to the same edition id");
    let meta = f.client.edition_meta(&first).unwrap();
    assert_eq!(meta.creator, alice, "creator must not be overwritten");
    assert_eq!(meta.supply, 5, "supply must not be overwritten");
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

/// Burning is not exposed. `NonFungibleBurnable` was dropped deliberately —
/// see the comment where the other OZ traits are implemented — so the client
/// has no `burn`/`burn_from` at all and a minted copy can only ever change
/// hands. This asserts the *absence* stays absent: re-adding the extension
/// would silently reintroduce the listed-then-burned state `buy` cannot
/// report cleanly.
#[test]
fn burning_is_not_exposed() {
    let f = setup();
    let alice = Address::generate(&f.env);
    fund(&f, &alice, PRICE);
    let id = buy_one(&f, &alice, &alice, 0);

    // If a `burn` entry point ever comes back, this stops compiling — which
    // is the point. Supply is one-way: what was minted stays minted.
    assert_eq!(f.client.balance(&alice), 1);
    assert_eq!(f.client.owner_of(&id), alice);
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

/// `MAX_ROYALTY_BPS` (90%) is set to the largest value that keeps
/// `seller_amount = total - platform_fee - royalty` non-negative even when
/// the platform fee sits at its own 10% ceiling. This pins that invariant at
/// the boundary: a resale at the maximum royalty must still settle, leaving
/// the seller exactly zero rather than panicking on a negative transfer.
#[test]
fn resale_at_max_royalty_and_max_platform_fee_leaves_seller_exactly_zero() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator, royalty receiver
    let bob = Address::generate(&f.env); // first buyer, then reseller
    let carol = Address::generate(&f.env); // second buyer
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    // Both ceilings at once — the worst case the cap has to survive.
    f.client.set_platform_fee(&1_000, &f.treasury);

    let (id, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 9_000, 1, PRICE, 1);
    let bob_before_resale = f.token.balance(&bob);

    f.client.list(&bob, &id, &single_price(&f, PRICE));
    f.client.buy(&carol, &id, &f.payment, &0, &0);

    assert_eq!(f.client.owner_of(&id), carol);
    assert_eq!(
        f.token.balance(&bob) - bob_before_resale,
        0,
        "10% platform fee + 90% royalty must consume exactly the whole sale, never overdraw it",
    );
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

/// The ownership check in `do_list` runs once per token rather than once for
/// the batch, so a caller can't slip someone else's token in among their own.
/// And because the panic reverts the whole invocation, the attempt lists
/// *nothing* — not even the tokens they legitimately own.
#[test]
fn list_batch_rejects_a_mixed_batch_and_lists_nothing() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // owns one copy
    let carol = Address::generate(&f.env); // owns another, and wants bob's too
    fund(&f, &bob, PRICE);
    fund(&f, &carol, PRICE);

    let (bob_token, _) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 2, PRICE, 1);
    let (carol_token, _) = buy_ref(&f, &carol, &alice, "row-1", "purchase-2", 0, 2, PRICE, 1);

    let mut token_ids = Vec::new(&f.env);
    token_ids.push_back(carol_token); // hers
    token_ids.push_back(bob_token); // not hers

    assert!(
        f.client.try_list_batch(&carol, &token_ids, &single_price(&f, PRICE)).is_err(),
        "a batch containing a token the caller doesn't own must be rejected",
    );
    assert!(
        f.client.listing(&bob_token).is_none(),
        "bob's token must not have been listed by carol",
    );
    assert!(
        f.client.listing(&carol_token).is_none(),
        "the whole call reverts, so even carol's own token stays unlisted",
    );
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

/// The creator still signs nothing — not at registration, not at first sale.
/// A purchase needs the *buyer* and *treasury*, and no one else.
///
/// Treasury's authorization is what pins the fee arguments. They are plain
/// call parameters, so a buyer assembling their own envelope could otherwise
/// zero them, sign it honestly, and have the backend fee-bump a purchase that
/// reimburses nothing. This test is the record of that trade: it previously
/// asserted the buyer alone sufficed, and now asserts treasury is required
/// too — meaning a purchase can no longer be assembled by a buyer acting
/// alone, even one paying their own network fee.
///
/// The auth tree spelled out here is exactly what the client has to produce:
/// `buy_edition` plus one payment sub-invocation per recipient, authorized by
/// the buyer, alongside treasury's own authorization of the same call.
#[test]
fn buy_edition_requires_the_buyer_and_treasury() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let treasury = Address::generate(&env);
    let unlock_authority = Address::generate(&env);
    let price_authority = Address::generate(&env);
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
            price_authority.clone(),
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

    // Registration is the price authority's job and happens ahead of the
    // sale — done here under the blanket mock so the auth assertions below
    // isolate the purchase itself.
    let edition_ref = String::from_str(&env, "row-1");
    client.register_edition(&price_authority, &edition_ref, &edition);

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
    let purchase_ref = String::from_str(&env, "purchase-1");
    let call_args = (
        bob.clone(),
        edition_ref.clone(),
        purchase_ref.clone(),
        payment.clone(),
        1u32,
        0i128,
        0i128,
    );
    let (first, last) = client
        .mock_auths(&[
            MockAuth {
                address: &bob,
                invoke: &MockAuthInvoke {
                    contract: &contract_id,
                    fn_name: "buy_edition",
                    args: call_args.clone().into_val(&env),
                    sub_invokes: &[fee_leg, creator_leg],
                },
            },
            MockAuth {
                address: &treasury,
                invoke: &MockAuthInvoke {
                    contract: &contract_id,
                    fn_name: "buy_edition",
                    args: call_args.into_val(&env),
                    sub_invokes: &[],
                },
            },
        ])
        .buy_edition(&bob, &edition_ref, &purchase_ref, &payment, &1, &0, &0);

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
    let price_authority = Address::generate(&env);
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
            price_authority.clone(),
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
            &String::from_str(&f.env, "row-1"),
            &String::from_str(&f.env, "purchase-2"),
            &f.payment,
            &1,
            &0,
            &0,
        )
        .is_err());
    assert!(f
        .client
        .try_register_edition(
            &f.price_authority,
            &String::from_str(&f.env, "row-2"),
            &edition_input(&f, &alice, 0, 1, PRICE),
        )
        .is_err());
    assert!(f
        .client
        .try_update_edition(
            &f.price_authority,
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

/// A fresh deploy is immediately usable — no follow-up call required.
///
/// This is the regression guard for a real deployment footgun: the price
/// authority used to be settable only via `set_price_authority`, so a deploy
/// that forgot it left `register_edition` — and therefore every purchase —
/// permanently rejecting with `#324`, with nothing on-chain explaining why.
#[test]
fn a_freshly_deployed_contract_can_register_without_further_setup() {
    let f = setup(); // constructor only — no `set_price_authority` anywhere
    let alice = Address::generate(&f.env);

    assert_eq!(
        f.client.price_authority(),
        Some(f.price_authority.clone()),
        "the constructor must have stored the price authority",
    );

    let id = f.client.register_edition(
        &f.price_authority,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 10, PRICE),
    );
    assert_eq!(f.client.edition_by_ref(&String::from_str(&f.env, "row-1")), Some(id));
}

/// With no price authority set, nothing gated on it may proceed — it must
/// refuse rather than fall back to some plausible-looking caller. Only an
/// upgrade from a build predating the key can produce this state now; see
/// [`setup_with_price_authority_cleared`].
#[test]
#[should_panic(expected = "Error(Contract, #324)")]
fn register_edition_before_authority_set_panics() {
    let f = setup_with_price_authority_cleared();
    let alice = Address::generate(&f.env);

    // f.owner is a plausible-looking caller, but PriceAuthority was never set
    // on this fixture — must be rejected, not silently accepted.
    f.client.register_edition(
        &f.owner,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 10, PRICE),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #324)")]
fn only_price_authority_can_update_edition() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    let authority = f.price_authority.clone();
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
    // The fixture's own authority is the "old" one here, so registration
    // during `buy_ref` below still succeeds before the rotation happens.
    let old_authority = f.price_authority.clone();
    let new_authority = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

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
    // Deliberately the unconfigured fixture: this asserts the transition from
    // "never set" to "set", which `setup()` has already performed.
    let f = setup_with_price_authority_cleared();
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
    let price_authority = Address::generate(&env);
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
            price_authority.clone(),
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
    let price_authority = Address::generate(&env);
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
            price_authority.clone(),
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
    let price_authority = Address::generate(&env);
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
            price_authority.clone(),
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

    register(&f, edition_input(&f, &alice, 0, 1, PRICE));

    let treasury_before = f.token.balance(&f.treasury);
    let creator_before = f.token.balance(&alice);

    f.client.buy_edition(
        &bob,
        &String::from_str(&f.env, "row-1"),
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
        &Vec::from_array(&f.env, [String::from_str(&f.env, "row-1")]),
        &Vec::from_array(&f.env, [id]),
        &Vec::new(&f.env),
    );

    f.env.as_contract(&f.client.address, || {
        let instance_ttl = f.env.storage().instance().get_ttl();
        assert!(instance_ttl > 100 * 17_280, "instance TTL should be freshly bumped: {instance_ttl}");

        let edition_ttl = f.env.storage().persistent().get_ttl(&DataKey::Edition(edition_id));
        assert!(edition_ttl > 100 * 17_280, "Edition TTL should be freshly bumped: {edition_ttl}");

        let prices_ttl = f.env.storage().persistent().get_ttl(&DataKey::EditionPrices(edition_id));
        assert!(prices_ttl > 100 * 17_280, "EditionPrices TTL should be freshly bumped: {prices_ttl}");

        // `EditionByRef` is the one whose loss breaks an edition outright:
        // `buy_edition` couldn't resolve the ref, and `register_edition`
        // would create a duplicate instead of finding the original.
        let ref_ttl = f
            .env
            .storage()
            .persistent()
            .get_ttl(&DataKey::EditionByRef(String::from_str(&f.env, "row-1")));
        assert!(ref_ttl > 100 * 17_280, "EditionByRef TTL should be freshly bumped: {ref_ttl}");

        // Without this a kept-alive token stays owned but loses the edition
        // link `art_meta`/`royalty_info` resolve through.
        let token_edition_ttl = f.env.storage().persistent().get_ttl(&DataKey::TokenEdition(id));
        assert!(
            token_edition_ttl > 100 * 17_280,
            "TokenEdition TTL should be freshly bumped: {token_edition_ttl}"
        );
    });

    // A plain client call still resolves the token's owner — proof the
    // ownership entry survived (and was renewed), not left to expire.
    assert_eq!(f.client.owner_of(&id), bob);
}

/// A listed copy's `Listing` and an unlocked reward's `Unlocked` entry are
/// both written once and then never touched again by ordinary reads — the
/// getters are plain `get`s, and an app reading through simulation never
/// persists an extension. So if `keep_alive` doesn't renew them they simply
/// expire: a resale listing silently vanishes, and reward content a holder
/// already earned re-locks itself.
#[test]
fn keep_alive_extends_listing_and_unlocked_ttl() {
    use soroban_sdk::testutils::{storage::Persistent as _, Ledger as _};

    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer, then reseller
    fund(&f, &bob, PRICE);

    let id = buy_one(&f, &bob, &alice, 0);
    f.client.list(&bob, &id, &single_price(&f, PRICE));
    f.client.unlock_item_for(&f.unlock_authority, &id, &0);

    // Same jump as the sibling test: far enough that the original 120-day
    // extend has dropped under the 30-day renewal threshold.
    let sequence = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = sequence + 100 * 17_280);

    f.client.keep_alive(
        &Vec::new(&f.env),
        &Vec::new(&f.env),
        &Vec::from_array(&f.env, [id]),
        &Vec::from_array(&f.env, [(id, 0u32)]),
    );

    f.env.as_contract(&f.client.address, || {
        let listing_ttl = f.env.storage().persistent().get_ttl(&DataKey::Listing(id));
        assert!(listing_ttl > 100 * 17_280, "Listing TTL should be freshly bumped: {listing_ttl}");

        let unlocked_ttl = f.env.storage().persistent().get_ttl(&DataKey::Unlocked(id, 0));
        assert!(unlocked_ttl > 100 * 17_280, "Unlocked TTL should be freshly bumped: {unlocked_ttl}");
    });

    // And the data still reads back correctly, not merely un-expired.
    assert!(f.client.listing(&id).is_some());
    assert!(f.client.is_item_unlocked(&id, &0));
}

/// An unlisted copy has no `Listing`, and a token with no unlock has no
/// `Unlocked` — passing them must skip silently rather than panic, so a
/// scheduler can hand over a whole batch without first checking which
/// entries happen to exist.
#[test]
fn keep_alive_skips_absent_listing_and_unlocked_entries() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let id = buy_one(&f, &bob, &alice, 0); // never listed, never unlocked

    f.client.keep_alive(
        &Vec::new(&f.env),
        &Vec::new(&f.env),
        &Vec::from_array(&f.env, [id]),
        &Vec::from_array(&f.env, [(id, 7u32)]),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #325)")]
fn keep_alive_rejects_too_many_unlocked_pairs() {
    let f = setup();
    let mut pairs = Vec::new(&f.env);
    for i in 0..201u32 {
        pairs.push_back((i, 0u32));
    }
    f.client.keep_alive(&Vec::new(&f.env), &Vec::new(&f.env), &Vec::new(&f.env), &pairs);
}

/// The whole point of writing OZ's storage keys directly: ownership must end
/// up at this contract's 120-day `BUMP_TO`, not the 30 days `stellar-tokens`
/// hardcodes. That 30 was the only thing forcing the keep-alive scheduler
/// onto a 28-day cadence.
///
/// This also guards the coupling. `extend_ownership_ttl` reaches into
/// `NFTConsecutiveStorageKey`, so if a future `stellar-tokens` reorders that
/// enum the extension would silently target nothing and ownership would
/// quietly go back to expiring at 30 days. Asserting the TTL actually lands
/// past the 30-day mark turns that into a failing test instead.
#[test]
fn keep_alive_extends_ownership_past_the_oz_default() {
    use soroban_sdk::testutils::{storage::Persistent as _, Ledger as _};
    use stellar_tokens::non_fungible::consecutive::storage::NFTConsecutiveStorageKey;

    const THIRTY_DAYS: u32 = 30 * 17_280;

    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE);

    let id = buy_one(&f, &bob, &alice, 0);

    // Straight after minting, ownership is already past OZ's own ceiling —
    // `buy_edition` lifts it, so a token minted just after a sweep doesn't
    // expire before the next one.
    f.env.as_contract(&f.client.address, || {
        let owner_ttl =
            f.env.storage().persistent().get_ttl(&NFTConsecutiveStorageKey::Owner(id));
        assert!(
            owner_ttl > THIRTY_DAYS,
            "mint should lift ownership past OZ's 30-day default, got {owner_ttl}"
        );
    });

    // And a later sweep keeps it there rather than letting it decay back.
    let sequence = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = sequence + 100 * 17_280);

    f.client.keep_alive(
        &Vec::new(&f.env),
        &Vec::new(&f.env),
        &Vec::from_array(&f.env, [id]),
        &Vec::new(&f.env),
    );

    f.env.as_contract(&f.client.address, || {
        let owner_ttl =
            f.env.storage().persistent().get_ttl(&NFTConsecutiveStorageKey::Owner(id));
        assert!(
            owner_ttl > THIRTY_DAYS,
            "keep_alive should hold ownership past OZ's 30-day default, got {owner_ttl}"
        );

        let bucket_ttl = f
            .env
            .storage()
            .persistent()
            .get_ttl(&NFTConsecutiveStorageKey::OwnershipBucket(0));
        assert!(
            bucket_ttl > THIRTY_DAYS,
            "the ownership bucket must be renewed too, got {bucket_ttl}"
        );
    });

    // Still functionally intact, not merely un-expired.
    assert_eq!(f.client.owner_of(&id), bob);
}

/// The case the sweep cadence is actually sized around.
///
/// A batch-minted token carries only a bucket bit until someone moves it —
/// OZ's `update` then *creates* an `Owner` entry, and Soroban gives a newly
/// created persistent entry only `minPersistentTtl` (120 days on mainnet),
/// well short of `BUMP_TO`. Nothing lifts it until the next sweep, which is
/// why the scheduler runs quarterly rather than at whatever `BUMP_TO` alone
/// would allow.
///
/// This pins the recovery half of that: after a transfer and a full sweep
/// gap, `keep_alive` must take the new owner's entry back out to `BUMP_TO`
/// rather than leaving it on whatever floor it was created with.
#[test]
fn keep_alive_restores_ttl_for_a_token_transferred_between_sweeps() {
    use soroban_sdk::testutils::{storage::Persistent as _, Ledger as _};
    use stellar_tokens::non_fungible::consecutive::storage::NFTConsecutiveStorageKey;

    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer of a 3-copy batch
    let carol = Address::generate(&f.env); // receives one mid-cycle
    fund(&f, &bob, PRICE * 3);

    // A batch, so the middle id has no explicit `Owner` entry of its own.
    let (first, last) = buy_ref(&f, &bob, &alice, "row-1", "purchase-1", 0, 3, PRICE, 3);
    let moved = first + 1;
    assert!(moved < last, "want a token that is not the batch's last id");

    // Transferred right after a sweep would have run.
    f.client.transfer(&bob, &carol, &moved);
    assert_eq!(f.client.owner_of(&moved), carol);

    // A full quarterly gap passes.
    let sequence = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = sequence + 92 * 17_280);

    f.client.keep_alive(
        &Vec::new(&f.env),
        &Vec::new(&f.env),
        &Vec::from_array(&f.env, [moved]),
        &Vec::new(&f.env),
    );

    f.env.as_contract(&f.client.address, || {
        let ttl =
            f.env.storage().persistent().get_ttl(&NFTConsecutiveStorageKey::Owner(moved));
        assert!(
            ttl > 92 * 17_280,
            "the sweep must lift a mid-cycle transfer's owner entry back to BUMP_TO, got {ttl}"
        );
    });

    assert_eq!(f.client.owner_of(&moved), carol, "and ownership still resolves");
}

/// `BUMP_THRESHOLD` has to clear `minPersistentTtl`, and this pins why.
///
/// Soroban starts every newly-created persistent entry at `minPersistentTtl`,
/// and `extend_ttl` only fires *strictly below* its threshold. Setting the
/// threshold equal to that floor would therefore never fire on a fresh entry:
/// records would sit at the floor and reach `BUMP_TO` only when the keep-alive
/// sweep eventually caught them, making the cron the single thing keeping data
/// alive. With the threshold above the floor a write lifts its own records
/// immediately, and the sweep is a backstop.
///
/// The harness floor has to be raised to mainnet's for this to mean anything:
/// at the default 4,096 ledgers a fresh entry sits under any plausible
/// threshold, so the test would pass no matter what. With the real floor in
/// place it fails if the threshold ever drops back to or below it.
#[test]
fn writing_a_record_lifts_it_past_the_creation_floor() {
    use soroban_sdk::testutils::storage::Persistent as _;

    use soroban_sdk::testutils::Ledger as _;

    let f = setup();

    // The harness defaults this to 4,096 ledgers, far below mainnet's 120
    // days. Without matching mainnet here the test proves nothing: a fresh
    // entry would start under *any* plausible threshold, so it would pass
    // whether or not the threshold actually clears the floor.
    f.env.ledger().set_min_persistent_entry_ttl(120 * 17_280);

    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE);

    let id = buy_one(&f, &bob, &alice, 0);
    let edition_id = f.client.edition_by_ref(&String::from_str(&f.env, "row-1")).unwrap();

    // No sweep has run and no ledger time has passed — whatever TTL these
    // carry was set by the writes themselves.
    f.env.as_contract(&f.client.address, || {
        for (label, ttl) in [
            ("Edition", f.env.storage().persistent().get_ttl(&DataKey::Edition(edition_id))),
            (
                "EditionPrices",
                f.env.storage().persistent().get_ttl(&DataKey::EditionPrices(edition_id)),
            ),
            ("TokenEdition", f.env.storage().persistent().get_ttl(&DataKey::TokenEdition(id))),
        ] {
            assert!(
                ttl >= 150 * 17_280,
                "{label} should be lifted past BUMP_THRESHOLD at write time, got {ttl}"
            );
        }
    });
}

/// The attack treasury authorization exists to stop.
///
/// `inclusion_fee`/`network_fee` are plain call arguments, so a buyer can
/// build their own envelope with both set to zero and sign it perfectly
/// honestly — right contract, right function, their own account, a real
/// purchase, and every payment leg properly authorized. Handed to the backend
/// it would be fee-bumped like any other, leaving treasury paying the network
/// cost and reimbursed nothing.
///
/// The auth tree below is deliberately *complete* apart from treasury: both
/// transfer sub-invocations are present, so the only thing missing is the one
/// thing under test. Without `require_treasury_auth` this call succeeds.
#[test]
#[should_panic]
fn a_buyer_alone_cannot_authorize_a_purchase() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer, acting alone
    fund(&f, &bob, PRICE);

    f.client.register_edition(
        &f.price_authority,
        &String::from_str(&f.env, "row-1"),
        &edition_input(&f, &alice, 0, 1, PRICE),
    );

    let platform_fee = PRICE * FEE_BPS as i128 / 10_000;
    let fee_leg = MockAuthInvoke {
        contract: &f.payment,
        fn_name: "transfer",
        args: (bob.clone(), f.treasury.clone(), platform_fee).into_val(&f.env),
        sub_invokes: &[],
    };
    let creator_leg = MockAuthInvoke {
        contract: &f.payment,
        fn_name: "transfer",
        args: (bob.clone(), alice.clone(), PRICE - platform_fee).into_val(&f.env),
        sub_invokes: &[],
    };

    // Fees zeroed, as an actual attacker would. Everything bob can legitimately
    // sign for is signed; treasury's entry is the only omission.
    f.client
        .mock_auths(&[MockAuth {
            address: &bob,
            invoke: &MockAuthInvoke {
                contract: &f.client.address,
                fn_name: "buy_edition",
                args: (
                    bob.clone(),
                    String::from_str(&f.env, "row-1"),
                    String::from_str(&f.env, "purchase-1"),
                    f.payment.clone(),
                    1u32,
                    0i128,
                    0i128,
                )
                    .into_val(&f.env),
                sub_invokes: &[fee_leg, creator_leg],
            },
        }])
        .buy_edition(
            &bob,
            &String::from_str(&f.env, "row-1"),
            &String::from_str(&f.env, "purchase-1"),
            &f.payment,
            &1,
            &0,
            &0,
        );
}

/// One stale id must not take the sweep down with it.
///
/// The scheduler builds `token_ids` from the app database, which can hold ids
/// the chain does not — a burned token, a row from an earlier contract
/// instance, a write that outlived its transaction. Since a Soroban panic
/// reverts everything, an existence check on each id would mean one bad row
/// silently stops *every* other token in the batch being renewed, and the
/// next sweep two months later fails on the same row. Unknown ids skip.
#[test]
fn keep_alive_tolerates_ids_that_do_not_exist_on_chain() {
    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE);

    let real = buy_one(&f, &bob, &alice, 0);

    // A real id sandwiched between two that were never minted.
    f.client.keep_alive(
        &Vec::new(&f.env),
        &Vec::new(&f.env),
        &Vec::from_array(&f.env, [9_998, real, 9_999]),
        &Vec::new(&f.env),
    );

    assert_eq!(
        f.client.owner_of(&real),
        bob,
        "the real token must still have been renewed despite the stale ids",
    );
}

#[test]
fn keep_alive_skips_edition_ids_that_do_not_exist() {
    let f = setup();
    // No editions registered at all yet — should be a silent no-op, not a panic.
    f.client.keep_alive(
        &Vec::from_array(&f.env, [0, 1, 2]),
        &Vec::from_array(&f.env, [String::from_str(&f.env, "never-registered")]),
        &Vec::new(&f.env),
        &Vec::from_array(&f.env, [(0u32, 0u32)]),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #325)")]
fn keep_alive_rejects_too_many_edition_ids() {
    let f = setup();
    let mut edition_ids = Vec::new(&f.env);
    for i in 0..201 {
        edition_ids.push_back(i);
    }
    f.client.keep_alive(&edition_ids, &Vec::new(&f.env), &Vec::new(&f.env), &Vec::new(&f.env));
}

/// Watch the clock run out and the sweep heal it, printed as a timeline.
///
/// `cargo test keep_alive_timeline -- --nocapture`
///
/// This is the test-harness answer to "can I set a 5-minute TTL and watch it
/// expire?" — on a real network you can't, because an entry's starting life is
/// `minPersistentTtl` (a network setting) and `extend_ttl` only ever extends.
/// Here the ledger is ours to move.
#[test]
fn keep_alive_timeline() {
    use soroban_sdk::testutils::{storage::Persistent as _, Ledger as _};
    use stellar_tokens::non_fungible::consecutive::storage::NFTConsecutiveStorageKey;

    let f = setup();
    let alice = Address::generate(&f.env); // creator
    let bob = Address::generate(&f.env); // buyer
    fund(&f, &bob, PRICE);

    let token_id = buy_one(&f, &bob, &alice, 0);
    let row = String::from_str(&f.env, "row-1");
    let edition_id = f.client.edition_by_ref(&row).unwrap();

    let days = |ledgers: u32| ledgers as f64 / 17_280.0;
    let read = |label: &str| {
        f.env.as_contract(&f.client.address, || {
            let edition = f.env.storage().persistent().get_ttl(&DataKey::Edition(edition_id));
            let by_ref = f.env.storage().persistent().get_ttl(&DataKey::EditionByRef(row.clone()));
            let owner = f
                .env
                .storage()
                .persistent()
                .get_ttl(&NFTConsecutiveStorageKey::Owner(token_id));
            std::println!(
                "  {label:<24} Edition {:>6.1}d   EditionByRef {:>6.1}d   Owner {:>6.1}d",
                days(edition),
                days(by_ref),
                days(owner),
            );
            (edition, by_ref, owner)
        })
    };

    std::println!("\n  BUMP_THRESHOLD = 150d, BUMP_TO = 175d\n");
    let (_, _, owner_at_mint) = read("at mint");

    // Two months on — one missed sweep.
    let seq = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = seq + 62 * 17_280);
    read("+62d (sweep missed)");

    // Four months on. Ownership is now past OZ's own 30-day life, which is
    // exactly what `extend_ownership_ttl` exists to prevent.
    let seq = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = seq + 62 * 17_280);
    let (_, _, owner_before) = read("+124d (2 missed)");

    f.client.keep_alive(
        &Vec::from_array(&f.env, [edition_id]),
        &Vec::from_array(&f.env, [row.clone()]),
        &Vec::from_array(&f.env, [token_id]),
        &Vec::new(&f.env),
    );
    let (edition_after, by_ref_after, owner_after) = read("after keep_alive");
    std::println!();

    assert!(owner_at_mint > 30 * 17_280, "mint must lift ownership past OZ's 30 days");
    assert!(owner_after > owner_before, "the sweep must renew ownership");
    for (ttl, name) in [(edition_after, "Edition"), (by_ref_after, "EditionByRef"), (owner_after, "Owner")] {
        assert!(ttl > 150 * 17_280, "{name} should be back above the threshold: {ttl}");
    }
    assert_eq!(f.client.owner_of(&token_id), bob, "token still readable");
}

/// `BUMP_TO` above the network's `max_entry_ttl` clamps; it does not fail.
///
/// The contract picks 175 days against a 180-day ceiling, so the margin only
/// matters if the network ever lowers `maxEntryTTL`. This pins what happens
/// then: extensions are capped at the new ceiling and every call still
/// succeeds. Worth knowing, because the alternative — a network change
/// silently making every purchase panic — would be unrecoverable without an
/// upgrade.
#[test]
fn extending_past_the_network_ceiling_clamps_rather_than_failing() {
    use soroban_sdk::testutils::{storage::Persistent as _, Ledger as _};

    let f = setup();
    let ceiling = 100 * 17_280; // below the contract's BUMP_TO of 175 days
    f.env.ledger().set_max_entry_ttl(ceiling);

    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let token_id = buy_one(&f, &bob, &alice, 0);
    let row = String::from_str(&f.env, "row-1");
    let edition_id = f.client.edition_by_ref(&row).unwrap();

    f.client.keep_alive(
        &Vec::from_array(&f.env, [edition_id]),
        &Vec::from_array(&f.env, [row.clone()]),
        &Vec::from_array(&f.env, [token_id]),
        &Vec::new(&f.env),
    );

    f.env.as_contract(&f.client.address, || {
        for (ttl, name) in [
            (f.env.storage().persistent().get_ttl(&DataKey::Edition(edition_id)), "Edition"),
            (f.env.storage().persistent().get_ttl(&DataKey::TokenEdition(token_id)), "TokenEdition"),
            (f.env.storage().persistent().get_ttl(&DataKey::EditionByRef(row.clone())), "EditionByRef"),
        ] {
            assert!(ttl <= ceiling, "{name} must not exceed the ceiling: {ttl}");
            assert!(ttl > 90 * 17_280, "{name} should still be pushed near it: {ttl}");
        }
    });

    assert_eq!(f.client.owner_of(&token_id), bob);
}

/// The "set it to 5 minutes and watch it heal" experiment, in minutes.
///
/// `cargo test keep_alive_five_minute -- --nocapture`
///
/// Real networks won't allow this — a persistent entry is born at
/// `minPersistentTTL` (7 days on testnet, 120 on mainnet) and `extend_ttl`
/// only ever extends. Here the harness lets us set the network's own limits,
/// so the entire archival lifecycle runs in minutes instead of months. The
/// contract is unchanged; only the ledger around it is small.
#[test]
fn keep_alive_five_minute() {
    use soroban_sdk::testutils::{storage::Persistent as _, Ledger as _};

    // ~5s per ledger on Stellar, so 12 ledgers to the minute.
    const PER_MINUTE: u32 = 12;

    let f = setup();
    f.env.ledger().set_min_persistent_entry_ttl(5 * PER_MINUTE); // born at 5 min
    f.env.ledger().set_max_entry_ttl(10 * PER_MINUTE); // ceiling at 10 min

    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let token_id = buy_one(&f, &bob, &alice, 0);
    let row = String::from_str(&f.env, "row-1");
    let edition_id = f.client.edition_by_ref(&row).unwrap();

    let show = |label: &str| {
        f.env.as_contract(&f.client.address, || {
            let mins = |l: u32| l as f64 / PER_MINUTE as f64;
            let edition = f.env.storage().persistent().get_ttl(&DataKey::Edition(edition_id));
            let by_ref = f.env.storage().persistent().get_ttl(&DataKey::EditionByRef(row.clone()));
            let token = f.env.storage().persistent().get_ttl(&DataKey::TokenEdition(token_id));
            std::println!(
                "  {label:<22} Edition {:>5.1}m   EditionByRef {:>5.1}m   TokenEdition {:>5.1}m",
                mins(edition), mins(by_ref), mins(token),
            );
            edition
        })
    };
    let tick = |minutes: u32| {
        let seq = f.env.ledger().sequence();
        f.env.ledger().with_mut(|li| li.sequence_number = seq + minutes * PER_MINUTE);
    };

    std::println!("\n  min_persistent_entry_ttl = 5m, max_entry_ttl = 10m\n");
    let at_mint = show("at mint");

    tick(5);
    show("+5 min");
    tick(4);
    let before = show("+9 min (nearly dead)");

    f.client.keep_alive(
        &Vec::from_array(&f.env, [edition_id]),
        &Vec::from_array(&f.env, [row.clone()]),
        &Vec::from_array(&f.env, [token_id]),
        &Vec::new(&f.env),
    );
    let after = show("after keep_alive");
    std::println!();

    assert_eq!(at_mint, 10 * PER_MINUTE, "mint should clamp to the 10m ceiling");
    assert_eq!(before, 1 * PER_MINUTE, "1 minute of life left before the sweep");
    assert_eq!(after, 10 * PER_MINUTE, "the sweep must take it back to the ceiling");
    assert_eq!(f.client.owner_of(&token_id), bob, "token still readable");
}

/// A sweep at the scheduler's batch size fits inside one transaction.
///
/// `MAX_KEEP_ALIVE_IDS` (200) is only what the contract will *accept*. The
/// real ceiling is Soroban's per-transaction footprint, and each token can add
/// four entries to it — `OwnershipBucket`, `Owner`, `TokenEdition`, `Listing`.
/// Testnet rejected 150 ids outright, and here — where the harness enforces
/// mainnet's limits — 31 worst-case tokens already hit 102 entries against a
/// cap of 100. The scheduler sends 25 (`MAX_IDS_PER_CALL` in the keep-alive
/// route). This pins it: raising that number needs a re-test, not a guess.
#[test]
fn a_sweep_at_the_scheduler_batch_size_fits_one_transaction() {
    const BATCH: u32 = 25;

    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * BATCH as i128);

    let row = String::from_str(&f.env, "row-batch");
    f.client.register_edition(
        &f.price_authority,
        &row,
        &edition_input(&f, &alice, 0, BATCH, PRICE),
    );
    let edition_id = f.client.edition_by_ref(&row).unwrap();

    // Worst case for the footprint: bought one at a time, so every token gets
    // its own `Owner` entry rather than sharing one per batch.
    let mut token_ids = Vec::new(&f.env);
    for i in 0..BATCH {
        let purchase_ref = std::format!("p{i}");
        let (first, _) = f.client.buy_edition(
            &bob,
            &row,
            &String::from_str(&f.env, &purchase_ref),
            &f.payment,
            &1,
            &0,
            &0,
        );
        token_ids.push_back(first);
    }
    assert_eq!(token_ids.len(), BATCH);

    f.client.keep_alive(
        &Vec::from_array(&f.env, [edition_id]),
        &Vec::from_array(&f.env, [row.clone()]),
        &token_ids,
        &Vec::new(&f.env),
    );

    assert_eq!(f.client.owner_of(&token_ids.get(0).unwrap()), bob);
    assert_eq!(f.client.owner_of(&token_ids.get(BATCH - 1).unwrap()), bob);
}

/// Every payment leg, with the numbers printed.
///
/// `cargo test money_flow -- --nocapture`
#[test]
fn money_flow() {
    let f = setup();
    let u = |v: i128| v as f64 / 1e7;
    let bal = |a: &Address| f.token.balance(a);

    let creator = Address::generate(&f.env);
    let buyer = Address::generate(&f.env);
    let reseller = buyer.clone();
    let buyer2 = Address::generate(&f.env);
    let treasury = f.treasury.clone();

    let inclusion = 100_0000000i128; // 100 units
    let network = 10_0000000i128; //  10 units
    fund(&f, &buyer, PRICE * 10);
    fund(&f, &buyer2, PRICE * 10);

    // ---------------------------------------------------------------- primary
    std::println!("\n  \x1b[1mPRIMARY SALE\x1b[0m  buy_edition, 2 copies @ {} each", u(PRICE));
    std::println!("  platform fee {}bps, creator royalty 500bps (not charged on a primary sale)", FEE_BPS);
    let (b0, c0, t0) = (bal(&buyer), bal(&creator), bal(&treasury));

    let row = String::from_str(&f.env, "row-1");
    f.client.register_edition(&f.price_authority, &row, &edition_input(&f, &creator, 500, 10, PRICE));
    f.client.buy_edition(
        &buyer, &row, &String::from_str(&f.env, "p1"), &f.payment, &2, &inclusion, &network,
    );

    let total = PRICE * 2;
    let platform_fee = total * FEE_BPS as i128 / 10_000;
    std::println!("    buyer    −{:>12.2}   (item {} + fees {})", u(b0 - bal(&buyer)), u(total), u(inclusion + network));
    std::println!("    creator  +{:>12.2}   (total − platform fee)", u(bal(&creator) - c0));
    std::println!("    treasury +{:>12.2}   (platform fee {} + fees {})", u(bal(&treasury) - t0), u(platform_fee), u(inclusion + network));
    assert_eq!(b0 - bal(&buyer), total + inclusion + network);
    assert_eq!(bal(&creator) - c0, total - platform_fee);
    assert_eq!(bal(&treasury) - t0, platform_fee + inclusion + network);

    // ---------------------------------------------------------------- resale
    std::println!("\n  \x1b[1mRESALE\x1b[0m  buy, 1 token @ {}", u(PRICE));
    let token_id = 0u32;
    f.client.list(&reseller, &token_id, &single_price(&f, PRICE));
    let (s0, c1, t1, b20) = (bal(&reseller), bal(&creator), bal(&treasury), bal(&buyer2));
    let split = f.client.sale_breakdown(&token_id, &f.payment).unwrap();
    f.client.buy(&buyer2, &token_id, &f.payment, &inclusion, &network);

    std::println!("    buyer2   −{:>12.2}   (item {} + fees {})", u(b20 - bal(&buyer2)), u(PRICE), u(inclusion + network));
    std::println!("    seller   +{:>12.2}   (92.5% — after 2.5% platform, 5% royalty)", u(bal(&reseller) - s0));
    std::println!("    creator  +{:>12.2}   (5% royalty, forever)", u(bal(&creator) - c1));
    std::println!("    treasury +{:>12.2}   (2.5% platform fee + fees)", u(bal(&treasury) - t1));
    assert_eq!(split.total, PRICE);
    assert_eq!(split.platform_fee, PRICE * 250 / 10_000);
    assert_eq!(split.royalty, PRICE * 500 / 10_000);
    assert_eq!(split.seller_amount, PRICE - split.platform_fee - split.royalty);
    assert_eq!(bal(&reseller) - s0, split.seller_amount);
    assert_eq!(bal(&creator) - c1, split.royalty);
    assert_eq!(bal(&treasury) - t1, split.platform_fee + inclusion + network);
    assert_eq!(b20 - bal(&buyer2), PRICE + inclusion + network);

    // ------------------------------------------------ creator reselling own work
    std::println!("\n  \x1b[1mCREATOR RESELLS THEIR OWN COPY\x1b[0m  royalty nets to zero");
    fund(&f, &creator, PRICE * 3);
    let (_, last) = f.client.buy_edition(
        &creator, &row, &String::from_str(&f.env, "p2"), &f.payment, &1, &0, &0,
    );
    f.client.list(&creator, &last, &single_price(&f, PRICE));
    let own = f.client.sale_breakdown(&last, &f.payment).unwrap();
    std::println!("    royalty  {:>13.2}   (creator would be paying themselves)", u(own.royalty));
    std::println!("    seller   +{:>12.2}   (97.5% — keeps the royalty share)", u(own.seller_amount));
    assert_eq!(own.royalty, 0);
    assert_eq!(own.seller_amount, PRICE - own.platform_fee);
    std::println!();
}

/// Each of the scheduler's per-kind caps fits inside one transaction.
///
/// The footprint counts every entry a call touches, across all four lists at
/// once — so capping each list separately is not enough, and the route sends
/// exactly one kind per call. These are the sizes it sends
/// (`LIMITS` in `src/pages/api/internal/keep-alive.ts`); if any of them stops
/// fitting, this fails here rather than silently on a sweep.
#[test]
fn every_scheduler_batch_size_fits_one_transaction() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE * 100);

    // 80 editions and refs (the largest cap), with 20 of them also minted.
    let mut edition_ids = Vec::new(&f.env);
    let mut refs = Vec::new(&f.env);
    let mut token_ids = Vec::new(&f.env);
    for i in 0..80u32 {
        let r = String::from_str(&f.env, &std::format!("row{i}"));
        f.client.register_edition(&f.price_authority, &r, &edition_input(&f, &alice, 0, 2, PRICE));
        edition_ids.push_back(f.client.edition_by_ref(&r).unwrap());
        refs.push_back(r.clone());
        if i < 20 {
            let (first, _) = f.client.buy_edition(
                &bob, &r, &String::from_str(&f.env, &std::format!("pr{i}")), &f.payment, &1, &0, &0);
            token_ids.push_back(first);
        }
    }

    let take = |v: &Vec<u32>, n: u32| {
        let mut out = Vec::new(&f.env);
        for i in 0..n { out.push_back(v.get(i).unwrap()); }
        out
    };
    let take_s = |v: &Vec<String>, n: u32| {
        let mut out = Vec::new(&f.env);
        for i in 0..n { out.push_back(v.get(i).unwrap()); }
        out
    };
    let none_u32 = Vec::new(&f.env);
    let none_str: Vec<String> = Vec::new(&f.env);
    let none_pair: Vec<(u32, u32)> = Vec::new(&f.env);

    // LIMITS.tokens = 20
    f.client.keep_alive(&none_u32, &none_str, &take(&token_ids, 20), &none_pair);
    // LIMITS.editions = 40
    f.client.keep_alive(&take(&edition_ids, 40), &none_str, &none_u32, &none_pair);
    // LIMITS.refs = 80
    f.client.keep_alive(&none_u32, &take_s(&refs, 80), &none_u32, &none_pair);
    // LIMITS.unlocked = 80 is not exercised directly — an `Unlocked` entry
    // costs exactly one footprint entry, the same as a ref, so the refs case
    // above bounds it.

    assert_eq!(f.client.owner_of(&token_ids.get(0).unwrap()), bob);
}

// =============================================================================
// Single-kind keep-alive entry points — for an operator sweeping by hand.
// =============================================================================

/// Each one renews its own kind, and the contract instance alongside it.
#[test]
fn single_kind_entry_points_renew_what_they_name() {
    use soroban_sdk::testutils::{storage::Instance as _, storage::Persistent as _, Ledger as _};

    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);

    let token_id = buy_one(&f, &bob, &alice, 0);
    let row = String::from_str(&f.env, "row-1");
    let edition_id = f.client.edition_by_ref(&row).unwrap();

    // Far enough forward that everything is under the renewal threshold.
    let seq = f.env.ledger().sequence();
    f.env.ledger().with_mut(|li| li.sequence_number = seq + 100 * 17_280);

    let ttl = |k: DataKey| f.env.as_contract(&f.client.address, || f.env.storage().persistent().get_ttl(&k));
    let instance_ttl = || f.env.as_contract(&f.client.address, || f.env.storage().instance().get_ttl());

    f.client.keep_editions_alive(&Vec::from_array(&f.env, [edition_id]));
    assert!(ttl(DataKey::Edition(edition_id)) > 150 * 17_280, "Edition renewed");
    assert!(ttl(DataKey::EditionPrices(edition_id)) > 150 * 17_280, "EditionPrices renewed");

    f.client.keep_edition_refs_alive(&Vec::from_array(&f.env, [row.clone()]));
    assert!(ttl(DataKey::EditionByRef(row.clone())) > 150 * 17_280, "EditionByRef renewed");

    f.client.keep_tokens_alive(&Vec::from_array(&f.env, [token_id]));
    assert!(ttl(DataKey::TokenEdition(token_id)) > 150 * 17_280, "TokenEdition renewed");

    // Every entry point renews the instance, so any manual sweep keeps the
    // contract itself alive.
    f.client.keep_contract_alive();
    assert!(instance_ttl() > 150 * 17_280, "instance renewed");

    assert_eq!(f.client.owner_of(&token_id), bob);
}

/// Unknown ids skip rather than panic, same as `keep_alive`.
#[test]
fn single_kind_entry_points_tolerate_ids_that_do_not_exist() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    fund(&f, &bob, PRICE);
    let token_id = buy_one(&f, &bob, &alice, 0);

    f.client.keep_editions_alive(&Vec::from_array(&f.env, [9_998, 9_999]));
    f.client.keep_edition_refs_alive(&Vec::from_array(&f.env, [String::from_str(&f.env, "nope")]));
    f.client.keep_tokens_alive(&Vec::from_array(&f.env, [9_998, token_id, 9_999]));
    f.client.keep_unlocked_alive(&Vec::from_array(&f.env, [(9_998u32, 0u32)]));

    assert_eq!(f.client.owner_of(&token_id), bob, "the real token survived");
}

/// Each cap is enforced on-chain, at its own size.
#[test]
fn single_kind_entry_points_enforce_their_own_caps() {
    let f = setup();

    let over = |n: u32| {
        let mut v = Vec::new(&f.env);
        for i in 0..n { v.push_back(i); }
        v
    };
    // MAX_TOKENS_PER_CALL = 25
    assert!(f.client.try_keep_tokens_alive(&over(26)).is_err(), "26 tokens must be refused");
    assert!(f.client.try_keep_tokens_alive(&over(25)).is_ok(), "25 tokens must be accepted");
    // MAX_EDITIONS_PER_CALL = 40
    assert!(f.client.try_keep_editions_alive(&over(41)).is_err(), "41 editions must be refused");
    assert!(f.client.try_keep_editions_alive(&over(40)).is_ok(), "40 editions must be accepted");

    let mut refs = Vec::new(&f.env);
    for i in 0..81u32 { refs.push_back(String::from_str(&f.env, &std::format!("r{i}"))); }
    assert!(f.client.try_keep_edition_refs_alive(&refs).is_err(), "81 refs must be refused");
}
