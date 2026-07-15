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
  u64,
  i128,
  Option,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidAmount"},
  2: {message:"InvalidMaxWinners"},
  3: {message:"BountyAlreadyExists"},
  4: {message:"BountyNotFound"},
  5: {message:"BountyNotFunded"},
  6: {message:"MaxWinnersReached"},
  7: {message:"InsufficientRemainingBalance"},
  8: {message:"WinnerAlreadySelected"},
  9: {message:"WinnerAwardNotFound"},
  10: {message:"AlreadyClaimed"},
  11: {message:"AlreadyCancelled"},
  12: {message:"Unauthorized"},
  13: {message:"CreatorCannotBeWinner"}
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

export type DataKey = {tag: "Admin", values: void} | {tag: "NativeToken", values: void} | {tag: "Bounty", values: readonly [u64]} | {tag: "WinnerAward", values: readonly [u64, string]};


export interface WinnerAward {
  amount: i128;
  claimed: boolean;
}

export type BountyStatus = {tag: "Funded", values: void} | {tag: "Cancelled", values: void};





export interface Client {
  /**
   * Construct and simulate a get_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty: ({bounty_id}: {bounty_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Bounty>>>

  /**
   * Construct and simulate a claim_reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Winner pulls their committed award.
   */
  claim_reward: ({bounty_id, winner}: {bounty_id: u64, winner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator cancels the bounty, reclaiming any unassigned escrow.
   * Awards already selected (claimed or not) are unaffected.
   */
  cancel_bounty: ({caller, bounty_id}: {caller: string, bounty_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator deposits `amount` of `token` into escrow for `bounty_id`.
   * Requires admin co-authorization so only the platform can assign IDs.
   */
  create_bounty: ({bounty_id, creator, token, amount, max_winners}: {bounty_id: u64, creator: string, token: string, amount: i128, max_winners: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a select_winner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator commits `amount` of the remaining escrow to `winner`. The
   * award is claimable by `winner` via `claim_reward`, but not paid out yet.
   */
  select_winner: ({caller, bounty_id, winner, amount}: {caller: string, bounty_id: u64, winner: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_winner_award transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_winner_award: ({bounty_id, winner}: {bounty_id: u64, winner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<WinnerAward>>>

  /**
   * Construct and simulate a admin_extend_bounty_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin-only: extend the TTL of a bounty entry. Callable at any time to
   * keep inactive bounties alive. Requires the platform admin signature.
   */
  admin_extend_bounty_ttl: ({bounty_id}: {bounty_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a admin_extend_instance_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin-only: extend the TTL of the contract instance (admin, native_token,
   * and the contract code). This keeps the whole contract callable.
   */
  admin_extend_instance_ttl: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a admin_extend_winner_award_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin-only: extend the TTL of a winner award entry.
   */
  admin_extend_winner_award_ttl: ({bounty_id, winner}: {bounty_id: u64, winner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAEAAAAAAAAAEUludmFsaWRNYXhXaW5uZXJzAAAAAAAAAgAAAAAAAAATQm91bnR5QWxyZWFkeUV4aXN0cwAAAAADAAAAAAAAAA5Cb3VudHlOb3RGb3VuZAAAAAAABAAAAAAAAAAPQm91bnR5Tm90RnVuZGVkAAAAAAUAAAAAAAAAEU1heFdpbm5lcnNSZWFjaGVkAAAAAAAABgAAAAAAAAAcSW5zdWZmaWNpZW50UmVtYWluaW5nQmFsYW5jZQAAAAcAAAAAAAAAFVdpbm5lckFscmVhZHlTZWxlY3RlZAAAAAAAAAgAAAAAAAAAE1dpbm5lckF3YXJkTm90Rm91bmQAAAAACQAAAAAAAAAOQWxyZWFkeUNsYWltZWQAAAAAAAoAAAAAAAAAEEFscmVhZHlDYW5jZWxsZWQAAAALAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAMAAAAAAAAABVDcmVhdG9yQ2Fubm90QmVXaW5uZXIAAAAAAAAN",
        "AAAAAQAAAAAAAAAAAAAABkJvdW50eQAAAAAABwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAttYXhfd2lubmVycwAAAAAEAAAAAAAAAAlyZW1haW5pbmcAAAAAAAALAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMQm91bnR5U3RhdHVzAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADHRvdGFsX2Ftb3VudAAAAAsAAAAAAAAAEHdpbm5lcnNfc2VsZWN0ZWQAAAAE",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALTmF0aXZlVG9rZW4AAAAAAQAAAAAAAAAGQm91bnR5AAAAAAABAAAABgAAAAEAAAAAAAAAC1dpbm5lckF3YXJkAAAAAAIAAAAGAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAC1dpbm5lckF3YXJkAAAAAAIAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAHY2xhaW1lZAAAAAAB",
        "AAAAAgAAAAAAAAAAAAAADEJvdW50eVN0YXR1cwAAAAIAAAAAAAAAAAAAAAZGdW5kZWQAAAAAAAAAAAAAAAAACUNhbmNlbGxlZAAAAA==",
        "AAAAAAAAAAAAAAAKZ2V0X2JvdW50eQAAAAAAAQAAAAAAAAAJYm91bnR5X2lkAAAAAAAABgAAAAEAAAPpAAAH0AAAAAZCb3VudHkAAAAAAAM=",
        "AAAAAAAAACNXaW5uZXIgcHVsbHMgdGhlaXIgY29tbWl0dGVkIGF3YXJkLgAAAAAMY2xhaW1fcmV3YXJkAAAAAgAAAAAAAAAJYm91bnR5X2lkAAAAAAAABgAAAAAAAAAGd2lubmVyAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAP9SdW5zIG9uY2UgYXQgZGVwbG95IHRpbWUuIGBhZG1pbmAgaXMgdGhlIHBsYXRmb3JtIGFjY291bnQgdGhhdCBtdXN0CmNvLXNpZ24gZXZlcnkgYGNyZWF0ZV9ib3VudHlgIGNhbGwgKHByZXZlbnRzIGV4dGVybmFsIElEIHNxdWF0dGluZykuCmBuYXRpdmVfdG9rZW5gIGlzIHRoZSBuYXRpdmUgWExNIFNBQyBhZGRyZXNzIHNvIGBjbGFpbV9yZXdhcmRgIGNhbgpza2lwIHRoZSByZWR1bmRhbnQgYHRydXN0KClgIGNhbGwgZm9yIFhMTSBib3VudGllcy4AAAAADV9fY29uc3RydWN0b3IAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAADG5hdGl2ZV90b2tlbgAAABMAAAAA",
        "AAAAAAAAAHZDcmVhdG9yIGNhbmNlbHMgdGhlIGJvdW50eSwgcmVjbGFpbWluZyBhbnkgdW5hc3NpZ25lZCBlc2Nyb3cuCkF3YXJkcyBhbHJlYWR5IHNlbGVjdGVkIChjbGFpbWVkIG9yIG5vdCkgYXJlIHVuYWZmZWN0ZWQuAAAAAAANY2FuY2VsX2JvdW50eQAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJYm91bnR5X2lkAAAAAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAIZDcmVhdG9yIGRlcG9zaXRzIGBhbW91bnRgIG9mIGB0b2tlbmAgaW50byBlc2Nyb3cgZm9yIGBib3VudHlfaWRgLgpSZXF1aXJlcyBhZG1pbiBjby1hdXRob3JpemF0aW9uIHNvIG9ubHkgdGhlIHBsYXRmb3JtIGNhbiBhc3NpZ24gSURzLgAAAAAADWNyZWF0ZV9ib3VudHkAAAAAAAAFAAAAAAAAAAlib3VudHlfaWQAAAAAAAAGAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAttYXhfd2lubmVycwAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAIpDcmVhdG9yIGNvbW1pdHMgYGFtb3VudGAgb2YgdGhlIHJlbWFpbmluZyBlc2Nyb3cgdG8gYHdpbm5lcmAuIFRoZQphd2FyZCBpcyBjbGFpbWFibGUgYnkgYHdpbm5lcmAgdmlhIGBjbGFpbV9yZXdhcmRgLCBidXQgbm90IHBhaWQgb3V0IHlldC4AAAAAAA1zZWxlY3Rfd2lubmVyAAAAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAlib3VudHlfaWQAAAAAAAAGAAAAAAAAAAZ3aW5uZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAQZ2V0X3dpbm5lcl9hd2FyZAAAAAIAAAAAAAAACWJvdW50eV9pZAAAAAAAAAYAAAAAAAAABndpbm5lcgAAAAAAEwAAAAEAAAPoAAAH0AAAAAtXaW5uZXJBd2FyZAA=",
        "AAAAAAAAAIpBZG1pbi1vbmx5OiBleHRlbmQgdGhlIFRUTCBvZiBhIGJvdW50eSBlbnRyeS4gQ2FsbGFibGUgYXQgYW55IHRpbWUgdG8Ka2VlcCBpbmFjdGl2ZSBib3VudGllcyBhbGl2ZS4gUmVxdWlyZXMgdGhlIHBsYXRmb3JtIGFkbWluIHNpZ25hdHVyZS4AAAAAABdhZG1pbl9leHRlbmRfYm91bnR5X3R0bAAAAAABAAAAAAAAAAlib3VudHlfaWQAAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAIlBZG1pbi1vbmx5OiBleHRlbmQgdGhlIFRUTCBvZiB0aGUgY29udHJhY3QgaW5zdGFuY2UgKGFkbWluLCBuYXRpdmVfdG9rZW4sCmFuZCB0aGUgY29udHJhY3QgY29kZSkuIFRoaXMga2VlcHMgdGhlIHdob2xlIGNvbnRyYWN0IGNhbGxhYmxlLgAAAAAAABlhZG1pbl9leHRlbmRfaW5zdGFuY2VfdHRsAAAAAAAAAAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAADNBZG1pbi1vbmx5OiBleHRlbmQgdGhlIFRUTCBvZiBhIHdpbm5lciBhd2FyZCBlbnRyeS4AAAAAHWFkbWluX2V4dGVuZF93aW5uZXJfYXdhcmRfdHRsAAAAAAAAAgAAAAAAAAAJYm91bnR5X2lkAAAAAAAABgAAAAAAAAAGd2lubmVyAAAAAAATAAAAAQAAA+kAAAACAAAAAw==" ]),
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