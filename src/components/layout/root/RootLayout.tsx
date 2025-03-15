"use client";
import clsx from "clsx";
import { useSession } from "next-auth/react";

import React, { use } from "react";
import { ChevronLeft } from "lucide-react";

import { ThemeProvider } from "../../providers/theme-provider";
import { ConnectWalletButton } from "package/connect_wallet";

import Header from "../Header";
import Sidebar from "../Left-sidebar/sidebar";
import { cn } from "~/lib/utils";
import { useSidebar } from "~/hooks/use-sidebar";
import ModalProvider from "~/components/providers/modal-provider";
import { Toaster } from "~/components/shadcn/ui/toaster";
import { userRouter } from "~/server/api/routers/fan/user";
import { useRouter } from "next/router";
import { i } from "vitest/dist/reporters-w_64AS5f";
import CreatorLayout from "./CreatorLayout";
import { PostAudioProvider } from "~/components/context/PostAudioContext";
import { PostVideoProvider } from "~/components/context/PostVideoContext";
import { PlayerProvider } from "~/components/context/PlayerContext";
import { BackgroundMusicProvider } from "~/components/context/BackgroundMusicContext";

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
  console.log(router);
  const isArtistRoutes = router.pathname.startsWith("/artist");

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
      <PostAudioProvider>
        <PostVideoProvider>
          <PlayerProvider>
            <BackgroundMusicProvider>
              <div className={clsx("flex h-screen w-full flex-col", className)}>
                <Header />
                <div className="flex w-full scrollbar-hide ">
                  <div className="relative  bg-secondary shadow-sm shadow-primary">
                    <Sidebar />
                    <ChevronLeft
                      className={cn(
                        "fixed left-[17rem] top-24 z-10 hidden cursor-pointer rounded-full border-2 bg-background text-3xl text-foreground shadow-sm shadow-black transition-all duration-500 ease-in-out md:block",
                        isMinimized && "left-[4.5rem] rotate-180",
                      )}
                      onClick={handleToggle}
                    />
                  </div>

                  {session.status === "authenticated" ? (
                    <div className="w-full  overflow-y-auto p-2   scrollbar-hide lg:px-4">
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
                  ) : (
                    <div className="flex h-screen w-full items-center justify-center ">
                      <ConnectWalletButton />
                    </div>
                  )}
                </div>
              </div>
            </BackgroundMusicProvider>
          </PlayerProvider>
        </PostVideoProvider>
      </PostAudioProvider>
    </ThemeProvider>
  );
}
