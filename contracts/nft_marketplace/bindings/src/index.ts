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


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDVRK7PYX6E2EKV2FM333MSJ4PL6IXYUPRICAB6C4ZAGTBV72PJA62IS",
  }
} as const


export const Errors = {
  1: { message: "NotInitialized" },
  2: { message: "AlreadyInitialized" },
  3: { message: "InvalidAmount" },
  4: { message: "InvalidCopies" },
  5: { message: "TokenNotFound" },
  6: { message: "NotOwner" },
  7: { message: "NotApproved" },
  8: { message: "SelfTransfer" },
  9: { message: "ListingNotFound" },
  10: { message: "ListingNotActive" },
  11: { message: "NoCopiesAvailable" },
  12: { message: "InsufficientPayment" },
  13: { message: "Unauthorized" },
  14: { message: "ApprovalExpired" },
  16: { message: "InvalidTokenUri" },
  17: { message: "InvalidName" }
}


export type DataKey = { tag: "Admin", values: void } | { tag: "PaymentToken", values: void } | { tag: "Name", values: void } | { tag: "Symbol", values: void } | { tag: "NextTokenId", values: void } | { tag: "TokenOwner", values: readonly [u128] } | { tag: "TokenUri", values: readonly [u128] } | { tag: "TokenApproval", values: readonly [u128] } | { tag: "OperatorApproval", values: readonly [string, string] } | { tag: "Balance", values: readonly [string] } | { tag: "Listing", values: readonly [u128] } | { tag: "TokenMetadata", values: readonly [u128] };


export interface Listing {
  available_copies: u32;
  is_active: boolean;
  payment_token: string;
  price: i128;
  seller: string;
  total_copies: u32;
}



export interface Approval {
  approved: string;
  live_until_ledger: u32;
}




export interface TokenMetadata {
  content_url: string;
  creator: string;
  description: string;
  media_type: string;
  name: string;
  thumbnail: string;
}



export interface Client {
  /**
   * Construct and simulate a buy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  buy: ({ buyer, token_id, quantity }: { buyer: string, token_id: u128, quantity: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint: ({ creator, name, description, thumbnail, content_url, media_type, copies, price }: { creator: string, name: string, description: string, thumbnail: string, content_url: string, media_type: string, copies: u32, price: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u128>>>

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve: ({ approver, approved, token_id, live_until_ledger }: { approver: string, approved: string, token_id: u128, live_until_ledger: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: ({ owner }: { owner: string }, options?: MethodOptions) => Promise<AssembledTransaction<u128>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({ new_wasm_hash }: { new_wasm_hash: Buffer }, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a owner_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  owner_of: ({ token_id }: { token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer: ({ from, to, token_id }: { from: string, to: string, token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a token_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token_uri: ({ token_id }: { token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_listing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_listing: ({ token_id }: { token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Listing>>>

  /**
   * Construct and simulate a get_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_approved: ({ token_id }: { token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a list_for_sale transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_for_sale: ({ seller, token_id, price, copies }: { seller: string, token_id: u128, price: i128, copies: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_from: ({ spender, from, to, token_id }: { spender: string, from: string, to: string, token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_listing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_listing: ({ seller, token_id }: { seller: string, token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a approve_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_for_all: ({ owner, operator, live_until_ledger }: { owner: string, operator: string, live_until_ledger: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_payment_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_payment_token: ({ new_token }: { new_token: string }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_token_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_token_metadata: ({ token_id }: { token_id: u128 }, options?: MethodOptions) => Promise<AssembledTransaction<Result<TokenMetadata>>>

  /**
   * Construct and simulate a is_approved_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_approved_for_all: ({ owner, operator }: { owner: string, operator: string }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a admin_extend_instance_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_extend_instance_ttl: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, payment_token, name, symbol }: { admin: string, payment_token: string, name: string, symbol: string },
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
    return ContractClient.deploy({ admin, payment_token, name, symbol }, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "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",
        "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==",
        "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAAhhcHByb3ZlcgAAABMAAAAAAAAACGFwcHJvdmVkAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAKAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAACg==",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIb3duZXJfb2YAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAoAAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAACgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAJdG9rZW5fdXJpAAAAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAKAAAAAQAAA+kAAAAQAAAAAw==",
        "AAAAAAAAAAAAAAALZ2V0X2xpc3RpbmcAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAKAAAAAQAAA+kAAAfQAAAAB0xpc3RpbmcAAAAAAw==",
        "AAAAAAAAAAAAAAAMZ2V0X2FwcHJvdmVkAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAKAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABMAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABAAAAAA",
        "AAAAAAAAAAAAAAANbGlzdF9mb3Jfc2FsZQAAAAAAAAQAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAKAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAABmNvcGllcwAAAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAAAoAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAOY2FuY2VsX2xpc3RpbmcAAAAAAAIAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAKAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAARc2V0X3BheW1lbnRfdG9rZW4AAAAAAAABAAAAAAAAAAluZXdfdG9rZW4AAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAASZ2V0X3Rva2VuX21ldGFkYXRhAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAoAAAABAAAD6QAAB9AAAAANVG9rZW5NZXRhZGF0YQAAAAAAAAM=",
        "AAAAAAAAAAAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAAZYWRtaW5fZXh0ZW5kX2luc3RhbmNlX3R0bAAAAAAAAAAAAAABAAAD6QAAAAIAAAAD"
      ]),
      options
    )
  }
  public readonly fromJSON = {
    buy: this.txFromJSON<Result<void>>,
    mint: this.txFromJSON<Result<u128>>,
    name: this.txFromJSON<string>,
    symbol: this.txFromJSON<string>,
    approve: this.txFromJSON<Result<void>>,
    balance: this.txFromJSON<u128>,
    upgrade: this.txFromJSON<null>,
    version: this.txFromJSON<u32>,
    owner_of: this.txFromJSON<Result<string>>,
    transfer: this.txFromJSON<Result<void>>,
    token_uri: this.txFromJSON<Result<string>>,
    get_listing: this.txFromJSON<Result<Listing>>,
    get_approved: this.txFromJSON<Option<string>>,
    list_for_sale: this.txFromJSON<Result<void>>,
    transfer_from: this.txFromJSON<Result<void>>,
    cancel_listing: this.txFromJSON<Result<void>>,
    approve_for_all: this.txFromJSON<Result<void>>,
    set_payment_token: this.txFromJSON<Result<void>>,
    get_token_metadata: this.txFromJSON<Result<TokenMetadata>>,
    is_approved_for_all: this.txFromJSON<boolean>,
    admin_extend_instance_ttl: this.txFromJSON<Result<void>>
  }
}