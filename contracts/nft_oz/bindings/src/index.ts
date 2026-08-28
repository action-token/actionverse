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






/**
 * Off-chain-media descriptor returned by [`ArtNft::art_meta`] for a single
 * token — synthesized from that token's edition, not stored per-token.
 * No royalty bps — [`ArtNft::royalty_info`] is the single source of truth.
 */
export interface ArtMeta {
  creator: string;
  description: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string;
  title: string;
}


/**
 * At most one listing per token. Secondary market only — a primary sale is
 * priced via `EditionPrices`. A reseller sets their own currencies, not
 * whatever the creator originally offered.
 */
export interface Listing {
  prices: Array<PriceEntry>;
  seller: string;
}

export const ArtError = {
  300: {message:"InvalidAmount"},
  301: {message:"InvalidFee"},
  302: {message:"InvalidRoyalty"},
  303: {message:"NameTooLong"},
  304: {message:"DescriptionTooLong"},
  305: {message:"InvalidUri"},
  306: {message:"ListingNotFound"},
  307: {message:"SelfPurchase"},
  308: {message:"NotSeller"},
  /**
   * The listing's seller no longer owns the token — it was transferred
   * out from under the listing.
   */
  309: {message:"ListingStale"},
  /**
   * This `edition_ref` already registered an edition — guards against
   * double-registering the same off-chain record.
   */
  311: {message:"DuplicateRef"},
  312: {message:"RefTooLong"},
  313: {message:"InvalidSupply"},
  /**
   * An edition's price grid is empty or has more currencies than
   * `MAX_PRICE_ENTRIES`.
   */
  314: {message:"TooManyPriceEntries"},
  315: {message:"DuplicatePaymentToken"},
  316: {message:"InvalidPrice"},
  /**
   * `payment_token` isn't one of the currencies this edition is priced in.
   */
  317: {message:"PaymentTokenNotAccepted"},
  /**
   * This purchase would mint more copies than the edition has left.
   */
  318: {message:"SupplyExhausted"},
  /**
   * `quantity` is 0 or exceeds `MAX_QUANTITY_PER_BUY`.
   */
  319: {message:"QuantityTooLarge"},
  320: {message:"EditionNotFound"},
  /**
   * This `purchase_ref` was already used — guards against double-applying
   * the same purchase attempt.
   */
  321: {message:"DuplicatePurchaseRef"},
  322: {message:"PurchaseRefTooLong"},
  /**
   * The caller of `unlock_item_for` isn't the registered unlock
   * authority (or none has been set yet).
   */
  323: {message:"NotUnlockAuthority"},
  /**
   * The caller of `register_edition`/`update_edition` isn't the
   * registered price authority.
   * 
   * Also raised when no authority is set at all, which since v11 can
   * only happen on a contract *upgraded* from a build predating the
   * key — `__constructor` sets it, but a constructor never runs on an
   * upgrade, so that one case still needs a `set_price_authority` call.
   */
  324: {message:"NotPriceAuthority"},
  /**
   * `keep_alive` was given more edition or token ids than
   * `MAX_KEEP_ALIVE_IDS` in one call.
   */
  325: {message:"TooManyKeepAliveIds"}
}



/**
 * One accepted currency and its price for one copy of an edition.
 */
export interface PriceEntry {
  /**
 * SEP-41 token address (the native XLM SAC, the platform asset's SAC,
 * or any other Stellar Asset Contract added later).
 */
payment_token: string;
  price: i128;
}


/**
 * A creator's submission: bounded artwork with a fixed supply, minted
 * lazily as copies sell rather than up front.
 */
export interface EditionMeta {
  creator: string;
  description: string;
  media_type: string;
  /**
 * The locked/gated content — visible to the storefront, but only
 * meaningful once a copy is owned.
 */
media_url: string;
  /**
 * Copies minted so far, always `<= supply`.
 */
minted: u32;
  royalty_bps: u32;
  /**
 * Total copies this edition will ever mint.
 */
supply: u32;
  thumbnail_url: string;
  title: string;
}


/**
 * Fields for a new edition. Grouped into one argument to stay under
 * Soroban's 10-parameter-per-function cap.
 */
export interface EditionInput {
  creator: string;
  description: string;
  media_type: string;
  media_url: string;
  prices: Array<PriceEntry>;
  royalty_bps: u32;
  supply: u32;
  thumbnail_url: string;
  title: string;
}


/**
 * What a buyer will actually be charged, broken out so the UI can show the
 * split before asking for a signature.
 */
export interface SaleBreakdown {
  platform_fee: i128;
  royalty: i128;
  royalty_receiver: string;
  seller_amount: i128;
  total: i128;
}





/**
 * What one `buy_edition` call minted. Recorded because the return value
 * can't be read back — see [`ArtNft::buy_edition`].
 */
export interface PurchaseReceipt {
  buyer: string;
  edition_id: u32;
  first_token_id: u32;
  last_token_id: u32;
  payment_token: string;
  quantity: u32;
  unit_price: i128;
}




export const RoleTransferError = {
  2200: {message:"NoPendingTransfer"},
  2201: {message:"InvalidLiveUntilLedger"},
  2202: {message:"InvalidPendingAccount"},
  2203: {message:"TransferExpired"}
}

export const OwnableError = {
  2100: {message:"OwnerNotSet"},
  2101: {message:"TransferInProgress"},
  2102: {message:"OwnerAlreadySet"}
}






export const PausableError = {
  /**
   * The operation failed because the contract is paused.
   */
  1000: {message:"EnforcedPause"},
  /**
   * The operation failed because the contract is not paused.
   */
  1001: {message:"ExpectedPause"}
}




export const NonFungibleTokenError = {
  /**
   * Indicates a non-existent `token_id`.
   */
  200: {message:"NonExistentToken"},
  /**
   * Indicates an error related to the ownership over a particular token.
   * Used in transfers.
   */
  201: {message:"IncorrectOwner"},
  /**
   * Indicates a failure with the `operator`s approval. Used in transfers.
   */
  202: {message:"InsufficientApproval"},
  /**
   * Indicates a failure with the `approver` of a token to be approved. Used
   * in approvals.
   */
  203: {message:"InvalidApprover"},
  /**
   * Indicates an invalid value for `live_until_ledger` when setting
   * approvals.
   */
  204: {message:"InvalidLiveUntilLedger"},
  /**
   * Indicates overflow when adding two values
   */
  205: {message:"MathOverflow"},
  /**
   * Indicates all possible `token_id`s are already in use.
   */
  206: {message:"TokenIDsAreDepleted"},
  /**
   * Indicates an invalid amount to batch mint in `consecutive` extension.
   */
  207: {message:"InvalidAmount"},
  /**
   * Indicates the token does not exist in owner's list.
   */
  208: {message:"TokenNotFoundInOwnerList"},
  /**
   * Indicates the token does not exist in global list.
   */
  209: {message:"TokenNotFoundInGlobalList"},
  /**
   * Indicates access to unset metadata.
   */
  210: {message:"UnsetMetadata"},
  /**
   * Indicates the length of the base URI exceeds the maximum allowed.
   */
  211: {message:"BaseUriMaxLenExceeded"},
  /**
   * Indicates the royalty amount is higher than 10_000 (100%) basis points.
   */
  212: {message:"InvalidRoyaltyAmount"},
  /**
   * Indicates the length of the name exceeds the maximum allowed.
   */
  213: {message:"NameMaxLenExceeded"},
  /**
   * Indicates the length of the symbol exceeds the maximum allowed.
   */
  214: {message:"SymbolMaxLenExceeded"}
}


