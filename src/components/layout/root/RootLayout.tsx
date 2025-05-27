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
  const isHomeRoute = router.pathname === "/";
  const handleToggle = () => {
    toggle();
  };
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <MiniPlayerProvider>
        <div className={clsx("flex  w-full flex-col", className)}>
          {router.pathname !== "/" && <Header />}
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
      </MiniPlayerProvider>
    </ThemeProvider>
  );
}
