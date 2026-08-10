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
  200: {message:"NonExistentToken"},
  201: {message:"IncorrectOwner"},
  202: {message:"InsufficientApproval"},
  203: {message:"InvalidApprover"},
  204: {message:"InvalidLiveUntilLedger"},
  205: {message:"MathOverflow"},
  206: {message:"TokenIDsAreDepleted"},
  207: {message:"InvalidAmount"},
  208: {message:"TokenNotFoundInOwnerList"},
  209: {message:"TokenNotFoundInGlobalList"},
  210: {message:"UnsetMetadata"},
  211: {message:"BaseUriMaxLenExceeded"},
  212: {message:"InvalidRoyaltyAmount"},
  213: {message:"NameMaxLenExceeded"},
  214: {message:"SymbolMaxLenExceeded"},
  300: {message:"NotInitialized"},
  301: {message:"AlreadyInitialized"},
  302: {message:"InvalidCopies"},
  303: {message:"SelfTransfer"},
  304: {message:"ListingNotFound"},
  305: {message:"ListingNotActive"},
  306: {message:"NoCopiesAvailable"},
  307: {message:"InsufficientPayment"},
  308: {message:"Paused"},
  309: {message:"InvalidTokenUri"},
  310: {message:"InvalidDescription"},
  311: {message:"InvalidFee"},
  312: {message:"InsufficientBalance"},
  313: {message:"SelfPurchase"}
}


export type DataKey = {tag: "Admin", values: void} | {tag: "PaymentToken", values: void} | {tag: "Name", values: void} | {tag: "Symbol", values: void} | {tag: "NextTokenId", values: void} | {tag: "TokenOwner", values: readonly [u32]} | {tag: "TokenUri", values: readonly [u32]} | {tag: "TokenApproval", values: readonly [u32]} | {tag: "OperatorApproval", values: readonly [string, string]} | {tag: "Balance", values: readonly [string]} | {tag: "TokenBalance", values: readonly [u32, string]} | {tag: "Listing", values: readonly [u32, string]} | {tag: "ListingSellers", values: readonly [u32]} | {tag: "TokenMetadata", values: readonly [u32]} | {tag: "Paused", values: void} | {tag: "PlatformFeeBps", values: void} | {tag: "Treasury", values: void};


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
  royalty_bps: u32;
  thumbnail: string;
}



