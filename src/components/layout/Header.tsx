import Image from "next/image";
import React, { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

import { Bell, Menu, Plus, ShoppingBag, ShoppingCart } from "lucide-react";
import { useSession } from "next-auth/react";
import Lottie from "lottie-react"

import Link from "next/link";
import { useRouter } from "next/router";
import { WalletType } from "package/connect_wallet/src/lib/enums";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "~/components/shadcn/ui/sheet";
import { Button } from "~/components/shadcn/ui/button";
import { Mode, useMode } from "~/lib/state/fan/left-side-mode";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { api } from "~/utils/api";
import { useSidebar } from "~/hooks/use-sidebar";
import { DashboardNav } from "./Left-sidebar/dashboard-nav";
import { BeamNavigation, LeftBottom, LeftNavigation } from "./Left-sidebar/sidebar";
import { isRechargeAbleClient } from "~/utils/recharge/is-rechargeable-client";
import dynamic from "next/dynamic";

const ChristmasSleighAnimation = dynamic(() => import('../christmas/ChristmasSleigh'), {
    ssr: false,
});
const ChristmasWindChimeAnimation = dynamic(() => import('../christmas/ChristmasWindChimes'), {
    ssr: false,
});

function Header() {
    const router = useRouter()
    const { isSheetOpen, setIsSheetOpen } = useSidebar();
    const isBeamRoute = router.pathname.startsWith("/beam")

    const navigationItems = isBeamRoute ? BeamNavigation : LeftNavigation

    return (
        <header className="sticky w-full top-0 z-50 h-22  bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="relative h-22 px-2 py-4 ">
                <Image
                    src="/images/header.png"
                    alt="Header background"
                    fill
                    className="object-cover object-top"
                    priority
                />
                {/* <ChristmasWindChimeAnimation /> */}
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-0">
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="link"
                                    className="md:hidden p-2"
                                >
                                    <Menu color="white" />
                                </Button>
                            </SheetTrigger>

                            <SheetContent side="left" className="w-72 p-0 h-full">
                                <SheetHeader className="flex items-start justify-between bg-primary p-2 rounded-md shadow-md">

                                    <div className="flex items-center gap-0  ">
                                        <Image
                                            alt="logo"
                                            objectFit="cover"
                                            src="/images/logo.png"
                                            height={200}
                                            width={200}
                                            className=" h-10 w-20"
                                        />
                                        <h1 className="relative text-xl font-bold capitalize text-black md:text-4xl ">
                                            <p className="">ACTIONVERSE</p>
                                            <p className="absolute  right-0 top-0 -mr-4 -mt-1  text-xs">TM</p>
                                        </h1>

                                    </div>
                                </SheetHeader>
                                <div className="flex h-full w-full flex-col items-center justify-between p-2 no-scrollbar overflow-y-auto">
                                    <div className="flex h-full   w-full overflow-x-hidden flex-col py-2">
                                        <DashboardNav items={navigationItems} />
                                    </div>
                                    <div className="flex h-full w-full flex-col items-center">
                                        <LeftBottom />
                                    </div>
                                </div>



                            </SheetContent>

                        </Sheet>
                        <div className="relative ml-2 hidden h-14 w-24 md:block">
                            <Image

                                alt="logo"
                                src="/images/logo.png"

                                height={200}
                                width={200}
                                className=" h-14 w-24"
                            />
                        </div>
                        <h1 className="hidden md:block relative text-xl font-bold capitalize text-white  md:text-4xl">
                            ACTIONVERSE
                            {/* <ChristmasSleighAnimation /> */}
                            <p className="absolute right-0 top-0 -mr-4 -mt-1 text-xs">TM</p>
                        </h1>
                    </div>
                    <HeaderButtons />
                </div>
            </div>
            {/* <div className="absolute top-[4rem] left-0 right-0 w-full z-50 flex overflow-hidden  pointer-events-none">
                <div className="flex  h-12 pointer-events-none">
                    {Array.from({ length: 20 }, (_, index) => (
                        <Image
                            key={index}
                            src="/tn-christmas-lights.webp"
                            alt=""
                            width={1000}
                            height={1000}
                            className="object-cover w-full h-full"
                            priority={index === 0}
                        />
                    ))}
                </div>

            </div> */}

        </header>
    );
}

export default Header;


const HeaderButtons = () => {
    const { setBalance, setActive } = useUserStellarAcc();
    const session = useSession();
    const router = useRouter();
    const bal = api.wallate.acc.getAccountBalance.useQuery(undefined, {
        onSuccess: (data) => {
            const { balances } = data;
            setBalance(balances);
            setActive(true);
        },
        onError: (error) => {
            setActive(false);
        },
        enabled: session.data?.user?.id !== undefined,
    });
    const updateMutation = api.fan.notification.updateNotification.useMutation();

    const updateNotification = () => {
        updateMutation.mutate();
    };

    const { data: notificationCount } =
        api.fan.notification.getUnseenNotificationCount.useQuery(
            undefined,
            {
                enabled: session.data?.user?.id !== undefined
            }
        );

    const walletType = session.data?.user.walletType ?? WalletType.none;

    const isFBorGoogle = isRechargeAbleClient(walletType);

    if (walletType == WalletType.none) return null;

    if (bal.isLoading) return <div className="skeleton h-10 w-48"></div>;

    if (notificationCount === undefined)
        return <div className="skeleton h-10 w-48"></div>;

    return (
        <div className=" flex items-center justify-center gap-1 ">
            <Link href="/wallet-balance" className="">
                <Button className="" variant='destructive'>

                    <span className="block md:hidden">

                        {bal.data?.platformAssetBal.toFixed(0)}
                    </span>
                    <span className="hidden md:block">
                        {bal.data?.platformAssetBal.toFixed(0)}  {PLATFORM_ASSET.code.toUpperCase()}
                    </span>
                </Button>
            </Link>
            {isFBorGoogle && (
                <Link className=" " href={"/recharge"}>
                    <Button className="" variant='destructive'>
                        <ShoppingCart />
                    </Button>
                </Link>
            )}
            <Button
                className=" relative "
                variant="destructive"
                onClick={async () => {
                    await router.push("/notification");
                    updateNotification();
                }}
            >
                {notificationCount > 0 && (
                    <div className="absolute -top-2 left-0 h-4 w-4  rounded-full bg-primary"></div>
                )}
                <Bell />
            </Button>
        </div>
    );
};
