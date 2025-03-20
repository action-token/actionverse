import { useSession } from "next-auth/react";
import Image from "next/image";
import { api } from "~/utils/api";

import { X } from 'lucide-react';
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
import { addrShort } from "~/utils/utils";

import clsx from "clsx";
import { useRouter } from "next/router";
import { Card, CardContent, CardFooter } from "~/components/shadcn/ui/card";
import {
    AssetMenu,
    useAssetMenu,
} from "~/lib/state/marketplace/asset-tab-menu";
import { SongItemType, useModal } from "~/lib/state/play/use-modal-store";
import { DeleteAssetByAdmin, DisableFromMarketButton, OtherButtons, SparkleEffect } from "../common/modal-common-button";
import ShowThreeDModel from "../3d-model/model-show";
import { useAssestInfoModalStore } from "../store/asset-info-modal-store";

export const PaymentMethodEnum = z.enum(["asset", "xlm", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export default function AssetInfoModal() {
    const { data, isOpen, setIsOpen } = useAssestInfoModalStore()
    const session = useSession();
    const router = useRouter();
    const { selectedMenu, setSelectedMenu } = useAssetMenu();
    const { getAssetBalance: creatorAssetBalance } = useUserStellarAcc();
    const { getAssetBalance: creatorStorageAssetBalance, setBalance } =
        useCreatorStorageAcc();


    const handleClose = () => {
        setIsOpen(false);
    };

    const acc = api.wallate.acc.getCreatorStorageBallances.useQuery(undefined, {
        onSuccess: (data) => {
            setBalance(data);
        },
        onError: (error) => {
            console.log(error);
        },
        refetchOnWindowFocus: false,
        enabled: !!data

    })

    const copyCreatorAssetBalance = data
        ? selectedMenu === AssetMenu.OWN
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
        return (
            <>
                <Dialog open={isOpen} onOpenChange={handleClose}>
                    <DialogContent className="max-w-3xl  overflow-hidden p-0 [&>button]:rounded-full [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black ">
                        <DialogClose className="absolute right-3 top-3 ">
                            <X color="white" size={24} />
                        </DialogClose>
                        <div className="grid grid-cols-1 md:grid-cols-7">
                            {/* Left Column - Product Image */}
                            <Card className=" overflow-y-hidden  max-h-[770px] min-h-[770px]  scrollbar-hide   md:col-span-3">
                                <CardContent className="p-1 bg-primary rounded-sm flex flex-col justify-between h-full">
                                    {/* Image Container */}
                                    <div className="flex flex-col">
                                        <div className="relative h-[300px] w-full">
                                            <SparkleEffect />
                                            <Image
                                                src={data.thumbnail}
                                                alt={data.name}
                                                width={1000}
                                                height={1000}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>

                                        {/* Content */}
                                        <div className="space-y-3 p-4 border-2 rounded-md">
                                            <h2 className="text-lg font-bold  truncate">
                                                NAME: {data.name}
                                            </h2>

                                            <p className="max-h-[100px] border-b-2  min-h-[100px] overflow-y-auto text-sm text-gray-500 scrollbar-hide">
                                                DESCRIPTION: {data.description}
                                            </p>

                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <span className="h-auto p-0 text-xs text-[#00a8fc]">
                                                    ISSUER ID: {addrShort(data.issuer, 5)}
                                                </span>
                                                <Badge variant="secondary" className=" rounded-lg">
                                                    {data.code}
                                                </Badge>
                                            </div>

                                            <p className="font-semibold ">
                                                <span className="">Available:</span>{" "}
                                                {Number(copyCreatorAssetBalance) === 0
                                                    ? "Sold out"
                                                    : Number(copyCreatorAssetBalance) === 1
                                                        ? "1 copy"
                                                        : Number(copyCreatorAssetBalance) !== undefined
                                                            ? `${Number(copyCreatorAssetBalance)} copies`
                                                            : "..."}
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <span className="h-auto p-0 text-xs text-[#00a8fc]">
                                                    Media Type:
                                                </span>
                                                <Badge variant="destructive" className=" rounded-lg">
                                                    {data.mediaType}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full">
                                        <OtherButtons
                                            currentData={data}
                                            copies={Number(copyCreatorAssetBalance)}
                                        />
                                        {session.status === "authenticated" &&
                                            data?.creatorId === session.data.user.id && (
                                                <>
                                                    <DisableFromMarketButton
                                                        code={data.code}
                                                        issuer={data.issuer}
                                                    />
                                                </>
                                            )}
                                        {data.mediaType === "MUSIC" ? (
                                            <Button

                                                className="w-full shadow-sm shadow-foreground"
                                                variant="accent"
                                            >
                                                Play
                                            </Button>
                                        ) : (
                                            data.mediaType === "VIDEO" && (
                                                <Button

                                                    className="w-full"
                                                    variant="accent"
                                                >
                                                    Play
                                                </Button>
                                            )
                                        )}
                                        <DeleteAssetByAdmin assetId={data.id}
                                            handleClose={handleClose}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-1 p-2">

                                </CardFooter>
                            </Card>

                            {/* Right Column - Bundle Info */}
                            <div className=" rounded-sm bg-gray-300 p-1   md:col-span-4">
                                {data.mediaType === "IMAGE" ? (
                                    <Image
                                        src={data.mediaUrl}
                                        alt={data.name}
                                        width={1000}
                                        height={1000}
                                        className={clsx(
                                            "h-full max-h-[800px] w-full overflow-y-auto object-cover ",
                                        )}
                                    />
                                ) : data.mediaType === "VIDEO" ? (
                                    <>
                                        <div
                                            style={{
                                                backgroundImage: `url(${data.thumbnail})`,
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                                backgroundRepeat: "no-repeat",
                                                height: "100%",
                                                width: "100%",
                                            }}
                                            className={clsx(
                                                "h-full max-h-[800px] w-full overflow-y-auto object-cover",
                                            )}
                                        >
                                            {/* <RightSidePlayer /> */}
                                        </div>
                                    </>
                                ) : data.mediaType === "MUSIC" ? (
                                    <>
                                        <div
                                            style={{
                                                backgroundImage: `url(${data.thumbnail})`,
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                                backgroundRepeat: "no-repeat",
                                                height: "100%",
                                                width: "100%",
                                            }}
                                            className={clsx(
                                                "h-full max-h-[800px] w-full overflow-y-auto object-cover",
                                            )}
                                        >
                                            {/* <RightSidePlayer /> */}
                                        </div>
                                    </>
                                ) : (
                                    data.mediaType === "THREE_D" && (
                                        <ShowThreeDModel url={data.mediaUrl} />
                                    )
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    return null;
}

