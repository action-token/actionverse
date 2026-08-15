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
import { api } from "~/utils/api";

export interface NftCardData {
  id: string;
  name: string;
  thumbnail: string;
  lowestActivePrice: number | null;
  activeListingCount: number;
  status: "PENDING" | "MINTED";
  creator?: { id: string; name: string | null; image?: string | null } | null;
  isLiked?: boolean;
  likeCount?: number;
  /** Present when this card represents one specific seller's active listing
   *  (marketplace browse / homepage showcase) rather than the NFT as a whole
   *  (profile/collection views, which stay creator-attributed). */
  listing?: {
    sellerId: string;
    sellerName: string | null;
    sellerImage?: string | null;
    price: number;
    isResale: boolean;
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

  const isPending = nft.status === "PENDING";
  const isForSale = !isPending && (nft.listing !== undefined || nft.activeListingCount > 0);
  const byline = nft.listing
    ? { image: nft.listing.sellerImage, name: nft.listing.sellerName, seed: nft.listing.sellerId }
    : { image: nft.creator?.image, name: nft.creator?.name, seed: nft.creator?.id ?? nft.id };
  const bylinePrefix = nft.listing ? (nft.listing.isResale ? "Resold by " : "Created by ") : "by ";
  const price = nft.listing ? nft.listing.price : nft.lowestActivePrice;
  const href = nft.listing
    ? `/nft/${nft.id}?seller=${nft.listing.sellerId}`
    : `/nft/${nft.id}`;

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

              <Badge
                variant="secondary"
                className="absolute top-3 right-3 bg-black/70 text-white backdrop-blur-sm border-0"
              >
                1 of 1
              </Badge>

              <Button
                size="sm"
                variant="secondary"
                className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm hover:bg-white border-0 shadow-lg"
              >
                <Eye className="w-4 h-4" />
              </Button>

              <div className="absolute top-3 right-3 flex items-center gap-2">
                {isPending ? (
                  <Badge className="bg-black/80 text-white border-0 shadow-lg px-3 py-1 font-semibold uppercase text-[10px]">
                    Minting
                  </Badge>
                ) : (
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
                )}
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Price
                    </span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {isPending ? "Minting…" : isForSale ? `${price} XLM` : "Not listed"}
                    </span>
                  </div>
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
