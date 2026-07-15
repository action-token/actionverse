#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NativeToken,
    Bounty(u64),
    WinnerAward(u64, Address),
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BountyStatus {
    Funded,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Bounty {
    pub creator: Address,
    pub token: Address,
    pub total_amount: i128,
    pub remaining: i128,
    pub max_winners: u32,
    pub winners_selected: u32,
    pub status: BountyStatus,
}

#[contracttype]
#[derive(Clone)]
pub struct WinnerAward {
    pub amount: i128,
    pub claimed: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InvalidMaxWinners = 2,
    BountyAlreadyExists = 3,
    BountyNotFound = 4,
    BountyNotFunded = 5,
    MaxWinnersReached = 6,
    InsufficientRemainingBalance = 7,
    WinnerAlreadySelected = 8,
    WinnerAwardNotFound = 9,
    AlreadyClaimed = 10,
    AlreadyCancelled = 11,
    Unauthorized = 12,
    CreatorCannotBeWinner = 13,
}

#[contractevent]
pub struct BountyCreated {
    #[topic]
    pub bounty_id: u64,
    #[topic]
    pub creator: Address,
    pub token: Address,
    pub amount: i128,
    pub max_winners: u32,
}

#[contractevent]
pub struct WinnerSelected {
    #[topic]
    pub bounty_id: u64,
    #[topic]
    pub winner: Address,
    pub amount: i128,
}

#[contractevent]
pub struct RewardClaimed {
    #[topic]
    pub bounty_id: u64,
    #[topic]
    pub winner: Address,
    pub amount: i128,
}

#[contractevent]
pub struct BountyCancelled {
    #[topic]
    pub bounty_id: u64,
    pub refunded_amount: i128,
}

#[contract]
pub struct BountyManager;

#[contractimpl]
impl BountyManager {
    /// Runs once at deploy time. `admin` is the platform account that must
    /// co-sign every `create_bounty` call (prevents external ID squatting).
    /// `native_token` is the native XLM SAC address so `claim_reward` can
    /// skip the redundant `trust()` call for XLM bounties.
    pub fn __constructor(env: Env, admin: Address, native_token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NativeToken, &native_token);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    }

    /// Creator deposits `amount` of `token` into escrow for `bounty_id`.
    /// Requires admin co-authorization so only the platform can assign IDs.
    pub fn create_bounty(
        env: Env,
        bounty_id: u64,
        creator: Address,
        token: Address,
        amount: i128,
        max_winners: u32,
    ) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        creator.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if max_winners == 0 {
            return Err(Error::InvalidMaxWinners);
        }

        let key = DataKey::Bounty(bounty_id);
        if env.storage().persistent().has(&key) {
            return Err(Error::BountyAlreadyExists);
        }

        TokenClient::new(&env, &token).transfer(&creator, &env.current_contract_address(), &amount);

        let bounty = Bounty {
            creator: creator.clone(),
            token: token.clone(),
            total_amount: amount,
            remaining: amount,
            max_winners,
            winners_selected: 0,
            status: BountyStatus::Funded,
        };
        env.storage().persistent().set(&key, &bounty);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        BountyCreated {
            bounty_id,
            creator,
            token,
            amount,
            max_winners,
        }
        .publish(&env);

        Ok(())
    }

    /// Creator commits `amount` of the remaining escrow to `winner`. The
    /// award is claimable by `winner` via `claim_reward`, but not paid out yet.
    pub fn select_winner(
        env: Env,
        caller: Address,
        bounty_id: u64,
        winner: Address,
        amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        let key = DataKey::Bounty(bounty_id);
        let mut bounty: Bounty = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::BountyNotFound)?;

        if bounty.creator != caller {
            return Err(Error::Unauthorized);
        }
        if winner == bounty.creator {
            return Err(Error::CreatorCannotBeWinner);
        }
        if bounty.status != BountyStatus::Funded {
            return Err(Error::BountyNotFunded);
        }
        if bounty.winners_selected >= bounty.max_winners {
            return Err(Error::MaxWinnersReached);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amount > bounty.remaining {
            return Err(Error::InsufficientRemainingBalance);
        }

        let award_key = DataKey::WinnerAward(bounty_id, winner.clone());
        if env.storage().persistent().has(&award_key) {
            return Err(Error::WinnerAlreadySelected);
        }

        bounty.remaining -= amount;
        bounty.winners_selected += 1;
        env.storage().persistent().set(&key, &bounty);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        let award = WinnerAward { amount, claimed: false };
        env.storage().persistent().set(&award_key, &award);
        env.storage()
            .persistent()
            .extend_ttl(&award_key, BUMP_THRESHOLD, BUMP_TO);

        WinnerSelected {
            bounty_id,
            winner,
            amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Winner pulls their committed award.
    pub fn claim_reward(env: Env, bounty_id: u64, winner: Address) -> Result<(), Error> {
        winner.require_auth();

        let bounty_key = DataKey::Bounty(bounty_id);
        let bounty: Bounty = env
            .storage()
            .persistent()
            .get(&bounty_key)
            .ok_or(Error::BountyNotFound)?;

        let award_key = DataKey::WinnerAward(bounty_id, winner.clone());
        let mut award: WinnerAward = env
            .storage()
            .persistent()
            .get(&award_key)
            .ok_or(Error::WinnerAwardNotFound)?;

        if award.claimed {
            return Err(Error::AlreadyClaimed);
        }

        let native_token: Option<Address> =
            env.storage().instance().get(&DataKey::NativeToken);
        if native_token.as_ref() != Some(&bounty.token) {
            StellarAssetClient::new(&env, &bounty.token).trust(&winner);
        }

        TokenClient::new(&env, &bounty.token).transfer(
            &env.current_contract_address(),
            &winner,
            &award.amount,
        );

        award.claimed = true;
        env.storage().persistent().set(&award_key, &award);
        env.storage()
            .persistent()
            .extend_ttl(&award_key, BUMP_THRESHOLD, BUMP_TO);
        env.storage()
            .persistent()
            .extend_ttl(&bounty_key, BUMP_THRESHOLD, BUMP_TO);

        RewardClaimed {
            bounty_id,
            winner,
            amount: award.amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Creator cancels the bounty, reclaiming any unassigned escrow.
    /// Awards already selected (claimed or not) are unaffected.
    pub fn cancel_bounty(env: Env, caller: Address, bounty_id: u64) -> Result<(), Error> {
        caller.require_auth();

        let key = DataKey::Bounty(bounty_id);
        let mut bounty: Bounty = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::BountyNotFound)?;

        if bounty.creator != caller {
            return Err(Error::Unauthorized);
        }
        if bounty.status == BountyStatus::Cancelled {
            return Err(Error::AlreadyCancelled);
        }

        let refund_amount = bounty.remaining;
        if refund_amount > 0 {
            TokenClient::new(&env, &bounty.token).transfer(
                &env.current_contract_address(),
                &bounty.creator,
                &refund_amount,
            );
        }

        bounty.remaining = 0;
        bounty.status = BountyStatus::Cancelled;
        env.storage().persistent().set(&key, &bounty);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        BountyCancelled {
            bounty_id,
            refunded_amount: refund_amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn get_bounty(env: Env, bounty_id: u64) -> Result<Bounty, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Bounty(bounty_id))
            .ok_or(Error::BountyNotFound)
    }

    pub fn get_winner_award(env: Env, bounty_id: u64, winner: Address) -> Option<WinnerAward> {
        env.storage()
            .persistent()
            .get(&DataKey::WinnerAward(bounty_id, winner))
    }

    /// Admin-only: extend the TTL of a bounty entry. Callable at any time to
    /// keep inactive bounties alive. Requires the platform admin signature.
    pub fn admin_extend_bounty_ttl(env: Env, bounty_id: u64) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Bounty(bounty_id);
        if !env.storage().persistent().has(&key) {
            return Err(Error::BountyNotFound);
        }

        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        Ok(())
    }

    /// Admin-only: extend the TTL of a winner award entry.
    pub fn admin_extend_winner_award_ttl(
        env: Env,
        bounty_id: u64,
        winner: Address,
    ) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let award_key = DataKey::WinnerAward(bounty_id, winner.clone());
        if !env.storage().persistent().has(&award_key) {
            return Err(Error::WinnerAwardNotFound);
        }

        env.storage()
            .persistent()
            .extend_ttl(&award_key, BUMP_THRESHOLD, BUMP_TO);

        Ok(())
    }

    /// Admin-only: extend the TTL of the contract instance (admin, native_token,
    /// and the contract code). This keeps the whole contract callable.
    pub fn admin_extend_instance_ttl(env: Env) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        Ok(())
    }
}

mod test;