export interface Client {
  /**
   * Construct and simulate a buy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buys `quantity` copies of `token_id`. Storage is fully updated
   * (checks-effects) before any external token transfer (interactions),
   * so a non-standard/malicious `payment_token` contract can't reenter
   * this call and observe or exploit stale listing/balance state.
   */
  buy: ({buyer, seller, token_id, quantity}: {buyer: string, seller: string, token_id: u32, quantity: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint: ({creator, name, description, thumbnail, content_url, media_type, copies, price, royalty_bps}: {creator: string, name: string, description: string, thumbnail: string, content_url: string, media_type: string, copies: u32, price: i128, royalty_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Emergency circuit breaker: blocks `mint`, `list_for_sale`, and `buy`
   * while paused. Ownership transfer/approval and listing cancellation
   * stay available so users can still self-serve out of an incident.
   */
  pause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve: ({approver, approved, token_id, live_until_ledger}: {approver: string, approved: string, token_id: u32, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a owner_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  owner_of: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer: ({from, to, token_id}: {from: string, to: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a token_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token_uri: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_listing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_listing: ({token_id, seller}: {token_id: u32, seller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Listing>>>

  /**
   * Construct and simulate a get_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_approved: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_listings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Every active listing for a token_id, one per seller who currently has
   * copies up for sale. This is what buyers browse to pick who to buy from.
   */
  get_listings: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Listing>>>

  /**
   * Construct and simulate a get_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_treasury: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_treasury: ({new_treasury}: {new_treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a list_for_sale transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_for_sale: ({seller, token_id, price, copies}: {seller: string, token_id: u32, price: i128, copies: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_from: ({spender, from, to, token_id}: {spender: string, from: string, to: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_listing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_listing: ({seller, token_id}: {seller: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a approve_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_for_all: ({owner, operator, live_until_ledger}: {owner: string, operator: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_platform_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_platform_fee: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_platform_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_platform_fee: ({fee_bps}: {fee_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a token_balance_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * How many copies of `token_id` a specific address currently holds.
   */
  token_balance_of: ({token_id, owner}: {token_id: u32, owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_payment_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_payment_token: ({new_token}: {new_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_token_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_token_metadata: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<TokenMetadata>>>

  /**
   * Construct and simulate a is_approved_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_approved_for_all: ({owner, operator}: {owner: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a admin_extend_instance_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_extend_instance_ttl: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, payment_token, name, symbol}: {admin: string, payment_token: string, name: string, symbol: string},
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
    return ContractClient.deploy({admin, payment_token, name, symbol}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABQAAAAAAAAAAAAAABE1pbnQAAAABAAAABG1pbnQAAAADAAAAAAAAAANzeW0AAAAAEQAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAHQAAAAAAAAAQTm9uRXhpc3RlbnRUb2tlbgAAAMgAAAAAAAAADkluY29ycmVjdE93bmVyAAAAAADJAAAAAAAAABRJbnN1ZmZpY2llbnRBcHByb3ZhbAAAAMoAAAAAAAAAD0ludmFsaWRBcHByb3ZlcgAAAADLAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAADMAAAAAAAAAAxNYXRoT3ZlcmZsb3cAAADNAAAAAAAAABNUb2tlbklEc0FyZURlcGxldGVkAAAAAM4AAAAAAAAADUludmFsaWRBbW91bnQAAAAAAADPAAAAAAAAABhUb2tlbk5vdEZvdW5kSW5Pd25lckxpc3QAAADQAAAAAAAAABlUb2tlbk5vdEZvdW5kSW5HbG9iYWxMaXN0AAAAAAAA0QAAAAAAAAANVW5zZXRNZXRhZGF0YQAAAAAAANIAAAAAAAAAFUJhc2VVcmlNYXhMZW5FeGNlZWRlZAAAAAAAANMAAAAAAAAAFEludmFsaWRSb3lhbHR5QW1vdW50AAAA1AAAAAAAAAASTmFtZU1heExlbkV4Y2VlZGVkAAAAAADVAAAAAAAAABRTeW1ib2xNYXhMZW5FeGNlZWRlZAAAANYAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAEsAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAS0AAAAAAAAADUludmFsaWRDb3BpZXMAAAAAAAEuAAAAAAAAAAxTZWxmVHJhbnNmZXIAAAEvAAAAAAAAAA9MaXN0aW5nTm90Rm91bmQAAAABMAAAAAAAAAAQTGlzdGluZ05vdEFjdGl2ZQAAATEAAAAAAAAAEU5vQ29waWVzQXZhaWxhYmxlAAAAAAABMgAAAAAAAAATSW5zdWZmaWNpZW50UGF5bWVudAAAAAEzAAAAAAAAAAZQYXVzZWQAAAAAATQAAAAAAAAAD0ludmFsaWRUb2tlblVyaQAAAAE1AAAAAAAAABJJbnZhbGlkRGVzY3JpcHRpb24AAAAAATYAAAAAAAAACkludmFsaWRGZWUAAAAAATcAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAABOAAAAAAAAAAMU2VsZlB1cmNoYXNlAAABOQ==",
        "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",
        "AAAABQAAAAAAAAAAAAAAEExpc3RpbmdDYW5jZWxsZWQAAAABAAAAEWxpc3RpbmdfY2FuY2VsbGVkAAAAAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAQAAAAI=",
        "AAAAAAAAAQNCdXlzIGBxdWFudGl0eWAgY29waWVzIG9mIGB0b2tlbl9pZGAuIFN0b3JhZ2UgaXMgZnVsbHkgdXBkYXRlZAooY2hlY2tzLWVmZmVjdHMpIGJlZm9yZSBhbnkgZXh0ZXJuYWwgdG9rZW4gdHJhbnNmZXIgKGludGVyYWN0aW9ucyksCnNvIGEgbm9uLXN0YW5kYXJkL21hbGljaW91cyBgcGF5bWVudF90b2tlbmAgY29udHJhY3QgY2FuJ3QgcmVlbnRlcgp0aGlzIGNhbGwgYW5kIG9ic2VydmUgb3IgZXhwbG9pdCBzdGFsZSBsaXN0aW5nL2JhbGFuY2Ugc3RhdGUuAAAAAANidXkAAAAABAAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAIcXVhbnRpdHkAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAEbWludAAAAAkAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAEbmFtZQAAABAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAACXRodW1ibmFpbAAAAAAAABAAAAAAAAAAC2NvbnRlbnRfdXJsAAAAABAAAAAAAAAACm1lZGlhX3R5cGUAAAAAABAAAAAAAAAABmNvcGllcwAAAAAABAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAtyb3lhbHR5X2JwcwAAAAAEAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==",
        "AAAAAAAAAMhFbWVyZ2VuY3kgY2lyY3VpdCBicmVha2VyOiBibG9ja3MgYG1pbnRgLCBgbGlzdF9mb3Jfc2FsZWAsIGFuZCBgYnV5YAp3aGlsZSBwYXVzZWQuIE93bmVyc2hpcCB0cmFuc2Zlci9hcHByb3ZhbCBhbmQgbGlzdGluZyBjYW5jZWxsYXRpb24Kc3RheSBhdmFpbGFibGUgc28gdXNlcnMgY2FuIHN0aWxsIHNlbGYtc2VydmUgb3V0IG9mIGFuIGluY2lkZW50LgAAAAVwYXVzZQAAAAAAAAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAAhhcHByb3ZlcgAAABMAAAAAAAAACGFwcHJvdmVkAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAABA==",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAAAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIb3duZXJfb2YAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAJdG9rZW5fdXJpAAAAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAA+kAAAAQAAAAAw==",
        "AAAAAAAAAAAAAAALZ2V0X2xpc3RpbmcAAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAAZzZWxsZXIAAAAAABMAAAABAAAD6QAAB9AAAAAHTGlzdGluZwAAAAAD",
        "AAAAAAAAAAAAAAAMZ2V0X2FwcHJvdmVkAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAA+gAAAAT",
        "AAAAAAAAAI1FdmVyeSBhY3RpdmUgbGlzdGluZyBmb3IgYSB0b2tlbl9pZCwgb25lIHBlciBzZWxsZXIgd2hvIGN1cnJlbnRseSBoYXMKY29waWVzIHVwIGZvciBzYWxlLiBUaGlzIGlzIHdoYXQgYnV5ZXJzIGJyb3dzZSB0byBwaWNrIHdobyB0byBidXkgZnJvbS4AAAAAAAAMZ2V0X2xpc3RpbmdzAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAA+oAAAfQAAAAB0xpc3RpbmcA",
        "AAAAAAAAAAAAAAAMZ2V0X3RyZWFzdXJ5AAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAMc2V0X3RyZWFzdXJ5AAAAAQAAAAAAAAAMbmV3X3RyZWFzdXJ5AAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABMAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABAAAAAA",
        "AAAAAAAAAAAAAAANbGlzdF9mb3Jfc2FsZQAAAAAAAAQAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAABmNvcGllcwAAAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAOY2FuY2VsX2xpc3RpbmcAAAAAAAIAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAQZ2V0X3BsYXRmb3JtX2ZlZQAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAAQc2V0X3BsYXRmb3JtX2ZlZQAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAEFIb3cgbWFueSBjb3BpZXMgb2YgYHRva2VuX2lkYCBhIHNwZWNpZmljIGFkZHJlc3MgY3VycmVudGx5IGhvbGRzLgAAAAAAABB0b2tlbl9iYWxhbmNlX29mAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAABA==",
        "AAAAAAAAAAAAAAARc2V0X3BheW1lbnRfdG9rZW4AAAAAAAABAAAAAAAAAAluZXdfdG9rZW4AAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAASZ2V0X3Rva2VuX21ldGFkYXRhAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6QAAB9AAAAANVG9rZW5NZXRhZGF0YQAAAAAAAAM=",
        "AAAAAAAAAAAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAAZYWRtaW5fZXh0ZW5kX2luc3RhbmNlX3R0bAAAAAAAAAAAAAABAAAD6QAAAAIAAAAD" ]),
      options
    )
  }
  public readonly fromJSON = {
    buy: this.txFromJSON<Result<void>>,
        mint: this.txFromJSON<Result<u32>>,
        name: this.txFromJSON<string>,
        pause: this.txFromJSON<Result<void>>,
        symbol: this.txFromJSON<string>,
        approve: this.txFromJSON<Result<void>>,
        balance: this.txFromJSON<u32>,
        unpause: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<null>,
        version: this.txFromJSON<u32>,
        owner_of: this.txFromJSON<Result<string>>,
        transfer: this.txFromJSON<Result<void>>,
        is_paused: this.txFromJSON<boolean>,
        token_uri: this.txFromJSON<Result<string>>,
        get_listing: this.txFromJSON<Result<Listing>>,
        get_approved: this.txFromJSON<Option<string>>,
        get_listings: this.txFromJSON<Array<Listing>>,
        get_treasury: this.txFromJSON<string>,
        set_treasury: this.txFromJSON<Result<void>>,
        list_for_sale: this.txFromJSON<Result<void>>,
        transfer_from: this.txFromJSON<Result<void>>,
        cancel_listing: this.txFromJSON<Result<void>>,
        approve_for_all: this.txFromJSON<Result<void>>,
        get_platform_fee: this.txFromJSON<u32>,
        set_platform_fee: this.txFromJSON<Result<void>>,
        token_balance_of: this.txFromJSON<u32>,
        set_payment_token: this.txFromJSON<Result<void>>,
        get_token_metadata: this.txFromJSON<Result<TokenMetadata>>,
        is_approved_for_all: this.txFromJSON<boolean>,
        admin_extend_instance_ttl: this.txFromJSON<Result<void>>
  }
}