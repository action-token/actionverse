"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"

const CustomCursor: React.FC<{ variant: string }> = ({ variant }) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

    useEffect(() => {
        const mouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY,
            })
        }

        window.addEventListener("mousemove", mouseMove)

        return () => {
            window.removeEventListener("mousemove", mouseMove)
        }
    }, [])

    const variants = {
        default: {
            x: mousePosition.x - 16,
            y: mousePosition.y - 16,
            backgroundColor: "rgba(255, 255, 255, 0.3)",
        },
        hover: {
            x: mousePosition.x - 16,
            y: mousePosition.y - 16,
            backgroundColor: "rgba(219, 221, 44, 0.8)",
            scale: 1.5,
        },
    }

    return (
        <motion.div
            className="fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-50"
            animate={variant}
            variants={variants}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
        />
    )
}

export default CustomCursor

