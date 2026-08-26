import type React from "react";
import { motion } from "framer-motion";
import { Gem, Eye, Star } from "lucide-react";
// import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Badge } from "~/components/shadcn/ui/badge";
import { Button } from "~/components/shadcn/ui/button";
import { Card, CardContent } from "~/components/shadcn/ui/card";
import { PlaceholderArt } from "~/components/nft/placeholder-art";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

export function priceTokenLabel(token?: string): string {
  switch (token) {
    case "asset":
      return PLATFORM_ASSET.code;
    case "usdc":
      return "USDC";
    case "usd":
      return "USD";
    default:
      return "XLM";
  }
}

/** Row label for a price-grid entry, e.g. on `AssetView`'s card —
 *  "XLM PRICE", "PLATFORM PRICE", "USDC PRICE", "USD PRICE". */
export function priceRowLabel(token?: string): string {
  switch (token) {
    case "asset":
      return "PLATFORM PRICE";
    case "usdc":
      return "USDC PRICE";
    case "usd":
      return "USD PRICE";
    default:
      return "XLM PRICE";
  }
}

export interface NftCardData {
  id: string;
  name: string;
  thumbnail: string;
  status: "PENDING" | "MINTED";
  creator?: { id: string; name: string | null; image?: string | null } | null;
  isLiked?: boolean;
  likeCount?: number;
  /** Price to show on the card — the edition's lowest primary price, or a
   *  specific resale listing's price when `listing` is set. `null` means
   *  "not currently for sale" (e.g. sold out with no active resale). */
  price: number | null;
  /** Which currency `price` is denominated in — "xlm" | "asset" | "usdc". */
  priceToken?: string;
  /** Full multi-currency price grid, when more than one currency is on
   *  offer — used instead of the single `price`/`priceToken` to show every
   *  accepted currency on the card. */
  prices?: { paymentToken: string; price: number }[];
  /** Edition supply, present on a primary "buy a new copy" card. */
  supply?: number;
  mintedCount?: number;
  /** Present when this card represents one specific resold copy rather than
   *  a fresh mint from the edition — its own browsable entry, not merged
   *  into the original edition's card. */
  listing?: {
    tokenId: string;
    /** Every token id this card represents — more than one when the same
     *  seller listed several copies of this edition at the same price,
     *  merged into one card instead of one per token. */
    tokenIds: string[];
    quantity: number;
    sellerId: string;
    sellerName: string | null;
    sellerImage?: string | null;
    isResale: boolean;
  };
}

type MarketplaceListItem = RouterOutputs["nft"]["list"]["items"][number];

/** Adapts `nft.list`'s merged primary/resale feed item into `NftCardData`. */
export function toNftCardData(item: MarketplaceListItem): NftCardData {
  if (item.kind === "resale") {
    return {
      id: item.id,
      name: item.name,
      thumbnail: item.thumbnail,
      status: item.status,
      creator: item.creator,
      isLiked: item.isLiked,
      likeCount: item.likeCount,
      price: item.price,
      priceToken: item.priceToken,
      prices: item.prices,
      listing: {
        tokenId: item.tokenId,
        tokenIds: item.tokenIds,
        quantity: item.quantity,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        sellerImage: item.sellerImage,
        isResale: item.sellerId !== item.creator?.id,
      },
    };
  }
  return {
    id: item.id,
    name: item.name,
    thumbnail: item.thumbnail,
    status: item.status,
    creator: item.creator,
    isLiked: item.isLiked,
    likeCount: item.likeCount,
    price: item.price,
    priceToken: item.priceToken,
    prices: item.prices,
    supply: item.supply,
    mintedCount: item.mintedCount,
  };
}

