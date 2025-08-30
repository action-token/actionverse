import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import { api } from "~/utils/api";

import { ArrowLeft, Eye, X, DollarSign, User, Hash, Package, Copy } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
} from "~/components/shadcn/ui/dialog";

import { Badge } from "~/components/shadcn/ui/badge";

import { PLATFORM_ASSET } from "~/lib/stellar/constant";

import { z } from "zod";
import { addrShort } from "~/utils/utils";

import clsx from "clsx";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/shadcn/ui/card";

import {
    DeleteAssetByAdmin,
    DisableFromMarketButton,
    SparkleEffect,
} from "../common/modal-common-button";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";

import PaymentProcessItem from "../payment/payment-process";
import ShowThreeDModel from "../3d-model/model-show";

import CopyToClip from "../common/copy_to_Clip";
import { useBuyModalStore } from "../store/buy-modal-store";
import { useBottomPlayer } from "../player/context/bottom-player-context";
import Link from "next/link";
import { Separator } from "../shadcn/ui/separator";

export const PaymentMethodEnum = z.enum(["asset", "xlm", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export default function BuyModal() {
    const session = useSession();
    const [step, setStep] = useState(1);
    const { data, isOpen, setIsOpen } = useBuyModalStore()
    const { showPlayer } = useBottomPlayer()

    // const { setCurrentTrack, currentTrack, setIsPlaying, setCurrentAudioPlayingId } = usePlayer();
    const handleClose = () => {
        console.log(isOpen)
        setStep(1);
        setIsOpen(false);
    };

    const { hasTrust } = useUserStellarAcc()

    const handleNext = () => {
        setStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setStep((prev) => prev - 1);
    };

    const addrShort = (address: string | null | undefined, chars = 5) => {
        if (!address) return "";
        return `${address.slice(0, chars)}...${address.slice(-chars)}`
    }

    const copyToClipboard = (text: string | null | undefined) => {
        if (text) {
            navigator.clipboard.writeText(text)
        }
    }

    const copy = api.marketplace.market.getMarketAssetAvailableCopy.useQuery({
        id: data?.id,
    },
        {
            enabled: !!data
        }
    );

    const hasTrustonAsset = hasTrust(data?.asset.code ?? "", data?.asset.issuer ?? "");

    const { data: canBuyUser } =
        api.marketplace.market.userCanBuyThisMarketAsset.useQuery(
            data?.id ?? 0,
            {
                enabled: !!data
            }
        );

    if (!data || !data.asset)

        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl overflow-hidden p-1">
                    <DialogClose className="absolute right-3 top-3">
                        <X className="text-foreground" size={24} />
                    </DialogClose>
                    <div className="grid grid-cols-1">
                        {/* Left Column - Product Image */}
                        <Card className="bg-card">
                            <CardContent className="flex max-h-[600px] min-h-[600px] items-center justify-center">
                                <div role="status">
                                    <svg
                                        aria-hidden="true"
                                        className="h-8 w-8 animate-spin fill-primary text-muted"
                                        viewBox="0 0 100 101"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                            fill="currentColor"
                                        />
                                        <path
                                            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                            fill="currentFill"
                                        />
                                    </svg>
                                    <span className="sr-only">Loading...</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
        );

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-4xl border-0 bg-gradient-to-br from-background to-muted p-0 max-h-[90vh] overflow-y-auto">
                    <button
                        onClick={handleClose}
                        className="absolute right-4 top-4 z-50 rounded-full bg-primary shadow-sm shadow-foreground p-2"
                    >
                        <X className="h-4 w-4 text-foreground" />
                    </button>

                    {step === 1 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2  overflow-y-auto">
                            {/* Left Column - Media Display */}
                            <div className="relative bg-background/20 backdrop-blur-sm">
                                {/* Sparkle Effect */}
                                <div className="absolute inset-0 z-10 pointer-events-none">
                                    <div className="absolute top-4 left-4 w-2 h-2 bg-foreground rounded-full animate-pulse"></div>
                                    <div className="absolute top-12 right-8 w-1 h-1 bg-primary rounded-full animate-ping"></div>
                                    <div className="absolute bottom-16 left-8 w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></div>
                                </div>

                                {/* Desktop Image */}
                                <div className="hidden lg:block h-full relative">
                                    <Image
                                        src={data?.asset.thumbnail || "/placeholder.svg"}
                                        alt={data?.asset.name}
                                        fill
                                        className="object-cover"
                                    />

                                </div>

                                {/* Mobile Media Display */}
                                <div className="lg:hidden h-64 relative overflow-hidden">
                                    <Image
                                        src={data?.asset.thumbnail || "/placeholder.svg"}
                                        alt={data?.asset.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            </div>

                            {/* Right Column - Asset Details */}
                            <div className="flex flex-col bg-card/5 backdrop-blur-sm">
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Header */}
                                    <div className="space-y-2">
                                        <h1 className="text-2xl font-bold text-foreground truncate">{data?.asset.name}</h1>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant='destructive'
                                            >
                                                {data?.asset.mediaType === "THREE_D" ? "3D Model" : data?.asset.mediaType}
                                            </Badge>
                                            <Badge>
                                                {data?.asset.code}
                                            </Badge>
                                        </div>
                                    </div>

                                    <Separator className="bg-border" />

                                    {/* Description */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
                                        <div className="h-40 overflow-y-auto bg-secondary rounded-lg p-3">
                                            <p className="text-sm text-foreground/80 leading-relaxed">{data?.asset.description}</p>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                            <DollarSign className="h-4 w-4" />
                                            Price
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-bold text-foreground">{data?.price} {PLATFORM_ASSET.code}</span>
                                            <Badge className="bg-accent/20 text-accent-foreground border-accent/30">
                                                ${data?.priceUSD} USD
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Asset Details */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Asset Details</h3>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Hash className="h-4 w-4" />
                                                    Issuer ID
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs  bg-primary px-2 py-1 rounded-md">
                                                        {addrShort(data?.asset.issuer, 5)}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                                        onClick={() => copyToClipboard(data?.asset.issuer)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Placer ID
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs  bg-primary px-2 py-1 rounded-md">
                                                        {addrShort(data?.placerId, 5)}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                                        onClick={() => copyToClipboard(data?.placerId)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Package className="h-4 w-4" />
                                                    Available
                                                </span>
                                                <Badge className="bg-accent text-accent-foreground border-accent/30">
                                                    {copy.data} {copy.data === 1 ? "copy" : "copies"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="p-2 space-y-2 flex flex-col gap-2">
                                    <Link href={`/market-asset/${data.id}`}>
                                        <Button
                                            onClick={handleClose}
                                            variant="outline" className="w-full shadow-sm shadow-background border-2">
                                            <Eye className="mr-2 h-4 w-4" />
                                            View Asset
                                        </Button>
                                    </Link>

                                    {session.status === "authenticated" &&
                                        data.placerId === session.data.user.id ? (
                                        <>
                                            <DisableFromMarketButton
                                                code={data.asset.code}
                                                issuer={data.asset.issuer}
                                            />
                                        </>
                                    ) : (
                                        canBuyUser &&
                                        copy.data &&
                                        copy.data > 0 && (
                                            <Button
                                                variant="accent"
                                                onClick={handleNext}
                                                className="w-full shadow-sm shadow-background border-2"
                                            >
                                                Buy Item
                                            </Button>
                                        )
                                    )}




                                    <p className="text-xs text-muted-foreground text-center">
                                        Once purchased, this item will be added to your collection.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="max-h-[90vh] overflow-y-auto">
                            <Card>
                                <CardContent className="p-0">
                                    <PaymentProcessItem
                                        marketItemId={data.id}
                                        priceUSD={data.priceUSD}
                                        item={data.asset}
                                        price={data.price}
                                        placerId={data.placerId}
                                        setClose={handleClose}
                                        type={data.type}
                                    />
                                </CardContent>
                                <CardFooter className="p-2">
                                    {step === 2 && (
                                        <Button onClick={handleBack} variant="destructive" className="shadow-sm shadow-background">
                                            Back
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog >
        </>
    );
}
