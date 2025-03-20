"use client"

import { motion } from "framer-motion"
import { Paintbrush, User } from "lucide-react"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"

import { Mode, useModeStore } from "../store/mode-store"

export function ModeSwitch() {
    const { selectedMode, toggleSelectedMode } = useModeStore()
    const [isHovering, setIsHovering] = useState(false)

    const isCreator = selectedMode === Mode.Creator
    const router = useRouter()
    return (
        <TooltipProvider>
            <div className="inline-flex flex-col rounded-md p-1 shadow-sm shadow-black bg-gray-100/50 backdrop-blur-sm">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => {
                                if (isCreator) {
                                    toggleSelectedMode()
                                    router.push("/artist/home")
                                }
                            }}
                            className={cn(
                                "relative rounded-md transition-colors mb-1",
                                "flex flex-col items-center justify-center gap-1 p-2",
                                "w-10 h-10 md:w-12 md:h-12", // Smaller on mobile, regular on md+
                                isCreator ? "text-gray-600 " : "text-white animate-bounce",
                            )}
                            disabled={!isCreator}
                        >
                            {!isCreator && (
                                <motion.div
                                    layoutId="activeBackgroundIcon"
                                    className="absolute inset-0 bg-blue-500 rounded-md"
                                    transition={{
                                        type: "spring",
                                        bounce: 0.15,
                                        duration: 0.5,
                                    }}
                                />
                            )}
                            <User className="relative w-4 h-4" />
                            <span className="relative text-[10px] font-medium hidden md:inline">User</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium" sideOffset={8}>
                        {!isCreator ? "User Mode" : "Switch to User Mode"}
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => {
                                if (!isCreator) {
                                    toggleSelectedMode()
                                    router.push("/artist/profile")
                                }
                            }}
                            className={cn(
                                "relative rounded-md transition-colors",
                                "flex flex-col items-center justify-center gap-1 p-2",
                                "w-10 h-10 md:w-12 md:h-12", // Smaller on mobile, regular on md+
                                isCreator ? "text-white animate-bounce" : "text-gray-600",
                            )}
                            disabled={isCreator}
                        >
                            {isCreator && (
                                <motion.div
                                    layoutId="activeBackgroundIcon"
                                    className="absolute inset-0 bg-purple-500 rounded-md"
                                    transition={{
                                        type: "spring",
                                        bounce: 0.15,
                                        duration: 0.5,
                                    }}
                                />
                            )}
                            <Paintbrush className="relative w-4 h-4" />
                            <span className="relative text-[10px] font-medium hidden md:inline">Creator</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium" sideOffset={8}>
                        {isCreator ? "Creator Mode" : "Switch to Creator Mode"}
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}

import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "~/lib/utils"
import { useRouter } from "next/navigation"

const VisuallyHidden = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(({ className, ...props }, ref) => {
    return (
        <span
            ref={ref}
            className={cn(
                "absolute h-px w-px p-0 overflow-hidden whitespace-nowrap border-0",
                "clip-[rect(0px,0px,0px,0px)]",
                className,
            )}
            {...props}
        />
    )
})
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden }
