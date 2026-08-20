"use client";

import { useEffect, useState } from "react";
import { MediaType } from "@prisma/client";
import { Check, Loader2 } from "lucide-react";
import Image from "next/image";
import { Badge } from "~/components/shadcn/ui/badge";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select";

/**
 * Shared by the classic NFT and non-Stellar item create pages
 * (`~/pages/organization/classic-nft/create.tsx`,
 * `~/pages/organization/non-stellar-item/create.tsx`) — split out of the
 * old `SmartContractNftForm`-adjacent dialog forms so neither page needs
 * to duplicate this ~150 lines twice.
 */
export function TiersOptions({
    tiers,
    value,
    handleTierChange,
}: {
    tiers: { id: number; name: string; price: number }[];
    value?: string;
    handleTierChange: (value: string) => void;
}) {
    return (
        <Select value={value} onValueChange={handleTierChange}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tier" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Choose Tier</SelectLabel>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Only Members</SelectItem>
                    {tiers.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                            <div className="flex w-full items-center justify-between">
                                <span>{model.name}</span>
                                <Badge variant="outline">{model.price}</Badge>
                            </div>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

export function PlayableMedia({
    mediaUrl,
    mediaType,
}: {
    mediaUrl?: string;
    mediaType: MediaType;
}) {
    return (
        mediaUrl && <MediaComponent mediaType={mediaType} mediaUrl={mediaUrl} />
    );

    function MediaComponent({
        mediaType,
        mediaUrl,
    }: {
        mediaType: MediaType;
        mediaUrl: string;
    }) {
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            // Simulate loading
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 1000);

            return () => clearTimeout(timer);
        }, []);

        if (isLoading) {
            return (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin " />
                </div>
            );
        }

        switch (mediaType) {
            case MediaType.IMAGE:
                return (
                    <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        <Image
                            alt="NFT preview"
                            src={mediaUrl ?? "/placeholder.svg"}
                            fill
                            className="object-cover"
                        />
                    </div>
                );
            case MediaType.MUSIC:
                return (
                    <div className="w-full">
                        <audio controls className="w-full">
                            <source src={mediaUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                );
            case MediaType.VIDEO:
                return (
                    <div className="aspect-video w-full overflow-hidden rounded-md">
                        <video controls className="h-full w-full">
                            <source src={mediaUrl} type="video/mp4" />
                            Your browser does not support the video element.
                        </video>
                    </div>
                );
            case MediaType.THREE_D:
                return (
                    <div className="flex items-center justify-center rounded-md bg-green-50 p-4">
                        <div className="flex items-center gap-2 text-green-600">
                            <Check className="h-5 w-5" />
                            <span className="font-medium">
                                3D Model Uploaded Successfully
                            </span>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }
}
