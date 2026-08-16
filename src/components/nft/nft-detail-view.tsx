import { Pencil, ShoppingBag, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BlockchainInsights } from "~/components/nft/blockchain-insights";
import { PlaceholderArt } from "~/components/nft/placeholder-art";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/shadcn/ui/tabs";
import { type RouterOutputs } from "~/utils/api";

type ByIdNft = RouterOutputs["nft"]["byId"];
type OnChainInsights = RouterOutputs["nft"]["onChainInsights"];
type LiveListing = Extract<OnChainInsights, { minted: true }>["listings"][number];
type MyListing = { price: number; available: number; isActive: boolean } | null;

export function NftDetailView({
  nft,
  mode,
  // manage mode
  myListing,
  heldQuantity = 0,
  onUpdatePrice,
  onCancelListing,
  isSavingListing = false,
  // buy mode
  sellerId,
  viewerId,
  onBuy,
  isBuying = false,
  onChainInsights,
  isLoadingOnChainInsights = false,
}: {
  nft: ByIdNft;
  mode: "manage" | "buy";
  myListing?: MyListing;
  heldQuantity?: number;
  onUpdatePrice?: (price: number) => void | Promise<void>;
  onCancelListing?: () => void | Promise<void>;
  isSavingListing?: boolean;
  /** Which seller's listing this buy dialog is for — each seller is its own
   *  browsable item, so there's no in-dialog seller picker anymore. */
  sellerId?: string;
  /** The logged-in viewer's own id — used to hide the buy action on your own listing. */
  viewerId?: string;
  onBuy?: (sellerId: string) => void | Promise<void>;
  isBuying?: boolean;
  onChainInsights?: RouterOutputs["nft"]["onChainInsights"];
  isLoadingOnChainInsights?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{nft.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Created by{" "}
          <span
            className="font-semibold text-foreground hover:underline"
          >
            {nft.creator.name ?? "Unknown"}
          </span>
        </p>
      </div>

      {mode === "manage" ? (
        <ManagePriceCard
          myListing={myListing ?? null}
          heldQuantity={heldQuantity}
          onUpdatePrice={onUpdatePrice}
          onCancelListing={onCancelListing}
          isSaving={isSavingListing}
          network={onChainInsights?.network}
        />
      ) : (
        <BuyPriceCard
          listings={onChainInsights?.minted ? onChainInsights.listings : []}
          isLoadingListings={isLoadingOnChainInsights}
          status={nft.status}
          sellerId={sellerId}
          viewerId={viewerId}
          onBuy={onBuy}
          isBuying={isBuying}
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
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{nft.description}</p>
          )}
          <dl className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-semibold">
                {nft.status === "PENDING" ? "Minting…" : nft.activeListingCount > 0 ? "Listed" : "Unlisted"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-semibold">1 of 1</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Media type</dt>
              <dd className="truncate font-semibold">{nft.mediaType}</dd>
            </div>
            {nft.onChainTokenId && (
              <div>
                <dt className="text-muted-foreground">Token ID</dt>
                <dd className="font-mono font-semibold">#{nft.onChainTokenId}</dd>
              </div>
            )}
          </dl>
        </TabsContent>

        {mode === "manage" ? (
          <TabsContent value="creator" className="pt-4">
            <div

              className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted"
            >
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
                  Earns a royalty every time this NFT resells
                </p>
              </div>
            </div>
          </TabsContent>
        ) : (
          <TabsContent value="owners" className="pt-4">
            {/* Who has ever held a copy, not how many — that count is a live
                chain read per holder, which doesn't scale to a potentially
                long list here. The single figure that matters (how many you
                hold) is already live, above. */}
            {nft.ownerships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one holds a copy yet.</p>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card">
                {nft.ownerships.map((o) => (
                  <li key={o.id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                        {o.owner.image ? (
                          <Image src={o.owner.image} alt={o.owner.name ?? "Owner"} fill className="object-cover" />
                        ) : (
                          <PlaceholderArt
                            seed={o.owner.id}
                            className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                          />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {o.owner.name ?? "Unknown"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )}

        <TabsContent value="onchain" className="pt-4">
          <BlockchainInsights insights={onChainInsights} isLoading={isLoadingOnChainInsights} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ManagePriceCard({
  myListing,
  heldQuantity,
  onUpdatePrice,
  onCancelListing,
  isSaving,
  network,
}: {
  myListing: MyListing;
  heldQuantity: number;
  onUpdatePrice?: (price: number) => void | Promise<void>;
  onCancelListing?: () => void | Promise<void>;
  isSaving: boolean;
  network?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(myListing?.price ?? 1);
  const isActive = myListing?.isActive ?? false;

  if (heldQuantity <= 0 && !isActive) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        You no longer hold this NFT.
      </div>
    );
  }

  const label = isActive ? "Listed price" : "Not listed";

  function startEditing() {
    setPrice(myListing?.price ?? 1);
    setEditing(true);
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{editing ? "Set price" : label}</span>
        {network && !editing && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            {network}
          </span>
        )}
      </div>

      {editing ? (
        <>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              min={0.0000001}
              step="any"
              autoFocus
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
              className="h-12 max-w-[10rem] text-2xl font-black tabular-nums"
            />
            <span className="text-sm font-bold text-foreground">XLM</span>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              disabled={isSaving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
              disabled={isSaving}
              onClick={async () => {
                await onUpdatePrice?.(price);
                setEditing(false);
              }}
            >
              {isSaving ? "Saving…" : isActive ? "Save" : "List for sale"}
            </Button>
          </div>
        </>
      ) : isActive ? (
        <>
          <p className="mt-1 flex items-baseline gap-1.5 text-3xl font-black tabular-nums">
            {myListing!.price}
            <span className="text-sm font-bold text-foreground">XLM</span>
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5 rounded-full"
              onClick={startEditing}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit price
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isSaving}
              onClick={onCancelListing}
            >
              {isSaving ? "Cancelling…" : "Cancel listing"}
            </Button>
          </div>
        </>
      ) : (
        <Button
          className="mt-3 h-12 w-full gap-2 rounded-full bg-foreground text-base font-bold text-background hover:bg-foreground/90"
          onClick={startEditing}
        >
          <Tag className="h-4 w-4" />
          List for sale
        </Button>
      )}
    </div>
  );
}

function BuyPriceCard({
  listings,
  isLoadingListings,
  status,
  sellerId,
  viewerId,
  onBuy,
  isBuying,
}: {
  /** Live from the contract (`onChainInsights.listings`) — price and
   *  available count are never read from the database here. */
  listings: LiveListing[];
  isLoadingListings: boolean;
  status: ByIdNft["status"];
  sellerId?: string;
  viewerId?: string;
  onBuy?: (sellerId: string) => void | Promise<void>;
  isBuying: boolean;
}) {
  const selected = listings.find((l) => l.sellerId === sellerId) ?? listings[0] ?? null;
  const available = selected?.available ?? 0;
  const isOwnListing = !!selected && !!viewerId && selected.sellerId === viewerId;
  const canBuy = !!selected && available > 0 && !isOwnListing;

  if (!selected) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        {isLoadingListings
          ? "Checking availability…"
          : status === "PENDING"
            ? "Minting in progress…"
            : "Not currently for sale."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Price
        </p>
        <p className="mt-1 flex items-baseline gap-1.5 text-3xl font-black tabular-nums">
          {selected.pricePerCopy}
          <span className="text-sm font-bold text-foreground">XLM</span>
        </p>
      </div>

      <span
        className="mt-2 inline-block text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
      >
        Sold by {selected.sellerName ?? "Unknown seller"}
      </span>

      {isOwnListing ? (
        <p className="mt-4 rounded-full bg-muted px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
          This is your own listing
        </p>
      ) : (
        canBuy && (
          <Button
            onClick={() => onBuy?.(selected.sellerId)}
            disabled={isBuying}
            className="mt-4 h-12 w-full gap-2 rounded-full bg-foreground text-base font-bold text-background hover:bg-foreground/90"
          >
            <ShoppingBag className="h-4 w-4" />
            {isBuying ? "Confirm purchase…" : `Buy for ${selected.pricePerCopy.toFixed(2)} XLM`}
          </Button>
        )
      )}
    </div>
  );
}
