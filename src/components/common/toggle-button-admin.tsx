"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { motion, useAnimation } from "framer-motion"
import { ChevronsLeft, ChevronsRight } from "lucide-react"

interface ToggleButtonProps {
    isActive: boolean
    onToggle: () => void
    onMouseEnter: () => void
    onMouseLeave: () => void
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({ isActive, onToggle, onMouseEnter, onMouseLeave }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [isMounted, setIsMounted] = useState(false)

    const handleClick = () => {
        onToggle()
        if (audioRef.current) {
            audioRef.current.currentTime = 0
            audioRef.current.play()
        }
    }

    useEffect(() => {
        audioRef.current = new Audio("/toggle.mp3")
        setIsMounted(true)
    }, [])

    return (
        <motion.button
            className="relative w-10 h-10 bg-primary shadow-sm shadow-foreground rounded-full overflow-hidden flex items-center justify-center"
            onClick={handleClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isActive ? "Collapse sidebar" : "Expand sidebar"}
        >
            <motion.div initial={false}>
                {isActive ? <ChevronsLeft className="w-6 h-6" /> : <ChevronsRight className="w-6 h-6" />}
            </motion.div>
        </motion.button>
    )
}

