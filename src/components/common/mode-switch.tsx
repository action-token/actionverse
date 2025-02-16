"use client"

import { motion } from "framer-motion"
import { Sparkles, User } from "lucide-react"
import { useEffect } from "react"

import { Button } from "~/components/shadcn/ui/button"
import { Mode, useModeStore } from "../store/mode-store"
import { useSidebar } from "~/hooks/use-sidebar"

export function ModeSwitch() {
    const { selectedMode, toggleSelectedMode, isTransitioning, startTransition, endTransition } = useModeStore()
    const { isMinimized } = useSidebar()
    useEffect(() => {
        if (isTransitioning) {
            const timer = setTimeout(() => {
                endTransition()
            }, 1000) // Adjust this value to match your animation duration
            return () => clearTimeout(timer)
        }
    }, [isTransitioning, endTransition])

    const handleToggle = () => {
        if (!isTransitioning) {
            startTransition()
            toggleSelectedMode()
        }
    }

    return (
        <div className={`relative  w-full overflow-hidden rounded-full bg-gradient-to-r from-purple-500 to-pink-500 p-1 shadow-lg ${isMinimized ? "h-8" : " h-12"}`}>
            <Button className="absolute left-0 top-0 z-10 h-full w-full bg-transparent hover:bg-transparent" onClick={handleToggle}>
                <span className={`${isMinimized ?
                    'hidden' : 'block'} 

                }`}>Switch to {selectedMode === Mode.User ? "Creator" : "User"}</span>
            </Button>
            <motion.div
                className="absolute left-0 top-0 flex h-full w-1/2 items-center justify-center rounded-full bg-white shadow-md"
                initial={false}
                animate={{
                    x: selectedMode === Mode.User ? "0%" : "100%",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {selectedMode === Mode.User ? (
                    <User className="h-8 w-8 text-purple-500" />
                ) : (
                    <Sparkles className="h-8 w-8 text-pink-500" />
                )}
            </motion.div>
            <motion.div
                className="absolute left-0 top-0 h-full w-full"
                initial={false}
                animate={{
                    scale: isTransitioning ? [1, 1.5, 0] : 1,
                    opacity: isTransitioning ? [1, 0] : 1,
                }}
                transition={{ duration: 1, times: [0, 0.5, 1] }}
            >
                {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute h-2 w-2 rounded-full bg-yellow-300"
                        initial={{ x: "50%", y: "50%" }}
                        animate={{
                            x: isTransitioning ? `${Math.random() * 100}%` : "50%",
                            y: isTransitioning ? `${Math.random() * 100}%` : "50%",
                            scale: isTransitioning ? [0, 1, 0] : 0,
                        }}
                        transition={{ duration: 2, times: [0, 0.5, 1], delay: Math.random() * 0.2 }}
                    />
                ))}
            </motion.div>
        </div >
    )
}

