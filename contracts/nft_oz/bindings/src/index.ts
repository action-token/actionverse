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
 * Off-chain-media descriptor for one piece. Royalty basis points are
 * deliberately absent — those live in the OpenZeppelin royalties extension so
 * `royalty_info` stays the single source of truth for any marketplace reading
 * this collection.
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
 * At most one listing per token, since a 1-of-1 has exactly one owner who
 * could be selling it.
 */
export interface Listing {
  /**
 * SEP-41 token the price is denominated in — the native XLM SAC by
 * default, but stored per listing so a platform token or USDC can be
 * accepted later without changing this contract.
 */
payment_token: string;
  price: i128;
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
   * The listing's seller no longer owns the token — it was transferred or
   * burned out from under the listing.
   */
  309: {message:"ListingStale"},
  310: {message:"NotCreator"},
  /**
   * This `ref` already minted a token — guards against double-minting the
   * same off-chain record.
   */
  311: {message:"DuplicateRef"},
  312: {message:"RefTooLong"}
}


/**
 * Author-supplied fields for a new piece, grouped into one argument so
 * `mint_and_list` (which also needs `price` and `payment_token`) stays under
 * Soroban's 10-parameter-per-function cap (`SCSpecFunctionV0.inputs<10>`) —
 * the same limit that forced `ft_oz::ArtInput` into existence.
 */
