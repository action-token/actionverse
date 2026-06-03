"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Users } from "lucide-react"
import UserNotification from "~/components/notification/user-notification"
import CreatorNotifications from "~/components/notification/creator-notification"

const Notification = () => {
    const [activeView, setActiveView] = useState<"user" | "creator">("user")

    return (
        <div className="h-[calc(100vh-11vh)] overflow-hidden">
            <div className="mx-auto max-w-6xl px-4 py-10">



                {/* Layout: Sidebar + Content */}
                <div className="flex gap-6 items-start">

                    {/* Sidebar */}
                    <motion.aside
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="sticky top-6 w-52 shrink-0 flex flex-col gap-2"
                    >
                        {(["user", "creator"] as const).map((view) => {
                            const isActive = activeView === view
                            const Icon = view === "user" ? Bell : Users
                            const label = view === "user" ? "User" : "Creator"
                            const sub = view === "user" ? "Your activity" : "Fan interactions"

                            return (
                                <button
                                    key={view}
                                    onClick={() => setActiveView(view)}
                                    className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200
                                        ${isActive
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeBar"
                                            className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-indigo-400"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}

                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors
                                        ${isActive ? "bg-white/15" : "bg-muted-foreground/10 group-hover:bg-muted-foreground/20"}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold leading-none">{label}</span>
                                        <span className={`mt-1 text-xs leading-none ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                            {sub}
                                        </span>
                                    </div>
                                </button>
                            )
                        })}

                        <div className="mt-4 border-t border-border pt-4 px-1">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Notifications refresh every 30 seconds automatically.
                            </p>
                        </div>
                    </motion.aside>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeView}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.22, ease: "easeInOut" }}
                            >
                                {activeView === "user" ? <UserNotification /> : <CreatorNotifications />}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Notification