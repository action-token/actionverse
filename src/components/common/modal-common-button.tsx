import { motion } from "framer-motion";
import { useState } from "react";
import { api } from "~/utils/api";

import { Button } from "~/components/shadcn/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog";

import toast from "react-hot-toast";
import { useMarketRightStore } from "~/lib/state/marketplace/right";

import EnableInMarket from "../modal/Enable-nft-in-market";
import NftBackModal from "../modal/nft-back-modal";
import StorageCreateDialog from "../modal/place-nft-to-storage-modal";
import {
    MyCollectionMenu,
    useMyCollectionTabs,
} from "../store/tabs/mycollection-tabs";
import { Asset } from "@prisma/client";
export type AssetType = Omit<Asset, "issuerPrivate">;

export function DisableFromMarketButton({
    code,
    issuer,
}: {
    code: string;
    issuer: string;
}) {
    const { setData } = useMarketRightStore();
    const disable = api.marketplace.market.disableToMarketDB.useMutation({
        onSuccess() {
            setData(undefined);
        },
    });

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    return (
        <div className="flex w-full flex-col gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="w-full shadow-sm shadow-foreground "
                    >
                        {disable.isLoading && <span className="loading loading-spinner" />}
                        Disable from market
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirmation </DialogTitle>
                    </DialogHeader>
                    <div className="mt-6 w-full space-y-6 sm:mt-8 lg:mt-0 lg:max-w-xs xl:max-w-md">
                        <div className="flow-root">
                            <div className="-my-3 divide-y divide-gray-200 dark:divide-gray-800">
                                <dl className="flex items-center justify-between gap-4 py-3">
                                    <dd className="text-base font-medium text-gray-900 dark:text-white">
                                        Do you want to disable this item from the market?
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className=" w-full">
                        <div className="flex w-full gap-4  ">
                            <DialogClose className="w-full">
                                <Button variant="outline" className="w-full">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                disabled={disable.isLoading}
                                variant="destructive"
                                type="submit"
                                onClick={() => disable.mutate({ code, issuer })}
                                className="w-full"
                            >
                                Confirm
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function SparkleEffect() {
    return (
        <motion.div
            className="absolute inset-0"
            initial="initial"
            animate="animate"
        >
            {[...Array({ length: 20 })].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute h-2 w-2 rounded-full bg-yellow-300"
                    initial={{
                        opacity: 0,
                        scale: 0,
                        x: Math.random() * 400 - 200,
                        y: Math.random() * 400 - 200,
                    }}
                    animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                        x: Math.random() * 400 - 200,
                        y: Math.random() * 400 - 200,
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </motion.div>
    );
}
export function DeleteAssetByAdmin({
    assetId,
    marketId,
    handleClose,
}: {
    marketId?: number;
    assetId?: number;
    handleClose: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const admin = api.wallate.admin.checkAdmin.useQuery();
    const del = api.marketplace.market.deleteMarketAsset.useMutation({
        onSuccess: () => {
            toast.success("Asset deleted successfully");
            handleClose();
            setIsOpen(false);
        },
    });

    if (admin.data)
        return (
            <>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant={"destructive"}
                            className="w-full shadow-sm shadow-foreground "
                        >
                            {del.isLoading && <span className="loading loading-spinner" />}
                            Delete from {assetId ? "Asset" : "Market"} (admin)
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Confirmation </DialogTitle>
                        </DialogHeader>
                        <div>
                            <p>
                                Are you sure you want to delete this item? This action is
                                irreversible.
                            </p>
                        </div>
                        <DialogFooter className=" w-full">
                            <div className="flex w-full gap-4  ">
                                <DialogClose className="w-full">
                                    <Button
                                        variant="outline"
                                        className="w-full shadow-sm shadow-foreground "
                                    >
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="destructive"
                                    type="submit"
                                    onClick={() => del.mutate({ assetId, marketId })}
                                    disabled={del.isLoading}
                                    className="w-full shadow-sm shadow-foreground "
                                >
                                    {del.isLoading && (
                                        <span className="loading loading-spinner" />
                                    )}
                                    Confirm
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
}

export function OtherButtons({
    currentData,
    copies,
    isShowDisableButton,
}: {
    currentData: AssetType;
    copies: number | undefined;
    isShowDisableButton?: boolean;
}) {
    const { selectedMenu, setSelectedMenu } = useMyCollectionTabs();
    if (currentData && copies) {
        if (selectedMenu == MyCollectionMenu.COLLECTION) {
            return <StorageCreateDialog item={{ ...currentData, copies }} />;
        }
        if (selectedMenu == MyCollectionMenu.SECONDARY) {
            return (
                <MarketButtons
                    copy={copies}
                    code={currentData.code}
                    issuer={currentData.issuer}
                    name={currentData.name}
                    isShowDisableButton={isShowDisableButton}
                />
            );
        }
    }
}

export function MarketButtons({
    code,
    issuer,
    copy,
    name,
    isShowDisableButton,
}: {
    code: string;
    issuer: string;
    copy: number;
    name: string;
    isShowDisableButton?: boolean;
}) {
    const inMarket = api.wallate.acc.getAStorageAssetInMarket.useQuery({
        code,
        issuer,
    });
    if (inMarket.isLoading) return <div>Loading...</div>
    if (inMarket.error) return <div>Error...</div>

    if (inMarket.data) {
        return (
            <div>

                {isShowDisableButton && (
                    <>
                        <DisableFromMarketButton code={code} issuer={issuer} />
                    </>
                )}
            </div>
        )
    } else
        return (
            <div>
                <NftBackModal copy={copy} item={{ code, issuer }} />
                <EnableInMarket copy={copy} item={{ code, issuer, name }} />
            </div>
        )
}