export interface ArtInput {
  description: string;
  media_type: string;
  media_url: string;
  royalty_bps: u32;
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
   * Buys a listed token in a single invocation: payment out, token in.
   * 
   * Only the buyer signs. The seller's consent was given when they created
   * the listing, and the token moves via [`Base::update`] (the low-level,
   * no-auth path) rather than [`Base::transfer`], which would demand the
   * seller's signature at purchase time.
   */
  buy: ({buyer, token_id}: {buyer: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Destroys the token with `token_id` from `from`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `from` - The account whose token is destroyed.
   * * `token_id` - The identifier of the token to burn.
   * 
   * # Errors
   * 
   * * [`crate::non_fungible::NonFungibleTokenError::NonExistentToken`] -
   * When attempting to burn a token that does not exist.
   * * [`crate::non_fungible::NonFungibleTokenError::IncorrectOwner`] - If
   * the current owner (before calling this function) is not `from`.
   * 
   * # Events
   * 
   * * topics - `["burn", from: Address]`
   * * data - `[token_id: u32]`
   */
  burn: ({from, token_id}: {from: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a list transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Lists the caller's token for sale. Listing does not escrow the token —
   * the owner keeps it and can still transfer or burn it, which is why
   * `buy` re-checks ownership rather than trusting the stored seller.
   */
  list: ({seller, token_id, price, payment_token}: {seller: string, token_id: u32, price: i128, payment_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Emergency stop for `mint_art`, `mint_and_list`, `list`, and `buy`. Transfers, approvals,
   * and `cancel_listing` stay open so holders can always exit a position
   * while the platform is halted.
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
   * Construct and simulate a art_meta transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  art_meta: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ArtMeta>>>

  /**
   * Construct and simulate a mint_art transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mints a 1-of-1 to `creator` and returns its `token_id`.
   * 
   * Open to any address that signs as its own `creator` — this is a public
   * collection, and gating it behind an allowlist is a product decision
   * made off-chain (the tRPC layer only offers this to approved creators).
   * Note the auth is on `creator`, the *minter*, not on a recipient: a
   * recipient-authorized mint would let anyone mint tokens to themselves in
   * someone else's name.
   * 
   * `art_ref` is the caller's own identifier for this piece (the database
   * row id). It is recorded so the minted `token_id` can be looked up later
   * with [`Self::token_by_ref`] — the client cannot read it out of the
   * transaction result, because this repo's pinned `stellar-sdk` cannot
   * decode protocol-27 transaction meta. Minting twice under one `art_ref`
   * is rejected, which also makes a retried mint safe.
   * 
   * Mints without listing. Kept for programmatic use (e.g. minting into a
   * collection without immediately selling); the storefront's "create for
   * sale" flow uses [`Self::mint_and_list`] instead — 
   */
  mint_art: ({creator, art_ref, art}: {creator: string, art_ref: string, art: ArtInput}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
   * Construct and simulate a burn_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Destroys the token with `token_id` from `from`, by using `spender`s
   * approval.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `spender` - The account that is allowed to burn the token on behalf of
   * the owner.
   * * `from` - The account whose token is destroyed.
   * * `token_id` - The identifier of the token to burn.
   * 
   * # Errors
   * 
   * * [`crate::non_fungible::NonFungibleTokenError::NonExistentToken`] -
   * When attempting to burn a token that does not exist.
   * * [`crate::non_fungible::NonFungibleTokenError::IncorrectOwner`] - If
   * the current owner (before calling this function) is not `from`.
   * * [`crate::non_fungible::NonFungibleTokenError::InsufficientApproval`] -
   * If the spender does not have a valid approval.
   * 
   * # Events
   * 
   * * topics - `["burn", from: Address]`
   * * data - `[token_id: u32]`
   */
  burn_from: ({spender, from, token_id}: {spender: string, from: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Returns `(Address, i128)` - A tuple containing the receiver address and
   * the royalty amount.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `token_id` - The identifier of the token.
   * * `sale_price` - The sale price for which royalties are being
   * calculated.
   * 
   * # Errors
   * 
   * * [`crate::non_fungible::NonFungibleTokenError::NonExistentToken`] - If
   * the token does not exist.
   */
  royalty_info: ({token_id, sale_price}: {token_id: u32, sale_price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<readonly [string, i128]>>

  /**
   * Construct and simulate a token_by_ref transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolves the caller's off-chain reference back to the minted token id.
   * This is how the backend confirms a mint landed and learns its id.
   */
  token_by_ref: ({art_ref}: {art_ref: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

  /**
   * Construct and simulate a mint_and_list transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mints and lists in one signed call.
   * 
   * Two separate transactions here — mint, then a follow-up `list` — used
   * to be how the storefront created a for-sale piece. That shape needs the
   * second transaction to read back the first one's effects (the new
   * `token_id`, the account's bumped sequence number) through the public
   * Soroban RPC pool, which propagates those effects to different backend
   * nodes at different times. A read landing on a lagging node reads stale
   * state, and a transaction built from stale state is invalid — sometimes
   * caught here as a clear contract error, sometimes only failing deep
   * inside a wallet as an opaque submission error. There is no gap to lose
   * a race in when it's one call: mint and list happen atomically, so there
   * is nothing for a second transaction to read back before it can proceed.
   */
  mint_and_list: ({creator, art_ref, art, price, payment_token}: {creator: string, art_ref: string, art: ArtInput, price: i128, payment_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
   * Construct and simulate a sale_breakdown transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only preview of `buy`'s payment split, so the UI can show the
   * buyer exactly where their money goes before they sign.
   */
  sale_breakdown: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<SaleBreakdown>>>

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
   * Construct and simulate a platform_fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  platform_fee_bps: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_platform_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_platform_fee: ({fee_bps, treasury}: {fee_bps: u32, treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_token_royalty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Per-token royalty, changeable only by the piece's original creator —
   * not by whoever currently holds it, so a buyer can't strip the royalty
   * off a work before flipping it.
   */
  set_token_royalty: ({token_id, receiver, basis_points, operator}: {token_id: u32, receiver: string, basis_points: u32, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a set_default_royalty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Collection-wide fallback royalty, for tokens with none of their own.
   */
  set_default_royalty: ({receiver, basis_points, operator}: {receiver: string, basis_points: u32, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a remove_token_royalty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remove_token_royalty: ({token_id, operator}: {token_id: u32, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {owner, treasury, platform_fee_bps, name, symbol, base_uri}: {owner: string, treasury: string, platform_fee_bps: u32, name: string, symbol: string, base_uri: string},
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
    return ContractClient.deploy({owner, treasury, platform_fee_bps, name, symbol, base_uri}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABQAAAAAAAAAAAAAABkxpc3RlZAAAAAAAAQAAAAZsaXN0ZWQAAAAAAAQAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAEAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAAAAAADXBheW1lbnRfdG9rZW4AAAAAAAATAAAAAAAAAAI=",
        "AAAAAQAAAO1PZmYtY2hhaW4tbWVkaWEgZGVzY3JpcHRvciBmb3Igb25lIHBpZWNlLiBSb3lhbHR5IGJhc2lzIHBvaW50cyBhcmUKZGVsaWJlcmF0ZWx5IGFic2VudCDigJQgdGhvc2UgbGl2ZSBpbiB0aGUgT3BlblplcHBlbGluIHJveWFsdGllcyBleHRlbnNpb24gc28KYHJveWFsdHlfaW5mb2Agc3RheXMgdGhlIHNpbmdsZSBzb3VyY2Ugb2YgdHJ1dGggZm9yIGFueSBtYXJrZXRwbGFjZSByZWFkaW5nCnRoaXMgY29sbGVjdGlvbi4AAAAAAAAAAAAAB0FydE1ldGEAAAAABgAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAptZWRpYV90eXBlAAAAAAAQAAAAAAAAAAltZWRpYV91cmwAAAAAAAAQAAAAAAAAAA10aHVtYm5haWxfdXJsAAAAAAAAEAAAAAAAAAAFdGl0bGUAAAAAAAAQ",
        "AAAAAQAAAFxBdCBtb3N0IG9uZSBsaXN0aW5nIHBlciB0b2tlbiwgc2luY2UgYSAxLW9mLTEgaGFzIGV4YWN0bHkgb25lIG93bmVyIHdobwpjb3VsZCBiZSBzZWxsaW5nIGl0LgAAAAAAAAAHTGlzdGluZwAAAAADAAAAtFNFUC00MSB0b2tlbiB0aGUgcHJpY2UgaXMgZGVub21pbmF0ZWQgaW4g4oCUIHRoZSBuYXRpdmUgWExNIFNBQyBieQpkZWZhdWx0LCBidXQgc3RvcmVkIHBlciBsaXN0aW5nIHNvIGEgcGxhdGZvcm0gdG9rZW4gb3IgVVNEQyBjYW4gYmUKYWNjZXB0ZWQgbGF0ZXIgd2l0aG91dCBjaGFuZ2luZyB0aGlzIGNvbnRyYWN0LgAAAA1wYXltZW50X3Rva2VuAAAAAAAAEwAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAZzZWxsZXIAAAAAABM=",
        "AAAABAAAAAAAAAAAAAAACEFydEVycm9yAAAADQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAASwAAAAAAAAACkludmFsaWRGZWUAAAAAAS0AAAAAAAAADkludmFsaWRSb3lhbHR5AAAAAAEuAAAAAAAAAAtOYW1lVG9vTG9uZwAAAAEvAAAAAAAAABJEZXNjcmlwdGlvblRvb0xvbmcAAAAAATAAAAAAAAAACkludmFsaWRVcmkAAAAAATEAAAAAAAAAD0xpc3RpbmdOb3RGb3VuZAAAAAEyAAAAAAAAAAxTZWxmUHVyY2hhc2UAAAEzAAAAAAAAAAlOb3RTZWxsZXIAAAAAAAE0AAAAalRoZSBsaXN0aW5nJ3Mgc2VsbGVyIG5vIGxvbmdlciBvd25zIHRoZSB0b2tlbiDigJQgaXQgd2FzIHRyYW5zZmVycmVkIG9yCmJ1cm5lZCBvdXQgZnJvbSB1bmRlciB0aGUgbGlzdGluZy4AAAAAAAxMaXN0aW5nU3RhbGUAAAE1AAAAAAAAAApOb3RDcmVhdG9yAAAAAAE2AAAAXlRoaXMgYHJlZmAgYWxyZWFkeSBtaW50ZWQgYSB0b2tlbiDigJQgZ3VhcmRzIGFnYWluc3QgZG91YmxlLW1pbnRpbmcgdGhlCnNhbWUgb2ZmLWNoYWluIHJlY29yZC4AAAAAAAxEdXBsaWNhdGVSZWYAAAE3AAAAAAAAAApSZWZUb29Mb25nAAAAAAE4",
        "AAAAAQAAARhBdXRob3Itc3VwcGxpZWQgZmllbGRzIGZvciBhIG5ldyBwaWVjZSwgZ3JvdXBlZCBpbnRvIG9uZSBhcmd1bWVudCBzbwpgbWludF9hbmRfbGlzdGAgKHdoaWNoIGFsc28gbmVlZHMgYHByaWNlYCBhbmQgYHBheW1lbnRfdG9rZW5gKSBzdGF5cyB1bmRlcgpTb3JvYmFuJ3MgMTAtcGFyYW1ldGVyLXBlci1mdW5jdGlvbiBjYXAgKGBTQ1NwZWNGdW5jdGlvblYwLmlucHV0czwxMD5gKSDigJQKdGhlIHNhbWUgbGltaXQgdGhhdCBmb3JjZWQgYGZ0X296OjpBcnRJbnB1dGAgaW50byBleGlzdGVuY2UuAAAAAAAAAAhBcnRJbnB1dAAAAAYAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAACm1lZGlhX3R5cGUAAAAAABAAAAAAAAAACW1lZGlhX3VybAAAAAAAABAAAAAAAAAAC3JveWFsdHlfYnBzAAAAAAQAAAAAAAAADXRodW1ibmFpbF91cmwAAAAAAAAQAAAAAAAAAAV0aXRsZQAAAAAAABA=",
        "AAAABQAAAAAAAAAAAAAACUFydE1pbnRlZAAAAAAAAAEAAAAKYXJ0X21pbnRlZAAAAAAAAwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAQAAAAAAAAALcm95YWx0eV9icHMAAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACVB1cmNoYXNlZAAAAAAAAAEAAAAJcHVyY2hhc2VkAAAAAAAABgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAQAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAAAAAAMcm95YWx0eV9wYWlkAAAACwAAAAAAAAAAAAAAEXBsYXRmb3JtX2ZlZV9wYWlkAAAAAAAACwAAAAAAAAAC",
        "AAAAAQAAAG1XaGF0IGEgYnV5ZXIgd2lsbCBhY3R1YWxseSBiZSBjaGFyZ2VkLCBicm9rZW4gb3V0IHNvIHRoZSBVSSBjYW4gc2hvdyB0aGUKc3BsaXQgYmVmb3JlIGFza2luZyBmb3IgYSBzaWduYXR1cmUuAAAAAAAAAAAAAA1TYWxlQnJlYWtkb3duAAAAAAAABQAAAAAAAAAMcGxhdGZvcm1fZmVlAAAACwAAAAAAAAAHcm95YWx0eQAAAAALAAAAAAAAABByb3lhbHR5X3JlY2VpdmVyAAAAEwAAAAAAAAANc2VsbGVyX2Ftb3VudAAAAAAAAAsAAAAAAAAABXRvdGFsAAAAAAAACw==",
        "AAAABQAAAAAAAAAAAAAAEExpc3RpbmdDYW5jZWxsZWQAAAABAAAAEWxpc3RpbmdfY2FuY2VsbGVkAAAAAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAAElBsYXRmb3JtRmVlVXBkYXRlZAAAAAAAAQAAABRwbGF0Zm9ybV9mZWVfdXBkYXRlZAAAAAIAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAAAAAAC",
        "AAAAAAAAATpCdXlzIGEgbGlzdGVkIHRva2VuIGluIGEgc2luZ2xlIGludm9jYXRpb246IHBheW1lbnQgb3V0LCB0b2tlbiBpbi4KCk9ubHkgdGhlIGJ1eWVyIHNpZ25zLiBUaGUgc2VsbGVyJ3MgY29uc2VudCB3YXMgZ2l2ZW4gd2hlbiB0aGV5IGNyZWF0ZWQKdGhlIGxpc3RpbmcsIGFuZCB0aGUgdG9rZW4gbW92ZXMgdmlhIFtgQmFzZTo6dXBkYXRlYF0gKHRoZSBsb3ctbGV2ZWwsCm5vLWF1dGggcGF0aCkgcmF0aGVyIHRoYW4gW2BCYXNlOjp0cmFuc2ZlcmBdLCB3aGljaCB3b3VsZCBkZW1hbmQgdGhlCnNlbGxlcidzIHNpZ25hdHVyZSBhdCBwdXJjaGFzZSB0aW1lLgAAAAAAA2J1eQAAAAACAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAAAAAAAiNEZXN0cm95cyB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgIGZyb20gYGZyb21gLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBmcm9tYCAtIFRoZSBhY2NvdW50IHdob3NlIHRva2VuIGlzIGRlc3Ryb3llZC4KKiBgdG9rZW5faWRgIC0gVGhlIGlkZW50aWZpZXIgb2YgdGhlIHRva2VuIHRvIGJ1cm4uCgojIEVycm9ycwoKKiBbYGNyYXRlOjpub25fZnVuZ2libGU6Ok5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6Tm9uRXhpc3RlbnRUb2tlbmBdIC0KV2hlbiBhdHRlbXB0aW5nIHRvIGJ1cm4gYSB0b2tlbiB0aGF0IGRvZXMgbm90IGV4aXN0LgoqIFtgY3JhdGU6Om5vbl9mdW5naWJsZTo6Tm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbmNvcnJlY3RPd25lcmBdIC0gSWYKdGhlIGN1cnJlbnQgb3duZXIgKGJlZm9yZSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24pIGlzIG5vdCBgZnJvbWAuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJidXJuIiwgZnJvbTogQWRkcmVzc11gCiogZGF0YSAtIGBbdG9rZW5faWQ6IHUzMl1gAAAAAARidXJuAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAAAAAAAM1MaXN0cyB0aGUgY2FsbGVyJ3MgdG9rZW4gZm9yIHNhbGUuIExpc3RpbmcgZG9lcyBub3QgZXNjcm93IHRoZSB0b2tlbiDigJQKdGhlIG93bmVyIGtlZXBzIGl0IGFuZCBjYW4gc3RpbGwgdHJhbnNmZXIgb3IgYnVybiBpdCwgd2hpY2ggaXMgd2h5CmBidXlgIHJlLWNoZWNrcyBvd25lcnNoaXAgcmF0aGVyIHRoYW4gdHJ1c3RpbmcgdGhlIHN0b3JlZCBzZWxsZXIuAAAAAAAABGxpc3QAAAAEAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAA1wYXltZW50X3Rva2VuAAAAAAAAEwAAAAA=",
        "AAAAAAAAAFtSZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIG5hbWUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAALtFbWVyZ2VuY3kgc3RvcCBmb3IgYG1pbnRfYXJ0YCwgYG1pbnRfYW5kX2xpc3RgLCBgbGlzdGAsIGFuZCBgYnV5YC4gVHJhbnNmZXJzLCBhcHByb3ZhbHMsCmFuZCBgY2FuY2VsX2xpc3RpbmdgIHN0YXkgb3BlbiBzbyBob2xkZXJzIGNhbiBhbHdheXMgZXhpdCBhIHBvc2l0aW9uCndoaWxlIHRoZSBwbGF0Zm9ybSBpcyBoYWx0ZWQuAAAAAAVwYXVzZQAAAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAHFSZXR1cm5zIHRydWUgaWYgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZCwgYW5kIGZhbHNlIG90aGVyd2lzZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgAAAAAAAAZwYXVzZWQAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAF1SZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIHN5bWJvbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAABABHaXZlcyBwZXJtaXNzaW9uIHRvIGBhcHByb3ZlZGAgdG8gdHJhbnNmZXIgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCB0bwphbm90aGVyIGFjY291bnQuIFRoZSBhcHByb3ZhbCBpcyBjbGVhcmVkIHdoZW4gdGhlIHRva2VuIGlzCnRyYW5zZmVycmVkLgoKT25seSBhIHNpbmdsZSBhY2NvdW50IGNhbiBiZSBhcHByb3ZlZCBhdCBhIHRpbWUgZm9yIGEgYHRva2VuX2lkYC4KVG8gcmVtb3ZlIGFuIGFwcHJvdmFsLCB0aGUgYXBwcm92ZXIgY2FuIGFwcHJvdmUgdGhlaXIgb3duIGFkZHJlc3MsCmVmZmVjdGl2ZWx5IHJlbW92aW5nIHRoZSBwcmV2aW91cyBhcHByb3ZlZCBhZGRyZXNzLiBBbHRlcm5hdGl2ZWx5LApzZXR0aW5nIHRoZSBgbGl2ZV91bnRpbF9sZWRnZXJgIHRvIGAwYCB3aWxsIGFsc28gcmV2b2tlIHRoZSBhcHByb3ZhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhcHByb3ZlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgYXBwcm92ZXIgKHNob3VsZCBiZSBgb3duZXJgIG9yCmBvcGVyYXRvcmApLgoqIGBhcHByb3ZlZGAgLSBUaGUgYWRkcmVzcyByZWNlaXZpbmcgdGhlIGFwcHJvdmFsLgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6Tm9uRXhpc3RlbnRUb2tlbmBdIC0gSWYgdGhlIHRva2VuIGRvZXMgbm90CmV4aXN0LgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbnZhbGlkQXBwcm92ZXJgXSAtIElmIHRoZSBvd25lciBhZGRyZXNzIGlzCm5vdCB0aGUgYWN0dWFsIG93bmVyIG9mIHRoZSB0b2tlbi4KKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAAAhhcHByb3ZlZAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAKtSZXR1cm5zIHRoZSBudW1iZXIgb2YgdG9rZW5zIG93bmVkIGJ5IGBhY2NvdW50YC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWRkcmVzcyBmb3Igd2hpY2ggdGhlIGJhbGFuY2UgaXMgYmVpbmcgcXVlcmllZC4AAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAHbGlzdGluZwAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6AAAB9AAAAAHTGlzdGluZwA=",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAIYXJ0X21ldGEAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6AAAB9AAAAAHQXJ0TWV0YQA=",
        "AAAAAAAABABNaW50cyBhIDEtb2YtMSB0byBgY3JlYXRvcmAgYW5kIHJldHVybnMgaXRzIGB0b2tlbl9pZGAuCgpPcGVuIHRvIGFueSBhZGRyZXNzIHRoYXQgc2lnbnMgYXMgaXRzIG93biBgY3JlYXRvcmAg4oCUIHRoaXMgaXMgYSBwdWJsaWMKY29sbGVjdGlvbiwgYW5kIGdhdGluZyBpdCBiZWhpbmQgYW4gYWxsb3dsaXN0IGlzIGEgcHJvZHVjdCBkZWNpc2lvbgptYWRlIG9mZi1jaGFpbiAodGhlIHRSUEMgbGF5ZXIgb25seSBvZmZlcnMgdGhpcyB0byBhcHByb3ZlZCBjcmVhdG9ycykuCk5vdGUgdGhlIGF1dGggaXMgb24gYGNyZWF0b3JgLCB0aGUgKm1pbnRlciosIG5vdCBvbiBhIHJlY2lwaWVudDogYQpyZWNpcGllbnQtYXV0aG9yaXplZCBtaW50IHdvdWxkIGxldCBhbnlvbmUgbWludCB0b2tlbnMgdG8gdGhlbXNlbHZlcyBpbgpzb21lb25lIGVsc2UncyBuYW1lLgoKYGFydF9yZWZgIGlzIHRoZSBjYWxsZXIncyBvd24gaWRlbnRpZmllciBmb3IgdGhpcyBwaWVjZSAodGhlIGRhdGFiYXNlCnJvdyBpZCkuIEl0IGlzIHJlY29yZGVkIHNvIHRoZSBtaW50ZWQgYHRva2VuX2lkYCBjYW4gYmUgbG9va2VkIHVwIGxhdGVyCndpdGggW2BTZWxmOjp0b2tlbl9ieV9yZWZgXSDigJQgdGhlIGNsaWVudCBjYW5ub3QgcmVhZCBpdCBvdXQgb2YgdGhlCnRyYW5zYWN0aW9uIHJlc3VsdCwgYmVjYXVzZSB0aGlzIHJlcG8ncyBwaW5uZWQgYHN0ZWxsYXItc2RrYCBjYW5ub3QKZGVjb2RlIHByb3RvY29sLTI3IHRyYW5zYWN0aW9uIG1ldGEuIE1pbnRpbmcgdHdpY2UgdW5kZXIgb25lIGBhcnRfcmVmYAppcyByZWplY3RlZCwgd2hpY2ggYWxzbyBtYWtlcyBhIHJldHJpZWQgbWludCBzYWZlLgoKTWludHMgd2l0aG91dCBsaXN0aW5nLiBLZXB0IGZvciBwcm9ncmFtbWF0aWMgdXNlIChlLmcuIG1pbnRpbmcgaW50byBhCmNvbGxlY3Rpb24gd2l0aG91dCBpbW1lZGlhdGVseSBzZWxsaW5nKTsgdGhlIHN0b3JlZnJvbnQncyAiY3JlYXRlIGZvcgpzYWxlIiBmbG93IHVzZXMgW2BTZWxmOjptaW50X2FuZF9saXN0YF0gaW5zdGVhZCDigJQgAAAACG1pbnRfYXJ0AAAAAwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAdhcnRfcmVmAAAAABAAAAAAAAAAA2FydAAAAAfQAAAACEFydElucHV0AAAAAQAAAAQ=",
        "AAAAAAAAAOVSZXR1cm5zIHRoZSBvd25lciBvZiB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAACG93bmVyX29mAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAABM=",
        "AAAAAAAAAqBUcmFuc2ZlcnMgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCBmcm9tIGBmcm9tYCB0byBgdG9gLgoKV0FSTklORzogQ29uZmlybWF0aW9uIHRoYXQgdGhlIHJlY2lwaWVudCBpcyBjYXBhYmxlIG9mIHJlY2VpdmluZyB0aGUKYE5vbi1GdW5naWJsZWAgaXMgdGhlIGNhbGxlcidzIHJlc3BvbnNpYmlsaXR5OyBvdGhlcndpc2UgdGhlIE5GVCBtYXkgYmUKcGVybWFuZW50bHkgbG9zdC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgZnJvbWAgLSBBY2NvdW50IG9mIHRoZSBzZW5kZXIuCiogYHRvYCAtIEFjY291bnQgb2YgdGhlIHJlY2lwaWVudC4KKiBgdG9rZW5faWRgIC0gVG9rZW4gSUQgYXMgYSBudW1iZXIuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW5jb3JyZWN0T3duZXJgXSAtIElmIHRoZSBjdXJyZW50IG93bmVyCihiZWZvcmUgY2FsbGluZyB0aGlzIGZ1bmN0aW9uKSBpcyBub3QgYGZyb21gLgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJ0cmFuc2ZlciIsIGZyb206IEFkZHJlc3MsIHRvOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFt0b2tlbl9pZDogdTMyXWAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAIdHJlYXN1cnkAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAw1EZXN0cm95cyB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgIGZyb20gYGZyb21gLCBieSB1c2luZyBgc3BlbmRlcmBzCmFwcHJvdmFsLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBzcGVuZGVyYCAtIFRoZSBhY2NvdW50IHRoYXQgaXMgYWxsb3dlZCB0byBidXJuIHRoZSB0b2tlbiBvbiBiZWhhbGYgb2YKdGhlIG93bmVyLgoqIGBmcm9tYCAtIFRoZSBhY2NvdW50IHdob3NlIHRva2VuIGlzIGRlc3Ryb3llZC4KKiBgdG9rZW5faWRgIC0gVGhlIGlkZW50aWZpZXIgb2YgdGhlIHRva2VuIHRvIGJ1cm4uCgojIEVycm9ycwoKKiBbYGNyYXRlOjpub25fZnVuZ2libGU6Ok5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6Tm9uRXhpc3RlbnRUb2tlbmBdIC0KV2hlbiBhdHRlbXB0aW5nIHRvIGJ1cm4gYSB0b2tlbiB0aGF0IGRvZXMgbm90IGV4aXN0LgoqIFtgY3JhdGU6Om5vbl9mdW5naWJsZTo6Tm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbmNvcnJlY3RPd25lcmBdIC0gSWYKdGhlIGN1cnJlbnQgb3duZXIgKGJlZm9yZSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24pIGlzIG5vdCBgZnJvbWAuCiogW2BjcmF0ZTo6bm9uX2Z1bmdpYmxlOjpOb25GdW5naWJsZVRva2VuRXJyb3I6Okluc3VmZmljaWVudEFwcHJvdmFsYF0gLQpJZiB0aGUgc3BlbmRlciBkb2VzIG5vdCBoYXZlIGEgdmFsaWQgYXBwcm92YWwuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJidXJuIiwgZnJvbTogQWRkcmVzc11gCiogZGF0YSAtIGBbdG9rZW5faWQ6IHUzMl1gAAAAAAAACWJ1cm5fZnJvbQAAAAAAAAMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAAAAAAAJBSZXR1cm5zIGBTb21lKEFkZHJlc3MpYCBpZiBvd25lcnNoaXAgaXMgc2V0LCBvciBgTm9uZWAgaWYgb3duZXJzaGlwIGhhcwpiZWVuIHJlbm91bmNlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAPVSZXR1cm5zIHRoZSBVbmlmb3JtIFJlc291cmNlIElkZW50aWZpZXIgKFVSSSkgZm9yIHRoZSB0b2tlbiB3aXRoCmB0b2tlbl9pZGAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHRva2VuX2lkYCAtIFRva2VuIElEIGFzIGEgbnVtYmVyLgoKIyBOb3RlcwoKSWYgdGhlIHRva2VuIGRvZXMgbm90IGV4aXN0LCB0aGlzIGZ1bmN0aW9uIGlzIGV4cGVjdGVkIHRvIHBhbmljLgAAAAAAAAl0b2tlbl91cmkAAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAEA==",
        "AAAAAAAAAPFSZXR1cm5zIHRoZSBhY2NvdW50IGFwcHJvdmVkIGZvciB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAADGdldF9hcHByb3ZlZAAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAXdSZXR1cm5zIGAoQWRkcmVzcywgaTEyOClgIC0gQSB0dXBsZSBjb250YWluaW5nIHRoZSByZWNlaXZlciBhZGRyZXNzIGFuZAp0aGUgcm95YWx0eSBhbW91bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHRva2VuX2lkYCAtIFRoZSBpZGVudGlmaWVyIG9mIHRoZSB0b2tlbi4KKiBgc2FsZV9wcmljZWAgLSBUaGUgc2FsZSBwcmljZSBmb3Igd2hpY2ggcm95YWx0aWVzIGFyZSBiZWluZwpjYWxjdWxhdGVkLgoKIyBFcnJvcnMKCiogW2BjcmF0ZTo6bm9uX2Z1bmdpYmxlOjpOb25GdW5naWJsZVRva2VuRXJyb3I6Ok5vbkV4aXN0ZW50VG9rZW5gXSAtIElmCnRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdC4AAAAADHJveWFsdHlfaW5mbwAAAAIAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAKc2FsZV9wcmljZQAAAAAACwAAAAEAAAPtAAAAAgAAABMAAAAL",
        "AAAAAAAAAIhSZXNvbHZlcyB0aGUgY2FsbGVyJ3Mgb2ZmLWNoYWluIHJlZmVyZW5jZSBiYWNrIHRvIHRoZSBtaW50ZWQgdG9rZW4gaWQuClRoaXMgaXMgaG93IHRoZSBiYWNrZW5kIGNvbmZpcm1zIGEgbWludCBsYW5kZWQgYW5kIGxlYXJucyBpdHMgaWQuAAAADHRva2VuX2J5X3JlZgAAAAEAAAAAAAAAB2FydF9yZWYAAAAAEAAAAAEAAAPoAAAABA==",
        "AAAAAAAAALxSdW5zIGV4YWN0bHkgb25jZSwgYXQgZGVwbG95LiBVc2luZyBhIGNvbnN0cnVjdG9yIHJhdGhlciB0aGFuIGFuCmBpbml0aWFsaXplYCBlbnRyeSBwb2ludCBtZWFucyB0aGVyZSBpcyBubyB3aW5kb3cgaW4gd2hpY2ggYW4KdW5pbml0aWFsaXplZCBjb250cmFjdCBjYW4gYmUgY2xhaW1lZCBieSB3aG9ldmVyIGNhbGxzIGZpcnN0LgAAAA1fX2NvbnN0cnVjdG9yAAAAAAAABgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAEHBsYXRmb3JtX2ZlZV9icHMAAAAEAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAAhiYXNlX3VyaQAAABAAAAAA",
        "AAAAAAAAAyxNaW50cyBhbmQgbGlzdHMgaW4gb25lIHNpZ25lZCBjYWxsLgoKVHdvIHNlcGFyYXRlIHRyYW5zYWN0aW9ucyBoZXJlIOKAlCBtaW50LCB0aGVuIGEgZm9sbG93LXVwIGBsaXN0YCDigJQgdXNlZAp0byBiZSBob3cgdGhlIHN0b3JlZnJvbnQgY3JlYXRlZCBhIGZvci1zYWxlIHBpZWNlLiBUaGF0IHNoYXBlIG5lZWRzIHRoZQpzZWNvbmQgdHJhbnNhY3Rpb24gdG8gcmVhZCBiYWNrIHRoZSBmaXJzdCBvbmUncyBlZmZlY3RzICh0aGUgbmV3CmB0b2tlbl9pZGAsIHRoZSBhY2NvdW50J3MgYnVtcGVkIHNlcXVlbmNlIG51bWJlcikgdGhyb3VnaCB0aGUgcHVibGljClNvcm9iYW4gUlBDIHBvb2wsIHdoaWNoIHByb3BhZ2F0ZXMgdGhvc2UgZWZmZWN0cyB0byBkaWZmZXJlbnQgYmFja2VuZApub2RlcyBhdCBkaWZmZXJlbnQgdGltZXMuIEEgcmVhZCBsYW5kaW5nIG9uIGEgbGFnZ2luZyBub2RlIHJlYWRzIHN0YWxlCnN0YXRlLCBhbmQgYSB0cmFuc2FjdGlvbiBidWlsdCBmcm9tIHN0YWxlIHN0YXRlIGlzIGludmFsaWQg4oCUIHNvbWV0aW1lcwpjYXVnaHQgaGVyZSBhcyBhIGNsZWFyIGNvbnRyYWN0IGVycm9yLCBzb21ldGltZXMgb25seSBmYWlsaW5nIGRlZXAKaW5zaWRlIGEgd2FsbGV0IGFzIGFuIG9wYXF1ZSBzdWJtaXNzaW9uIGVycm9yLiBUaGVyZSBpcyBubyBnYXAgdG8gbG9zZQphIHJhY2UgaW4gd2hlbiBpdCdzIG9uZSBjYWxsOiBtaW50IGFuZCBsaXN0IGhhcHBlbiBhdG9taWNhbGx5LCBzbyB0aGVyZQppcyBub3RoaW5nIGZvciBhIHNlY29uZCB0cmFuc2FjdGlvbiB0byByZWFkIGJhY2sgYmVmb3JlIGl0IGNhbiBwcm9jZWVkLgAAAA1taW50X2FuZF9saXN0AAAAAAAABQAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAdhcnRfcmVmAAAAABAAAAAAAAAAA2FydAAAAAfQAAAACEFydElucHV0AAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAADXBheW1lbnRfdG9rZW4AAAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAABABUcmFuc2ZlcnMgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCBmcm9tIGBmcm9tYCB0byBgdG9gIGJ5IHVzaW5nCmBzcGVuZGVyYHMgYXBwcm92YWwuCgpVbmxpa2UgYHRyYW5zZmVyKClgLCB3aGljaCBpcyB1c2VkIHdoZW4gdGhlIHRva2VuIG93bmVyIGluaXRpYXRlcyB0aGUKdHJhbnNmZXIsIGB0cmFuc2Zlcl9mcm9tKClgIGFsbG93cyBhbiBhcHByb3ZlZCB0aGlyZCBwYXJ0eQooYHNwZW5kZXJgKSB0byB0cmFuc2ZlciB0aGUgdG9rZW4gb24gYmVoYWxmIG9mIHRoZSBvd25lci4gVGhpcwpmdW5jdGlvbiB2ZXJpZmllcyB0aGF0IGBzcGVuZGVyYCBoYXMgdGhlIG5lY2Vzc2FyeSBhcHByb3ZhbC4KCldBUk5JTkc6IENvbmZpcm1hdGlvbiB0aGF0IHRoZSByZWNpcGllbnQgaXMgY2FwYWJsZSBvZiByZWNlaXZpbmcgdGhlCmBOb24tRnVuZ2libGVgIGlzIHRoZSBjYWxsZXIncyByZXNwb25zaWJpbGl0eTsgb3RoZXJ3aXNlIHRoZSBORlQgbWF5IGJlCnBlcm1hbmVudGx5IGxvc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIHRyYW5zZmVyLgoqIGBmcm9tYCAtIEFjY291bnQgb2YgdGhlIHNlbmRlci4KKiBgdG9gIC0gQWNjb3VudCBvZiB0aGUgcmVjaXBpZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbmNvcnJlY3RPd25lcmBdIC0gSWYgdGhlIGN1cnJlbnQgb3duZXIKKGJlZm9yZSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24pIGlzIG5vdCBgZnJvbWAuCiogW2BOb25GdW5naWJsZVRva2VuRXJyb3I6Okluc3VmZmljaWVudEFwcHJvdmFsYF0gLSBJZiB0aGUgc3BlbmRlciBkb2VzCm5vdCBoYXZlIGEgdmFsaWQgYXBwcm92YWwuCiogW2BOb25GdW5naWJsZVRva2VuRXJyb3I6Ok5vbkV4aXN0ZW50VG9rZW5gXSAtIElmIHRoZSB0b2tlbiBkb2VzIG5vdApleGlzdC4KCiMgRXZlbnRzAAAADXRyYW5zZmVyX2Zyb20AAAAAAAAEAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAAOY2FuY2VsX2xpc3RpbmcAAAAAAAIAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAAHlSZWFkLW9ubHkgcHJldmlldyBvZiBgYnV5YCdzIHBheW1lbnQgc3BsaXQsIHNvIHRoZSBVSSBjYW4gc2hvdyB0aGUKYnV5ZXIgZXhhY3RseSB3aGVyZSB0aGVpciBtb25leSBnb2VzIGJlZm9yZSB0aGV5IHNpZ24uAAAAAAAADnNhbGVfYnJlYWtkb3duAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6AAAB9AAAAANU2FsZUJyZWFrZG93bgAAAA==",
        "AAAAAAAAAr9BcHByb3ZlIG9yIHJlbW92ZSBgb3BlcmF0b3JgIGFzIGFuIG9wZXJhdG9yIGZvciB0aGUgb3duZXIuCgpPcGVyYXRvcnMgY2FuIGNhbGwgYHRyYW5zZmVyX2Zyb20oKWAgZm9yIGFueSB0b2tlbiBoZWxkIGJ5IGBvd25lcmAsCmFuZCBjYWxsIGBhcHByb3ZlKClgIG9uIGJlaGFsZiBvZiBgb3duZXJgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG93bmVyYCAtIFRoZSBhZGRyZXNzIGhvbGRpbmcgdGhlIHRva2Vucy4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBhZGQgdG8gdGhlIHNldCBvZiBhdXRob3JpemVkIG9wZXJhdG9ycy4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlcgpudW1iZXIgaXMgbGVzcyB0aGFuIHRoZSBjdXJyZW50IGxlZGdlciBudW1iZXIuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhcHByb3ZlX2Zvcl9hbGwiLCBmcm9tOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtvcGVyYXRvcjogQWRkcmVzcywgbGl2ZV91bnRpbF9sZWRnZXI6IHUzMl1gAAAAAA9hcHByb3ZlX2Zvcl9hbGwAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAATBBY2NlcHRzIGEgcGVuZGluZyBvd25lcnNoaXAgdHJhbnNmZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsib3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZCJdYAoqIGRhdGEgLSBgW25ld19vd25lcjogQWRkcmVzc11gAAAAEGFjY2VwdF9vd25lcnNoaXAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAQcGxhdGZvcm1fZmVlX2JwcwAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAAQc2V0X3BsYXRmb3JtX2ZlZQAAAAIAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAAAAAKtQZXItdG9rZW4gcm95YWx0eSwgY2hhbmdlYWJsZSBvbmx5IGJ5IHRoZSBwaWVjZSdzIG9yaWdpbmFsIGNyZWF0b3Ig4oCUCm5vdCBieSB3aG9ldmVyIGN1cnJlbnRseSBob2xkcyBpdCwgc28gYSBidXllciBjYW4ndCBzdHJpcCB0aGUgcm95YWx0eQpvZmYgYSB3b3JrIGJlZm9yZSBmbGlwcGluZyBpdC4AAAAAEXNldF90b2tlbl9yb3lhbHR5AAAAAAAABAAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAADGJhc2lzX3BvaW50cwAAAAQAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAYVSZW5vdW5jZXMgb3duZXJzaGlwIG9mIHRoZSBjb250cmFjdC4KClBlcm1hbmVudGx5IHJlbW92ZXMgdGhlIG93bmVyLCBkaXNhYmxpbmcgYWxsIGZ1bmN0aW9ucyBnYXRlZCBieQpgI1tvbmx5X293bmVyXWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYE93bmFibGVFcnJvcjo6VHJhbnNmZXJJblByb2dyZXNzYF0gLSBJZiB0aGVyZSBpcyBhIHBlbmRpbmcgb3duZXJzaGlwCnRyYW5zZmVyLgoqIFtgT3duYWJsZUVycm9yOjpPd25lck5vdFNldGBdIC0gSWYgdGhlIG93bmVyIGlzIG5vdCBzZXQuCgojIE5vdGVzCgoqIEF1dGhvcml6YXRpb24gZm9yIHRoZSBjdXJyZW50IG93bmVyIGlzIHJlcXVpcmVkLgAAAAAAABJyZW5vdW5jZV9vd25lcnNoaXAAAAAAAAAAAAAA",
        "AAAAAAAAA45Jbml0aWF0ZXMgYSAyLXN0ZXAgb3duZXJzaGlwIHRyYW5zZmVyIHRvIGEgbmV3IGFkZHJlc3MuCgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGN1cnJlbnQgb3duZXIuIFRoZSBuZXcgb3duZXIgbXVzdCBsYXRlcgpjYWxsIGBhY2NlcHRfb3duZXJzaGlwKClgIHRvIGNvbXBsZXRlIHRoZSB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgbmV3X293bmVyYCAtIFRoZSBwcm9wb3NlZCBuZXcgb3duZXIuCiogYGxpdmVfdW50aWxfbGVkZ2VyYCAtIExlZGdlciBudW1iZXIgdW50aWwgd2hpY2ggdGhlIG5ldyBvd25lciBjYW4KYWNjZXB0LiBBIHZhbHVlIG9mIGAwYCBjYW5jZWxzIGFueSBwZW5kaW5nIHRyYW5zZmVyLgoKIyBFcnJvcnMKCiogW2BPd25hYmxlRXJyb3I6Ok93bmVyTm90U2V0YF0gLSBJZiB0aGUgb3duZXIgaXMgbm90IHNldC4KKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgb3duZXIgaXMgcmVxdWlyZWQuAAAAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA",
        "AAAAAAAAANdSZXR1cm5zIHdoZXRoZXIgdGhlIGBvcGVyYXRvcmAgaXMgYWxsb3dlZCB0byBtYW5hZ2UgYWxsIHRoZSBhc3NldHMgb2YKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gQWNjb3VudCBvZiB0aGUgdG9rZW4ncyBvd25lci4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBiZSBjaGVja2VkLgAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
        "AAAAAAAAAERDb2xsZWN0aW9uLXdpZGUgZmFsbGJhY2sgcm95YWx0eSwgZm9yIHRva2VucyB3aXRoIG5vbmUgb2YgdGhlaXIgb3duLgAAABNzZXRfZGVmYXVsdF9yb3lhbHR5AAAAAAMAAAAAAAAACHJlY2VpdmVyAAAAEwAAAAAAAAAMYmFzaXNfcG9pbnRzAAAABAAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAUcmVtb3ZlX3Rva2VuX3JveWFsdHkAAAACAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABAAAAAAAAAAAAAAADE93bmFibGVFcnJvcgAAAAMAAAAAAAAAC093bmVyTm90U2V0AAAACDQAAAAAAAAAElRyYW5zZmVySW5Qcm9ncmVzcwAAAAAINQAAAAAAAAAPT3duZXJBbHJlYWR5U2V0AAAACDY=",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGluaXRpYXRlZC4AAAAAAAAAAAART3duZXJzaGlwVHJhbnNmZXIAAAAAAAABAAAAEm93bmVyc2hpcF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gb3duZXJzaGlwIGlzIHJlbm91bmNlZC4AAAAAAAAAAAAST3duZXJzaGlwUmVub3VuY2VkAAAAAAABAAAAE293bmVyc2hpcF9yZW5vdW5jZWQAAAAAAQAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGNvbXBsZXRlZC4AAAAAAAAAAAAaT3duZXJzaGlwVHJhbnNmZXJDb21wbGV0ZWQAAAAAAAEAAAAcb3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAEAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAAAAAAAGUGF1c2VkAAAAAAABAAAABnBhdXNlZAAAAAAAAAAAAAI=",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHVucGF1c2VkLgAAAAAAAAAIVW5wYXVzZWQAAAABAAAACHVucGF1c2VkAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAADVBhdXNhYmxlRXJyb3IAAAAAAAACAAAANFRoZSBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAANRW5mb3JjZWRQYXVzZQAAAAAAA+gAAAA4VGhlIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSB0aGUgY29udHJhY3QgaXMgbm90IHBhdXNlZC4AAAANRXhwZWN0ZWRQYXVzZQAAAAAAA+k=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYW4gYXBwcm92YWwgaXMgZ3JhbnRlZC4AAAAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAIYXBwcm92ZWQAAAATAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyB0cmFuc2ZlcnJlZC4AAAAAAAAAAAAIVHJhbnNmZXIAAAABAAAACHRyYW5zZmVyAAAAAwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYXBwcm92YWwgZm9yIGFsbCB0b2tlbnMgaXMgZ3JhbnRlZC4AAAAAAAAAAAANQXBwcm92ZUZvckFsbAAAAAAAAAEAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
        "AAAABAAAAAAAAAAAAAAAFU5vbkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAAAA8AAAAkSW5kaWNhdGVzIGEgbm9uLWV4aXN0ZW50IGB0b2tlbl9pZGAuAAAAEE5vbkV4aXN0ZW50VG9rZW4AAADIAAAAV0luZGljYXRlcyBhbiBlcnJvciByZWxhdGVkIHRvIHRoZSBvd25lcnNoaXAgb3ZlciBhIHBhcnRpY3VsYXIgdG9rZW4uClVzZWQgaW4gdHJhbnNmZXJzLgAAAAAOSW5jb3JyZWN0T3duZXIAAAAAAMkAAABFSW5kaWNhdGVzIGEgZmFpbHVyZSB3aXRoIHRoZSBgb3BlcmF0b3JgcyBhcHByb3ZhbC4gVXNlZCBpbiB0cmFuc2ZlcnMuAAAAAAAAFEluc3VmZmljaWVudEFwcHJvdmFsAAAAygAAAFVJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGBhcHByb3ZlcmAgb2YgYSB0b2tlbiB0byBiZSBhcHByb3ZlZC4gVXNlZAppbiBhcHByb3ZhbHMuAAAAAAAAD0ludmFsaWRBcHByb3ZlcgAAAADLAAAASkluZGljYXRlcyBhbiBpbnZhbGlkIHZhbHVlIGZvciBgbGl2ZV91bnRpbF9sZWRnZXJgIHdoZW4gc2V0dGluZwphcHByb3ZhbHMuAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAzAAAAClJbmRpY2F0ZXMgb3ZlcmZsb3cgd2hlbiBhZGRpbmcgdHdvIHZhbHVlcwAAAAAAAAxNYXRoT3ZlcmZsb3cAAADNAAAANkluZGljYXRlcyBhbGwgcG9zc2libGUgYHRva2VuX2lkYHMgYXJlIGFscmVhZHkgaW4gdXNlLgAAAAAAE1Rva2VuSURzQXJlRGVwbGV0ZWQAAAAAzgAAAEVJbmRpY2F0ZXMgYW4gaW52YWxpZCBhbW91bnQgdG8gYmF0Y2ggbWludCBpbiBgY29uc2VjdXRpdmVgIGV4dGVuc2lvbi4AAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAM8AAAAzSW5kaWNhdGVzIHRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdCBpbiBvd25lcidzIGxpc3QuAAAAABhUb2tlbk5vdEZvdW5kSW5Pd25lckxpc3QAAADQAAAAMkluZGljYXRlcyB0aGUgdG9rZW4gZG9lcyBub3QgZXhpc3QgaW4gZ2xvYmFsIGxpc3QuAAAAAAAZVG9rZW5Ob3RGb3VuZEluR2xvYmFsTGlzdAAAAAAAANEAAAAjSW5kaWNhdGVzIGFjY2VzcyB0byB1bnNldCBtZXRhZGF0YS4AAAAADVVuc2V0TWV0YWRhdGEAAAAAAADSAAAAQUluZGljYXRlcyB0aGUgbGVuZ3RoIG9mIHRoZSBiYXNlIFVSSSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAFUJhc2VVcmlNYXhMZW5FeGNlZWRlZAAAAAAAANMAAABHSW5kaWNhdGVzIHRoZSByb3lhbHR5IGFtb3VudCBpcyBoaWdoZXIgdGhhbiAxMF8wMDAgKDEwMCUpIGJhc2lzIHBvaW50cy4AAAAAFEludmFsaWRSb3lhbHR5QW1vdW50AAAA1AAAAD1JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgbmFtZSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAEk5hbWVNYXhMZW5FeGNlZWRlZAAAAAAA1QAAAD9JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgc3ltYm9sIGV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZC4AAAAAFFN5bWJvbE1heExlbkV4Y2VlZGVkAAAA1g==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBidXJuZWQuAAAAAAAAAAAAAARCdXJuAAAAAQAAAARidXJuAAAAAgAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAChFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW4gcm95YWx0eSBpcyBzZXQuAAAAAAAAAA9TZXRUb2tlblJveWFsdHkAAAAAAQAAABFzZXRfdG9rZW5fcm95YWx0eQAAAAAAAAMAAAAAAAAACHJlY2VpdmVyAAAAEwAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAAAAAAADGJhc2lzX3BvaW50cwAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gZGVmYXVsdCByb3lhbHR5IGlzIHNldC4AAAAAAAAAAAARU2V0RGVmYXVsdFJveWFsdHkAAAAAAAABAAAAE3NldF9kZWZhdWx0X3JveWFsdHkAAAAAAgAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAQAAAAAAAAAMYmFzaXNfcG9pbnRzAAAABAAAAAAAAAAC",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW4gcm95YWx0eSBpcyByZW1vdmVkLgAAAAAAAAASUmVtb3ZlVG9rZW5Sb3lhbHR5AAAAAAABAAAAFHJlbW92ZV90b2tlbl9yb3lhbHR5AAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAI=" ]),
      options
    )
  }
  public readonly fromJSON = {
    buy: this.txFromJSON<null>,
        burn: this.txFromJSON<null>,
        list: this.txFromJSON<null>,
        name: this.txFromJSON<string>,
        pause: this.txFromJSON<null>,
        paused: this.txFromJSON<boolean>,
        symbol: this.txFromJSON<string>,
        approve: this.txFromJSON<null>,
        balance: this.txFromJSON<u32>,
        listing: this.txFromJSON<Option<Listing>>,
        unpause: this.txFromJSON<null>,
        art_meta: this.txFromJSON<Option<ArtMeta>>,
        mint_art: this.txFromJSON<u32>,
        owner_of: this.txFromJSON<string>,
        transfer: this.txFromJSON<null>,
        treasury: this.txFromJSON<Option<string>>,
        burn_from: this.txFromJSON<null>,
        get_owner: this.txFromJSON<Option<string>>,
        token_uri: this.txFromJSON<string>,
        get_approved: this.txFromJSON<Option<string>>,
        royalty_info: this.txFromJSON<readonly [string, i128]>,
        token_by_ref: this.txFromJSON<Option<u32>>,
        mint_and_list: this.txFromJSON<u32>,
        transfer_from: this.txFromJSON<null>,
        cancel_listing: this.txFromJSON<null>,
        sale_breakdown: this.txFromJSON<Option<SaleBreakdown>>,
        approve_for_all: this.txFromJSON<null>,
        accept_ownership: this.txFromJSON<null>,
        platform_fee_bps: this.txFromJSON<u32>,
        set_platform_fee: this.txFromJSON<null>,
        set_token_royalty: this.txFromJSON<null>,
        renounce_ownership: this.txFromJSON<null>,
        transfer_ownership: this.txFromJSON<null>,
        is_approved_for_all: this.txFromJSON<boolean>,
        set_default_royalty: this.txFromJSON<null>,
        remove_token_royalty: this.txFromJSON<null>
  }
}