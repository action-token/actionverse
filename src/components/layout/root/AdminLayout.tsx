"use client"

import React, { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "~/lib/utils"
import { NavItem } from "~/types/icon-types"
import { ArrowRight, ChevronsLeft, ChevronsRight, PanelRight } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button"
// import ParticleBackground from "../components/particle-background"
import { useAdminSidebar } from "~/hooks/use-admin-sidebar"
import { AdminNav } from "../Admin-sidebar/admin-nav"
import CustomCursor from "~/components/common/custom-cursor"
import { ToggleButton } from "~/components/common/toggle-button-admin"
import { api } from "~/utils/api"
import { useRouter } from "next/navigation"
import Loading from "~/components/common/loading"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
export const LeftNavigation: NavItem[] = [
    { href: "/admin/wallet", icon: "wallet", title: "WALLET" },
    { href: "/admin/admins", icon: "admin", title: "ADMIN" },
    { href: "/admin/pins", icon: "pins", title: "PINS" },
    { href: "/admin/creator-report", icon: "report", title: "COLLECTION REPORTS" },
    { href: "/admin/creators", icon: "creator", title: "CREATORS" },
    { href: "/admin/users", icon: "users", title: "USERS" },
    { href: "/admin/bounty", icon: "bounty", title: "BOUNTY" },
]

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [cursorVariant, setCursorVariant] = useState("default")
    const router = useRouter()
    const { isMinimized, toggle } = useAdminSidebar()
    const admin = api.wallate.admin.checkAdmin.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });



    return (
        <div className="flex relative gap-4 h-[calc(100vh-11.8vh)] overflow-hidden">
            <motion.div
                className="flex-grow overflow-y-auto scrollbar-hide"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {
                    admin.isLoading ? (
                        <Loading />
                    ) :
                        admin.data?.id ? (
                            <div className="flex flex-col w-full h-screen">
                                {children}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-full h-full">
                                <h1 className="text-3xl font-bold">You are not authorized to view this page</h1>
                            </div>
                        )
                }
            </motion.div>
            <AnimatePresence>
                <motion.div
                    className={cn(
                        "fixed z-40 right-[13.3rem] top-1/2 hidden rotate-180 rounded-sm  md:block",
                        isMinimized && "-rotate-180 right-[5.5rem]"
                    )}
                    transition={{ delay: 0.5, duration: 0.3 }}
                >
                    <ToggleButton
                        isActive={!isMinimized}
                        onToggle={toggle}
                        onMouseEnter={() => setCursorVariant("hover")}
                        onMouseLeave={() => setCursorVariant("default")}
                    />
                </motion.div>
            </AnimatePresence>
            <div className="hidden md:block bg-background border-[1px] rounded-sm">
                <motion.div
                    className={cn(
                        "h-[calc(100vh-10.8vh)]  sticky top-[5.8rem] p-1 w-full overflow-hidden border-r hidden md:block",
                        !isMinimized ? "w-[210px]" : "w-[78px]"
                    )}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    style={{ perspective: "1000px" }}
                >
                    <motion.div
                        className="flex h-full w-full flex-col items-center justify-start py-2 no-scrollbar"
                        animate={{ rotateY: isMinimized ? 30 : 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 10 }}
                    >
                        <div className="flex w-full h-screen overflow-x-hidden flex-col">
                            <AdminNav items={LeftNavigation} setCursorVariant={setCursorVariant} />
                        </div>
                    </motion.div>
                </motion.div>
            </div>
            <div className="fixed bottom-0 right-0 z-50 p-4 md:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="destructive" className="shadow-sm shadow-foreground">
                            <ChevronsLeft />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <motion.div
                            className="flex h-full w-full flex-col items-center justify-start py-2 no-scrollbar"
                            initial={{ rotateX: -10, skewY: -5, opacity: 0 }}
                            animate={{ rotateX: 0, skewY: 0, opacity: 1 }}
                            exit={{ rotateX: -10, skewY: -5, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 10 }}
                        >
                            <AdminNav items={LeftNavigation} setCursorVariant={setCursorVariant} />
                        </motion.div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

