"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Badge } from "~/components/shadcn/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "~/components/shadcn/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select";
import {
    Search,
    ImageIcon,
    Music,
    Video,
    Box,
    ShoppingCart,
    Loader2,
    Filter,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import useNeedSign from "~/lib/hook";
import { clientsign, extractTxHash } from "package/connect_wallet";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";

type MediaType = "image" | "video" | "audio" | "3d";

const BrowseNFTPage = () => {
    const { data: session, status } = useSession();
    const { needSign } = useNeedSign();

    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<MediaType | "all">("all");
    const [selectedNftId, setSelectedNftId] = useState<string | null>(null);
    const [buyQuantity, setBuyQuantity] = useState(1);
    const [isBuying, setIsBuying] = useState(false);

    const nftsQuery = api.nft.Nft.getNfts.useInfiniteQuery(
        { limit: 20, status: "LISTED" },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
    );

    const selectedNftQuery = api.nft.Nft.getNftById.useQuery(
        { id: selectedNftId! },
        { enabled: !!selectedNftId },
    );

    const myOwnedNfts = api.nft.Nft.getMyOwnedNfts.useQuery(undefined, {
        enabled: status === "authenticated",
    });

    const getBuyXDRMutation = api.nft.Nft.getBuyNftXDR.useMutation();
    const confirmPurchaseMutation = api.nft.Nft.confirmNftPurchased.useMutation({
        onSuccess: () => {
            toast.success("NFT purchased successfully!");
            nftsQuery.refetch();
            myOwnedNfts.refetch();
            setSelectedNftId(null);
            setBuyQuantity(1);
        },
        onError: (e) => toast.error(e.message),
    });

    const allNfts = nftsQuery.data?.pages.flatMap((p) => p.nfts) ?? [];

    const filteredNFTs = allNfts.filter((nft) => {
        const matchesSearch =
            nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            nft.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            nft.creator.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === "all" || nft.mediaType === filterType;
        return matchesSearch && matchesType;
    });

    const ownedMap = new Map<string, number>(
        myOwnedNfts.data?.map((o: { nftId: string; quantity: number }) => [o.nftId, o.quantity]) ?? [],
    );

    const handleBuy = async () => {
        if (!selectedNftId || !session) return;

        setIsBuying(true);
        try {
            const { xdr, fullySignedByServer } = await getBuyXDRMutation.mutateAsync({
                nftId: selectedNftId,
                quantity: buyQuantity,
                signWith: needSign(),
            });

            let txHash: string | undefined;
            if (fullySignedByServer) {
                const result = await submitSignedXDRToServer4User(xdr);
                txHash = extractTxHash(result);
            } else {
                const clientResponse = await clientsign({
                    presignedxdr: xdr,
                    walletType: session.user.walletType,
                    pubkey: session.user.id,
                    test: clientSelect(),
                });
                txHash = extractTxHash(clientResponse);
            }

            if (!txHash) {
                toast.error("Transaction failed");
                setIsBuying(false);
                return;
            }

            await confirmPurchaseMutation.mutateAsync({
                nftId: selectedNftId,
                txHash,
                quantity: buyQuantity,
            });
        } catch (e) {
            console.error(e);
            toast.error("Purchase failed");
        }
        setIsBuying(false);
    };

    const selectedNft = selectedNftQuery.data;
    const totalOwned = myOwnedNfts.data?.reduce((sum: number, o: { quantity: number }) => sum + o.quantity, 0) ?? 0;

    return (
        <div className="flex h-[calc(100vh-10.8vh)] flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b bg-secondary p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">NFT Marketplace</h1>
                    <div className="flex items-center gap-4">
                        <Link href="/nft/my">
                            <Badge variant="secondary" className="cursor-pointer text-sm hover:bg-secondary/70">
                                <ShoppingCart className="mr-1 h-4 w-4" />
                                {totalOwned} items owned
                            </Badge>
                        </Link>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="mt-4 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search NFTs by name, description, or creator..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select
                        value={filterType}
                        onValueChange={(v) => setFilterType(v as MediaType | "all")}
                    >
                        <SelectTrigger className="w-48">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="image">Images</SelectItem>
                            <SelectItem value="video">Videos</SelectItem>
                            <SelectItem value="audio">Audio</SelectItem>
                            <SelectItem value="3d">3D Objects</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* NFT Grid */}
            <div className="flex-1 overflow-y-auto bg-white/40 p-4">
                {nftsQuery.isLoading ? (
                    <MoreAssetsSkeleton className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" />
                ) : filteredNFTs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                        <Search className="h-16 w-16 opacity-50" />
                        <p className="mt-4 text-lg">No NFTs found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {filteredNFTs.map((nft) => (
                                <NFTBrowseCard
                                    key={nft.id}
                                    nft={nft}
                                    owned={ownedMap.get(nft.id) ?? 0}
                                    onBuy={() => setSelectedNftId(nft.id)}
                                />
                            ))}
                        </div>
                        {nftsQuery.hasNextPage && (
                            <div className="mt-6 flex justify-center">
                                <Button
                                    onClick={() => nftsQuery.fetchNextPage()}
                                    disabled={nftsQuery.isFetchingNextPage}
                                >
                                    {nftsQuery.isFetchingNextPage ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Load More
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Buy Dialog */}
            <Dialog open={!!selectedNftId} onOpenChange={() => setSelectedNftId(null)}>
                <DialogContent className="max-w-lg">
                    {selectedNft && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{selectedNft.name}</DialogTitle>
                                <DialogDescription>
                                    by {selectedNft.creator.name}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Preview */}
                                <div className="relative h-48 overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200">
                                    {selectedNft.mediaType === "image" ? (
                                        <Image
                                            src={selectedNft.thumbnail}
                                            alt={selectedNft.name}
                                            fill
                                            className="object-contain"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <MediaTypeIcon type={selectedNft.mediaType as MediaType} large />
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground">
                                    {selectedNft.description}
                                </p>

                                {/* Price and Availability */}
                                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Price per item</p>
                                        <p className="text-xl font-bold">{selectedNft.price} XLM</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Available</p>
                                        <p className="text-xl font-bold">
                                            {selectedNft.availableCopies ?? selectedNft.copies}/{selectedNft.copies}
                                        </p>
                                    </div>
                                </div>

                                {/* Quantity */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantity</label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setBuyQuantity(Math.max(1, buyQuantity - 1))}
                                            disabled={buyQuantity <= 1 || isBuying}
                                        >
                                            -
                                        </Button>
                                        <Input
                                            type="number"
                                            value={buyQuantity}
                                            onChange={(e) =>
                                                setBuyQuantity(
                                                    Math.min(
                                                        selectedNft.availableCopies ?? selectedNft.copies,
                                                        Math.max(1, parseInt(e.target.value) || 1),
                                                    ),
                                                )
                                            }
                                            className="w-20 text-center"
                                            min={1}
                                            max={selectedNft.availableCopies ?? selectedNft.copies}
                                            disabled={isBuying}
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                                setBuyQuantity(
                                                    Math.min(
                                                        selectedNft.availableCopies ?? selectedNft.copies,
                                                        buyQuantity + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                buyQuantity >= (selectedNft.availableCopies ?? selectedNft.copies) ||
                                                isBuying
                                            }
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">Total</span>
                                        <p className="text-xl font-bold">
                                            {selectedNft.price * buyQuantity} XLM
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedNftId(null)}
                                    disabled={isBuying}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleBuy}
                                    disabled={isBuying || status !== "authenticated"}
                                    className="shadow-sm shadow-black"
                                >
                                    {isBuying ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <ShoppingCart className="mr-2 h-4 w-4" />
                                            Buy Now
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

interface NFTData {
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    contentUrl: string;
    mediaType: string;
    price: number;
    copies: number;
    availableCopies: number | null;
    creator: { id: string; name: string | null; image: string | null };
}

function NFTBrowseCard({
    nft,
    owned,
    onBuy,
}: {
    nft: NFTData;
    owned: number;
    onBuy: () => void;
}) {
    const available = nft.availableCopies ?? nft.copies;

    return (
        <Card className="group overflow-hidden shadow-sm shadow-black transition-all hover:shadow-lg">
            {/* Media Preview */}
            <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200">
                {nft.mediaType === "image" ? (
                    <Image
                        src={nft.thumbnail}
                        alt={nft.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <MediaTypeIcon type={nft.mediaType as MediaType} />
                    </div>
                )}
                <Badge className="absolute left-2 top-2 capitalize">{nft.mediaType}</Badge>
                {owned > 0 && (
                    <Badge className="absolute right-2 top-2 bg-green-600">Owned: {owned}</Badge>
                )}
            </div>

            <CardContent className="p-4">
                {/* NFT Info */}
                <h3 className="truncate font-bold">{nft.name}</h3>

                {/* Creator */}
                <div className="mt-2 flex items-center gap-2">
                    {nft.creator.image && (
                        <div className="relative h-6 w-6 overflow-hidden rounded-full">
                            <Image
                                src={nft.creator.image}
                                alt={nft.creator.name ?? "Creator"}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                        {nft.creator.name ?? "Unknown"}
                    </span>
                </div>

                {/* Price and Availability */}
                <div className="mt-3 flex items-center justify-between">
                    <p className="font-bold">{nft.price} XLM</p>
                    <p className="text-xs text-muted-foreground">
                        {available}/{nft.copies} left
                    </p>
                </div>

                {/* Buy Button */}
                <Button
                    onClick={onBuy}
                    disabled={available === 0}
                    className="mt-3 w-full shadow-sm shadow-black"
                    size="sm"
                >
                    {available === 0 ? "Sold Out" : "Buy Now"}
                </Button>
            </CardContent>
        </Card>
    );
}

function MediaTypeIcon({ type, large = false }: { type: MediaType; large?: boolean }) {
    const iconClass = cn("text-muted-foreground", large ? "h-16 w-16" : "h-12 w-12");
    switch (type) {
        case "image":
            return <ImageIcon className={iconClass} />;
        case "video":
            return <Video className={iconClass} />;
        case "audio":
            return <Music className={iconClass} />;
        case "3d":
            return <Box className={iconClass} />;
    }
}

export default BrowseNFTPage;
