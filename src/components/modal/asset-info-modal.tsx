import { useSession } from "next-auth/react";
import Image from "next/image";
import { api } from "~/utils/api";

import { ArrowLeft, Eye, X, DollarSign, User, Hash, Package, Copy } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
} from "~/components/shadcn/ui/dialog";

import { Badge } from "~/components/shadcn/ui/badge";
import {
    useCreatorStorageAcc,
    useUserStellarAcc,
} from "~/lib/state/wallete/stellar-balances";

import { z } from "zod";

import {
    DeleteAssetByAdmin,
    DisableFromMarketButton,
    OtherButtons,
    SparkleEffect,
} from "../common/modal-common-button";
import { useAssestInfoModalStore } from "../store/asset-info-modal-store";
import { useBottomPlayer } from "../player/context/bottom-player-context";
import {
    MyCollectionMenu,
    useMyCollectionTabs,
} from "../store/tabs/mycollection-tabs";
import { useShowDisableButton } from "~/hooks/use-myCollection";
import { Separator } from "../shadcn/ui/separator";
import Link from "next/link";

export const PaymentMethodEnum = z.enum(["asset", "xlm", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export default function AssetInfoModal() {
    const { data, isOpen, setIsOpen } = useAssestInfoModalStore();
    const { showPlayer } = useBottomPlayer();

    const isMyCollectionPage = useShowDisableButton(data);
    const { selectedMenu, setSelectedMenu } = useMyCollectionTabs();
    const { getAssetBalance: creatorAssetBalance } = useUserStellarAcc();
    const {
        getAssetBalance: creatorStorageAssetBalance,
        setBalance,
        balances,
    } = useCreatorStorageAcc();


    const handleClose = () => {
        setIsOpen(false);
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
    const acc = api.wallate.acc.getCreatorStorageBallances.useQuery(undefined, {
        onSuccess: (data) => {
            setBalance(data);
        },
        onError: (error) => {
            console.log(error);
        },
        refetchOnWindowFocus: false,
        enabled: !!data,
    });

    const copyCreatorAssetBalance = data
        ? selectedMenu === MyCollectionMenu.COLLECTION
            ? creatorAssetBalance({
                code: data.code,
                issuer: data.issuer,
            })
            : creatorStorageAssetBalance({
                code: data.code,
                issuer: data.issuer,
            })
        : 0;

    if (data) {
        // console.log("vong cong data", data);
        return (
            <>
                <Dialog open={isOpen} onOpenChange={handleClose}>
                    <DialogContent className="max-w-4xl border-0 bg-gradient-to-br from-background to-muted p-0 h-[85vh] overflow-y-auto">
                        <button
                            onClick={handleClose}
                            className="absolute right-4 top-4 z-50 rounded-full bg-primary shadow-sm shadow-foreground p-2"
                        >
                            <X className="h-4 w-4 text-foreground" />
                        </button>

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
                                        src={data?.thumbnail || "/placeholder.svg"}
                                        alt={data?.name}
                                        fill
                                        className="object-cover"
                                    />

                                </div>

                                {/* Mobile Media Display */}
                                <div className="lg:hidden h-64 relative overflow-hidden">
                                    <Image
                                        src={data?.thumbnail || "/placeholder.svg"}
                                        alt={data?.name}
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
                                        <h1 className="text-2xl font-bold text-foreground truncate">{data?.name}</h1>
                                        <div className="flex items-center gap-2">
                                            <Badge className=" shadow-sm shadow-foreground"
                                                variant='destructive'
                                            >
                                                {data?.mediaType === "THREE_D" ? "3D Model" : data?.mediaType}
                                            </Badge>
                                            <Badge className="bg-secondary shadow-sm shadow-foreground">
                                                {data?.code}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Separator className="bg-border" />
                                    {/* Description */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
                                        <div className="h-48 overflow-y-auto bg-secondary rounded-lg p-3">
                                            <p className="text-sm text-foreground/80 leading-relaxed">{data?.description}</p>
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
                                                        {addrShort(data?.issuer, 5)}
                                                    </code>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                                        onClick={() => copyToClipboard(data?.issuer)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Creator ID
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs  bg-primary px-2 py-1 rounded-md">
                                                        {addrShort(data?.creatorId, 5)}
                                                    </code>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                                        onClick={() => copyToClipboard(data?.creatorId)}
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
                                                    {Number(copyCreatorAssetBalance) === 0
                                                        ? "Sold out"
                                                        : Number(copyCreatorAssetBalance) === 1
                                                            ? "1 copy"
                                                            : Number(copyCreatorAssetBalance) !== undefined
                                                                ? `${Number(copyCreatorAssetBalance)} copies`
                                                                : "..."}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="border-t border-border p-2 space-y-2">
                                    <Link href={`/asset/${data.id}`}>
                                        <Button
                                            onClick={handleClose}
                                            variant="outline" className="w-full shadow-sm shadow-background border-2">
                                            <Eye className="mr-2 h-4 w-4" />
                                            View Asset
                                        </Button>
                                    </Link>
                                    <OtherButtons
                                        isShowDisableButton={isMyCollectionPage}
                                        currentData={data}
                                        copies={Number(copyCreatorAssetBalance)}
                                    />

                                    <p className="text-xs text-muted-foreground text-center">
                                        Once purchased, this item will be added to your collection.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    return null;
}
