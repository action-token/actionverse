"use client";
import clsx from "clsx";
import { useSession } from "next-auth/react";

import { ChevronLeft } from "lucide-react";
import React from "react";

import { ConnectWalletButton } from "package/connect_wallet";
import { ThemeProvider } from "../../providers/theme-provider";

import { useRouter } from "next/router";
import FallingSnowflakes from "~/components/christmas/FallingSnowflakes";
import LoginRequiredModal from "~/components/modal/login-required-modal";
import { StemPlayer } from "~/components/player/bottom-player";
import { BottomPlayerProvider } from "~/components/player/context/bottom-player-context";
import { MiniPlayerProvider } from "~/components/player/mini-player-provider";
import ARModalProvider from "~/components/providers/augmented-reality/augmented-modal-provider";
import ModalProvider from "~/components/providers/modal-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import { Toaster } from "~/components/shadcn/ui/toaster";
import { useSidebar } from "~/hooks/use-sidebar";
import { cn } from "~/lib/utils";
import Header from "../Header";
import Sidebar from "../Left-sidebar/sidebar";
import ARLayout from "./ARLayout";
import CreatorLayout from "./CreatorLayout";
import { Toaster as Sonner } from "~/components/shadcn/ui/sonner"
import { api } from "~/utils/api";
import { useCreatorStorageAcc, useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";

export default function Layout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const session = useSession();
  const { setBalance, setActive } = useUserStellarAcc();
  const { setBalance: setCreatorBalance, } = useCreatorStorageAcc();


  const { isMinimized, toggle } = useSidebar();

  const router = useRouter();
  // console.log("router.pathname", router.pathname);

  const isArtistRoutes = router.pathname.startsWith("/organization");
  const publicRoutes = [
    "/about",
    "/privacy",
    "/support",
    "/",
    "/reward-checker",
    "/beam",
    "/beam/[id]",
    "/marketplace",
    "/bounty",
    "/community",
    "/organization",
  ];
  const isPublicRoute = publicRoutes.some(
    (route) => router.pathname === route || router.pathname.startsWith(route + "/"),
  );
  const isAugmentedRealityRoute = router.pathname.startsWith("/action/ar");

  const isHomeRoute = router.pathname === "/";
  const handleToggle = () => {
    toggle();
  };
  api.wallate.acc.getAccountBalance.useQuery(undefined, {
    onSuccess: (data) => {
      const { balances } = data;
      setBalance(balances);
      setActive(true);
    },
    onError: (error) => {
      setActive(false);
    },
    refetchOnWindowFocus: false,
    enabled: session.data?.user?.id !== undefined,
  });

  api.wallate.acc.getCreatorStorageBallances.useQuery(undefined, {
    onSuccess: (data) => {
      console.log("Storage Balance", data);
      setCreatorBalance(data);
    },
    onError: (error) => {
      console.log(error);
    },
    refetchOnWindowFocus: false,
    enabled: session.data?.user?.id !== undefined,
  });

  if (router.pathname.includes("/albedo")) {
    return <div>{children}</div>;
  }
  if (router.pathname.includes("/action/")) {
    // if (router.pathname.includes("/action/enter")) {
    //   return <>{children}</>;
    // }
    return (
      <>
        {session?.status === "authenticated" ? (
          <div className="fixed inset-0 h-screen w-full overflow-hidden">
            {isAugmentedRealityRoute ? (
              <>
                <ARModalProvider />
                {children}
              </>
            ) : (
              <ARLayout>
                <ARModalProvider />
                {children}
              </ARLayout>
            )}
          </div>
        ) : (
          <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
            <Card className="mx-4 w-full max-w-[350px]">
              <CardHeader className="text-center">
                <CardTitle className="text-lg sm:text-xl">
                  Welcome to Action-tokens AR
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Please login/signup to continue
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ConnectWalletButton />
              </CardContent>
            </Card>
          </div>
        )}
      </>
    );
  }
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >

      <MiniPlayerProvider>
        <BottomPlayerProvider>

          <div className={clsx("flex  w-full flex-col", className)}>
            {!(router.pathname === "/" || router.pathname.includes("/beam/ar")) && <Header />}
            <div className="flex w-full scrollbar-hide ">
              <div className="relative  bg-secondary shadow-sm shadow-primary">
                <Sidebar />
                <ChevronLeft
                  className={cn(
                    "fixed left-[17rem] top-24 z-50 hidden cursor-pointer rounded-full border-2 bg-background text-3xl text-foreground shadow-sm shadow-black transition-all duration-500 ease-in-out md:block",
                    isMinimized && "left-[4.5rem] rotate-180",
                    isHomeRoute ? "top-0" : "top-24",
                  )}
                  onClick={handleToggle}
                />
              </div>

              {session.status === "authenticated" ? (
                <div className="w-full  overflow-y-auto    scrollbar-hide ">
                  {isArtistRoutes ? (
                    <>
                      <CreatorLayout>{children}</CreatorLayout>
                    </>
                  ) : (
                    <>{children}</>
                  )}
                  <ModalProvider />
                  <Toaster />
                </div>
              ) : isPublicRoute ? (
                <div className="w-full   overflow-y-auto    scrollbar-hide ">
                  {isArtistRoutes ? (
                    <CreatorLayout>{children}</CreatorLayout>
                  ) : (
                    <>{children}</>
                  )}
                  <LoginRequiredModal />
                </div>
              ) : (
                <div className="flex h-screen w-full items-center justify-center ">
                  <ConnectWalletButton />
                </div>
              )}
            </div>
          </div>
          <StemPlayer />
          <Sonner richColors closeButton />
          {/* <FallingSnowflakes /> */}
        </BottomPlayerProvider>
      </MiniPlayerProvider>
    </ThemeProvider>
  );
}