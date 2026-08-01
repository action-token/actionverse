"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { Badge } from "~/components/shadcn/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { ImageIcon, Music, Video, Box, Package } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";

type MediaType = "image" | "video" | "audio" | "3d";

const MyNftsPage = () => {
    const { status } = useSession();
    const router = useRouter();
    const [selectedNftId, setSelectedNftId] = useState<string | null>(null);

    const myOwnedNfts = api.nft.Nft.getMyOwnedNfts.useQuery(undefined, {
        enabled: status === "authenticated",
    });

    const selectedNftQuery = api.nft.Nft.getNftById.useQuery(
        { id: selectedNftId! },
        { enabled: !!selectedNftId },
    );

    const selectedNft = selectedNftQuery.data;
    const selectedOwnedQuantity = myOwnedNfts.data?.find(
        (o) => o.nftId === selectedNftId,
    )?.quantity;

    if (status === "unauthenticated") {
        return (
            <div className="flex h-[calc(100vh-10.8vh)] items-center justify-center">
                <Card className="p-8 text-center">
                    <h2 className="text-xl font-bold">Please sign in to view your NFTs</h2>
                    <Button className="mt-4" onClick={() => router.push("/")}>
                        Go to Home
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-10.8vh)] flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b bg-secondary p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">My NFTs</h1>
                    <Badge variant="secondary" className="text-sm">
                        <Package className="mr-1 h-4 w-4" />
                        {myOwnedNfts.data?.length ?? 0} items
                    </Badge>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto bg-white/40 p-4">
                {myOwnedNfts.isLoading ? (
                    <MoreAssetsSkeleton className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" />
                ) : !myOwnedNfts.data || myOwnedNfts.data.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                        <Package className="h-16 w-16 opacity-50" />
                        <p className="mt-4 text-lg">You don&apos;t own any NFTs yet</p>
                        <Button className="mt-4" onClick={() => router.push("/nft/browse")}>
                            Browse Marketplace
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {myOwnedNfts.data.map((ownership) => (
                            <OwnedNftCard
                                key={ownership.id}
                                nft={ownership.nft}
                                quantity={ownership.quantity}
                                onClick={() => setSelectedNftId(ownership.nft.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
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
                                {/* Full content preview */}
                                <div className="relative h-64 overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200">
                                    {selectedNft.mediaType === "image" ? (
                                        <Image
                                            src={selectedNft.contentUrl}
                                            alt={selectedNft.name}
                                            fill
                                            className="object-contain"
                                        />
                                    ) : selectedNft.mediaType === "video" ? (
                                        <video
                                            src={selectedNft.contentUrl}
                                            controls
                                            className="h-full w-full object-contain"
                                        />
                                    ) : selectedNft.mediaType === "audio" ? (
                                        <div className="flex h-full flex-col items-center justify-center gap-4">
                                            <Music className="h-16 w-16 text-primary" />
                                            <audio src={selectedNft.contentUrl} controls className="w-4/5" />
                                        </div>
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <Box className="h-16 w-16 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground">
                                    {selectedNft.description}
                                </p>

                                {/* Details */}
                                <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary p-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">You own</p>
                                        <p className="text-xl font-bold">{selectedOwnedQuantity ?? 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Price paid (each)</p>
                                        <p className="text-xl font-bold">{selectedNft.price} XLM</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Media type</p>
                                        <p className="font-medium capitalize">{selectedNft.mediaType}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total copies</p>
                                        <p className="font-medium">{selectedNft.copies}</p>
                                    </div>
                                    {selectedNft.onChainTokenId && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground">Token ID</p>
                                            <p className="font-mono text-sm">{selectedNft.onChainTokenId}</p>
                                        </div>
                                    )}
                                    {selectedNft.txHash && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground">Mint transaction</p>
                                            <p className="truncate font-mono text-xs">{selectedNft.txHash}</p>
                                        </div>
                                    )}
                                </div>

                                <a
                                    href={selectedNft.contentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                >
                                    <Button variant="outline" className="w-full">
                                        View Full Media
                                    </Button>
                                </a>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

interface OwnedNftData {
    id: string;
    name: string;
    thumbnail: string;
    mediaType: string;
    price: number;
    creator: { id: string; name: string | null; image: string | null };
}

function OwnedNftCard({
    nft,
    quantity,
    onClick,
}: {
    nft: OwnedNftData;
    quantity: number;
    onClick: () => void;
}) {
    return (
        <Card
            onClick={onClick}
            className="group cursor-pointer overflow-hidden shadow-sm shadow-black transition-all hover:shadow-lg"
        >
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
                <Badge className="absolute right-2 top-2 bg-green-600">x{quantity}</Badge>
            </div>

            <CardContent className="p-4">
                <h3 className="truncate font-bold">{nft.name}</h3>
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
            </CardContent>
        </Card>
    );
}

function MediaTypeIcon({ type }: { type: MediaType }) {
    const iconClass = "h-12 w-12 text-muted-foreground";
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

export default MyNftsPage;
