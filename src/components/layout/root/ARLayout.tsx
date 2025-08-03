"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Home, Search, Heart, User, ShoppingBag, Camera, Zap, Globe, Book, Trophy } from "lucide-react"
import { useRouter } from "next/router"
import { RiUserStarLine } from "react-icons/ri"

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
    const router = useRouter()
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

    const navItems: NavItem[] = [
        { id: 1, icon: Home, href: "/augmented-reality/home", label: "Maps" },

        { id: 2, icon: Book, href: "/augmented-reality/collections", label: "Collection" },
        { id: 3, icon: RiUserStarLine, href: "/augmented-reality/organizations", label: "ORG." },

        { id: 4, icon: Trophy, href: "/augmented-reality/actions", label: "Actions" },

        { id: 5, icon: User, href: "/augmented-reality/profile", label: "Profile" },
    ];

    const activeIndex = navItems.findIndex((item) => item.id === activeItem)

    return (
        <div
            className="flex flex-col bg-background relative overflow-hidden max-w-3xl mx-auto"
            style={{
                height: "calc(var(--vh, 1vh) * 100)",
                minHeight: "-webkit-fill-available",
            }}
        >
            {/* Enhanced background */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 dark:from-blue-900 dark:via-purple-900 dark:to-pink-900" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/30 rounded-full blur-3xl" />
                <div className="absolute bottom-10 right-0 w-40 h-40 bg-purple-400/30 rounded-full blur-3xl" />
                <div className="absolute bottom-5 left-1/2 w-24 h-24 bg-pink-400/30 rounded-full blur-2xl" />
            </div>

            {/* Content area */}
            <div className="flex-1 relative z-10 pb-20 sm:pb-24 overflow-y-auto">{children}</div>

            {/* Clean Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent p-2 sm:p-3 safe-area-inset-bottom">
                <div className="max-w-xl mx-auto">
                    {/* Glass container */}
                    <div
                        className="relative overflow-hidden rounded-2xl sm:rounded-3xl"
                        style={{
                            background: "rgba(255, 255, 255, 0.85)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid rgba(255, 255, 255, 0.3)",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
                        }}
                    >
                        {/* Dark mode overlay */}
                        <div
                            className="absolute inset-0 rounded-2xl sm:rounded-3xl dark:block hidden"
                            style={{
                                background: "rgba(0, 0, 0, 0.75)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                            }}
                        />

                        {/* Glass highlight */}
                        <div
                            className="absolute inset-0 rounded-2xl sm:rounded-3xl"
                            style={{
                                background:
                                    "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)",
                            }}
                        />

                        {/* Navigation content */}
                        <div className="relative z-10">
                            <div className="flex relative">
                                {/* Simple sliding indicator */}
                                <div
                                    className="absolute top-0 bottom-0 transition-all duration-300 ease-out rounded-xl sm:rounded-2xl"
                                    style={{
                                        left: `${(activeIndex * 100) / navItems.length}%`,
                                        width: `${100 / navItems.length}%`,
                                        background: "rgba(59, 130, 246, 0.15)",
                                        border: "1px solid rgba(59, 130, 246, 0.25)",
                                        transform: "scale(0.9)",
                                    }}
                                />

                                {navItems.map((item, index) => {
                                    const Icon = item.icon
                                    const isActive = activeItem === item.id

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveItem(item.id)
                                                router.push(item.href)
                                            }
                                            }
                                            className={`flex-1 flex flex-col items-center justify-center py-2 sm:py-3 px-2 rounded-xl sm:rounded-2xl transition-all duration-200 relative z-10 ${isActive
                                                ? "text-blue-600 dark:text-blue-400"
                                                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                                }`}
                                        >
                                            {/* Icon */}
                                            <div
                                                className={`transition-all duration-200 ${isActive ? "scale-110" : "scale-100 hover:scale-105"}`}
                                            >
                                                <Icon size={22} className="sm:w-6 sm:h-6" />
                                            </div>

                                            {/* Label */}
                                            <span
                                                className={`text-[11px] sm:text-xs font-medium mt-1 transition-all duration-200 ${isActive ? "font-semibold text-blue-600 dark:text-blue-400" : ""
                                                    }`}
                                            >
                                                {item.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </div>
    )
}