export interface Client {
  /**
   * Construct and simulate a buy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buys a listed (already-minted) token in a single invocation: payment
   * out, token in. `payment_token` selects which of the listing's prices
   * to pay — must be one the seller actually offered.
   * 
   * Only the buyer signs. The seller's consent was given when they created
   * the listing, and the token moves via [`Consecutive::update`] (the
   * low-level, no-auth path) rather than a full `transfer`, which would
   * demand the seller's signature at purchase time.
   */
  buy: ({buyer, token_id, payment_token, inclusion_fee, network_fee}: {buyer: string, token_id: u32, payment_token: string, inclusion_fee: i128, network_fee: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a list transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Lists the caller's token for sale in one or more currencies, same
   * shape as an edition's own price grid — a reseller isn't limited to
   * whichever currencies the creator originally offered. Listing does not
   * escrow the token — the owner keeps it and can still transfer it,
   * which is why `buy` re-checks ownership rather than trusting the
   * stored seller.
   */
  list: ({seller, token_id, prices}: {seller: string, token_id: u32, prices: Array<PriceEntry>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the token collection name.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Emergency stop for `buy_edition`, `list`, `buy`, and
   * `unlock_token_for`. Transfers, approvals, and `cancel_listing` stay
   * open so holders can always exit a position while the platform is
   * halted.
   */
  pause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns true if the contract is paused, and false otherwise.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   */
  paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the token collection symbol.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gives permission to `approved` to transfer the token with `token_id` to
   * another account. The approval is cleared when the token is
   * transferred.
   * 
   * Only a single account can be approved at a time for a `token_id`.
   * To remove an approval, the approver can approve their own address,
   * effectively removing the previous approved address. Alternatively,
   * setting the `live_until_ledger` to `0` will also revoke the approval.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `approver` - The address of the approver (should be `owner` or
   * `operator`).
   * * `approved` - The address receiving the approval.
   * * `token_id` - Token ID as a number.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires. If `live_until_ledger` is `0`, the approval is revoked.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   * * [`NonFungibleTokenError::InvalidApprover`] - If the owner address is
   * not the actual owner of the token.
   * * [`NonFungibleTokenError::InvalidLiveUntilLedger`] - If the ledge
   */
  approve: ({approver, approved, token_id, live_until_ledger}: {approver: string, approved: string, token_id: u32, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the number of tokens owned by `account`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The address for which the balance is being queried.
   */
  balance: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a listing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  listing: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Listing>>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Replaces this contract's executable code in place — same address,
   * same storage, so the platform can ship behavior changes (or fix a
   * bug) without a redeploy and without anyone needing to be pointed at a
   * new contract id. `#[only_owner]` ignores whatever address is passed
   * as `_operator` and enforces the real owner from storage instead — see
   * `stellar-macros`' docs on the macro.
   */
  upgrade: ({new_wasm_hash, operator}: {new_wasm_hash: Buffer, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The contract build currently running on-chain — bump
   * `CONTRACT_VERSION` on every release that changes behavior so this
   * stays truthful after an `upgrade`.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a art_meta transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Synthesizes a single token's metadata from the edition it was minted
   * from — editions store their descriptive fields once, not once per
   * copy, so this is an indirection rather than a direct read.
   */
  art_meta: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ArtMeta>>>

  /**
   * Construct and simulate a owner_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the owner of the token with `token_id`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  owner_of: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfers the token with `token_id` from `from` to `to`.
   * 
   * WARNING: Confirmation that the recipient is capable of receiving the
   * `Non-Fungible` is the caller's responsibility; otherwise the NFT may be
   * permanently lost.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `from` - Account of the sender.
   * * `to` - Account of the recipient.
   * * `token_id` - Token ID as a number.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::IncorrectOwner`] - If the current owner
   * (before calling this function) is not `from`.
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   * 
   * # Events
   * 
   * * topics - `["transfer", from: Address, to: Address]`
   * * data - `[token_id: u32]`
   */
  transfer: ({from, to, token_id}: {from: string, to: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  treasury: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a buy_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buys several listed tokens at once, all paid in the same currency —
   * one signature instead of one `buy` call per token. The common case:
   * a buyer picking N copies pooled across one or more resale listings
   * for the same edition. Listings can belong to different sellers; each
   * token still settles (payment split, ownership transfer, `Purchased`
   * event) exactly as an individual `buy` would, just in one invocation.
   * 
   * `inclusion_fee`/`network_fee` are charged once for the whole batch
   * (there's only one real Soroban transaction underneath, regardless of
   * how many tokens it settles), not once per token — capped against the
   * sum of every token's own price, computed up front in a read-only
   * pass before any listing is touched.
   */
  buy_batch: ({buyer, token_ids, payment_token, inclusion_fee, network_fee}: {buyer: string, token_ids: Array<u32>, payment_token: string, inclusion_fee: i128, network_fee: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(Address)` if ownership is set, or `None` if ownership has
   * been renounced.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  get_owner: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a token_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the Uniform Resource Identifier (URI) for the token with
   * `token_id`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   * 
   * # Notes
   * 
   * If the token does not exist, this function is expected to panic.
   */
  token_uri: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a keep_alive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  keep_alive: ({edition_ids, edition_refs, token_ids, unlocked}: {edition_ids: Array<u32>, edition_refs: Array<string>, token_ids: Array<u32>, unlocked: Array<readonly [u32, u32]>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a list_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Lists several of the caller's tokens at once, all at the same price
   * grid — one signature instead of one `list` call per token. The common
   * case: a seller holding a consecutive run from one `buy_edition`
   * purchase relists several of them together. Each token still gets its
   * own independent `Listing` entry (and its own `Listed` event, via
   * `do_list`) — this is purely a batching of the same per-token effect
   * `list` has, not a new pooled-listing concept.
   */
  list_batch: ({seller, token_ids, prices}: {seller: string, token_ids: Array<u32>, prices: Array<PriceEntry>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a buy_edition transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buys `quantity` copies of an edition, minting them straight to
   * `buyer` in the same call that takes payment.
   * 
   * Only *resolves* `edition_ref` — never creates. Creation used to happen
   * here from a caller-supplied `EditionInput`, which let anyone front-run
   * an unsold item and define its terms; it now lives in
   * [`Self::register_edition`], behind the price authority.
   * 
   * `purchase_ref` is a fresh caller id per attempt, recorded so the minted
   * range can be read back with [`Self::purchase_by_ref`]: the pinned
   * `stellar-sdk` can't decode protocol-27 meta, so neither the return
   * value nor events survive a confirmed transaction, and re-deriving
   * "the last N minted" would race concurrent buyers. Reuse is rejected,
   * which also makes a retried submission safe.
   */
  buy_edition: ({buyer, edition_ref, purchase_ref, payment_token, quantity, inclusion_fee, network_fee}: {buyer: string, edition_ref: string, purchase_ref: string, payment_token: string, quantity: u32, inclusion_fee: i128, network_fee: i128}, options?: MethodOptions) => Promise<AssembledTransaction<readonly [u32, u32]>>

  /**
   * Construct and simulate a edition_meta transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  edition_meta: ({edition_id}: {edition_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<EditionMeta>>>

  /**
   * Construct and simulate a get_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the account approved for the token with `token_id`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  get_approved: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a royalty_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * ERC2981-shaped royalty lookup, resolved from the token's edition
   * rather than the OZ royalties extension's own storage — see the doc
   * comment in `buy_edition` for why. A token with no edition (shouldn't
   * happen for anything this contract minted) reports no royalty rather
   * than panicking, matching the OZ default's own "nothing set" behavior.
   */
  royalty_info: ({token_id, sale_price}: {token_id: u32, sale_price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<readonly [string, i128]>>

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfers the token with `token_id` from `from` to `to` by using
   * `spender`s approval.
   * 
   * Unlike `transfer()`, which is used when the token owner initiates the
   * transfer, `transfer_from()` allows an approved third party
   * (`spender`) to transfer the token on behalf of the owner. This
   * function verifies that `spender` has the necessary approval.
   * 
   * WARNING: Confirmation that the recipient is capable of receiving the
   * `Non-Fungible` is the caller's responsibility; otherwise the NFT may be
   * permanently lost.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `spender` - The address authorizing the transfer.
   * * `from` - Account of the sender.
   * * `to` - Account of the recipient.
   * * `token_id` - Token ID as a number.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::IncorrectOwner`] - If the current owner
   * (before calling this function) is not `from`.
   * * [`NonFungibleTokenError::InsufficientApproval`] - If the spender does
   * not have a valid approval.
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   * 
   * # Events
   */
  transfer_from: ({spender, from, to, token_id}: {spender: string, from: string, to: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cancel_listing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_listing: ({seller, token_id}: {seller: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a edition_by_ref transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolves the caller's off-chain reference back to the registered
   * edition id. This is how the backend confirms an edition exists
   * on-chain and learns its id after the first purchase.
   */
  edition_by_ref: ({edition_ref}: {edition_ref: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

  /**
   * Construct and simulate a edition_prices transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  edition_prices: ({edition_id}: {edition_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<PriceEntry>>>

  /**
   * Construct and simulate a sale_breakdown transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only preview of `buy`'s payment split for one of the listing's
   * currencies, so the UI can show the buyer exactly where their money
   * goes before they sign.
   */
  sale_breakdown: ({token_id, payment_token}: {token_id: u32, payment_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<SaleBreakdown>>>

  /**
   * Construct and simulate a update_edition transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rewrites title/description/thumbnail/supply/prices.
   * 
   * `media_url`, `media_type`, `creator` and `royalty_bps` are **not
   * parameters** — carried over from the existing meta, so nothing can
   * alter them. `supply` may only move down to `meta.minted`: never
   * diluting existing holders, never letting minted copies exceed the cap.
   */
  update_edition: ({caller, edition_id, title, description, thumbnail_url, supply, prices}: {caller: string, edition_id: u32, title: string, description: string, thumbnail_url: string, supply: u32, prices: Array<PriceEntry>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a approve_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve or remove `operator` as an operator for the owner.
   * 
   * Operators can call `transfer_from()` for any token held by `owner`,
   * and call `approve()` on behalf of `owner`.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `owner` - The address holding the tokens.
   * * `operator` - Account to add to the set of authorized operators.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires. If `live_until_ledger` is `0`, the approval is revoked.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::InvalidLiveUntilLedger`] - If the ledger
   * number is less than the current ledger number.
   * 
   * # Events
   * 
   * * topics - `["approve_for_all", from: Address]`
   * * data - `[operator: Address, live_until_ledger: u32]`
   */
  approve_for_all: ({owner, operator, live_until_ledger}: {owner: string, operator: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a price_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  price_authority: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a purchase_by_ref transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolves what a specific purchase attempt actually minted — see
   * [`Self::buy_edition`]'s doc comment for why this, and not the
   * transaction's return value, is how a confirmation step learns the
   * assigned token range.
   */
  purchase_by_ref: ({purchase_ref}: {purchase_ref: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PurchaseReceipt>>>

  /**
   * Construct and simulate a unlock_item_for transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Called by the backend once it has independently verified (off-chain)
   * that this specific token's specific locked-content item had its
   * unlock rule completed. Idempotent — calling it again for an
   * already-unlocked (token, item) pair is a no-op, not an error, so a
   * retried backend call after a dropped response is safe. Keyed by
   * `(token_id, media_index)` alone, not edition or owner: each item's
   * rule applies to one specific minted copy, decided once, regardless
   * of who holds it later.
   */
  unlock_item_for: ({caller, token_id, media_index}: {caller: string, token_id: u32, media_index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accept_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accepts a pending ownership transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   * 
   * # Events
   * 
   * * topics - `["ownership_transfer_completed"]`
   * * data - `[new_owner: Address]`
   */
  accept_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_item_unlocked transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Public, permissionless read — anyone (the buyer, a marketplace UI,
   * an auditor) can verify on-chain whether a given token's given
   * locked-content item was unlocked, without trusting the backend's
   * word for it.
   */
  is_item_unlocked: ({token_id, media_index}: {token_id: u32, media_index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a platform_fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  platform_fee_bps: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a register_edition transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Registers an edition ahead of its first sale, returning its id.
   * 
   * Gated to the price authority. This used to happen lazily inside
   * `buy_edition`, so the first caller for an `edition_ref` — the app's own
   * row id, visible in every listing URL — permanently set that edition's
   * creator, prices, royalty and supply. Anyone could front-run an unsold
   * item: name themselves `creator` to redirect payments, or set
   * `supply: 1` and buy it to make the item unsellable.
   * 
   * Idempotent — re-registering an existing ref returns its id, so a
   * retried call is safe.
   */
  register_edition: ({caller, edition_ref, edition}: {caller: string, edition_ref: string, edition: EditionInput}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a remaining_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remaining_supply: ({edition_id}: {edition_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_platform_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_platform_fee: ({fee_bps, treasury}: {fee_bps: u32, treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a keep_tokens_alive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renews ownership, `TokenEdition` and any `Listing` for each token.
   * 
   * The lowest cap of the four: a token can touch four ledger entries where
   * the other kinds touch one or two.
   */
  keep_tokens_alive: ({token_ids}: {token_ids: Array<u32>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a renounce_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renounces ownership of the contract.
   * 
   * Permanently removes the owner, disabling all functions gated by
   * `#[only_owner]`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`OwnableError::TransferInProgress`] - If there is a pending ownership
   * transfer.
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * 
   * # Notes
   * 
   * * Authorization for the current owner is required.
   */
  renounce_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates a 2-step ownership transfer to a new address.
   * 
   * Requires authorization from the current owner. The new owner must later
   * call `accept_ownership()` to complete the transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `new_owner` - The proposed new owner.
   * * `live_until_ledger` - Ledger number until which the new owner can
   * accept. A value of `0` cancels any pending transfer.
   * 
   * # Errors
   * 
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   * 
   * # Notes
   * 
   * * Authorization for the current owner is required.
   */
  transfer_ownership: ({new_owner, live_until_ledger}: {new_owner: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_approved_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns whether the `operator` is allowed to manage all the assets of
   * `owner`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `owner` - Account of the token's owner.
   * * `operator` - Account to be checked.
   */
  is_approved_for_all: ({owner, operator}: {owner: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a keep_contract_alive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renews only this contract's own instance entry.
   * 
   * The instance holds `Treasury`, `PriceAuthority`, `PlatformFeeBps`,
   * `NextEditionId` and the wasm reference — lose it and nothing works, so
   * this is the one worth being able to run on its own. Every other
   * `keep_*_alive` renews it too; this is the no-argument case.
   */
  keep_contract_alive: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a keep_editions_alive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renews `Edition` and `EditionPrices` for each id.
   * 
   * One of the single-kind entry points, for an operator running a sweep by
   * hand. They exist alongside [`Self::keep_alive`] because mixing kinds in
   * one call is what makes a batch overflow the transaction footprint —
   * here that is not expressible, and each cap is sized for its own kind.
   */
  keep_editions_alive: ({edition_ids}: {edition_ids: Array<u32>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a keep_unlocked_alive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renews `Unlocked(token_id, media_index)` for each pair. Losing one
   * silently re-locks reward content a holder already earned.
   */
  keep_unlocked_alive: ({unlocked}: {unlocked: Array<readonly [u32, u32]>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_price_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rotates the price authority's hot key — same rationale as
   * `set_unlock_authority`: this key gets called by the backend on
   * every creator edit, so being able to swap it without touching the
   * owner's cold key matters.
   */
  set_price_authority: ({new_authority}: {new_authority: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_unlock_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rotates the unlock authority's hot key without a full upgrade — the
   * backend process holding this key gets called automatically and
   * often, so being able to swap it (e.g. after a suspected leak)
   * without touching the owner's cold key matters more here than for
   * most admin settings.
   */
  set_unlock_authority: ({new_authority}: {new_authority: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a keep_edition_refs_alive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renews `EditionByRef` for each ref — the entry whose loss is worst,
   * since without it `buy_edition` cannot resolve a ref and
   * `register_edition` would create a duplicate edition instead of finding
   * the original.
   */
  keep_edition_refs_alive: ({edition_refs}: {edition_refs: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {owner, treasury, platform_fee_bps, name, symbol, base_uri, unlock_authority, price_authority}: {owner: string, treasury: string, platform_fee_bps: u32, name: string, symbol: string, base_uri: string, unlock_authority: string, price_authority: string},
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
    return ContractClient.deploy({owner, treasury, platform_fee_bps, name, symbol, base_uri, unlock_authority, price_authority}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABQAAAAAAAAAAAAAABkxpc3RlZAAAAAAAAQAAAAZsaXN0ZWQAAAAAAAMAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAEAAAAAAAAABnByaWNlcwAAAAAD6gAAB9AAAAAKUHJpY2VFbnRyeQAAAAAAAAAAAAI=",
        "AAAAAQAAANpPZmYtY2hhaW4tbWVkaWEgZGVzY3JpcHRvciByZXR1cm5lZCBieSBbYEFydE5mdDo6YXJ0X21ldGFgXSBmb3IgYSBzaW5nbGUKdG9rZW4g4oCUIHN5bnRoZXNpemVkIGZyb20gdGhhdCB0b2tlbidzIGVkaXRpb24sIG5vdCBzdG9yZWQgcGVyLXRva2VuLgpObyByb3lhbHR5IGJwcyDigJQgW2BBcnROZnQ6OnJveWFsdHlfaW5mb2BdIGlzIHRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoLgAAAAAAAAAAAAdBcnRNZXRhAAAAAAYAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAAKbWVkaWFfdHlwZQAAAAAAEAAAAAAAAAAJbWVkaWFfdXJsAAAAAAAAEAAAAAAAAAANdGh1bWJuYWlsX3VybAAAAAAAABAAAAAAAAAABXRpdGxlAAAAAAAAEA==",
        "AAAAAQAAALlBdCBtb3N0IG9uZSBsaXN0aW5nIHBlciB0b2tlbi4gU2Vjb25kYXJ5IG1hcmtldCBvbmx5IOKAlCBhIHByaW1hcnkgc2FsZSBpcwpwcmljZWQgdmlhIGBFZGl0aW9uUHJpY2VzYC4gQSByZXNlbGxlciBzZXRzIHRoZWlyIG93biBjdXJyZW5jaWVzLCBub3QKd2hhdGV2ZXIgdGhlIGNyZWF0b3Igb3JpZ2luYWxseSBvZmZlcmVkLgAAAAAAAAAAAAAHTGlzdGluZwAAAAACAAAAAAAAAAZwcmljZXMAAAAAA+oAAAfQAAAAClByaWNlRW50cnkAAAAAAAAAAAAGc2VsbGVyAAAAAAAT",
        "AAAABAAAAAAAAAAAAAAACEFydEVycm9yAAAAGQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAASwAAAAAAAAACkludmFsaWRGZWUAAAAAAS0AAAAAAAAADkludmFsaWRSb3lhbHR5AAAAAAEuAAAAAAAAAAtOYW1lVG9vTG9uZwAAAAEvAAAAAAAAABJEZXNjcmlwdGlvblRvb0xvbmcAAAAAATAAAAAAAAAACkludmFsaWRVcmkAAAAAATEAAAAAAAAAD0xpc3RpbmdOb3RGb3VuZAAAAAEyAAAAAAAAAAxTZWxmUHVyY2hhc2UAAAEzAAAAAAAAAAlOb3RTZWxsZXIAAAAAAAE0AAAAYFRoZSBsaXN0aW5nJ3Mgc2VsbGVyIG5vIGxvbmdlciBvd25zIHRoZSB0b2tlbiDigJQgaXQgd2FzIHRyYW5zZmVycmVkCm91dCBmcm9tIHVuZGVyIHRoZSBsaXN0aW5nLgAAAAxMaXN0aW5nU3RhbGUAAAE1AAAAcVRoaXMgYGVkaXRpb25fcmVmYCBhbHJlYWR5IHJlZ2lzdGVyZWQgYW4gZWRpdGlvbiDigJQgZ3VhcmRzIGFnYWluc3QKZG91YmxlLXJlZ2lzdGVyaW5nIHRoZSBzYW1lIG9mZi1jaGFpbiByZWNvcmQuAAAAAAAADER1cGxpY2F0ZVJlZgAAATcAAAAAAAAAClJlZlRvb0xvbmcAAAAAATgAAAAAAAAADUludmFsaWRTdXBwbHkAAAAAAAE5AAAAUUFuIGVkaXRpb24ncyBwcmljZSBncmlkIGlzIGVtcHR5IG9yIGhhcyBtb3JlIGN1cnJlbmNpZXMgdGhhbgpgTUFYX1BSSUNFX0VOVFJJRVNgLgAAAAAAABNUb29NYW55UHJpY2VFbnRyaWVzAAAAAToAAAAAAAAAFUR1cGxpY2F0ZVBheW1lbnRUb2tlbgAAAAAAATsAAAAAAAAADEludmFsaWRQcmljZQAAATwAAABGYHBheW1lbnRfdG9rZW5gIGlzbid0IG9uZSBvZiB0aGUgY3VycmVuY2llcyB0aGlzIGVkaXRpb24gaXMgcHJpY2VkIGluLgAAAAAAF1BheW1lbnRUb2tlbk5vdEFjY2VwdGVkAAAAAT0AAAA/VGhpcyBwdXJjaGFzZSB3b3VsZCBtaW50IG1vcmUgY29waWVzIHRoYW4gdGhlIGVkaXRpb24gaGFzIGxlZnQuAAAAAA9TdXBwbHlFeGhhdXN0ZWQAAAABPgAAADJgcXVhbnRpdHlgIGlzIDAgb3IgZXhjZWVkcyBgTUFYX1FVQU5USVRZX1BFUl9CVVlgLgAAAAAAEFF1YW50aXR5VG9vTGFyZ2UAAAE/AAAAAAAAAA9FZGl0aW9uTm90Rm91bmQAAAABQAAAAGJUaGlzIGBwdXJjaGFzZV9yZWZgIHdhcyBhbHJlYWR5IHVzZWQg4oCUIGd1YXJkcyBhZ2FpbnN0IGRvdWJsZS1hcHBseWluZwp0aGUgc2FtZSBwdXJjaGFzZSBhdHRlbXB0LgAAAAAAFER1cGxpY2F0ZVB1cmNoYXNlUmVmAAABQQAAAAAAAAASUHVyY2hhc2VSZWZUb29Mb25nAAAAAAFCAAAAYVRoZSBjYWxsZXIgb2YgYHVubG9ja19pdGVtX2ZvcmAgaXNuJ3QgdGhlIHJlZ2lzdGVyZWQgdW5sb2NrCmF1dGhvcml0eSAob3Igbm9uZSBoYXMgYmVlbiBzZXQgeWV0KS4AAAAAAAASTm90VW5sb2NrQXV0aG9yaXR5AAAAAAFDAAABYVRoZSBjYWxsZXIgb2YgYHJlZ2lzdGVyX2VkaXRpb25gL2B1cGRhdGVfZWRpdGlvbmAgaXNuJ3QgdGhlCnJlZ2lzdGVyZWQgcHJpY2UgYXV0aG9yaXR5LgoKQWxzbyByYWlzZWQgd2hlbiBubyBhdXRob3JpdHkgaXMgc2V0IGF0IGFsbCwgd2hpY2ggc2luY2UgdjExIGNhbgpvbmx5IGhhcHBlbiBvbiBhIGNvbnRyYWN0ICp1cGdyYWRlZCogZnJvbSBhIGJ1aWxkIHByZWRhdGluZyB0aGUKa2V5IOKAlCBgX19jb25zdHJ1Y3RvcmAgc2V0cyBpdCwgYnV0IGEgY29uc3RydWN0b3IgbmV2ZXIgcnVucyBvbiBhbgp1cGdyYWRlLCBzbyB0aGF0IG9uZSBjYXNlIHN0aWxsIG5lZWRzIGEgYHNldF9wcmljZV9hdXRob3JpdHlgIGNhbGwuAAAAAAAAEU5vdFByaWNlQXV0aG9yaXR5AAAAAAABRAAAAFdga2VlcF9hbGl2ZWAgd2FzIGdpdmVuIG1vcmUgZWRpdGlvbiBvciB0b2tlbiBpZHMgdGhhbgpgTUFYX0tFRVBfQUxJVkVfSURTYCBpbiBvbmUgY2FsbC4AAAAAE1Rvb01hbnlLZWVwQWxpdmVJZHMAAAABRQ==",
        "AAAABQAAAAAAAAAAAAAACVB1cmNoYXNlZAAAAAAAAAEAAAAJcHVyY2hhc2VkAAAAAAAACQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAQAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAAAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABMAAAAAAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAAAAAAAAxyb3lhbHR5X3BhaWQAAAALAAAAAAAAAAAAAAARcGxhdGZvcm1fZmVlX3BhaWQAAAAAAAALAAAAAAAAALdSZWltYnVyc2VzIHRyZWFzdXJ5IGZvciBmZWUtYnVtcGluZyB0aGlzIHB1cmNoYXNlLCBmb2xkZWQgaW50byB0aGUKcGxhdGZvcm0tZmVlIHRyYW5zZmVyLiBBbHdheXMgMCB1bmRlciBgYnV5X2JhdGNoYCwgd2hpY2ggY2hhcmdlcyB0aGUKYmF0Y2gncyBmZWUgb25jZSBpbiBpdHMgb3duIGFnZ3JlZ2F0ZSB0cmFuc2Zlci4AAAAAEmluY2x1c2lvbl9mZWVfcGFpZAAAAAAACwAAAAAAAAAAAAAAEG5ldHdvcmtfZmVlX3BhaWQAAAALAAAAAAAAAAI=",
        "AAAAAQAAAD9PbmUgYWNjZXB0ZWQgY3VycmVuY3kgYW5kIGl0cyBwcmljZSBmb3Igb25lIGNvcHkgb2YgYW4gZWRpdGlvbi4AAAAAAAAAAApQcmljZUVudHJ5AAAAAAACAAAAdVNFUC00MSB0b2tlbiBhZGRyZXNzICh0aGUgbmF0aXZlIFhMTSBTQUMsIHRoZSBwbGF0Zm9ybSBhc3NldCdzIFNBQywKb3IgYW55IG90aGVyIFN0ZWxsYXIgQXNzZXQgQ29udHJhY3QgYWRkZWQgbGF0ZXIpLgAAAAAAAA1wYXltZW50X3Rva2VuAAAAAAAAEwAAAAAAAAAFcHJpY2UAAAAAAAAL",
        "AAAAAQAAAG9BIGNyZWF0b3IncyBzdWJtaXNzaW9uOiBib3VuZGVkIGFydHdvcmsgd2l0aCBhIGZpeGVkIHN1cHBseSwgbWludGVkCmxhemlseSBhcyBjb3BpZXMgc2VsbCByYXRoZXIgdGhhbiB1cCBmcm9udC4AAAAAAAAAAAtFZGl0aW9uTWV0YQAAAAAJAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAACm1lZGlhX3R5cGUAAAAAABAAAABhVGhlIGxvY2tlZC9nYXRlZCBjb250ZW50IOKAlCB2aXNpYmxlIHRvIHRoZSBzdG9yZWZyb250LCBidXQgb25seQptZWFuaW5nZnVsIG9uY2UgYSBjb3B5IGlzIG93bmVkLgAAAAAAAAltZWRpYV91cmwAAAAAAAAQAAAAKUNvcGllcyBtaW50ZWQgc28gZmFyLCBhbHdheXMgYDw9IHN1cHBseWAuAAAAAAAABm1pbnRlZAAAAAAABAAAAAAAAAALcm95YWx0eV9icHMAAAAABAAAAClUb3RhbCBjb3BpZXMgdGhpcyBlZGl0aW9uIHdpbGwgZXZlciBtaW50LgAAAAAAAAZzdXBwbHkAAAAAAAQAAAAAAAAADXRodW1ibmFpbF91cmwAAAAAAAAQAAAAAAAAAAV0aXRsZQAAAAAAABA=",
        "AAAAAQAAAGpGaWVsZHMgZm9yIGEgbmV3IGVkaXRpb24uIEdyb3VwZWQgaW50byBvbmUgYXJndW1lbnQgdG8gc3RheSB1bmRlcgpTb3JvYmFuJ3MgMTAtcGFyYW1ldGVyLXBlci1mdW5jdGlvbiBjYXAuAAAAAAAAAAAADEVkaXRpb25JbnB1dAAAAAkAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAAKbWVkaWFfdHlwZQAAAAAAEAAAAAAAAAAJbWVkaWFfdXJsAAAAAAAAEAAAAAAAAAAGcHJpY2VzAAAAAAPqAAAH0AAAAApQcmljZUVudHJ5AAAAAAAAAAAAC3JveWFsdHlfYnBzAAAAAAQAAAAAAAAABnN1cHBseQAAAAAABAAAAAAAAAANdGh1bWJuYWlsX3VybAAAAAAAABAAAAAAAAAABXRpdGxlAAAAAAAAEA==",
        "AAAAAQAAAG1XaGF0IGEgYnV5ZXIgd2lsbCBhY3R1YWxseSBiZSBjaGFyZ2VkLCBicm9rZW4gb3V0IHNvIHRoZSBVSSBjYW4gc2hvdyB0aGUKc3BsaXQgYmVmb3JlIGFza2luZyBmb3IgYSBzaWduYXR1cmUuAAAAAAAAAAAAAA1TYWxlQnJlYWtkb3duAAAAAAAABQAAAAAAAAAMcGxhdGZvcm1fZmVlAAAACwAAAAAAAAAHcm95YWx0eQAAAAALAAAAAAAAABByb3lhbHR5X3JlY2VpdmVyAAAAEwAAAAAAAAANc2VsbGVyX2Ftb3VudAAAAAAAAAsAAAAAAAAABXRvdGFsAAAAAAAACw==",
        "AAAABQAAAAAAAAAAAAAADUVkaXRpb25NaW50ZWQAAAAAAAABAAAADmVkaXRpb25fbWludGVkAAAAAAAJAAAAAAAAAAplZGl0aW9uX2lkAAAAAAAEAAAAAQAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAQAAAAAAAAAOZmlyc3RfdG9rZW5faWQAAAAAAAQAAAAAAAAAAAAAAA1sYXN0X3Rva2VuX2lkAAAAAAAABAAAAAAAAAAAAAAACHF1YW50aXR5AAAABAAAAAAAAAAAAAAADXBheW1lbnRfdG9rZW4AAAAAAAATAAAAAAAAAAAAAAAKdW5pdF9wcmljZQAAAAAACwAAAAAAAACjUmVpbWJ1cnNlcyB0cmVhc3VyeSBmb3IgZmVlLWJ1bXBpbmcgdGhpcyBwdXJjaGFzZS4gRm9sZGVkIGludG8gdGhlCnBsYXRmb3JtLWZlZSB0cmFuc2ZlciwgcmVjb3JkZWQgaGVyZSBzbyB0aGUgYnV5ZXIncyB0cnVlIHRvdGFsIGlzCmF1ZGl0YWJsZSBmcm9tIHRoaXMgb25lIGV2ZW50LgAAAAASaW5jbHVzaW9uX2ZlZV9wYWlkAAAAAAALAAAAAAAAAAAAAAAQbmV0d29ya19mZWVfcGFpZAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADkVkaXRpb25DcmVhdGVkAAAAAAABAAAAD2VkaXRpb25fY3JlYXRlZAAAAAAEAAAAAAAAAAplZGl0aW9uX2lkAAAAAAAEAAAAAQAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAQAAAAAAAAALcm95YWx0eV9icHMAAAAABAAAAAAAAAAAAAAABnN1cHBseQAAAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADkVkaXRpb25VcGRhdGVkAAAAAAABAAAAD2VkaXRpb25fdXBkYXRlZAAAAAALAAAAAAAAAAplZGl0aW9uX2lkAAAAAAAEAAAAAQAAAAAAAAAJb2xkX3RpdGxlAAAAAAAAEAAAAAAAAAAAAAAACW5ld190aXRsZQAAAAAAABAAAAAAAAAAAAAAAA9vbGRfZGVzY3JpcHRpb24AAAAAEAAAAAAAAAAAAAAAD25ld19kZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAAAAAARb2xkX3RodW1ibmFpbF91cmwAAAAAAAAQAAAAAAAAAAAAAAARbmV3X3RodW1ibmFpbF91cmwAAAAAAAAQAAAAAAAAAAAAAAAKb2xkX3N1cHBseQAAAAAABAAAAAAAAAAAAAAACm5ld19zdXBwbHkAAAAAAAQAAAAAAAAAAAAAAApvbGRfcHJpY2VzAAAAAAPqAAAH0AAAAApQcmljZUVudHJ5AAAAAAAAAAAAAAAAAApuZXdfcHJpY2VzAAAAAAPqAAAH0AAAAApQcmljZUVudHJ5AAAAAAAAAAAAAg==",
        "AAAAAQAAAHlXaGF0IG9uZSBgYnV5X2VkaXRpb25gIGNhbGwgbWludGVkLiBSZWNvcmRlZCBiZWNhdXNlIHRoZSByZXR1cm4gdmFsdWUKY2FuJ3QgYmUgcmVhZCBiYWNrIOKAlCBzZWUgW2BBcnROZnQ6OmJ1eV9lZGl0aW9uYF0uAAAAAAAAAAAAAA9QdXJjaGFzZVJlY2VpcHQAAAAABwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAplZGl0aW9uX2lkAAAAAAAEAAAAAAAAAA5maXJzdF90b2tlbl9pZAAAAAAABAAAAAAAAAANbGFzdF90b2tlbl9pZAAAAAAAAAQAAAAAAAAADXBheW1lbnRfdG9rZW4AAAAAAAATAAAAAAAAAAhxdWFudGl0eQAAAAQAAAAAAAAACnVuaXRfcHJpY2UAAAAAAAs=",
        "AAAABQAAAAAAAAAAAAAAD0NvbnRlbnRVbmxvY2tlZAAAAAABAAAAEGNvbnRlbnRfdW5sb2NrZWQAAAADAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAAZFdoaWNoIGxvY2tlZC1jb250ZW50IGl0ZW0gb24gdGhpcyB0b2tlbiB3YXMganVzdCB1bmxvY2tlZCDigJQgc2VlCmBEYXRhS2V5OjpVbmxvY2tlZGAncyBkb2MgY29tbWVudC4AAAALbWVkaWFfaW5kZXgAAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAEExpc3RpbmdDYW5jZWxsZWQAAAABAAAAEWxpc3RpbmdfY2FuY2VsbGVkAAAAAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAAElBsYXRmb3JtRmVlVXBkYXRlZAAAAAAAAQAAABRwbGF0Zm9ybV9mZWVfdXBkYXRlZAAAAAIAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAAAAAAC",
        "AAAAAAAAAbtCdXlzIGEgbGlzdGVkIChhbHJlYWR5LW1pbnRlZCkgdG9rZW4gaW4gYSBzaW5nbGUgaW52b2NhdGlvbjogcGF5bWVudApvdXQsIHRva2VuIGluLiBgcGF5bWVudF90b2tlbmAgc2VsZWN0cyB3aGljaCBvZiB0aGUgbGlzdGluZydzIHByaWNlcwp0byBwYXkg4oCUIG11c3QgYmUgb25lIHRoZSBzZWxsZXIgYWN0dWFsbHkgb2ZmZXJlZC4KCk9ubHkgdGhlIGJ1eWVyIHNpZ25zLiBUaGUgc2VsbGVyJ3MgY29uc2VudCB3YXMgZ2l2ZW4gd2hlbiB0aGV5IGNyZWF0ZWQKdGhlIGxpc3RpbmcsIGFuZCB0aGUgdG9rZW4gbW92ZXMgdmlhIFtgQ29uc2VjdXRpdmU6OnVwZGF0ZWBdICh0aGUKbG93LWxldmVsLCBuby1hdXRoIHBhdGgpIHJhdGhlciB0aGFuIGEgZnVsbCBgdHJhbnNmZXJgLCB3aGljaCB3b3VsZApkZW1hbmQgdGhlIHNlbGxlcidzIHNpZ25hdHVyZSBhdCBwdXJjaGFzZSB0aW1lLgAAAAADYnV5AAAAAAUAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAA1wYXltZW50X3Rva2VuAAAAAAAAEwAAAAAAAAANaW5jbHVzaW9uX2ZlZQAAAAAAAAsAAAAAAAAAC25ldHdvcmtfZmVlAAAAAAsAAAAA",
        "AAAAAAAAAV5MaXN0cyB0aGUgY2FsbGVyJ3MgdG9rZW4gZm9yIHNhbGUgaW4gb25lIG9yIG1vcmUgY3VycmVuY2llcywgc2FtZQpzaGFwZSBhcyBhbiBlZGl0aW9uJ3Mgb3duIHByaWNlIGdyaWQg4oCUIGEgcmVzZWxsZXIgaXNuJ3QgbGltaXRlZCB0bwp3aGljaGV2ZXIgY3VycmVuY2llcyB0aGUgY3JlYXRvciBvcmlnaW5hbGx5IG9mZmVyZWQuIExpc3RpbmcgZG9lcyBub3QKZXNjcm93IHRoZSB0b2tlbiDigJQgdGhlIG93bmVyIGtlZXBzIGl0IGFuZCBjYW4gc3RpbGwgdHJhbnNmZXIgaXQsCndoaWNoIGlzIHdoeSBgYnV5YCByZS1jaGVja3Mgb3duZXJzaGlwIHJhdGhlciB0aGFuIHRydXN0aW5nIHRoZQpzdG9yZWQgc2VsbGVyLgAAAAAABGxpc3QAAAADAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAGcHJpY2VzAAAAAAPqAAAH0AAAAApQcmljZUVudHJ5AAAAAAAA",
        "AAAAAAAAAFtSZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIG5hbWUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAMFFbWVyZ2VuY3kgc3RvcCBmb3IgYGJ1eV9lZGl0aW9uYCwgYGxpc3RgLCBgYnV5YCwgYW5kCmB1bmxvY2tfdG9rZW5fZm9yYC4gVHJhbnNmZXJzLCBhcHByb3ZhbHMsIGFuZCBgY2FuY2VsX2xpc3RpbmdgIHN0YXkKb3BlbiBzbyBob2xkZXJzIGNhbiBhbHdheXMgZXhpdCBhIHBvc2l0aW9uIHdoaWxlIHRoZSBwbGF0Zm9ybSBpcwpoYWx0ZWQuAAAAAAAABXBhdXNlAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAHFSZXR1cm5zIHRydWUgaWYgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZCwgYW5kIGZhbHNlIG90aGVyd2lzZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgAAAAAAAAZwYXVzZWQAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAF1SZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIHN5bWJvbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAABABHaXZlcyBwZXJtaXNzaW9uIHRvIGBhcHByb3ZlZGAgdG8gdHJhbnNmZXIgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCB0bwphbm90aGVyIGFjY291bnQuIFRoZSBhcHByb3ZhbCBpcyBjbGVhcmVkIHdoZW4gdGhlIHRva2VuIGlzCnRyYW5zZmVycmVkLgoKT25seSBhIHNpbmdsZSBhY2NvdW50IGNhbiBiZSBhcHByb3ZlZCBhdCBhIHRpbWUgZm9yIGEgYHRva2VuX2lkYC4KVG8gcmVtb3ZlIGFuIGFwcHJvdmFsLCB0aGUgYXBwcm92ZXIgY2FuIGFwcHJvdmUgdGhlaXIgb3duIGFkZHJlc3MsCmVmZmVjdGl2ZWx5IHJlbW92aW5nIHRoZSBwcmV2aW91cyBhcHByb3ZlZCBhZGRyZXNzLiBBbHRlcm5hdGl2ZWx5LApzZXR0aW5nIHRoZSBgbGl2ZV91bnRpbF9sZWRnZXJgIHRvIGAwYCB3aWxsIGFsc28gcmV2b2tlIHRoZSBhcHByb3ZhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhcHByb3ZlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgYXBwcm92ZXIgKHNob3VsZCBiZSBgb3duZXJgIG9yCmBvcGVyYXRvcmApLgoqIGBhcHByb3ZlZGAgLSBUaGUgYWRkcmVzcyByZWNlaXZpbmcgdGhlIGFwcHJvdmFsLgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6Tm9uRXhpc3RlbnRUb2tlbmBdIC0gSWYgdGhlIHRva2VuIGRvZXMgbm90CmV4aXN0LgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbnZhbGlkQXBwcm92ZXJgXSAtIElmIHRoZSBvd25lciBhZGRyZXNzIGlzCm5vdCB0aGUgYWN0dWFsIG93bmVyIG9mIHRoZSB0b2tlbi4KKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAAAhhcHByb3ZlZAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAKtSZXR1cm5zIHRoZSBudW1iZXIgb2YgdG9rZW5zIG93bmVkIGJ5IGBhY2NvdW50YC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWRkcmVzcyBmb3Igd2hpY2ggdGhlIGJhbGFuY2UgaXMgYmVpbmcgcXVlcmllZC4AAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAHbGlzdGluZwAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6AAAB9AAAAAHTGlzdGluZwA=",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAXxSZXBsYWNlcyB0aGlzIGNvbnRyYWN0J3MgZXhlY3V0YWJsZSBjb2RlIGluIHBsYWNlIOKAlCBzYW1lIGFkZHJlc3MsCnNhbWUgc3RvcmFnZSwgc28gdGhlIHBsYXRmb3JtIGNhbiBzaGlwIGJlaGF2aW9yIGNoYW5nZXMgKG9yIGZpeCBhCmJ1Zykgd2l0aG91dCBhIHJlZGVwbG95IGFuZCB3aXRob3V0IGFueW9uZSBuZWVkaW5nIHRvIGJlIHBvaW50ZWQgYXQgYQpuZXcgY29udHJhY3QgaWQuIGAjW29ubHlfb3duZXJdYCBpZ25vcmVzIHdoYXRldmVyIGFkZHJlc3MgaXMgcGFzc2VkCmFzIGBfb3BlcmF0b3JgIGFuZCBlbmZvcmNlcyB0aGUgcmVhbCBvd25lciBmcm9tIHN0b3JhZ2UgaW5zdGVhZCDigJQgc2VlCmBzdGVsbGFyLW1hY3Jvc2AnIGRvY3Mgb24gdGhlIG1hY3JvLgAAAAd1cGdyYWRlAAAAAAIAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAJtUaGUgY29udHJhY3QgYnVpbGQgY3VycmVudGx5IHJ1bm5pbmcgb24tY2hhaW4g4oCUIGJ1bXAKYENPTlRSQUNUX1ZFUlNJT05gIG9uIGV2ZXJ5IHJlbGVhc2UgdGhhdCBjaGFuZ2VzIGJlaGF2aW9yIHNvIHRoaXMKc3RheXMgdHJ1dGhmdWwgYWZ0ZXIgYW4gYHVwZ3JhZGVgLgAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAMNTeW50aGVzaXplcyBhIHNpbmdsZSB0b2tlbidzIG1ldGFkYXRhIGZyb20gdGhlIGVkaXRpb24gaXQgd2FzIG1pbnRlZApmcm9tIOKAlCBlZGl0aW9ucyBzdG9yZSB0aGVpciBkZXNjcmlwdGl2ZSBmaWVsZHMgb25jZSwgbm90IG9uY2UgcGVyCmNvcHksIHNvIHRoaXMgaXMgYW4gaW5kaXJlY3Rpb24gcmF0aGVyIHRoYW4gYSBkaXJlY3QgcmVhZC4AAAAACGFydF9tZXRhAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAA+gAAAfQAAAAB0FydE1ldGEA",
        "AAAAAAAAAOVSZXR1cm5zIHRoZSBvd25lciBvZiB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAACG93bmVyX29mAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAABM=",
        "AAAAAAAAAqBUcmFuc2ZlcnMgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCBmcm9tIGBmcm9tYCB0byBgdG9gLgoKV0FSTklORzogQ29uZmlybWF0aW9uIHRoYXQgdGhlIHJlY2lwaWVudCBpcyBjYXBhYmxlIG9mIHJlY2VpdmluZyB0aGUKYE5vbi1GdW5naWJsZWAgaXMgdGhlIGNhbGxlcidzIHJlc3BvbnNpYmlsaXR5OyBvdGhlcndpc2UgdGhlIE5GVCBtYXkgYmUKcGVybWFuZW50bHkgbG9zdC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgZnJvbWAgLSBBY2NvdW50IG9mIHRoZSBzZW5kZXIuCiogYHRvYCAtIEFjY291bnQgb2YgdGhlIHJlY2lwaWVudC4KKiBgdG9rZW5faWRgIC0gVG9rZW4gSUQgYXMgYSBudW1iZXIuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW5jb3JyZWN0T3duZXJgXSAtIElmIHRoZSBjdXJyZW50IG93bmVyCihiZWZvcmUgY2FsbGluZyB0aGlzIGZ1bmN0aW9uKSBpcyBub3QgYGZyb21gLgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJ0cmFuc2ZlciIsIGZyb206IEFkZHJlc3MsIHRvOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFt0b2tlbl9pZDogdTMyXWAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAIdHJlYXN1cnkAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAs9CdXlzIHNldmVyYWwgbGlzdGVkIHRva2VucyBhdCBvbmNlLCBhbGwgcGFpZCBpbiB0aGUgc2FtZSBjdXJyZW5jeSDigJQKb25lIHNpZ25hdHVyZSBpbnN0ZWFkIG9mIG9uZSBgYnV5YCBjYWxsIHBlciB0b2tlbi4gVGhlIGNvbW1vbiBjYXNlOgphIGJ1eWVyIHBpY2tpbmcgTiBjb3BpZXMgcG9vbGVkIGFjcm9zcyBvbmUgb3IgbW9yZSByZXNhbGUgbGlzdGluZ3MKZm9yIHRoZSBzYW1lIGVkaXRpb24uIExpc3RpbmdzIGNhbiBiZWxvbmcgdG8gZGlmZmVyZW50IHNlbGxlcnM7IGVhY2gKdG9rZW4gc3RpbGwgc2V0dGxlcyAocGF5bWVudCBzcGxpdCwgb3duZXJzaGlwIHRyYW5zZmVyLCBgUHVyY2hhc2VkYApldmVudCkgZXhhY3RseSBhcyBhbiBpbmRpdmlkdWFsIGBidXlgIHdvdWxkLCBqdXN0IGluIG9uZSBpbnZvY2F0aW9uLgoKYGluY2x1c2lvbl9mZWVgL2BuZXR3b3JrX2ZlZWAgYXJlIGNoYXJnZWQgb25jZSBmb3IgdGhlIHdob2xlIGJhdGNoCih0aGVyZSdzIG9ubHkgb25lIHJlYWwgU29yb2JhbiB0cmFuc2FjdGlvbiB1bmRlcm5lYXRoLCByZWdhcmRsZXNzIG9mCmhvdyBtYW55IHRva2VucyBpdCBzZXR0bGVzKSwgbm90IG9uY2UgcGVyIHRva2VuIOKAlCBjYXBwZWQgYWdhaW5zdCB0aGUKc3VtIG9mIGV2ZXJ5IHRva2VuJ3Mgb3duIHByaWNlLCBjb21wdXRlZCB1cCBmcm9udCBpbiBhIHJlYWQtb25seQpwYXNzIGJlZm9yZSBhbnkgbGlzdGluZyBpcyB0b3VjaGVkLgAAAAAJYnV5X2JhdGNoAAAAAAAABQAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAl0b2tlbl9pZHMAAAAAAAPqAAAABAAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABMAAAAAAAAADWluY2x1c2lvbl9mZWUAAAAAAAALAAAAAAAAAAtuZXR3b3JrX2ZlZQAAAAALAAAAAA==",
        "AAAAAAAAAJBSZXR1cm5zIGBTb21lKEFkZHJlc3MpYCBpZiBvd25lcnNoaXAgaXMgc2V0LCBvciBgTm9uZWAgaWYgb3duZXJzaGlwIGhhcwpiZWVuIHJlbm91bmNlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAPVSZXR1cm5zIHRoZSBVbmlmb3JtIFJlc291cmNlIElkZW50aWZpZXIgKFVSSSkgZm9yIHRoZSB0b2tlbiB3aXRoCmB0b2tlbl9pZGAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHRva2VuX2lkYCAtIFRva2VuIElEIGFzIGEgbnVtYmVyLgoKIyBOb3RlcwoKSWYgdGhlIHRva2VuIGRvZXMgbm90IGV4aXN0LCB0aGlzIGZ1bmN0aW9uIGlzIGV4cGVjdGVkIHRvIHBhbmljLgAAAAAAAAl0b2tlbl91cmkAAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAEA==",
        "AAAAAAAAAAAAAAAKa2VlcF9hbGl2ZQAAAAAABAAAAAAAAAALZWRpdGlvbl9pZHMAAAAD6gAAAAQAAAAAAAAADGVkaXRpb25fcmVmcwAAA+oAAAAQAAAAAAAAAAl0b2tlbl9pZHMAAAAAAAPqAAAABAAAAAAAAAAIdW5sb2NrZWQAAAPqAAAD7QAAAAIAAAAEAAAABAAAAAA=",
        "AAAAAAAAAcVMaXN0cyBzZXZlcmFsIG9mIHRoZSBjYWxsZXIncyB0b2tlbnMgYXQgb25jZSwgYWxsIGF0IHRoZSBzYW1lIHByaWNlCmdyaWQg4oCUIG9uZSBzaWduYXR1cmUgaW5zdGVhZCBvZiBvbmUgYGxpc3RgIGNhbGwgcGVyIHRva2VuLiBUaGUgY29tbW9uCmNhc2U6IGEgc2VsbGVyIGhvbGRpbmcgYSBjb25zZWN1dGl2ZSBydW4gZnJvbSBvbmUgYGJ1eV9lZGl0aW9uYApwdXJjaGFzZSByZWxpc3RzIHNldmVyYWwgb2YgdGhlbSB0b2dldGhlci4gRWFjaCB0b2tlbiBzdGlsbCBnZXRzIGl0cwpvd24gaW5kZXBlbmRlbnQgYExpc3RpbmdgIGVudHJ5IChhbmQgaXRzIG93biBgTGlzdGVkYCBldmVudCwgdmlhCmBkb19saXN0YCkg4oCUIHRoaXMgaXMgcHVyZWx5IGEgYmF0Y2hpbmcgb2YgdGhlIHNhbWUgcGVyLXRva2VuIGVmZmVjdApgbGlzdGAgaGFzLCBub3QgYSBuZXcgcG9vbGVkLWxpc3RpbmcgY29uY2VwdC4AAAAAAAAKbGlzdF9iYXRjaAAAAAAAAwAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAAAAAAl0b2tlbl9pZHMAAAAAAAPqAAAABAAAAAAAAAAGcHJpY2VzAAAAAAPqAAAH0AAAAApQcmljZUVudHJ5AAAAAAAA",
        "AAAAAAAAAupCdXlzIGBxdWFudGl0eWAgY29waWVzIG9mIGFuIGVkaXRpb24sIG1pbnRpbmcgdGhlbSBzdHJhaWdodCB0bwpgYnV5ZXJgIGluIHRoZSBzYW1lIGNhbGwgdGhhdCB0YWtlcyBwYXltZW50LgoKT25seSAqcmVzb2x2ZXMqIGBlZGl0aW9uX3JlZmAg4oCUIG5ldmVyIGNyZWF0ZXMuIENyZWF0aW9uIHVzZWQgdG8gaGFwcGVuCmhlcmUgZnJvbSBhIGNhbGxlci1zdXBwbGllZCBgRWRpdGlvbklucHV0YCwgd2hpY2ggbGV0IGFueW9uZSBmcm9udC1ydW4KYW4gdW5zb2xkIGl0ZW0gYW5kIGRlZmluZSBpdHMgdGVybXM7IGl0IG5vdyBsaXZlcyBpbgpbYFNlbGY6OnJlZ2lzdGVyX2VkaXRpb25gXSwgYmVoaW5kIHRoZSBwcmljZSBhdXRob3JpdHkuCgpgcHVyY2hhc2VfcmVmYCBpcyBhIGZyZXNoIGNhbGxlciBpZCBwZXIgYXR0ZW1wdCwgcmVjb3JkZWQgc28gdGhlIG1pbnRlZApyYW5nZSBjYW4gYmUgcmVhZCBiYWNrIHdpdGggW2BTZWxmOjpwdXJjaGFzZV9ieV9yZWZgXTogdGhlIHBpbm5lZApgc3RlbGxhci1zZGtgIGNhbid0IGRlY29kZSBwcm90b2NvbC0yNyBtZXRhLCBzbyBuZWl0aGVyIHRoZSByZXR1cm4KdmFsdWUgbm9yIGV2ZW50cyBzdXJ2aXZlIGEgY29uZmlybWVkIHRyYW5zYWN0aW9uLCBhbmQgcmUtZGVyaXZpbmcKInRoZSBsYXN0IE4gbWludGVkIiB3b3VsZCByYWNlIGNvbmN1cnJlbnQgYnV5ZXJzLiBSZXVzZSBpcyByZWplY3RlZCwKd2hpY2ggYWxzbyBtYWtlcyBhIHJldHJpZWQgc3VibWlzc2lvbiBzYWZlLgAAAAAAC2J1eV9lZGl0aW9uAAAAAAcAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAALZWRpdGlvbl9yZWYAAAAAEAAAAAAAAAAMcHVyY2hhc2VfcmVmAAAAEAAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABMAAAAAAAAACHF1YW50aXR5AAAABAAAAAAAAAANaW5jbHVzaW9uX2ZlZQAAAAAAAAsAAAAAAAAAC25ldHdvcmtfZmVlAAAAAAsAAAABAAAD7QAAAAIAAAAEAAAABA==",
        "AAAAAAAAAAAAAAAMZWRpdGlvbl9tZXRhAAAAAQAAAAAAAAAKZWRpdGlvbl9pZAAAAAAABAAAAAEAAAPoAAAH0AAAAAtFZGl0aW9uTWV0YQA=",
        "AAAAAAAAAPFSZXR1cm5zIHRoZSBhY2NvdW50IGFwcHJvdmVkIGZvciB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAADGdldF9hcHByb3ZlZAAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAVRFUkMyOTgxLXNoYXBlZCByb3lhbHR5IGxvb2t1cCwgcmVzb2x2ZWQgZnJvbSB0aGUgdG9rZW4ncyBlZGl0aW9uCnJhdGhlciB0aGFuIHRoZSBPWiByb3lhbHRpZXMgZXh0ZW5zaW9uJ3Mgb3duIHN0b3JhZ2Ug4oCUIHNlZSB0aGUgZG9jCmNvbW1lbnQgaW4gYGJ1eV9lZGl0aW9uYCBmb3Igd2h5LiBBIHRva2VuIHdpdGggbm8gZWRpdGlvbiAoc2hvdWxkbid0CmhhcHBlbiBmb3IgYW55dGhpbmcgdGhpcyBjb250cmFjdCBtaW50ZWQpIHJlcG9ydHMgbm8gcm95YWx0eSByYXRoZXIKdGhhbiBwYW5pY2tpbmcsIG1hdGNoaW5nIHRoZSBPWiBkZWZhdWx0J3Mgb3duICJub3RoaW5nIHNldCIgYmVoYXZpb3IuAAAADHJveWFsdHlfaW5mbwAAAAIAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAKc2FsZV9wcmljZQAAAAAACwAAAAEAAAPtAAAAAgAAABMAAAAL",
        "AAAAAAAAALxSdW5zIGV4YWN0bHkgb25jZSwgYXQgZGVwbG95LiBVc2luZyBhIGNvbnN0cnVjdG9yIHJhdGhlciB0aGFuIGFuCmBpbml0aWFsaXplYCBlbnRyeSBwb2ludCBtZWFucyB0aGVyZSBpcyBubyB3aW5kb3cgaW4gd2hpY2ggYW4KdW5pbml0aWFsaXplZCBjb250cmFjdCBjYW4gYmUgY2xhaW1lZCBieSB3aG9ldmVyIGNhbGxzIGZpcnN0LgAAAA1fX2NvbnN0cnVjdG9yAAAAAAAACAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAEHBsYXRmb3JtX2ZlZV9icHMAAAAEAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAAhiYXNlX3VyaQAAABAAAAAAAAAAEHVubG9ja19hdXRob3JpdHkAAAATAAAAAAAAAA9wcmljZV9hdXRob3JpdHkAAAAAEwAAAAA=",
        "AAAAAAAABABUcmFuc2ZlcnMgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCBmcm9tIGBmcm9tYCB0byBgdG9gIGJ5IHVzaW5nCmBzcGVuZGVyYHMgYXBwcm92YWwuCgpVbmxpa2UgYHRyYW5zZmVyKClgLCB3aGljaCBpcyB1c2VkIHdoZW4gdGhlIHRva2VuIG93bmVyIGluaXRpYXRlcyB0aGUKdHJhbnNmZXIsIGB0cmFuc2Zlcl9mcm9tKClgIGFsbG93cyBhbiBhcHByb3ZlZCB0aGlyZCBwYXJ0eQooYHNwZW5kZXJgKSB0byB0cmFuc2ZlciB0aGUgdG9rZW4gb24gYmVoYWxmIG9mIHRoZSBvd25lci4gVGhpcwpmdW5jdGlvbiB2ZXJpZmllcyB0aGF0IGBzcGVuZGVyYCBoYXMgdGhlIG5lY2Vzc2FyeSBhcHByb3ZhbC4KCldBUk5JTkc6IENvbmZpcm1hdGlvbiB0aGF0IHRoZSByZWNpcGllbnQgaXMgY2FwYWJsZSBvZiByZWNlaXZpbmcgdGhlCmBOb24tRnVuZ2libGVgIGlzIHRoZSBjYWxsZXIncyByZXNwb25zaWJpbGl0eTsgb3RoZXJ3aXNlIHRoZSBORlQgbWF5IGJlCnBlcm1hbmVudGx5IGxvc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIHRyYW5zZmVyLgoqIGBmcm9tYCAtIEFjY291bnQgb2YgdGhlIHNlbmRlci4KKiBgdG9gIC0gQWNjb3VudCBvZiB0aGUgcmVjaXBpZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbmNvcnJlY3RPd25lcmBdIC0gSWYgdGhlIGN1cnJlbnQgb3duZXIKKGJlZm9yZSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24pIGlzIG5vdCBgZnJvbWAuCiogW2BOb25GdW5naWJsZVRva2VuRXJyb3I6Okluc3VmZmljaWVudEFwcHJvdmFsYF0gLSBJZiB0aGUgc3BlbmRlciBkb2VzCm5vdCBoYXZlIGEgdmFsaWQgYXBwcm92YWwuCiogW2BOb25GdW5naWJsZVRva2VuRXJyb3I6Ok5vbkV4aXN0ZW50VG9rZW5gXSAtIElmIHRoZSB0b2tlbiBkb2VzIG5vdApleGlzdC4KCiMgRXZlbnRzAAAADXRyYW5zZmVyX2Zyb20AAAAAAAAEAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAAOY2FuY2VsX2xpc3RpbmcAAAAAAAIAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAALRSZXNvbHZlcyB0aGUgY2FsbGVyJ3Mgb2ZmLWNoYWluIHJlZmVyZW5jZSBiYWNrIHRvIHRoZSByZWdpc3RlcmVkCmVkaXRpb24gaWQuIFRoaXMgaXMgaG93IHRoZSBiYWNrZW5kIGNvbmZpcm1zIGFuIGVkaXRpb24gZXhpc3RzCm9uLWNoYWluIGFuZCBsZWFybnMgaXRzIGlkIGFmdGVyIHRoZSBmaXJzdCBwdXJjaGFzZS4AAAAOZWRpdGlvbl9ieV9yZWYAAAAAAAEAAAAAAAAAC2VkaXRpb25fcmVmAAAAABAAAAABAAAD6AAAAAQ=",
        "AAAAAAAAAAAAAAAOZWRpdGlvbl9wcmljZXMAAAAAAAEAAAAAAAAACmVkaXRpb25faWQAAAAAAAQAAAABAAAD6gAAB9AAAAAKUHJpY2VFbnRyeQAA",
        "AAAAAAAAAJ1SZWFkLW9ubHkgcHJldmlldyBvZiBgYnV5YCdzIHBheW1lbnQgc3BsaXQgZm9yIG9uZSBvZiB0aGUgbGlzdGluZydzCmN1cnJlbmNpZXMsIHNvIHRoZSBVSSBjYW4gc2hvdyB0aGUgYnV5ZXIgZXhhY3RseSB3aGVyZSB0aGVpciBtb25leQpnb2VzIGJlZm9yZSB0aGV5IHNpZ24uAAAAAAAADnNhbGVfYnJlYWtkb3duAAAAAAACAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAADXBheW1lbnRfdG9rZW4AAAAAAAATAAAAAQAAA+gAAAfQAAAADVNhbGVCcmVha2Rvd24AAAA=",
        "AAAAAAAAAUFSZXdyaXRlcyB0aXRsZS9kZXNjcmlwdGlvbi90aHVtYm5haWwvc3VwcGx5L3ByaWNlcy4KCmBtZWRpYV91cmxgLCBgbWVkaWFfdHlwZWAsIGBjcmVhdG9yYCBhbmQgYHJveWFsdHlfYnBzYCBhcmUgKipub3QKcGFyYW1ldGVycyoqIOKAlCBjYXJyaWVkIG92ZXIgZnJvbSB0aGUgZXhpc3RpbmcgbWV0YSwgc28gbm90aGluZyBjYW4KYWx0ZXIgdGhlbS4gYHN1cHBseWAgbWF5IG9ubHkgbW92ZSBkb3duIHRvIGBtZXRhLm1pbnRlZGA6IG5ldmVyCmRpbHV0aW5nIGV4aXN0aW5nIGhvbGRlcnMsIG5ldmVyIGxldHRpbmcgbWludGVkIGNvcGllcyBleGNlZWQgdGhlIGNhcC4AAAAAAAAOdXBkYXRlX2VkaXRpb24AAAAAAAcAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAKZWRpdGlvbl9pZAAAAAAABAAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAA10aHVtYm5haWxfdXJsAAAAAAAAEAAAAAAAAAAGc3VwcGx5AAAAAAAEAAAAAAAAAAZwcmljZXMAAAAAA+oAAAfQAAAAClByaWNlRW50cnkAAAAAAAA=",
        "AAAAAAAAAr9BcHByb3ZlIG9yIHJlbW92ZSBgb3BlcmF0b3JgIGFzIGFuIG9wZXJhdG9yIGZvciB0aGUgb3duZXIuCgpPcGVyYXRvcnMgY2FuIGNhbGwgYHRyYW5zZmVyX2Zyb20oKWAgZm9yIGFueSB0b2tlbiBoZWxkIGJ5IGBvd25lcmAsCmFuZCBjYWxsIGBhcHByb3ZlKClgIG9uIGJlaGFsZiBvZiBgb3duZXJgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG93bmVyYCAtIFRoZSBhZGRyZXNzIGhvbGRpbmcgdGhlIHRva2Vucy4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBhZGQgdG8gdGhlIHNldCBvZiBhdXRob3JpemVkIG9wZXJhdG9ycy4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlcgpudW1iZXIgaXMgbGVzcyB0aGFuIHRoZSBjdXJyZW50IGxlZGdlciBudW1iZXIuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhcHByb3ZlX2Zvcl9hbGwiLCBmcm9tOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtvcGVyYXRvcjogQWRkcmVzcywgbGl2ZV91bnRpbF9sZWRnZXI6IHUzMl1gAAAAAA9hcHByb3ZlX2Zvcl9hbGwAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAPcHJpY2VfYXV0aG9yaXR5AAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAANdSZXNvbHZlcyB3aGF0IGEgc3BlY2lmaWMgcHVyY2hhc2UgYXR0ZW1wdCBhY3R1YWxseSBtaW50ZWQg4oCUIHNlZQpbYFNlbGY6OmJ1eV9lZGl0aW9uYF0ncyBkb2MgY29tbWVudCBmb3Igd2h5IHRoaXMsIGFuZCBub3QgdGhlCnRyYW5zYWN0aW9uJ3MgcmV0dXJuIHZhbHVlLCBpcyBob3cgYSBjb25maXJtYXRpb24gc3RlcCBsZWFybnMgdGhlCmFzc2lnbmVkIHRva2VuIHJhbmdlLgAAAAAPcHVyY2hhc2VfYnlfcmVmAAAAAAEAAAAAAAAADHB1cmNoYXNlX3JlZgAAABAAAAABAAAD6AAAB9AAAAAPUHVyY2hhc2VSZWNlaXB0AA==",
        "AAAAAAAAAeJDYWxsZWQgYnkgdGhlIGJhY2tlbmQgb25jZSBpdCBoYXMgaW5kZXBlbmRlbnRseSB2ZXJpZmllZCAob2ZmLWNoYWluKQp0aGF0IHRoaXMgc3BlY2lmaWMgdG9rZW4ncyBzcGVjaWZpYyBsb2NrZWQtY29udGVudCBpdGVtIGhhZCBpdHMKdW5sb2NrIHJ1bGUgY29tcGxldGVkLiBJZGVtcG90ZW50IOKAlCBjYWxsaW5nIGl0IGFnYWluIGZvciBhbgphbHJlYWR5LXVubG9ja2VkICh0b2tlbiwgaXRlbSkgcGFpciBpcyBhIG5vLW9wLCBub3QgYW4gZXJyb3IsIHNvIGEKcmV0cmllZCBiYWNrZW5kIGNhbGwgYWZ0ZXIgYSBkcm9wcGVkIHJlc3BvbnNlIGlzIHNhZmUuIEtleWVkIGJ5CmAodG9rZW5faWQsIG1lZGlhX2luZGV4KWAgYWxvbmUsIG5vdCBlZGl0aW9uIG9yIG93bmVyOiBlYWNoIGl0ZW0ncwpydWxlIGFwcGxpZXMgdG8gb25lIHNwZWNpZmljIG1pbnRlZCBjb3B5LCBkZWNpZGVkIG9uY2UsIHJlZ2FyZGxlc3MKb2Ygd2hvIGhvbGRzIGl0IGxhdGVyLgAAAAAAD3VubG9ja19pdGVtX2ZvcgAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAALbWVkaWFfaW5kZXgAAAAABAAAAAA=",
        "AAAAAAAAATBBY2NlcHRzIGEgcGVuZGluZyBvd25lcnNoaXAgdHJhbnNmZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsib3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZCJdYAoqIGRhdGEgLSBgW25ld19vd25lcjogQWRkcmVzc11gAAAAEGFjY2VwdF9vd25lcnNoaXAAAAAAAAAAAA==",
        "AAAAAAAAANBQdWJsaWMsIHBlcm1pc3Npb25sZXNzIHJlYWQg4oCUIGFueW9uZSAodGhlIGJ1eWVyLCBhIG1hcmtldHBsYWNlIFVJLAphbiBhdWRpdG9yKSBjYW4gdmVyaWZ5IG9uLWNoYWluIHdoZXRoZXIgYSBnaXZlbiB0b2tlbidzIGdpdmVuCmxvY2tlZC1jb250ZW50IGl0ZW0gd2FzIHVubG9ja2VkLCB3aXRob3V0IHRydXN0aW5nIHRoZSBiYWNrZW5kJ3MKd29yZCBmb3IgaXQuAAAAEGlzX2l0ZW1fdW5sb2NrZWQAAAACAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAC21lZGlhX2luZGV4AAAAAAQAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAQcGxhdGZvcm1fZmVlX2JwcwAAAAAAAAABAAAABA==",
        "AAAAAAAAAiNSZWdpc3RlcnMgYW4gZWRpdGlvbiBhaGVhZCBvZiBpdHMgZmlyc3Qgc2FsZSwgcmV0dXJuaW5nIGl0cyBpZC4KCkdhdGVkIHRvIHRoZSBwcmljZSBhdXRob3JpdHkuIFRoaXMgdXNlZCB0byBoYXBwZW4gbGF6aWx5IGluc2lkZQpgYnV5X2VkaXRpb25gLCBzbyB0aGUgZmlyc3QgY2FsbGVyIGZvciBhbiBgZWRpdGlvbl9yZWZgIOKAlCB0aGUgYXBwJ3Mgb3duCnJvdyBpZCwgdmlzaWJsZSBpbiBldmVyeSBsaXN0aW5nIFVSTCDigJQgcGVybWFuZW50bHkgc2V0IHRoYXQgZWRpdGlvbidzCmNyZWF0b3IsIHByaWNlcywgcm95YWx0eSBhbmQgc3VwcGx5LiBBbnlvbmUgY291bGQgZnJvbnQtcnVuIGFuIHVuc29sZAppdGVtOiBuYW1lIHRoZW1zZWx2ZXMgYGNyZWF0b3JgIHRvIHJlZGlyZWN0IHBheW1lbnRzLCBvciBzZXQKYHN1cHBseTogMWAgYW5kIGJ1eSBpdCB0byBtYWtlIHRoZSBpdGVtIHVuc2VsbGFibGUuCgpJZGVtcG90ZW50IOKAlCByZS1yZWdpc3RlcmluZyBhbiBleGlzdGluZyByZWYgcmV0dXJucyBpdHMgaWQsIHNvIGEKcmV0cmllZCBjYWxsIGlzIHNhZmUuAAAAABByZWdpc3Rlcl9lZGl0aW9uAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtlZGl0aW9uX3JlZgAAAAAQAAAAAAAAAAdlZGl0aW9uAAAAB9AAAAAMRWRpdGlvbklucHV0AAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAQcmVtYWluaW5nX3N1cHBseQAAAAEAAAAAAAAACmVkaXRpb25faWQAAAAAAAQAAAABAAAABA==",
        "AAAAAAAAAAAAAAAQc2V0X3BsYXRmb3JtX2ZlZQAAAAIAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAAAAAK1SZW5ld3Mgb3duZXJzaGlwLCBgVG9rZW5FZGl0aW9uYCBhbmQgYW55IGBMaXN0aW5nYCBmb3IgZWFjaCB0b2tlbi4KClRoZSBsb3dlc3QgY2FwIG9mIHRoZSBmb3VyOiBhIHRva2VuIGNhbiB0b3VjaCBmb3VyIGxlZGdlciBlbnRyaWVzIHdoZXJlCnRoZSBvdGhlciBraW5kcyB0b3VjaCBvbmUgb3IgdHdvLgAAAAAAABFrZWVwX3Rva2Vuc19hbGl2ZQAAAAAAAAEAAAAAAAAACXRva2VuX2lkcwAAAAAAA+oAAAAEAAAAAA==",
        "AAAAAAAAAYVSZW5vdW5jZXMgb3duZXJzaGlwIG9mIHRoZSBjb250cmFjdC4KClBlcm1hbmVudGx5IHJlbW92ZXMgdGhlIG93bmVyLCBkaXNhYmxpbmcgYWxsIGZ1bmN0aW9ucyBnYXRlZCBieQpgI1tvbmx5X293bmVyXWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYE93bmFibGVFcnJvcjo6VHJhbnNmZXJJblByb2dyZXNzYF0gLSBJZiB0aGVyZSBpcyBhIHBlbmRpbmcgb3duZXJzaGlwCnRyYW5zZmVyLgoqIFtgT3duYWJsZUVycm9yOjpPd25lck5vdFNldGBdIC0gSWYgdGhlIG93bmVyIGlzIG5vdCBzZXQuCgojIE5vdGVzCgoqIEF1dGhvcml6YXRpb24gZm9yIHRoZSBjdXJyZW50IG93bmVyIGlzIHJlcXVpcmVkLgAAAAAAABJyZW5vdW5jZV9vd25lcnNoaXAAAAAAAAAAAAAA",
        "AAAAAAAAA45Jbml0aWF0ZXMgYSAyLXN0ZXAgb3duZXJzaGlwIHRyYW5zZmVyIHRvIGEgbmV3IGFkZHJlc3MuCgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGN1cnJlbnQgb3duZXIuIFRoZSBuZXcgb3duZXIgbXVzdCBsYXRlcgpjYWxsIGBhY2NlcHRfb3duZXJzaGlwKClgIHRvIGNvbXBsZXRlIHRoZSB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgbmV3X293bmVyYCAtIFRoZSBwcm9wb3NlZCBuZXcgb3duZXIuCiogYGxpdmVfdW50aWxfbGVkZ2VyYCAtIExlZGdlciBudW1iZXIgdW50aWwgd2hpY2ggdGhlIG5ldyBvd25lciBjYW4KYWNjZXB0LiBBIHZhbHVlIG9mIGAwYCBjYW5jZWxzIGFueSBwZW5kaW5nIHRyYW5zZmVyLgoKIyBFcnJvcnMKCiogW2BPd25hYmxlRXJyb3I6Ok93bmVyTm90U2V0YF0gLSBJZiB0aGUgb3duZXIgaXMgbm90IHNldC4KKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgb3duZXIgaXMgcmVxdWlyZWQuAAAAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA",
        "AAAAAAAAANdSZXR1cm5zIHdoZXRoZXIgdGhlIGBvcGVyYXRvcmAgaXMgYWxsb3dlZCB0byBtYW5hZ2UgYWxsIHRoZSBhc3NldHMgb2YKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gQWNjb3VudCBvZiB0aGUgdG9rZW4ncyBvd25lci4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBiZSBjaGVja2VkLgAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
        "AAAAAAAAAThSZW5ld3Mgb25seSB0aGlzIGNvbnRyYWN0J3Mgb3duIGluc3RhbmNlIGVudHJ5LgoKVGhlIGluc3RhbmNlIGhvbGRzIGBUcmVhc3VyeWAsIGBQcmljZUF1dGhvcml0eWAsIGBQbGF0Zm9ybUZlZUJwc2AsCmBOZXh0RWRpdGlvbklkYCBhbmQgdGhlIHdhc20gcmVmZXJlbmNlIOKAlCBsb3NlIGl0IGFuZCBub3RoaW5nIHdvcmtzLCBzbwp0aGlzIGlzIHRoZSBvbmUgd29ydGggYmVpbmcgYWJsZSB0byBydW4gb24gaXRzIG93bi4gRXZlcnkgb3RoZXIKYGtlZXBfKl9hbGl2ZWAgcmVuZXdzIGl0IHRvbzsgdGhpcyBpcyB0aGUgbm8tYXJndW1lbnQgY2FzZS4AAAATa2VlcF9jb250cmFjdF9hbGl2ZQAAAAAAAAAAAA==",
        "AAAAAAAAAU5SZW5ld3MgYEVkaXRpb25gIGFuZCBgRWRpdGlvblByaWNlc2AgZm9yIGVhY2ggaWQuCgpPbmUgb2YgdGhlIHNpbmdsZS1raW5kIGVudHJ5IHBvaW50cywgZm9yIGFuIG9wZXJhdG9yIHJ1bm5pbmcgYSBzd2VlcCBieQpoYW5kLiBUaGV5IGV4aXN0IGFsb25nc2lkZSBbYFNlbGY6OmtlZXBfYWxpdmVgXSBiZWNhdXNlIG1peGluZyBraW5kcyBpbgpvbmUgY2FsbCBpcyB3aGF0IG1ha2VzIGEgYmF0Y2ggb3ZlcmZsb3cgdGhlIHRyYW5zYWN0aW9uIGZvb3RwcmludCDigJQKaGVyZSB0aGF0IGlzIG5vdCBleHByZXNzaWJsZSwgYW5kIGVhY2ggY2FwIGlzIHNpemVkIGZvciBpdHMgb3duIGtpbmQuAAAAAAATa2VlcF9lZGl0aW9uc19hbGl2ZQAAAAABAAAAAAAAAAtlZGl0aW9uX2lkcwAAAAPqAAAABAAAAAA=",
        "AAAAAAAAAHxSZW5ld3MgYFVubG9ja2VkKHRva2VuX2lkLCBtZWRpYV9pbmRleClgIGZvciBlYWNoIHBhaXIuIExvc2luZyBvbmUKc2lsZW50bHkgcmUtbG9ja3MgcmV3YXJkIGNvbnRlbnQgYSBob2xkZXIgYWxyZWFkeSBlYXJuZWQuAAAAE2tlZXBfdW5sb2NrZWRfYWxpdmUAAAAAAQAAAAAAAAAIdW5sb2NrZWQAAAPqAAAD7QAAAAIAAAAEAAAABAAAAAA=",
        "AAAAAAAAANZSb3RhdGVzIHRoZSBwcmljZSBhdXRob3JpdHkncyBob3Qga2V5IOKAlCBzYW1lIHJhdGlvbmFsZSBhcwpgc2V0X3VubG9ja19hdXRob3JpdHlgOiB0aGlzIGtleSBnZXRzIGNhbGxlZCBieSB0aGUgYmFja2VuZCBvbgpldmVyeSBjcmVhdG9yIGVkaXQsIHNvIGJlaW5nIGFibGUgdG8gc3dhcCBpdCB3aXRob3V0IHRvdWNoaW5nIHRoZQpvd25lcidzIGNvbGQga2V5IG1hdHRlcnMuAAAAAAATc2V0X3ByaWNlX2F1dGhvcml0eQAAAAABAAAAAAAAAA1uZXdfYXV0aG9yaXR5AAAAAAAAEwAAAAA=",
        "AAAAAAAAARhSb3RhdGVzIHRoZSB1bmxvY2sgYXV0aG9yaXR5J3MgaG90IGtleSB3aXRob3V0IGEgZnVsbCB1cGdyYWRlIOKAlCB0aGUKYmFja2VuZCBwcm9jZXNzIGhvbGRpbmcgdGhpcyBrZXkgZ2V0cyBjYWxsZWQgYXV0b21hdGljYWxseSBhbmQKb2Z0ZW4sIHNvIGJlaW5nIGFibGUgdG8gc3dhcCBpdCAoZS5nLiBhZnRlciBhIHN1c3BlY3RlZCBsZWFrKQp3aXRob3V0IHRvdWNoaW5nIHRoZSBvd25lcidzIGNvbGQga2V5IG1hdHRlcnMgbW9yZSBoZXJlIHRoYW4gZm9yCm1vc3QgYWRtaW4gc2V0dGluZ3MuAAAAFHNldF91bmxvY2tfYXV0aG9yaXR5AAAAAQAAAAAAAAANbmV3X2F1dGhvcml0eQAAAAAAABMAAAAA",
        "AAAAAAAAANJSZW5ld3MgYEVkaXRpb25CeVJlZmAgZm9yIGVhY2ggcmVmIOKAlCB0aGUgZW50cnkgd2hvc2UgbG9zcyBpcyB3b3JzdCwKc2luY2Ugd2l0aG91dCBpdCBgYnV5X2VkaXRpb25gIGNhbm5vdCByZXNvbHZlIGEgcmVmIGFuZApgcmVnaXN0ZXJfZWRpdGlvbmAgd291bGQgY3JlYXRlIGEgZHVwbGljYXRlIGVkaXRpb24gaW5zdGVhZCBvZiBmaW5kaW5nCnRoZSBvcmlnaW5hbC4AAAAAABdrZWVwX2VkaXRpb25fcmVmc19hbGl2ZQAAAAABAAAAAAAAAAxlZGl0aW9uX3JlZnMAAAPqAAAAEAAAAAA=",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABAAAAAAAAAAAAAAADE93bmFibGVFcnJvcgAAAAMAAAAAAAAAC093bmVyTm90U2V0AAAACDQAAAAAAAAAElRyYW5zZmVySW5Qcm9ncmVzcwAAAAAINQAAAAAAAAAPT3duZXJBbHJlYWR5U2V0AAAACDY=",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGluaXRpYXRlZC4AAAAAAAAAAAART3duZXJzaGlwVHJhbnNmZXIAAAAAAAABAAAAEm93bmVyc2hpcF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gb3duZXJzaGlwIGlzIHJlbm91bmNlZC4AAAAAAAAAAAAST3duZXJzaGlwUmVub3VuY2VkAAAAAAABAAAAE293bmVyc2hpcF9yZW5vdW5jZWQAAAAAAQAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGNvbXBsZXRlZC4AAAAAAAAAAAAaT3duZXJzaGlwVHJhbnNmZXJDb21wbGV0ZWQAAAAAAAEAAAAcb3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAEAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAAAAAAAGUGF1c2VkAAAAAAABAAAABnBhdXNlZAAAAAAAAAAAAAI=",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHVucGF1c2VkLgAAAAAAAAAIVW5wYXVzZWQAAAABAAAACHVucGF1c2VkAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAADVBhdXNhYmxlRXJyb3IAAAAAAAACAAAANFRoZSBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAANRW5mb3JjZWRQYXVzZQAAAAAAA+gAAAA4VGhlIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSB0aGUgY29udHJhY3QgaXMgbm90IHBhdXNlZC4AAAANRXhwZWN0ZWRQYXVzZQAAAAAAA+k=",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYW4gYXBwcm92YWwgaXMgZ3JhbnRlZC4AAAAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAIYXBwcm92ZWQAAAATAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyB0cmFuc2ZlcnJlZC4AAAAAAAAAAAAIVHJhbnNmZXIAAAABAAAACHRyYW5zZmVyAAAAAwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYXBwcm92YWwgZm9yIGFsbCB0b2tlbnMgaXMgZ3JhbnRlZC4AAAAAAAAAAAANQXBwcm92ZUZvckFsbAAAAAAAAAEAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
        "AAAABAAAAAAAAAAAAAAAFU5vbkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAAAA8AAAAkSW5kaWNhdGVzIGEgbm9uLWV4aXN0ZW50IGB0b2tlbl9pZGAuAAAAEE5vbkV4aXN0ZW50VG9rZW4AAADIAAAAV0luZGljYXRlcyBhbiBlcnJvciByZWxhdGVkIHRvIHRoZSBvd25lcnNoaXAgb3ZlciBhIHBhcnRpY3VsYXIgdG9rZW4uClVzZWQgaW4gdHJhbnNmZXJzLgAAAAAOSW5jb3JyZWN0T3duZXIAAAAAAMkAAABFSW5kaWNhdGVzIGEgZmFpbHVyZSB3aXRoIHRoZSBgb3BlcmF0b3JgcyBhcHByb3ZhbC4gVXNlZCBpbiB0cmFuc2ZlcnMuAAAAAAAAFEluc3VmZmljaWVudEFwcHJvdmFsAAAAygAAAFVJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGBhcHByb3ZlcmAgb2YgYSB0b2tlbiB0byBiZSBhcHByb3ZlZC4gVXNlZAppbiBhcHByb3ZhbHMuAAAAAAAAD0ludmFsaWRBcHByb3ZlcgAAAADLAAAASkluZGljYXRlcyBhbiBpbnZhbGlkIHZhbHVlIGZvciBgbGl2ZV91bnRpbF9sZWRnZXJgIHdoZW4gc2V0dGluZwphcHByb3ZhbHMuAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAzAAAAClJbmRpY2F0ZXMgb3ZlcmZsb3cgd2hlbiBhZGRpbmcgdHdvIHZhbHVlcwAAAAAAAAxNYXRoT3ZlcmZsb3cAAADNAAAANkluZGljYXRlcyBhbGwgcG9zc2libGUgYHRva2VuX2lkYHMgYXJlIGFscmVhZHkgaW4gdXNlLgAAAAAAE1Rva2VuSURzQXJlRGVwbGV0ZWQAAAAAzgAAAEVJbmRpY2F0ZXMgYW4gaW52YWxpZCBhbW91bnQgdG8gYmF0Y2ggbWludCBpbiBgY29uc2VjdXRpdmVgIGV4dGVuc2lvbi4AAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAM8AAAAzSW5kaWNhdGVzIHRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdCBpbiBvd25lcidzIGxpc3QuAAAAABhUb2tlbk5vdEZvdW5kSW5Pd25lckxpc3QAAADQAAAAMkluZGljYXRlcyB0aGUgdG9rZW4gZG9lcyBub3QgZXhpc3QgaW4gZ2xvYmFsIGxpc3QuAAAAAAAZVG9rZW5Ob3RGb3VuZEluR2xvYmFsTGlzdAAAAAAAANEAAAAjSW5kaWNhdGVzIGFjY2VzcyB0byB1bnNldCBtZXRhZGF0YS4AAAAADVVuc2V0TWV0YWRhdGEAAAAAAADSAAAAQUluZGljYXRlcyB0aGUgbGVuZ3RoIG9mIHRoZSBiYXNlIFVSSSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAFUJhc2VVcmlNYXhMZW5FeGNlZWRlZAAAAAAAANMAAABHSW5kaWNhdGVzIHRoZSByb3lhbHR5IGFtb3VudCBpcyBoaWdoZXIgdGhhbiAxMF8wMDAgKDEwMCUpIGJhc2lzIHBvaW50cy4AAAAAFEludmFsaWRSb3lhbHR5QW1vdW50AAAA1AAAAD1JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgbmFtZSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAEk5hbWVNYXhMZW5FeGNlZWRlZAAAAAAA1QAAAD9JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgc3ltYm9sIGV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZC4AAAAAFFN5bWJvbE1heExlbkV4Y2VlZGVkAAAA1g==",
        "AAAABQAAADFFdmVudCBlbWl0dGVkIHdoZW4gY29uc2VjdXRpdmUgdG9rZW5zIGFyZSBtaW50ZWQuAAAAAAAAAAAAAA9Db25zZWN1dGl2ZU1pbnQAAAAAAQAAABBjb25zZWN1dGl2ZV9taW50AAAAAwAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAA1mcm9tX3Rva2VuX2lkAAAAAAAABAAAAAAAAAAAAAAAC3RvX3Rva2VuX2lkAAAAAAQAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    buy: this.txFromJSON<null>,
        list: this.txFromJSON<null>,
        name: this.txFromJSON<string>,
        pause: this.txFromJSON<null>,
        paused: this.txFromJSON<boolean>,
        symbol: this.txFromJSON<string>,
        approve: this.txFromJSON<null>,
        balance: this.txFromJSON<u32>,
        listing: this.txFromJSON<Option<Listing>>,
        unpause: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        version: this.txFromJSON<u32>,
        art_meta: this.txFromJSON<Option<ArtMeta>>,
        owner_of: this.txFromJSON<string>,
        transfer: this.txFromJSON<null>,
        treasury: this.txFromJSON<Option<string>>,
        buy_batch: this.txFromJSON<null>,
        get_owner: this.txFromJSON<Option<string>>,
        token_uri: this.txFromJSON<string>,
        keep_alive: this.txFromJSON<null>,
        list_batch: this.txFromJSON<null>,
        buy_edition: this.txFromJSON<readonly [u32, u32]>,
        edition_meta: this.txFromJSON<Option<EditionMeta>>,
        get_approved: this.txFromJSON<Option<string>>,
        royalty_info: this.txFromJSON<readonly [string, i128]>,
        transfer_from: this.txFromJSON<null>,
        cancel_listing: this.txFromJSON<null>,
        edition_by_ref: this.txFromJSON<Option<u32>>,
        edition_prices: this.txFromJSON<Array<PriceEntry>>,
        sale_breakdown: this.txFromJSON<Option<SaleBreakdown>>,
        update_edition: this.txFromJSON<null>,
        approve_for_all: this.txFromJSON<null>,
        price_authority: this.txFromJSON<Option<string>>,
        purchase_by_ref: this.txFromJSON<Option<PurchaseReceipt>>,
        unlock_item_for: this.txFromJSON<null>,
        accept_ownership: this.txFromJSON<null>,
        is_item_unlocked: this.txFromJSON<boolean>,
        platform_fee_bps: this.txFromJSON<u32>,
        register_edition: this.txFromJSON<u32>,
        remaining_supply: this.txFromJSON<u32>,
        set_platform_fee: this.txFromJSON<null>,
        keep_tokens_alive: this.txFromJSON<null>,
        renounce_ownership: this.txFromJSON<null>,
        transfer_ownership: this.txFromJSON<null>,
        is_approved_for_all: this.txFromJSON<boolean>,
        keep_contract_alive: this.txFromJSON<null>,
        keep_editions_alive: this.txFromJSON<null>,
        keep_unlocked_alive: this.txFromJSON<null>,
        set_price_authority: this.txFromJSON<null>,
        set_unlock_authority: this.txFromJSON<null>,
        keep_edition_refs_alive: this.txFromJSON<null>
  }
}