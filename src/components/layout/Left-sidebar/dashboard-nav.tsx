/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Dispatch, SetStateAction } from "react"

import { cn } from "~/lib/utils"
import { useSidebar } from "~/hooks/use-sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { Icons } from "./icons"
import type { NavItem } from "~/types/icon-types"
import { Button } from "~/components/shadcn/ui/button"

interface DashboardNavProps {
  items: NavItem[]
  setOpen?: Dispatch<SetStateAction<boolean>>
  isMobileNav?: boolean
}

export function DashboardNav({ items, setOpen }: DashboardNavProps) {
  const pathname = usePathname()
  const { isMinimized, setIsSheetOpen, isSheetOpen } = useSidebar()

  // Ensure path is never null
  const path = pathname || "/"

  if (!items.length) {
    return null
  }

  // Helper function to check if a path is active based on your specific requirements
  const isPathActive = (itemHref: string): boolean => {
    // Special case for root path - also match /bounty/* paths
    if (itemHref === "/") {
      return path === "/" || path.startsWith("/bounty/")
    }

    // Special case for organization route
    if (itemHref === "/organization/home") {
      return path.startsWith("/organization")
    }

    // For other paths, check if current path starts with the item href
    if (path === itemHref) {
      return true
    }

    // Check if it's a sub-route (except for /bounty/* which is handled above)
    if (!path.startsWith("/bounty/")) {
      const itemParts = itemHref.split("/").filter(Boolean)
      const pathParts = path.split("/").filter(Boolean)

      // If itemHref has more parts than the current path, it can't be a match
      if (itemParts.length > pathParts.length) {
        return false
      }

      // Check if all parts of itemHref match the beginning of the path
      for (let i = 0; i < itemParts.length; i++) {
        if (itemParts[i] !== pathParts[i]) {
          return false
        }
      }

      return true
    }

    return false
  }

  return (
    <nav className="grid w-full gap-3 p-1">
      <TooltipProvider>
        {items.map((item, index) => {
          const Icon = Icons[item.icon as keyof typeof Icons]
          const isActive = item.href ? isPathActive(item.href) : false

          return (
            item.href && (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Link href={item.disabled ? "/" : item.href} key={item.href}>
                    <Button
                      className={cn(
                        "flex w-full items-center shadow-sm justify-start gap-2 overflow-hidden rounded-md text-sm font-medium",
                        isActive
                          ? "text-destructive border-2 border-destructive bg-background hover:bg-background font-bold"
                          : "transparent shadow-black",
                        item.disabled && "cursor-not-allowed opacity-80",
                      )}
                      onClick={() => {
                        if (setOpen) setOpen(false)
                        if (isSheetOpen) setIsSheetOpen(false)
                      }}
                    >
                      {isMinimized ? (
                        <Icon />
                      ) : (
                        <div className="flex items-center justify-center gap-4">
                          <Icon />
                          <span className="mr-2 truncate">{item.title}</span>
                        </div>
                      )}
                    </Button>
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