export function NftCard({ nft, index = 0 }: { nft: NftCardData; index?: number }) {
  const { data: session } = useSession();
  const utils = api.useContext();

  /*
  const toggleLike = api.nft.toggleLike.useMutation({
    onMutate: async ({ nftId }) => {
      await utils.nft.list.cancel();
      const prev = utils.nft.list.getInfiniteData();
      utils.nft.list.setInfiniteData({ limit: 10 }, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === nftId
                ? {
                    ...item,
                    isLiked: !item.isLiked,
                    likeCount: item.likeCount + (item.isLiked ? -1 : 1),
                  }
                : item,
            ),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.nft.list.setInfiniteData({ limit: 10 }, context.prev);
    },
    onSettled: () => void utils.nft.list.invalidate(),
  });

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!session?.user) {
      toast.error("Connect your wallet to save favorites");
      return;
    }
    toggleLike.mutate({ nftId: nft.id });
  }
  */

  const isForSale = nft.price !== null;
  const byline = nft.listing
    ? { image: nft.listing.sellerImage, name: nft.listing.sellerName, seed: nft.listing.sellerId }
    : { image: nft.creator?.image, name: nft.creator?.name, seed: nft.creator?.id ?? nft.id };
  const bylinePrefix = nft.listing ? (nft.listing.isResale ? "Resold by " : "Created by ") : "by ";
  const price = nft.price;
  // `/smart-contract/[id]` is the one buy page for every NFT now — primary
  // or resold, gated or not — replacing the old `/nft/[id]`. It reads
  // `nft.byId` itself, so no token id needs to travel in the URL. A resale
  // card does carry `?resale=<sellerId>` though: without it the page can't
  // tell which of the two cards for one edition was clicked, and would
  // offer primary "buy new" pricing to someone who came in for a specific
  // seller's resold copy.
  const href = nft.listing
    ? `/smart-contract/${nft.id}?resale=${encodeURIComponent(nft.listing.sellerId)}`
    : `/smart-contract/${nft.id}`;
  const supplyBadge =
    nft.supply && nft.supply > 1 ? `${nft.mintedCount ?? 0}/${nft.supply}` : "1 of 1";
  const resaleBadge =
    nft.listing && nft.listing.quantity > 1 ? `Resale ×${nft.listing.quantity}` : "Resale";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: "easeOut" }}
      className="h-full"
    >
      <Link href={href} className="group block h-full">
        <Card className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 h-full backdrop-blur-sm group">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="relative overflow-hidden">
              <Image
                src={nft.thumbnail || "/images/logo.png"}
                alt={nft.name}
                height={240}
                width={240}
                className="object-cover h-48 w-full transition-transform duration-500 group-hover:scale-105"
              />

              <Button
                size="sm"
                variant="secondary"
                className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm hover:bg-white border-0 shadow-lg"
              >
                <Eye className="w-4 h-4" />
              </Button>

              {/* Stacked, not both `top-3 right-3` — that had the NFT badge
                  rendering directly on top of (and fully hiding) the
                  resale/supply badge underneath it. */}
              <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 0 rgba(59, 130, 246, 0)",
                      "0 0 20px rgba(59, 130, 246, 0.6)",
                      "0 0 0 rgba(59, 130, 246, 0)",
                    ],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "loop",
                  }}
                >
                  <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-lg backdrop-blur-md px-3 py-1">
                    <Gem className="w-3 h-3 mr-1.5 fill-white" />
                    <span className="font-semibold">NFT</span>
                  </Badge>
                </motion.div>

                <Badge
                  variant="secondary"
                  className={cn(
                    "border-0 text-white backdrop-blur-sm",
                    nft.listing ? "bg-amber-600/90" : "bg-black/70",
                  )}
                >
                  {nft.listing ? resaleBadge : supplyBadge}
                </Badge>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <div className="space-y-3 flex-1">
                {/* Title section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
                        {byline.image ? (
                          <Image
                            src={byline.image}
                            alt={byline.name ?? "Seller"}
                            width={20}
                            height={20}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <PlaceholderArt seed={byline.seed} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" />
                        )}
                      </div>
                      <span className="font-medium text-muted-foreground text-xs truncate">
                        {bylinePrefix}{byline.name ?? "unknown"}
                      </span>
                      <motion.div
                        animate={{ rotate: [0, 15, 0, -15, 0] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </motion.div>
                    </div>

                    {/* Like button - commented out as requested */}
                    {/*
                    <button
                      type="button"
                      onClick={handleLike}
                      className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Heart className={nft.isLiked ? "h-3.5 w-3.5 fill-red-500 text-red-500" : "h-3.5 w-3.5"} />
                      {nft.likeCount ?? 0}
                    </button>
                    */}
                  </div>
                  <h2 className="text-lg font-bold truncate leading-tight">{nft.name}</h2>
                </div>

                <div className="rounded-xl p-4 border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                  {isForSale && nft.prices && nft.prices.length > 1 ? (
                    <div className="space-y-1">
                      {nft.prices.map((p) => (
                        <div key={p.paymentToken} className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {priceTokenLabel(p.paymentToken)} PRICE
                          </span>
                          <span className="text-base font-bold text-green-600 dark:text-green-400">
                            {p.price.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        XLM Price
                      </span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        {isForSale ? `${price?.toFixed(3)} ${priceTokenLabel(nft.priceToken)}` : "Sold out"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3">
                <Button size="sm" className="w-full transition-colors shadow-sm shadow-black/30">
                  <Eye className="w-4 h-4 mr-2" />
                  Buy Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
