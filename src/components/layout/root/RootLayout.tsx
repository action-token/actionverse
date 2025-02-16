"use client";
import clsx from "clsx";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React from "react";
import { ChevronLeft } from "lucide-react";

import { ThemeProvider } from "../../providers/theme-provider";
import { ConnectWalletButton } from "package/connect_wallet";
import { ScrollArea } from "~/components/shadcn/ui/scroll-area";

import Header from "../Header";
import Sidebar, { LeftNavigation } from "../Left-sidebar/sidebar";
import { cn } from "~/lib/utils";
import { useSidebar } from "~/hooks/use-sidebar";
import ModalProvider from "~/components/providers/modal-provider";
import { Toaster } from "~/components/shadcn/ui/toaster";

export default function Layout({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const session = useSession();
    const { isMinimized, toggle } = useSidebar();

    const handleToggle = () => {
        toggle();
    };
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange


        >
            <div className={clsx("flex flex-col w-full h-screen", className)}>
                <Header />
                <div className="flex w-full scrollbar-hide ">
                    <div className="relative  z-50">
                        <Sidebar />
                        <ChevronLeft
                            className={cn(
                                "fixed z-10 left-[17rem] top-24 hidden cursor-pointer rounded-full border-2 bg-background text-3xl text-foreground shadow-sm shadow-black md:block transition-all duration-500 ease-in-out",
                                isMinimized && "rotate-180 left-[4.5rem]",
                            )}
                            onClick={handleToggle}
                        />

                    </div>

                    {session.status === "authenticated" ? (
                        <div className="w-full  overflow-y-auto p-2  lg:px-4 scrollbar-hide">
                            {children}
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
        </ThemeProvider>
    );
}
