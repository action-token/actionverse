"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Home, FolderOpen, Globe, User, Target, Gift, RotateCcw } from 'lucide-react'
import { useRouter } from "next/router"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "~/lib/utils"
import Image from "next/image"

interface NavItem {
    id: number
    icon: React.ElementType
    label: string
    href: string
}

export default function ARLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [activeItem, setActiveItem] = useState(1)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const router = useRouter()
    const tabBarHeight = 100
    const curveHeight = 50
    const width = 375 // Assuming a fixed width for the SVG, can be dynamic based on screen size
    // Fix for mobile viewport height issues
    useEffect(() => {
        const setVH = () => {
            const vh = window.innerHeight * 0.01
            document.documentElement.style.setProperty("--vh", `${vh}px`)
            setViewportHeight(window.innerHeight)
        }

        setVH()
        window.addEventListener("resize", setVH)
        window.addEventListener("orientationchange", setVH)

        return () => {
            window.removeEventListener("resize", setVH)
            window.removeEventListener("orientationchange", setVH)
        }
    }, [])

    // Update active item based on current route
    useEffect(() => {
        const currentPath = router.pathname
        const matchingItem = navItems.find(item => {
            const basePath = item.href.split('?')[0] ?? '';
            return currentPath.startsWith(basePath);
        })
        if (matchingItem) {
            setActiveItem(matchingItem.id)
        }
    }, [router.pathname])

    const navItems: NavItem[] = [
        {
            id: 1,
            icon: Home,
            href: "/augmented-reality/home",
            label: "MAP"
        },
        {
            id: 2,
            icon: FolderOpen,
            href: "/augmented-reality/collections",
            label: "COLLECTION"
        },
        {
            id: 3,
            icon: Globe,
            href: "/augmented-reality/organizations",
            label: "HUBS"
        },
        {
            id: 4,
            icon: User,
            href: "/augmented-reality/profile",
            label: "PROFILE"
        },
    ]

    const handleNavigation = async (item: NavItem) => {
        if (item.id === activeItem) return

        setIsTransitioning(true)
        setActiveItem(item.id)

        setTimeout(() => {
            router.push(item.href)
            setIsTransitioning(false)
        }, 150)
    }

    return (
        <div
            className="flex flex-col  relative overflow-y-auto max-w-md mx-auto"
            style={{
                height: "calc(var(--vh, 1vh) * 100)",
                minHeight: "-webkit-fill-available",
            }}
        >





            {/* Content area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={router.pathname}
                    className="flex-1 relative z-10 pb-20 overflow-y-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {isTransitioning && (
                        <motion.div
                            className="absolute inset-0  backdrop-blur-sm z-50 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="w-8 h-8 border-2 border-slate-300 border-t-red-500 rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                        </motion.div>
                    )}
                    {children}
                </motion.div>
            </AnimatePresence>

            {/* Curved Bottom Navigation */}
            <motion.div
                className="fixed bottom-0 left-0 right-0 z-50"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <div className="max-w-md mx-auto relative">
                    {/* Main Navigation Background with Curve */}
                    <svg
                        viewBox="0 0 375 100"
                        className="w-full h-20 absolute bottom-0"
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="navGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.98)" />
                                <stop offset="100%" stopColor="rgba(248, 250, 252, 0.95)" />
                            </linearGradient>
                        </defs>
                        <path
                            d={`M0,0 
             L${width / 2 - 100},0 
             C${width / 2 - 40},0 ${width / 2 - 30},${curveHeight} ${width / 2},${curveHeight} 
             C${width / 2 + 30},${curveHeight} ${width / 2 + 40},0 ${width / 2 + 100},0 
             L${width},0 
             L${width},${tabBarHeight} 
             L0,${tabBarHeight} 
             Z`}
                            fill="url(#navGradient)"
                            stroke="#ff4757"
                            strokeOpacity={0.5}
                            strokeWidth="1"
                        />
                    </svg>

                    {/* Navigation Items */}
                    <div className="relative z-10 flex items-end justify-between px-8 pb-4 pt-4">
                        {/* Left Side Items */}
                        <div className="flex items-end space-x-12">
                            {navItems.slice(0, 2).map((item, index) => {
                                const Icon = item.icon
                                const isActive = activeItem === item.id

                                return (
                                    <motion.button
                                        key={item.id}
                                        onClick={() => handleNavigation(item)}
                                        className="flex flex-col items-center space-y-1"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.1 }}
                                    >
                                        <div className="relative">
                                            <Icon
                                                size={24}
                                                className={cn(
                                                    "transition-colors duration-200",
                                                    isActive ? "text-red-500" : "text-slate-400"
                                                )}
                                            />
                                            {isActive && (
                                                <motion.div
                                                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ duration: 0.2 }}
                                                />
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium transition-colors duration-200",
                                            isActive ? "text-red-500" : "text-slate-400"
                                        )}>
                                            {item.label}
                                        </span>
                                    </motion.button>
                                )
                            })}
                        </div>

                        {/* Center Elevated Button */}
                        <motion.div
                            onClick={() => handleNavigation({
                                id: 5,
                                icon: Target,
                                label: "AR",
                                href: "/augmented-reality/actions"
                            })}

                            className="absolute right-[42%] transform -translate-x-1/2 -top-10"
                            initial={{ opacity: 0, scale: 0, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{
                                duration: 0.5,
                                delay: 0.3,
                                type: "spring",
                                stiffness: 200
                            }}
                        >
                            <motion.button
                                className="w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-slate-100"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(148, 163, 184, 0.2)"
                                }}
                            >
                                <Image

                                    src="/images/action/logo.png"
                                    alt="AR Icon"
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 object-contain"
                                />
                            </motion.button>
                        </motion.div>

                        {/* Right Side Items */}
                        <div className="flex items-end space-x-12">
                            {navItems.slice(2, 4).map((item, index) => {
                                const Icon = item.icon
                                const isActive = activeItem === item.id

                                return (
                                    <motion.button
                                        key={item.id}
                                        onClick={() => handleNavigation(item)}
                                        className="flex flex-col items-center space-y-1"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: (index + 2) * 0.1 }}
                                    >
                                        <div className="relative">
                                            <Icon
                                                size={24}
                                                className={cn(
                                                    "transition-colors duration-200",
                                                    isActive ? "text-red-500" : "text-slate-400"
                                                )}
                                            />
                                            {isActive && (
                                                <motion.div
                                                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ duration: 0.2 }}
                                                />
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium transition-colors duration-200",
                                            isActive ? "text-red-500" : "text-slate-400"
                                        )}>
                                            {item.label}
                                        </span>
                                    </motion.button>
                                )
                            })}
                        </div>
                    </div>


                </div>
            </motion.div>
        </div>
    )
}
