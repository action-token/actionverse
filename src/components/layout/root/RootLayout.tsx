"use client";
import clsx from "clsx";
import { useSession } from "next-auth/react";

import { ChevronLeft } from "lucide-react";
import React from "react";

import { ConnectWalletButton } from "package/connect_wallet";
import { ThemeProvider } from "../../providers/theme-provider";

import { useRouter } from "next/router";
import LoginRequiredModal from "~/components/modal/login-required-modal";
import { MiniPlayerProvider } from "~/components/player/mini-player-provider";
import ModalProvider from "~/components/providers/modal-provider";
import { Toaster } from "~/components/shadcn/ui/toaster";
import { useSidebar } from "~/hooks/use-sidebar";
import { cn } from "~/lib/utils";
import Header from "../Header";
import Sidebar from "../Left-sidebar/sidebar";
import CreatorLayout from "./CreatorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import ARLayout from "./ARLayout";
import ARModalProvider from "~/components/providers/augmented-reality/augmented-modal-provider";
import { BottomPlayerProvider } from "~/components/player/context/bottom-player-context";
import { StemPlayer } from "~/components/player/bottom-player";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import { api } from "~/utils/api";
import FallingSnowflakes from "~/components/christmas/FallingSnowflakes";
export default function Layout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const session = useSession();
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
  ];
  const isPublicRoute = publicRoutes.includes(router.pathname);
  const isAugmentedRealityRoute = router.pathname.startsWith("/action/ar");

  const isHomeRoute = router.pathname === "/";
  const handleToggle = () => {
    toggle();
  };

  if (router.pathname.includes("/albedo")) {
    return <div>{children}</div>;
  }
  if (router.pathname.includes("/action/")) {
    // if (router.pathname.includes("/action/enter")) {
    //   return <>{children}</>;
    // }
    return (
      <>
        {session?.status === "authenticated" || router.pathname.includes("/action/qr") ? (
          <div className="h-screen w-full overflow-hidden fixed inset-0">
            {
              isAugmentedRealityRoute ? (

                <>
                  <ARModalProvider />
                  {children}
                </>
              ) : (
                <ARLayout>
                  <ARModalProvider />
                  {children}
                </ARLayout>
              )
            }

          </div>
        ) : (
          <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-[350px] mx-4">
              <CardHeader className="text-center">
                <CardTitle className="text-lg sm:text-xl">Welcome to Actionverse AR</CardTitle>
                <CardDescription className="text-sm sm:text-base">Please login/signup to continue</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ConnectWalletButton />
              </CardContent>
            </Card>
          </div>
        )}
      </>
    )
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
                  <>{children}</>
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
          <FallingSnowflakes />
        </BottomPlayerProvider>
      </MiniPlayerProvider>
    </ThemeProvider>
  );
}