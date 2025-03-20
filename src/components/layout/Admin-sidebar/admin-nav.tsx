/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */


"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "~/lib/utils"
import type { Dispatch, SetStateAction } from "react"
import { useAdminSidebar } from "~/hooks/use-admin-sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import type { NavItem } from "~/types/icon-types"
import { Button } from "~/components/shadcn/ui/button"
import { Icons } from "../Left-sidebar/icons"

interface AdminNavProps {
  items: NavItem[]
  setOpen?: Dispatch<SetStateAction<boolean>>
  isMobileNav?: boolean
  setCursorVariant: (variant: string) => void
}

export function AdminNav({ items, setOpen, setCursorVariant }: AdminNavProps) {
  const path = usePathname()
  const { isMinimized, setIsSheetOpen, isSheetOpen } = useAdminSidebar()

  if (!items.length) {
    return null
  }

  return (
    <nav className="grid w-full gap-3 p-1">
      <TooltipProvider>
        {items.map((item, index) => {
          const Icon = Icons[item.icon as keyof typeof Icons]
          return (
            item.href && (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Link href={item.disabled ? "/" : item.href}>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        className={cn(
                          "flex w-full items-center shadow-sm justify-center gap-2 overflow-hidden rounded-md text-sm font-medium hover:text-[#dbdd2c]",
                          path === item.href
                            ? "border-[#dbdd2c] border-2 text-[#dbdd2c] font-bold"
                            : "transparent shadow-black",
                          item.disabled && "cursor-not-allowed opacity-80",
                        )}
                        onClick={() => {
                          if (setOpen) setOpen(false)
                          if (isSheetOpen) setIsSheetOpen(false)
                        }}
                        onMouseEnter={() => setCursorVariant("hover")}
                        onMouseLeave={() => setCursorVariant("default")}
                      >
                        {isMinimized ? (
                          <Icon />
                        ) : (
                          <div className="flex items-center justify-center gap-4">
                            <span className="mr-2 truncate">{item.title}</span>
                          </div>
                        )}
                      </Button>
                    </motion.div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  align="center"
                  side="right"
                  sideOffset={8}
                  className={isMinimized ? "inline-block" : "hidden"}
                >
                  {item.title}
                </TooltipContent>
              </Tooltip>
            )
          )
        })}
      </TooltipProvider>
    </nav>
  )
}

