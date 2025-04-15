import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import { api } from "~/utils/api";

import { ArrowLeft, X } from "lucide-react";
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
import { useRouter } from "next/router";
import { Card, CardContent, CardFooter } from "~/components/shadcn/ui/card";
import { useModal } from "~/lib/state/play/use-modal-store";
import { DeleteAssetByAdmin, DisableFromMarketButton, SparkleEffect } from "../common/modal-common-button";
import PaymentProcessItem from "../payment/payment-process";
import { useMusicBuyModalStore } from "../store/music-buy-store";

export const PaymentMethodEnum = z.enum(["asset", "xlm", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export default function MusicBuyModal() {
    const [step, setStep] = useState(1);

    const { data, isOpen, setIsOpen } = useMusicBuyModalStore();
    const session = useSession();
    const router = useRouter();
    const isCollectionRoute = router.pathname.startsWith("/assets");

    const handleClose = () => {
        setStep(1);
        setIsOpen(false);
    };

    const copy = api.marketplace.market.getSongAvailableCopy.useQuery(
        {
            songId: data?.id,
        },
        {
            enabled: !!data?.id,
        },
    );

    const handleNext = () => {
        setStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setStep((prev) => prev - 1);
    };

    const { data: canBuyUser } =
        api.marketplace.market.userCanBuySongMarketAsset.useQuery(
            data?.id ?? -1,
            {
                enabled: !!data?.id,
            },
        );

    if (!data || !data.asset)
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl overflow-hidden p-1   ">
                    <DialogClose className="absolute right-3 top-3 ">
                        <X color="white" size={24} />
                    </DialogClose>
                    <div className="grid grid-cols-1">
                        {/* Left Column - Product Image */}
                        <Card className="  bg-[#1e1f22] ">
                            <CardContent className="flex max-h-[600px] min-h-[600px] items-center justify-center">
                                <div role="status">
                                    <svg
                                        aria-hidden="true"
                                        className="h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
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
                <DialogContent className="max-w-3xl     overflow-hidden p-0 [&>button]:rounded-full [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black">
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-7 ">
                            {/* Left Column - Product Image */}
                            <Card className="  overflow-y-hidden max-h-[770px] min-h-[770px] scrollbar-hide   md:col-span-3 ">
                                <CardContent className="p-0 bg-primary rounded-sm flex flex-col justify-between h-full">
                                    {/* Image Container */}
                                    <div className="flex flex-col h-full">
                                        <div className="relative h-[300px] w-full">
                                            <SparkleEffect />
                                            <Image
                                                src={data.asset.thumbnail}
                                                alt={data.asset.name}
                                                width={1000}
                                                height={1000}
                                                className="h-full w-full object-cover shadow-md rounded-md hidden md:block"
                                            />


                                            {/* Content */}
                                            <div className="space-y-1 p-4 border-2 rounded-md">
                                                <h2 className="text-lg font-bold  truncate">
                                                    {data.asset.name}
                                                </h2>

                                                <p className="max-h-[100px] border-b-2  min-h-[100px] overflow-y-auto text-sm text-gray-500 scrollbar-hide">
                                                    {data.asset.description && data.asset.description.length > 0 ? data.asset.description : "No description"}
                                                </p>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-bold ">
                                                        {data.price} {PLATFORM_ASSET.code}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="border-none bg-white text-[#3ba55c]"
                                                    >
                                                        $ {data.priceUSD}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <span className="h-auto p-0 text-xs text-[#00a8fc]">
                                                        {addrShort(data.asset.issuer, 5)}
                                                    </span>
                                                    <Badge variant="destructive" className=" rounded-lg">
                                                        #{data.asset.code}
                                                    </Badge>
                                                </div>
                                                <p className="font-semibold ">
                                                    <span className="">Available:</span>{" "}
                                                    {copy.data === 0
                                                        ? "Sold out"
                                                        : copy.data === 1
                                                            ? "1 copy"
                                                            : copy.data !== undefined
                                                                ? `${copy.data} copies`
                                                                : "..."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full p-1">
                                        {session.status === "authenticated" &&
                                            data.asset.creatorId === session.data.user.id &&
                                            isCollectionRoute ? (
                                            <>
                                                <DisableFromMarketButton
                                                    code={data.asset.code}
                                                    issuer={data.asset.issuer}
                                                />
                                            </>
                                        ) : (
                                            canBuyUser?.canBuy &&
                                            copy.data &&
                                            copy.data > 0 && (
                                                <Button
                                                    onClick={handleNext}
                                                    className="w-full shadow-sm shadow-black border-2"

                                                >
                                                    Buy
                                                </Button>
                                            )
                                        )}

                                        <DeleteAssetByAdmin
                                            assetId={data.assetId}
                                            handleClose={handleClose}
                                        />

                                        <p className="text-xs text-gray-400">
                                            Once purchased, this item will be placed on collection.
                                        </p>
                                    </div>

                                </CardContent>

                            </Card>

                            {/* Right Column - Bundle Info */}
                            <div className=" hidden rounded-sm bg-gray-300   p-1  md:col-span-4 md:grid ">
                                {data.asset.mediaType === "IMAGE" ? (
                                    <Image
                                        src={data.asset.mediaUrl}
                                        alt={data.asset.name}
                                        width={1000}
                                        height={1000}
                                        className={clsx(
                                            "h-full w-full object-cover ",
                                            data.asset.tierId ? " blur-md" : "",
                                        )}
                                    />
                                ) : data.asset.mediaType === "VIDEO" ? (
                                    <Image
                                        src={data.asset.thumbnail}
                                        alt={data.asset.name}
                                        width={1000}
                                        height={1000}
                                        className={clsx(
                                            "h-full w-full object-cover ",
                                            data.asset.tierId ? " blur-md" : "",
                                        )}
                                    />
                                ) : (
                                    data.asset.mediaType === "MUSIC" && (
                                        <Image
                                            src={data.asset.thumbnail}
                                            alt={data.asset.name}
                                            width={1000}
                                            height={1000}
                                            className={clsx(
                                                "h-full w-full object-cover ",
                                                data.asset.tierId ? " blur-md" : "",
                                            )}
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <Card>
                            <CardContent className="p-0">
                                <PaymentProcessItem
                                    marketItemId={canBuyUser?.marketAssetId}
                                    priceUSD={data.priceUSD}
                                    item={data.asset}
                                    price={data.price}
                                    placerId={data.creatorId}
                                    setClose={handleClose}
                                />
                            </CardContent>
                            <CardFooter className="p-2">
                                {step === 2 && (
                                    <Button onClick={handleBack} variant="destructive" className="shadow-sm shadow-black">
                                        Back
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )}
                    {/* <DialogFooter>
                            {step > 1 && (
                                <Button onClick={handleBack} variant="outline">
                                    Back
                                </Button>
                            )}
                            {step < 2 ? (
                                <Button onClick={handleNext}>Next</Button>
                            ) : (
                                <Button onClick={handleSubmit}>Submit</Button>
                            )}
                        </DialogFooter> */}
                </DialogContent>
            </Dialog>
        </>
    );
}
