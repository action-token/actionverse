"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import type React from "react"
import { ChevronLeft } from "lucide-react"
import { useSidebar } from "~/hooks/use-sidebar"
import { cn } from "~/lib/utils"
import { Button } from "~/components/shadcn/ui/button"
import { Mode, useModeStore } from "~/components/store/mode-store"
import { ModeSwitch } from "~/components/common/mode-switch"
import { NavItem } from "~/types/icon-types"
import { DashboardNav } from "../Left-sidebar/dashboard-nav"

export default function CreatorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-[calc(100vh-11.8vh)] overflow-hidden">
            <div className="flex-grow overflow-y-auto scrollbar-hide">
                <div className="p-2 lg:px-4">{children}</div>
            </div>
            <div className="hidden lg:block bg-muted rounded-lg">
                <RightSidebar />
            </div>
        </div>
    )
}

export const LeftNavigation: NavItem[] = [
    { href: "/", icon: "dashboard", title: "HOMEPAGE" },

    { href: "/my-collection", icon: "collection", title: "MY COLLECTION" },
    // Search: { path: "/search", icon: Search, text: "Search" },
    { href: "/music", icon: "music", title: "MUSIC" },
    { href: "/marketplace", icon: "store", title: "MARKETPLACE" },
    { href: "/bounty", icon: "bounty", title: "BOUNTY" },
    { href: "/artist/home", icon: "creator", title: "ARTISTS" },
    { href: "/settings", icon: "setting", title: "SETTINGS" },
];


const RightSidebar = () => {
    const { isMinimized, toggle } = useSidebar();
    const { selectedMode, toggleSelectedMode, isTransitioning, startTransition, endTransition } = useModeStore()

    return (
        <div
            className={cn(
                ` h-[calc(100vh-10.8vh)] sticky top-[5.8rem] p-1 w-full overflow-hidden border-r  hidden transition-[width] duration-500 md:block`,
                !isMinimized ? "w-[280px]" : "w-[78px]"

            )}
        >

            <div className=" flex  h-full   w-full  flex-col items-center justify-start   py-2   no-scrollbar  ">
                <div className="flex  w-full h-screen overflow-x-hidden   flex-col  ">
                    <ModeSwitch />
                    {
                        selectedMode === Mode.Creator && <DashboardNav items={LeftNavigation} />
                    }


                </div>

            </div>
        </div>
    )
}

