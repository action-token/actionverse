"use client"

import React, { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "~/lib/utils"
import { NavItem } from "~/types/icon-types"
import { ArrowRight, ChevronDown, ChevronsLeft, ChevronsRight, ChevronUp, PanelRight } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button"
// import ParticleBackground from "../components/particle-background"
import { useAdminSidebar } from "~/hooks/use-admin-sidebar"
import { AdminNav } from "../Admin-sidebar/admin-nav"
import CustomCursor from "~/components/common/custom-cursor"
import { ToggleButton } from "~/components/common/toggle-button-admin"
import { api } from "~/utils/api"
import { usePathname, useRouter } from "next/navigation"
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
import { Icons } from "../Left-sidebar/icons"
import Link from "next/link"

type DockerItem = {
    disabled?: boolean;
    icon: React.ReactNode
    label: string
    color: string
    href: string
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [cursorVariant, setCursorVariant] = useState("default")
    const router = useRouter()
    const { isMinimized, toggle } = useAdminSidebar()
    const admin = api.wallate.admin.checkAdmin.useQuery(undefined, {
        refetchOnWindowFocus: true,
    });
    const path = usePathname();
    const [isExpanded, setIsExpanded] = useState(false)
    const LeftNavigation: DockerItem[] = [
        { href: "/admin/wallet", icon: "wallet", label: "WALLET", color: "bg-blue-500" },
        { href: "/admin/admins", icon: "admin", label: "ADMIN", color: "bg-purple-500" },
        { href: "/admin/pins", icon: "pins", label: "PINS", color: "bg-pink-500" },
        { href: "/admin/reward-checker", icon: "reward", label: "REWARD CHECKER", color: "bg-primary" },
        { href: "/admin/creator-report", icon: "report", label: "COLLECTION REPORTS", color: "bg-amber-500" },
        { href: "/admin/creators", icon: "creator", label: "CREATORS", color: "bg-emerald-500" },
        { href: "/admin/users", icon: "users", label: "USERS", color: "bg-blue-500" },
        { href: "/admin/bounty", icon: "bounty", label: "BOUNTY", color: "bg-purple-500" },
        { href: "/admin/map", icon: "map", label: "MAP", color: "bg-pink-500" },

    ]


    const toggleExpand = () => {
        setIsExpanded(!isExpanded)
    }


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
            <div className={`fixed bottom-8  z-50 -translate-x-1/2 transition-all duration-500 ease-in-out ${isExpanded ? "right-32 " : "right-4 "}`}>
                <div className="relative">
                    {/* Expanded Items */}
                    <AnimatePresence>
                        {isExpanded && (
                            <div className="absolute bottom-10 -left-4  -translate-x-1/2 ">
                                {LeftNavigation.map((item, index) => {

                                    const Icon = Icons[item.icon as keyof typeof Icons];

                                    return (
                                        <Link
                                            key={index}
                                            href={item.disabled ? "/admin/wallet" : item.href}
                                        >
                                            <motion.div

                                                initial={{
                                                    y: 0,
                                                    x: 0,
                                                    scale: 0.5,
                                                    opacity: 0,
                                                }}
                                                animate={{
                                                    y: -60 * (index + 1),
                                                    x: - Math.sin((index + 1) * 0.4) * 25, // Create a small natural curve
                                                    scale: 1,
                                                    opacity: 1,
                                                }}
                                                exit={{
                                                    y: 0,
                                                    x: Math.sin((index + 1) * 0.5) * 5, // Maintain curve during exit
                                                    scale: 0.5,
                                                    opacity: 0,
                                                    transition: {
                                                        duration: 0.2,
                                                        delay: (LeftNavigation.length - index) * 0.05,
                                                    },
                                                }}
                                                transition={{
                                                    duration: 0.3,
                                                    delay: index * 0.05,
                                                    type: "spring",
                                                    stiffness: 260,
                                                    damping: 20,
                                                }}
                                                className="absolute left-1/2 -translate-x-1/2 "
                                            >
                                                <Button
                                                    size="icon"
                                                    className={cn(
                                                        "h-12 w-12 hover:bg-foreground hover:text-primary  shadow-lg transition-transform hover:scale-109",
                                                        item.color,
                                                        "text-white", path === item.href ? "bg-foreground " : ""

                                                    )}
                                                    onClick={() => console.log(`Clicked ${item.label}`)}
                                                >

                                                    <Icon />
                                                    <span className="sr-only">{item.label}</span>
                                                </Button>
                                                <motion.span
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    transition={{ delay: index * 0.05 + 0.2 }}
                                                    className={cn("absolute left-full ml-3 top-2 hover:bg-foreground hover:text-primary -translate-y-1/2 whitespace-nowrap rounded-md bg-background px-2 py-1 text-sm font-medium shadow-sm", path === item.href ? "bg-foreground text-primary" : "")}
                                                >
                                                    {item.label}
                                                </motion.span>
                                            </motion.div>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </AnimatePresence>

                    <motion.div

                        transition={{ duration: 0.2 }}
                        className={`relative z-10  flex  items-center justify-center    rounded-sm   ${isExpanded ? "" : "animate-bounce"}`}
                    >
                        <Button
                            size="icon"
                            onClick={toggleExpand}
                            className="h-10 w-10  border-[#dbdd2c] border-2  font-bold rounded-sm"
                        >
                            {isExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronUp className="h-6 w-6 " />}
                            <span className="sr-only">{isExpanded ? "Close menu" : "Open menu"}</span>
                        </Button>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

