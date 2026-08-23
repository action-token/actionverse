import { Loader2, Lock, Minus, Pencil, Plus, ShoppingBag, Tag } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { BlockchainInsights } from "~/components/nft/blockchain-insights";
import { PlaceholderArt } from "~/components/nft/placeholder-art";
import { priceTokenLabel } from "~/components/nft/nft-card";
import { BuyNftWithCard } from "~/components/payment/buy-nft-with-card";
import { cn } from "~/lib/utils";
import {
  DEFAULT_PLATFORM_FEE_BPS,
  INCLUSION_FEE_IN_PLATFORM_ASSET,
  INCLUSION_FEE_IN_USD,
  NETWORK_FEE_IN_PLATFORM_ASSET,
  NETWORK_FEE_IN_USD,
} from "~/lib/stellar/constant";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/shadcn/ui/tabs";
import { isRechargeAbleClient } from "~/utils/recharge/is-rechargeable-client";
import { InsufficientAssetBalance } from "~/components/payment/insufficient-asset-balance";
import { AccountActivationRequired } from "~/components/payment/account-activation-required";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import { WalletType } from "~/types/wallet/wallet-types";
import { type NftDisplayCurrency, type NftPaymentToken } from "~/lib/stellar/oz/nft";
import { type RouterOutputs } from "~/utils/api";

type ByIdNft = RouterOutputs["nft"]["byId"];
type OnChainInsights = RouterOutputs["nft"]["onChainInsights"];
type MyToken = {
  tokenId: string;
  isListed: boolean;
  listingPrice: number | null;
  listingPaymentToken: string | null;
  listingPrices: { paymentToken: string; price: number }[];
};

// Contract-side cap on how many copies one `buy_edition` call can mint —
// mirrors `MAX_QUANTITY_PER_BUY` in `contracts/nft_oz/src/lib.rs` and
// `src/server/api/routers/nft.ts`.
const MAX_QUANTITY_PER_BUY = 20;

// Frontend-only cap on how many held copies can be relisted in one batch —
// well under the contract's own `list_batch` limit, just keeps a single
// "Hold N / list N" action from growing unreasonably large.
const MAX_LIST_BATCH = 5;

// Frontend-only cap on how many copies can be bought in one action — applies
// to both a fresh primary purchase and a pooled resale purchase, well under
// the contract's own `buy_edition`/`buy_batch` limits.
const MAX_BUY_BATCH = 5;

// A signed transaction can take a few seconds to land, and a flat "disabled +
// dimmed" button reads as broken rather than working — so buy/list buttons
// cycle through these while pending instead, and stay fully opaque/animated
// so they visibly look alive rather than stuck.
const BUYING_STATUS_MESSAGES = ["Confirming purchase…", "Waiting for signature…", "Almost there…"];
const LISTING_STATUS_MESSAGES = ["Listing…", "Waiting for signature…", "Almost there…"];

// Advances through `messages` once and holds on the last one — looping back
// to the first message reads as "stuck restarting", not progress.
function useProgressiveStatusText(active: boolean, messages: string[]): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= messages.length - 1) {
          clearInterval(id);
          return i;
        }
        return i + 1;
      });
    }, 2500);
    return () => clearInterval(id);
  }, [active, messages]);

  return messages[index]!;
}

