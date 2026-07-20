import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const Errors: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
    7: {
        message: string;
    };
    8: {
        message: string;
    };
    9: {
        message: string;
    };
    10: {
        message: string;
    };
    11: {
        message: string;
    };
    12: {
        message: string;
    };
    13: {
        message: string;
    };
};
export interface Bounty {
    creator: string;
    max_winners: u32;
    remaining: i128;
    status: BountyStatus;
    token: string;
    total_amount: i128;
    winners_selected: u32;
}
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "NativeToken";
    values: void;
} | {
    tag: "Bounty";
    values: readonly [string];
} | {
    tag: "WinnerAward";
    values: readonly [string, string];
};
export interface WinnerAward {
    amount: i128;
    claimed: boolean;
}
export type BountyStatus = {
    tag: "Funded";
    values: void;
} | {
    tag: "Cancelled";
    values: void;
};
export interface Client {
    /**
     * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Upgrade the contract to a new WASM version.
     * Only admin can call this. The contract keeps the same address and all data.
     */
    upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the current contract version.
     */
    version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a get_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_bounty: ({ bounty_id }: {
        bounty_id: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Bounty>>>;
    /**
     * Construct and simulate a claim_reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Winner pulls their committed award.
     */
    claim_reward: ({ bounty_id, winner }: {
        bounty_id: string;
        winner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a cancel_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Creator cancels the bounty, reclaiming any unassigned escrow.
     */
    cancel_bounty: ({ caller, bounty_id }: {
        caller: string;
        bounty_id: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a create_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Creator deposits `amount` of `token` into escrow.
     * The `bounty_id` is the DB-generated UUID passed from off-chain.
     * Only the creator needs to authorize this call.
     */
    create_bounty: ({ bounty_id, creator, token, amount, max_winners }: {
        bounty_id: string;
        creator: string;
        token: string;
        amount: i128;
        max_winners: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a select_winner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Creator commits `amount` of the remaining escrow to `winner`.
     */
    select_winner: ({ caller, bounty_id, winner, amount }: {
        caller: string;
        bounty_id: string;
        winner: string;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_winner_award transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_winner_award: ({ bounty_id, winner }: {
        bounty_id: string;
        winner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<WinnerAward>>>;
    /**
     * Construct and simulate a admin_extend_bounty_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin_extend_bounty_ttl: ({ bounty_id }: {
        bounty_id: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a admin_extend_instance_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin_extend_instance_ttl: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a admin_extend_winner_award_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin_extend_winner_award_ttl: ({ bounty_id, winner }: {
        bounty_id: string;
        winner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, native_token }: {
        admin: string;
        native_token: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        upgrade: (json: string) => AssembledTransaction<null>;
        version: (json: string) => AssembledTransaction<number>;
        get_bounty: (json: string) => AssembledTransaction<Result<Bounty, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        claim_reward: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        cancel_bounty: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        create_bounty: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        select_winner: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_winner_award: (json: string) => AssembledTransaction<Option<WinnerAward>>;
        admin_extend_bounty_ttl: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        admin_extend_instance_ttl: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        admin_extend_winner_award_ttl: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
