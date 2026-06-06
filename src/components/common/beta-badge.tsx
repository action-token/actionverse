"use client"

import { motion } from "framer-motion"

interface BetaBadgeProps {
  className?: string
}

export function BetaBadge({ className }: BetaBadgeProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Outer pulsing glow rings */}
      <motion.span
        className="absolute inset-0 rounded bg-[hsl(var(--greditnet))]"
        initial={{ opacity: 0.4, scale: 1 }}
        animate={{
          opacity: [0.4, 0, 0.4],
          scale: [1, 1.6, 1],
        }}
        transition={{
          duration: 2.5,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />
      <motion.span
        className="absolute inset-0 rounded bg-[hsl(var(--greditnet))]"
        initial={{ opacity: 0.3, scale: 1 }}
        animate={{
          opacity: [0.3, 0, 0.3],
          scale: [1, 1.4, 1],
        }}
        transition={{
          duration: 2.5,
          ease: "easeInOut",
          repeat: Infinity,
          delay: 0.4,
        }}
      />

      {/* Badge body */}
      <span
        className="relative z-10 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
        style={{ backgroundColor: "hsl(var(--greditnet))" }}
      >
        BETA
      </span>
    </div>
  )
}