function BuyButton({
  isBuying,
  onClick,
  idleLabel,
}: {
  isBuying: boolean;
  onClick: () => void;
  idleLabel: string;
}) {
  const statusText = useProgressiveStatusText(isBuying, BUYING_STATUS_MESSAGES);
  return (
    <Button
      disabled={isBuying}
      onClick={onClick}
      className={cn(
        "mt-4 h-12 w-full gap-2 rounded-full text-base font-bold transition-all",
        isBuying
          ? "animate-pulse bg-foreground/90 text-background disabled:opacity-100"
          : "bg-foreground text-background hover:bg-foreground/90",
      )}
    >
      {isBuying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
      {isBuying ? statusText : idleLabel}
    </Button>
  );
}

function ListButton({
  isSaving,
  disabled = false,
  onClick,
  idleLabel,
  size,
  className,
}: {
  isSaving: boolean;
  disabled?: boolean;
  onClick: () => void;
  idleLabel: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const statusText = useProgressiveStatusText(isSaving, LISTING_STATUS_MESSAGES);
  return (
    <Button
      size={size}
      disabled={isSaving || disabled}
      onClick={onClick}
      className={cn(
        "gap-1.5 rounded-full text-background transition-all",
        isSaving
          ? "animate-pulse bg-foreground/90 disabled:opacity-100"
          : "bg-foreground hover:bg-foreground/90",
        className,
      )}
    >
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
      {isSaving ? statusText : idleLabel}
    </Button>
  );
}

export function NftDetailView({
  nft,
  mode,
  viewerId,
  // manage mode
  myTokens = [],
  onListToken,
  onCancelListing,
  onListMultiple,
  isSavingListing = false,
  // buy mode — primary (a fresh copy from the edition)
  onBuyPrimary,
  isBuyingPrimary = false,
  // buy mode — secondary (one or more resold copies, picked from the pool)
  onBuyResaleBatch,
  isBuyingResale = false,
  onCardPurchaseSuccess,
  onChainInsights,
  isLoadingOnChainInsights = false,
}: {
  nft: ByIdNft;
  mode: "manage" | "buy";
  viewerId?: string;
  myTokens?: MyToken[];
  onListToken?: (tokenId: string, prices: { paymentToken: NftDisplayCurrency; price: number }[]) => void | Promise<void>;
  onCancelListing?: (tokenId: string) => void | Promise<void>;
  onListMultiple?: (
    tokenIds: string[],
    prices: { paymentToken: NftDisplayCurrency; price: number }[],
  ) => void | Promise<void>;
  isSavingListing?: boolean;
  onBuyPrimary?: (args: { paymentToken: NftPaymentToken; quantity: number }) => void | Promise<void>;
  isBuyingPrimary?: boolean;
  onBuyResaleBatch?: (tokenIds: string[], paymentToken: NftPaymentToken) => void | Promise<void>;
  isBuyingResale?: boolean;
  /** See `PrimaryBuyCard`'s prop of the same name. */
  onCardPurchaseSuccess?: () => void | Promise<void>;
  onChainInsights?: OnChainInsights;
  isLoadingOnChainInsights?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{nft.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Created by{" "}
          <span className="font-semibold text-foreground hover:underline">
            {nft.creator.name ?? "Unknown"}
          </span>
        </p>
      </div>

      {mode === "manage" ? (
        <ManagePriceCard
          myTokens={myTokens}
          onListToken={onListToken}
          onCancelListing={onCancelListing}
          onListMultiple={onListMultiple}
          isSaving={isSavingListing}
          network={onChainInsights?.network}
        />
      ) : nft.resaleListings.length > 0 ? (
        <ResaleBuyCard
          listings={nft.resaleListings}
          viewerId={viewerId}
          onBuy={onBuyResaleBatch}
          isBuying={isBuyingResale}
          onCardPurchaseSuccess={onCardPurchaseSuccess}
        />
      ) : (
        <PrimaryBuyCard
          nft={nft}
          onChainInsights={onChainInsights}
          isLoadingOnChainInsights={isLoadingOnChainInsights}
          onBuy={onBuyPrimary}
          isBuying={isBuyingPrimary}
          onCardPurchaseSuccess={onCardPurchaseSuccess}
        />
      )}

      <Tabs defaultValue="details" className="flex-1">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="details"
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 font-semibold text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value={mode === "manage" ? "creator" : "owners"}
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 font-semibold text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            {mode === "manage" ? "Creator" : "Owners"}
          </TabsTrigger>
          <TabsTrigger
            value="onchain"
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 font-semibold text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            On-Chain
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 pt-4">
          {nft.description && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{nft.description}</p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-semibold">
                {nft.supply > 1 ? `Limited edition of ${nft.supply}` : "1 of 1"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Minted</dt>
              <dd className="font-semibold">
                {nft.mintedCount} / {nft.supply}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Media type</dt>
              <dd className="truncate font-semibold">{nft.mediaType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Royalty</dt>
              <dd className="font-semibold">{(nft.royaltyBps / 100).toFixed(2)}%</dd>
            </div>
          </dl>
        </TabsContent>

        {mode === "manage" ? (
          <TabsContent value="creator" className="pt-4">
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                {nft.creator.image ? (
                  <Image src={nft.creator.image} alt={nft.creator.name ?? "Creator"} fill className="object-cover" />
                ) : (
                  <PlaceholderArt seed={nft.creator.id} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{nft.creator.name ?? "Unknown creator"}</p>
                <p className="text-xs text-muted-foreground">
                  Earns a royalty every time any copy of this edition resells
                </p>
              </div>
            </div>
          </TabsContent>
        ) : (
          <TabsContent value="owners" className="pt-4">
            {nft.owners.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one holds a copy yet.</p>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card">
                {nft.owners.map((o) => (
                  <li key={o.id}>
                    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                        {o.image ? (
                          <Image src={o.image} alt={o.name ?? "Owner"} fill className="object-cover" />
                        ) : (
                          <PlaceholderArt seed={o.id} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {o.name ?? "Unknown"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )}

        <TabsContent value="onchain" className="pt-4">
          <BlockchainInsights
            insights={onChainInsights}
            isLoading={isLoadingOnChainInsights}
            nftName={nft.name}
            nftThumbnail={nft.thumbnail}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Manage — one row per copy the caller holds, each independently listable
// =============================================================================

/** Exported so `src/pages/smart-contract/[id].tsx` — now the one page for
 *  buying *and* managing every NFT — can render it directly instead of the
 *  full `NftDetailView` (which also renders its own title/description/tabs
 *  that page already has its own versions of). */
export function ManagePriceCard({
  myTokens,
  onListToken,
  onCancelListing,
  onListMultiple,
  isSaving,
  network,
}: {
  myTokens: MyToken[];
  onListToken?: (tokenId: string, prices: { paymentToken: NftDisplayCurrency; price: number }[]) => void | Promise<void>;
  onCancelListing?: (tokenId: string) => void | Promise<void>;
  onListMultiple?: (
    tokenIds: string[],
    prices: { paymentToken: NftDisplayCurrency; price: number }[],
  ) => void | Promise<void>;
  isSaving: boolean;
  network?: string;
}) {
  if (myTokens.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        You don{"'"}t hold any copies of this item.
      </div>
    );
  }

  const unlisted = myTokens.filter((t) => !t.isListed);
  const listed = myTokens.filter((t) => t.isListed);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          You hold {myTokens.length} cop{myTokens.length === 1 ? "y" : "ies"}
        </span>
        {network && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            {network}
          </span>
        )}
      </div>

      {unlisted.length > 0 && (
        <HoldAndListCard tokens={unlisted} onListMultiple={onListMultiple} isSaving={isSaving} />
      )}

      {listed.map((token) => (
        <TokenListingRow
          key={token.tokenId}
          token={token}
          isSaving={isSaving}
          onList={(prices) => onListToken?.(token.tokenId, prices)}
          onCancel={() => onCancelListing?.(token.tokenId)}
        />
      ))}
    </div>
  );
}

/**
 * Every unlisted copy of the same edition is interchangeable (same edition,
 * same royalty, same everything but its token id), so rather than one "List
 * for sale" row per copy, this picks *how many* of them to list at once, all
 * at the same price — a `[-] N / M Hold [+]` stepper, not N separate rows.
 *
 * The contract only lists one token per call (no batch-list entry point), so
 * "list N" still signs N transactions under the hood — `onListMultiple`
 * loops them sequentially — but the UI presents it as one action.
 */
function HoldAndListCard({
  tokens,
  onListMultiple,
  isSaving,
}: {
  tokens: MyToken[];
  onListMultiple?: (
    tokenIds: string[],
    prices: { paymentToken: NftDisplayCurrency; price: number }[],
  ) => void | Promise<void>;
  isSaving: boolean;
}) {
  const heldCount = tokens.length;
  // Listing is capped at MAX_LIST_BATCH per action even if the seller holds
  // more than that — they just list again for the rest.
  const max = Math.min(heldCount, MAX_LIST_BATCH);
  const [count, setCount] = useState(1);
  // A reseller sets their own prices — ACTION (on-chain) and USD (a
  // Square-charged card sticker price, off-chain only), both required —
  // independent of whichever ones the creator originally priced the
  // edition in.
  const [priceAsset, setPriceAsset] = useState("1");
  const [priceUsd, setPriceUsd] = useState("");
  const parsedAsset = Number(priceAsset) || 0;
  const parsedUsd = Number(priceUsd) || 0;
  const hasBothPrices = parsedAsset > 0 && parsedUsd > 0;

  function submit() {
    onListMultiple?.(tokens.slice(0, count).map((t) => t.tokenId), [
      { paymentToken: "asset", price: parsedAsset },
      { paymentToken: "usd", price: parsedUsd },
    ]);
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">List copies for Resale</span>
        <Tag className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={count <= 1}
          onClick={() => setCount((c) => Math.max(1, c - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[6rem] text-center text-base font-bold tabular-nums">
          {count} / {max}
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={count >= max}
          onClick={() => setCount((c) => Math.min(max, c + 1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        {heldCount > MAX_LIST_BATCH
          ? `You hold ${heldCount} — up to ${MAX_LIST_BATCH} can be listed per batch`
          : `You hold ${heldCount}`}
      </p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Price per copy
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Both currencies are required — buyers pick which to pay with.
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground">{priceTokenLabel("asset")}</span>
          <Input
            type="number"
            min={0}
            step="any"
            value={priceAsset}
            onChange={(e) => setPriceAsset(e.target.value)}
            placeholder="e.g. 5"
            className="h-10 font-bold tabular-nums"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground">USD</span>
          <Input
            type="number"
            min={0}
            step="any"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            placeholder="e.g. 10"
            className="h-10 font-bold tabular-nums"
          />
        </div>
      </div>

      <ListButton
        isSaving={isSaving}
        disabled={!hasBothPrices}
        onClick={submit}
        idleLabel={`List ${count} for sale`}
        className="mt-4 h-11 w-full"
      />
    </div>
  );
}

function TokenListingRow({
  token,
  isSaving,
  onList,
  onCancel,
}: {
  token: MyToken;
  isSaving: boolean;
  onList: (prices: { paymentToken: NftDisplayCurrency; price: number }[]) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [priceAsset, setPriceAsset] = useState("1");
  const [priceUsd, setPriceUsd] = useState("");
  const parsedAsset = Number(priceAsset) || 0;
  const parsedUsd = Number(priceUsd) || 0;

  function startEditing() {
    setPriceAsset(String(token.listingPrices.find((p) => p.paymentToken === "asset")?.price ?? 1));
    setPriceUsd(String(token.listingPrices.find((p) => p.paymentToken === "usd")?.price ?? ""));
    setEditing(true);
  }

  function submit() {
    return onList([
      { paymentToken: "asset", price: parsedAsset },
      { paymentToken: "usd", price: parsedUsd },
    ]);
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          Token #{token.tokenId}
        </span>
        {!editing && (
          <span className="text-xs font-semibold text-muted-foreground">
            {token.isListed ? "Listed" : "Not listed"}
          </span>
        )}
      </div>

      {editing ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">{priceTokenLabel("asset")}</span>
              <Input
                type="number"
                min={0}
                step="any"
                autoFocus
                value={priceAsset}
                onChange={(e) => setPriceAsset(e.target.value)}
                className="h-10 font-bold tabular-nums"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">USD</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                placeholder="e.g. 10"
                className="h-10 font-bold tabular-nums"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-full"
              disabled={isSaving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <ListButton
              size="sm"
              isSaving={isSaving}
              disabled={parsedAsset <= 0 || parsedUsd <= 0}
              onClick={async () => {
                await submit();
                setEditing(false);
              }}
              idleLabel={token.isListed ? "Save" : "List for sale"}
              className="flex-1"
            />
          </div>
        </>
      ) : token.isListed ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            {token.listingPrices.map((p) => (
              <p key={p.paymentToken} className="flex items-baseline gap-1 text-lg font-black tabular-nums">
                {p.price}
                <span className="text-xs font-bold text-foreground">{priceTokenLabel(p.paymentToken)}</span>
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1 rounded-full" onClick={startEditing}>
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isSaving}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          className="mt-2 w-full gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90"
          onClick={startEditing}
        >
          <Tag className="h-3.5 w-3.5" />
          List for sale
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Buy — a specific resold copy
// =============================================================================

/**
 * Every active resale listing for this edition, pooled into one card: pick
 * a quantity and buy the N cheapest — each is still its own token with its
 * own seller, so "buy N" signs N separate `buy` transactions in sequence
 * (the contract has no batch resale-purchase entry point), but the buyer
 * only has to choose a quantity once, same shape as the primary buy card.
 *
 * Exported so `src/pages/smart-contract/[id].tsx` — now the one buy page
 * for every NFT, gated or not — can show it for a resold copy exactly as
 * `nft/[id].tsx` used to. Resale applies to gated editions too — a resold
 * token keeps whatever unlock progress it already had (see
 * `confirmBuy`/`confirmBuyBatch`, VIP_TICKET_UNLOCK_PLAN.md §2b) — this
 * "cheapest N" pooling just doesn't yet surface that per-token progress to
 * the buyer before purchase; see §2b step 6.
 */
export function ResaleBuyCard({
  listings,
  viewerId,
  onBuy,
  isBuying,
  onCardPurchaseSuccess,
}: {
  listings: ByIdNft["resaleListings"];
  viewerId?: string;
  onBuy?: (tokenIds: string[], paymentToken: NftPaymentToken) => void | Promise<void>;
  isBuying: boolean;
  /** See `PrimaryBuyCard`'s prop of the same name — called after a
   *  successful "Pay with card" purchase of the cheapest USD-priced
   *  resale listing (see below). */
  onCardPurchaseSuccess?: () => void | Promise<void>;
}) {
  const { data: session } = useSession();
  const isCustodial = isRechargeAbleClient(session?.user.walletType ?? WalletType.none);
  // Gates the Platform-Asset buy button only — a card/USD checkout is
  // funded by the card, not this balance. `active` is false both for a
  // genuinely unactivated account and before the balance query has
  // answered, so it is only treated as "needs activation" once we know
  // someone is actually signed in.
  const { platformAssetBalance, active: isAccountActive } = useUserStellarAcc();
  const needsActivation = !!session?.user && !isAccountActive;

  // Top-level currency choice, same shape as `PrimaryBuyCard`: Platform
  // Asset (the pooled "cheapest N" ACTION flow below) or USD (card,
  // settles one specific token at a time via `buyResaleWithCard` — there's
  // no batch card entry point, so this surfaces just the single cheapest
  // USD-priced listing instead of a quantity picker).
  const [selectedCurrency, setSelectedCurrency] = useState<"asset" | "usd">("asset");

  const cheapestUsdListing = listings
    .filter((l) => l.sellerId !== viewerId)
    .flatMap((l) => l.prices.filter((p) => p.paymentToken === "usd").map((p) => ({ tokenId: l.tokenId, price: p.price })))
    .sort((a, b) => a.price - b.price)[0];

  const allPurchasable = [
    ...new Map(
      listings
        .filter((l) => l.sellerId !== viewerId)
        .flatMap((l) => l.prices.filter((p) => p.paymentToken === "asset").map((p) => ({ tokenId: l.tokenId, price: p.price })))
        .map((o) => [o.tokenId, o]),
    ).values(),
  ].sort((a, b) => a.price - b.price);

  const [quantity, setQuantity] = useState(1);
  const maxQuantity = Math.min(allPurchasable.length, MAX_BUY_BATCH);

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(q, 1), Math.max(maxQuantity, 1)));
  }, [maxQuantity]);

  if (allPurchasable.length === 0 && !cheapestUsdListing) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        {listings.length > 0 ? "These resales are all your own listings." : "No resold copies for sale right now."}
      </div>
    );
  }

  const selected = allPurchasable.slice(0, quantity);
  const total = selected.reduce((sum, l) => sum + l.price, 0);
  // `buy_batch` is one fee-bumped transaction regardless of how many
  // tokens it settles, so the fee is charged once for the whole batch, not
  // once per token — see `buy_batch`'s doc comment in
  // `contracts/nft_oz/src/lib.rs`.
  const grandTotal = total + INCLUSION_FEE_IN_PLATFORM_ASSET + NETWORK_FEE_IN_PLATFORM_ASSET;
  const cheapest = allPurchasable[0]?.price ?? 0;
  const usdTotal = cheapestUsdListing ? cheapestUsdListing.price + INCLUSION_FEE_IN_USD + NETWORK_FEE_IN_USD : 0;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Buy a resold copy
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {allPurchasable.length} for resale
        </span>
      </div>

      <div className="mt-2 flex w-fit gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => setSelectedCurrency("asset")}
          disabled={allPurchasable.length === 0}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            selectedCurrency === "asset"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {priceTokenLabel("asset")}
        </button>
        <button
          type="button"
          onClick={() => setSelectedCurrency("usd")}
          disabled={!cheapestUsdListing}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            selectedCurrency === "usd"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          USD
        </button>
      </div>

      {selectedCurrency === "asset" ? (
        <>
          <p className="mt-2 flex items-baseline gap-1.5 text-2xl font-black tabular-nums">
            {cheapest}
            <span className="text-sm font-bold text-foreground">{priceTokenLabel("asset")}</span>
            <span className="text-xs font-medium text-muted-foreground">cheapest available</span>
          </p>

          {maxQuantity > 1 && (
            <div className="mt-2 flex w-fit items-center gap-1 rounded-full border pl-3">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-7 text-center text-sm font-bold tabular-nums">{quantity}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                disabled={quantity >= maxQuantity}
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="pr-3 text-xs font-semibold text-muted-foreground">
                / {maxQuantity}
              </span>
            </div>
          )}

          <div className="mt-4 space-y-1.5 rounded-xl bg-muted p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price ({quantity} cop{quantity === 1 ? "y" : "ies"})</span>
              <span className="font-semibold tabular-nums">
                {total.toFixed(2)} {priceTokenLabel("asset")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inclusion fee</span>
              <span className="font-semibold tabular-nums">
                {INCLUSION_FEE_IN_PLATFORM_ASSET.toFixed(2)} {priceTokenLabel("asset")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Network fee</span>
              <span className="font-semibold tabular-nums">
                {NETWORK_FEE_IN_PLATFORM_ASSET.toFixed(2)} {priceTokenLabel("asset")}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
              <span className="font-bold">Total</span>
              <span className="text-base font-black tabular-nums">
                {grandTotal.toFixed(2)} {priceTokenLabel("asset")}
              </span>
            </div>
          </div>

          {needsActivation ? (
            <AccountActivationRequired />
          ) : platformAssetBalance >= grandTotal ? (
            <BuyButton
              isBuying={isBuying}
              onClick={() => void onBuy?.(selected.map((l) => l.tokenId), "asset")}
              idleLabel={`Buy ${quantity} for ${grandTotal.toFixed(2)} ${priceTokenLabel("asset")}`}
            />
          ) : (
            <InsufficientAssetBalance required={grandTotal} balance={platformAssetBalance} />
          )}
        </>
      ) : (
        cheapestUsdListing && (
          <>
            <div className="mt-4 space-y-1.5 rounded-xl bg-muted p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Item price</span>
                <span className="font-semibold tabular-nums">${cheapestUsdListing.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Inclusion fee</span>
                <span className="font-semibold tabular-nums">${INCLUSION_FEE_IN_USD.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Network fee</span>
                <span className="font-semibold tabular-nums">${NETWORK_FEE_IN_USD.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
                <span className="font-bold">Total</span>
                <span className="text-base font-black tabular-nums">${usdTotal.toFixed(2)}</span>
              </div>
            </div>

            {needsActivation ? (
              <AccountActivationRequired />
            ) : isCustodial ? (
              <BuyNftWithCard
                className="mt-3"
                target={{ kind: "resale", tokenId: cheapestUsdListing.tokenId }}
                onSuccess={async () => {
                  await onCardPurchaseSuccess?.();
                }}
              />
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0" />
                Card payment isn&apos;t available for connected wallets — pay with {priceTokenLabel("asset")} instead.
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

// =============================================================================
// Buy — a fresh copy, minted on demand from the edition
// =============================================================================

/**
 * Exported so the gated-ticket page (`src/pages/smart-contract/[id].tsx`)
 * can reuse the exact same quantity/currency/network-fee breakdown instead
 * of a second, drifting implementation — resale doesn't apply there (see
 * VIP_TICKET_UNLOCK_PLAN.md), but a primary purchase is identical either
 * way.
 */
export function PrimaryBuyCard({
  nft,
  onChainInsights,
  isLoadingOnChainInsights,
  onBuy,
  isBuying,
  onCardPurchaseSuccess,
}: {
  nft: ByIdNft;
  onChainInsights?: OnChainInsights;
  isLoadingOnChainInsights: boolean;
  onBuy?: (args: { paymentToken: NftPaymentToken; quantity: number }) => void | Promise<void>;
  isBuying: boolean;
  /** Called after a successful "Pay with card" purchase (see
   *  `BuyNftWithCard`) — the card mutation is self-contained, so this is
   *  the hook for the page to invalidate/refetch, same effect `onBuy`'s
   *  caller has after its own promise resolves. */
  onCardPurchaseSuccess?: () => void | Promise<void>;
}) {
  const { data: session } = useSession();
  const isCustodial = isRechargeAbleClient(session?.user.walletType ?? WalletType.none);
  // Gates the Platform-Asset buy button only — a card/USD checkout is
  // funded by the card, not this balance. `active` is false both for a
  // genuinely unactivated account and before the balance query has
  // answered, so it is only treated as "needs activation" once we know
  // someone is actually signed in.
  const { platformAssetBalance, active: isAccountActive } = useUserStellarAcc();
  const needsActivation = !!session?.user && !isAccountActive;

  // Top-level currency choice — Platform Asset (on-chain) or USD (card) —
  // always both, since a price in each is now mandatory (see
  // `DisplayPricesSchema`). Defaults to ACTION.
  const [selectedCurrency, setSelectedCurrency] = useState<"asset" | "usd">("asset");
  const [quantity, setQuantity] = useState(1);

  // Ground truth once available (post-mint); the DB's price grid otherwise —
  // see `nft.onChainInsights` for why the on-chain read wins once it exists.
  const allPrices = onChainInsights?.prices ?? nft.prices.map((p) => ({ paymentToken: p.paymentToken, price: p.price }));
  const assetPrice = allPrices.find((p) => p.paymentToken === "asset")?.price ?? 0;
  // "usd" never has an on-chain counterpart (see `NFT_DISPLAY_CURRENCIES`'s
  // doc comment), so it only ever comes from the DB's own price grid.
  const usdPrice = nft.prices.find((p) => p.paymentToken === "usd")?.price;

  const remaining = onChainInsights
    ? onChainInsights.remainingSupply
    : nft.supply - nft.mintedCount;
  const maxQuantity = Math.max(0, Math.min(remaining, MAX_QUANTITY_PER_BUY, MAX_BUY_BATCH));

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(q, 1), Math.max(maxQuantity, 1)));
  }, [maxQuantity]);

  if (isLoadingOnChainInsights && !onChainInsights) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Checking availability…
      </div>
    );
  }

  if (maxQuantity <= 0 || assetPrice <= 0) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Sold out — no copies left to buy.
      </div>
    );
  }

  const total = assetPrice * quantity;
  const grandTotal = total + INCLUSION_FEE_IN_PLATFORM_ASSET + NETWORK_FEE_IN_PLATFORM_ASSET;
  const usdTotal = usdPrice !== undefined ? usdPrice * quantity + INCLUSION_FEE_IN_USD + NETWORK_FEE_IN_USD : 0;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Buy this item</h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {remaining} of {onChainInsights?.supply ?? nft.supply} left
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {maxQuantity > 1 ? (
          <div className="flex shrink-0 items-center gap-1 rounded-full border pl-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-7 text-center text-sm font-bold tabular-nums">{quantity}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full"
              disabled={quantity >= maxQuantity}
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span />
        )}

        <div className="flex shrink-0 gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => setSelectedCurrency("asset")}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm font-bold transition-colors",
              selectedCurrency === "asset"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {priceTokenLabel("asset")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCurrency("usd")}
            disabled={usdPrice === undefined}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              selectedCurrency === "usd"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            USD
          </button>
        </div>
      </div>

      {selectedCurrency === "asset" ? (
        <>
          {/* Cost breakdown — laid out inline, no popup. */}
          <div className="mt-4 space-y-1.5 rounded-xl bg-muted p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price per copy</span>
              <span className="font-semibold tabular-nums">
                {assetPrice} {priceTokenLabel("asset")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-semibold tabular-nums">×{quantity}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inclusion fee</span>
              <span className="font-semibold tabular-nums">
                {INCLUSION_FEE_IN_PLATFORM_ASSET} {priceTokenLabel("asset")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Network fee</span>
              <span className="font-semibold tabular-nums">
                {NETWORK_FEE_IN_PLATFORM_ASSET} {priceTokenLabel("asset")}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
              <span className="font-bold">Total</span>
              <span className="text-base font-black tabular-nums">
                {grandTotal.toFixed(2)} {priceTokenLabel("asset")}
              </span>
            </div>

            {/* This is the primary sale — there's no seller separate from
                the creator, so no royalty leg (a creator isn't charged a
                royalty on their own sale). Informational only: it doesn't
                change the total above, it's how the contract splits it
                between the platform and the creator once you pay it. */}
            <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>↳ Platform fee ({(DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(1)}%)</span>
                <span className="tabular-nums">
                  {((total * DEFAULT_PLATFORM_FEE_BPS) / 10_000).toFixed(2)} {priceTokenLabel("asset")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>↳ Creator royalty</span>
                <span className="tabular-nums">0 (primary sale)</span>
              </div>
            </div>
          </div>

          {needsActivation ? (
            <AccountActivationRequired />
          ) : platformAssetBalance >= grandTotal ? (
            <BuyButton
              isBuying={isBuying}
              onClick={() => void onBuy?.({ paymentToken: "asset", quantity })}
              idleLabel={`Buy for ${grandTotal.toFixed(2)} ${priceTokenLabel("asset")}`}
            />
          ) : (
            <InsufficientAssetBalance required={grandTotal} balance={platformAssetBalance} />
          )}
        </>
      ) : (
        <>
          <div className="mt-4 space-y-1.5 rounded-xl bg-muted p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Item price ({quantity}×)</span>
              <span className="font-semibold tabular-nums">${((usdPrice ?? 0) * quantity).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inclusion fee</span>
              <span className="font-semibold tabular-nums">${INCLUSION_FEE_IN_USD.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Network fee</span>
              <span className="font-semibold tabular-nums">${NETWORK_FEE_IN_USD.toFixed(2)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
              <span className="font-bold">Total</span>
              <span className="text-base font-black tabular-nums">${usdTotal.toFixed(2)}</span>
            </div>
          </div>

          {needsActivation ? (
            <AccountActivationRequired />
          ) : isCustodial ? (
            <BuyNftWithCard
              className="mt-3"
              target={{ kind: "edition", nftId: nft.id, quantity }}
              onSuccess={async () => {
                await onCardPurchaseSuccess?.();
              }}
            />
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              Card payment isn&apos;t available for connected wallets — pay with {priceTokenLabel("asset")} instead.
            </div>
          )}
        </>
      )}
    </div>
  );
}
