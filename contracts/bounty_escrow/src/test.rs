#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Env, String,
};

fn setup<'a>() -> (Env, BountyManagerClient<'a>, TokenClient<'a>, StellarAssetClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract_id.address();
    let token = TokenClient::new(&env, &token_address);
    let token_sac = StellarAssetClient::new(&env, &token_address);

    let contract_id = env.register(BountyManager, (admin.clone(), token_address.clone()));
    let client = BountyManagerClient::new(&env, &contract_id);

    (env, client, token, token_sac)
}

fn s(env: &Env, val: &str) -> String {
    String::from_str(env, val)
}

#[test]
fn happy_path_create_select_claim() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "550e8400-e29b-41d4-a716-446655440000");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &2);
    assert_eq!(token.balance(&creator), 0);
    assert_eq!(token.balance(&client.address), 1_000);

    client.select_winner(&creator, &bounty_id, &winner, &400);
    let bounty = client.get_bounty(&bounty_id);
    assert_eq!(bounty.remaining, 600);
    assert_eq!(bounty.winners_selected, 1);

    client.claim_reward(&bounty_id, &winner);
    assert_eq!(token.balance(&winner), 400);
    assert_eq!(token.balance(&client.address), 600);

    let award = client.get_winner_award(&bounty_id, &winner).unwrap();
    assert!(award.claimed);
}

#[test]
fn create_bounty_duplicate_id_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "dup-id-1234");

    client.create_bounty(&bounty_id, &creator, &token.address, &500, &1);
    let result = client.try_create_bounty(&bounty_id, &creator, &token.address, &500, &1);
    assert_eq!(result, Err(Ok(Error::BountyAlreadyExists)));
}

#[test]
fn select_winner_exceeding_remaining_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "bounty-exceed");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &2);
    let result = client.try_select_winner(&creator, &bounty_id, &winner, &1_001);
    assert_eq!(result, Err(Ok(Error::InsufficientRemainingBalance)));
}

#[test]
fn select_winner_past_max_winners_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner_a = Address::generate(&env);
    let winner_b = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "bounty-maxw");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    client.select_winner(&creator, &bounty_id, &winner_a, &500);
    let result = client.try_select_winner(&creator, &bounty_id, &winner_b, &500);
    assert_eq!(result, Err(Ok(Error::MaxWinnersReached)));
}

#[test]
fn claim_without_selection_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "bounty-noclaim");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    let result = client.try_claim_reward(&bounty_id, &winner);
    assert_eq!(result, Err(Ok(Error::WinnerAwardNotFound)));
}

#[test]
fn double_claim_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "bounty-dclaim");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    client.select_winner(&creator, &bounty_id, &winner, &500);
    client.claim_reward(&bounty_id, &winner);

    let result = client.try_claim_reward(&bounty_id, &winner);
    assert_eq!(result, Err(Ok(Error::AlreadyClaimed)));
}

#[test]
fn cancel_refunds_unassigned_and_keeps_awards_claimable() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "bounty-cancel");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &2);
    client.select_winner(&creator, &bounty_id, &winner, &300);
    client.cancel_bounty(&creator, &bounty_id);

    assert_eq!(token.balance(&creator), 700);
    assert_eq!(token.balance(&client.address), 300);

    client.claim_reward(&bounty_id, &winner);
    assert_eq!(token.balance(&winner), 300);

    let result =
        client.try_select_winner(&creator, &bounty_id, &Address::generate(&env), &1);
    assert_eq!(result, Err(Ok(Error::BountyNotFunded)));
}

#[test]
fn cancel_twice_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "bounty-c2");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    client.cancel_bounty(&creator, &bounty_id);
    let result = client.try_cancel_bounty(&creator, &bounty_id);
    assert_eq!(result, Err(Ok(Error::AlreadyCancelled)));
}

#[test]
fn invalid_amount_and_max_winners_rejected() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let id = s(&env, "b-inv");
    let zero_amount = client.try_create_bounty(&id, &creator, &token.address, &0, &1);
    assert_eq!(zero_amount, Err(Ok(Error::InvalidAmount)));

    let id2 = s(&env, "b-inv2");
    let zero_winners = client.try_create_bounty(&id2, &creator, &token.address, &500, &0);
    assert_eq!(zero_winners, Err(Ok(Error::InvalidMaxWinners)));
}

#[test]
fn winner_cannot_be_selected_twice_for_same_bounty() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-dupw");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &2);
    client.select_winner(&creator, &bounty_id, &winner, &200);
    let result = client.try_select_winner(&creator, &bounty_id, &winner, &200);
    assert_eq!(result, Err(Ok(Error::WinnerAlreadySelected)));
}

#[test]
fn unauthorized_caller_cannot_select_winner() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let impostor = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-uauth");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    let result = client.try_select_winner(&impostor, &bounty_id, &winner, &500);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn unauthorized_caller_cannot_cancel_bounty() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let impostor = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-ucauth");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    let result = client.try_cancel_bounty(&impostor, &bounty_id);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn creator_cannot_select_self_as_winner() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-self");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    let result = client.try_select_winner(&creator, &bounty_id, &creator, &500);
    assert_eq!(result, Err(Ok(Error::CreatorCannotBeWinner)));
}

#[test]
fn admin_can_extend_bounty_ttl() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-ettl");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    client.admin_extend_bounty_ttl(&bounty_id);

    let bounty = client.get_bounty(&bounty_id);
    assert_eq!(bounty.total_amount, 1_000);
}

#[test]
fn admin_can_extend_winner_award_ttl() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-wettl");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    client.select_winner(&creator, &bounty_id, &winner, &500);
    client.admin_extend_winner_award_ttl(&bounty_id, &winner);

    let award = client.get_winner_award(&bounty_id, &winner).unwrap();
    assert_eq!(award.amount, 500);
}

#[test]
fn admin_can_extend_instance_ttl() {
    let (env, client, token, token_sac) = setup();
    let creator = Address::generate(&env);
    token_sac.mint(&creator, &1_000);

    let bounty_id = s(&env, "b-ittl");

    client.create_bounty(&bounty_id, &creator, &token.address, &1_000, &1);
    client.admin_extend_instance_ttl();

    let bounty = client.get_bounty(&bounty_id);
    assert_eq!(bounty.total_amount, 1_000);
}
