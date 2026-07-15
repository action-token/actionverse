import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: { message: "InvalidAmount" },
  2: { message: "InvalidMaxWinners" },
  3: { message: "BountyAlreadyExists" },
  4: { message: "BountyNotFound" },
  5: { message: "BountyNotFunded" },
  6: { message: "MaxWinnersReached" },
  7: { message: "InsufficientRemainingBalance" },
  8: { message: "WinnerAlreadySelected" },
  9: { message: "WinnerAwardNotFound" },
  10: { message: "AlreadyClaimed" },
  11: { message: "AlreadyCancelled" },
  12: { message: "Unauthorized" },
  13: { message: "CreatorCannotBeWinner" }
}


export interface Bounty {
  creator: string;
  max_winners: u32;
  remaining: i128;
  status: BountyStatus;
  token: string;
  total_amount: i128;
  winners_selected: u32;
}

export type DataKey = { tag: "Admin", values: void } | { tag: "NativeToken", values: void } | { tag: "Bounty", values: readonly [string] } | { tag: "WinnerAward", values: readonly [string, string] };


export interface WinnerAward {
  amount: i128;
  claimed: boolean;
}

export type BountyStatus = { tag: "Funded", values: void } | { tag: "Cancelled", values: void };





export interface Client {
  /**
   * Construct and simulate a get_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty: ({ bounty_id }: { bounty_id: string }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Bounty>>>

  /**
   * Construct and simulate a claim_reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Winner pulls their committed award.
   */
  claim_reward: ({ bounty_id, winner }: { bounty_id: string, winner: string }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator cancels the bounty, reclaiming any unassigned escrow.
   */
  cancel_bounty: ({ caller, bounty_id }: { caller: string, bounty_id: string }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator deposits `amount` of `token` into escrow.
   * The `bounty_id` is the DB-generated UUID passed from off-chain.
   * Only the creator needs to authorize this call.
   */
  create_bounty: ({ bounty_id, creator, token, amount, max_winners }: { bounty_id: string, creator: string, token: string, amount: i128, max_winners: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a select_winner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator commits `amount` of the remaining escrow to `winner`.
   */
  select_winner: ({ caller, bounty_id, winner, amount }: { caller: string, bounty_id: string, winner: string, amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_winner_award transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_winner_award: ({ bounty_id, winner }: { bounty_id: string, winner: string }, options?: MethodOptions) => Promise<AssembledTransaction<Option<WinnerAward>>>

  /**
   * Construct and simulate a admin_extend_bounty_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_extend_bounty_ttl: ({ bounty_id }: { bounty_id: string }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a admin_extend_instance_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_extend_instance_ttl: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a admin_extend_winner_award_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_extend_winner_award_ttl: ({ bounty_id, winner }: { bounty_id: string, winner: string }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, native_token }: { admin: string, native_token: string },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ admin, native_token }, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec(["AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAEAAAAAAAAAEUludmFsaWRNYXhXaW5uZXJzAAAAAAAAAgAAAAAAAAATQm91bnR5QWxyZWFkeUV4aXN0cwAAAAADAAAAAAAAAA5Cb3VudHlOb3RGb3VuZAAAAAAABAAAAAAAAAAPQm91bnR5Tm90RnVuZGVkAAAAAAUAAAAAAAAAEU1heFdpbm5lcnNSZWFjaGVkAAAAAAAABgAAAAAAAAAcSW5zdWZmaWNpZW50UmVtYWluaW5nQmFsYW5jZQAAAAcAAAAAAAAAFVdpbm5lckFscmVhZHlTZWxlY3RlZAAAAAAAAAgAAAAAAAAAE1dpbm5lckF3YXJkTm90Rm91bmQAAAAACQAAAAAAAAAOQWxyZWFkeUNsYWltZWQAAAAAAAoAAAAAAAAAEEFscmVhZHlDYW5jZWxsZWQAAAALAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAMAAAAAAAAABVDcmVhdG9yQ2Fubm90QmVXaW5uZXIAAAAAAAAN",
        "AAAAAQAAAAAAAAAAAAAABkJvdW50eQAAAAAABwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAttYXhfd2lubmVycwAAAAAEAAAAAAAAAAlyZW1haW5pbmcAAAAAAAALAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMQm91bnR5U3RhdHVzAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADHRvdGFsX2Ftb3VudAAAAAsAAAAAAAAAEHdpbm5lcnNfc2VsZWN0ZWQAAAAE",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALTmF0aXZlVG9rZW4AAAAAAQAAAAAAAAAGQm91bnR5AAAAAAABAAAAEAAAAAEAAAAAAAAAC1dpbm5lckF3YXJkAAAAAAIAAAAQAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAC1dpbm5lckF3YXJkAAAAAAIAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAHY2xhaW1lZAAAAAAB",
        "AAAAAgAAAAAAAAAAAAAADEJvdW50eVN0YXR1cwAAAAIAAAAAAAAAAAAAAAZGdW5kZWQAAAAAAAAAAAAAAAAACUNhbmNlbGxlZAAAAA==",
        "AAAAAAAAAAAAAAAKZ2V0X2JvdW50eQAAAAAAAQAAAAAAAAAJYm91bnR5X2lkAAAAAAAAEAAAAAEAAAPpAAAH0AAAAAZCb3VudHkAAAAAAAM=",
        "AAAAAAAAACNXaW5uZXIgcHVsbHMgdGhlaXIgY29tbWl0dGVkIGF3YXJkLgAAAAAMY2xhaW1fcmV3YXJkAAAAAgAAAAAAAAAJYm91bnR5X2lkAAAAAAAAEAAAAAAAAAAGd2lubmVyAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMbmF0aXZlX3Rva2VuAAAAEwAAAAA=",
        "AAAAAAAAAD1DcmVhdG9yIGNhbmNlbHMgdGhlIGJvdW50eSwgcmVjbGFpbWluZyBhbnkgdW5hc3NpZ25lZCBlc2Nyb3cuAAAAAAAADWNhbmNlbF9ib3VudHkAAAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACWJvdW50eV9pZAAAAAAAABAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAKBDcmVhdG9yIGRlcG9zaXRzIGBhbW91bnRgIG9mIGB0b2tlbmAgaW50byBlc2Nyb3cuClRoZSBgYm91bnR5X2lkYCBpcyB0aGUgREItZ2VuZXJhdGVkIFVVSUQgcGFzc2VkIGZyb20gb2ZmLWNoYWluLgpPbmx5IHRoZSBjcmVhdG9yIG5lZWRzIHRvIGF1dGhvcml6ZSB0aGlzIGNhbGwuAAAADWNyZWF0ZV9ib3VudHkAAAAAAAAFAAAAAAAAAAlib3VudHlfaWQAAAAAAAAQAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAttYXhfd2lubmVycwAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAD1DcmVhdG9yIGNvbW1pdHMgYGFtb3VudGAgb2YgdGhlIHJlbWFpbmluZyBlc2Nyb3cgdG8gYHdpbm5lcmAuAAAAAAAADXNlbGVjdF93aW5uZXIAAAAAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACWJvdW50eV9pZAAAAAAAABAAAAAAAAAABndpbm5lcgAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAQZ2V0X3dpbm5lcl9hd2FyZAAAAAIAAAAAAAAACWJvdW50eV9pZAAAAAAAABAAAAAAAAAABndpbm5lcgAAAAAAEwAAAAEAAAPoAAAH0AAAAAtXaW5uZXJBd2FyZAA=",
        "AAAAAAAAAAAAAAAXYWRtaW5fZXh0ZW5kX2JvdW50eV90dGwAAAAAAQAAAAAAAAAJYm91bnR5X2lkAAAAAAAAEAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAZYWRtaW5fZXh0ZW5kX2luc3RhbmNlX3R0bAAAAAAAAAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAdYWRtaW5fZXh0ZW5kX3dpbm5lcl9hd2FyZF90dGwAAAAAAAACAAAAAAAAAAlib3VudHlfaWQAAAAAAAAQAAAAAAAAAAZ3aW5uZXIAAAAAABMAAAABAAAD6QAAAAIAAAAD"]),
      options
    )
  }
  public readonly fromJSON = {
    get_bounty: this.txFromJSON<Result<Bounty>>,
    claim_reward: this.txFromJSON<Result<void>>,
    cancel_bounty: this.txFromJSON<Result<void>>,
    create_bounty: this.txFromJSON<Result<void>>,
    select_winner: this.txFromJSON<Result<void>>,
    get_winner_award: this.txFromJSON<Option<WinnerAward>>,
    admin_extend_bounty_ttl: this.txFromJSON<Result<void>>,
    admin_extend_instance_ttl: this.txFromJSON<Result<void>>,
    admin_extend_winner_award_ttl: this.txFromJSON<Result<void>>
  }
}