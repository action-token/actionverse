"use client"
import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { RefreshCw, Coins } from "lucide-react"
import Image from "next/image"

interface IConvertCard {
  selected: boolean
  handleClick: () => void
  extra?: ReactNode
}

export default function ConvertCard({ handleClick, selected, extra }: IConvertCard) {
  return (
    <motion.div
      onClick={handleClick}
      className={`relative overflow-hidden rounded-xl border ${selected
        ? "border-primary bg-primary/5 shadow-md"
        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
        } transition-all duration-200 cursor-pointer`}
      whileHover={{ scale: selected ? 1 : 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex flex-col h-40 p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-2">
            <Image
              src="/images/action/logo.png"
              alt="Offer"
              width={100}
              height={100}
              className="w-10 h-10"
            />
            <motion.div
              className="flex items-center gap-2"
              animate={{ scale: selected ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >

              <span className="text-2xl font-bold">100</span>
            </motion.div>

            <motion.div animate={{ rotate: selected ? 360 : 0 }} transition={{ duration: 0.5 }}>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </motion.div>

            {extra}
          </div>
        </div>

        <motion.div
          className={`w-full py-2 px-4 rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          animate={{
            backgroundColor: selected ? "var(--primary)" : "var(--muted)",
            color: selected ? "var(--primary-foreground)" : "var(--foreground)",
          }}
        >
          <p className="text-center text-lg font-bold">$100</p>
        </motion.div>
      </div>

      {selected && (
        <motion.div
          className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        />
      )}
    </motion.div>
  )
}
