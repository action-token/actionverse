"use client"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/shadcn/ui/popover"

import { Home, ImageIcon, Video, Music, Text, ShoppingBag, Plus, GalleryHorizontal } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

export default function Sidebar() {
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)

  const router = useRouter()
  const path = usePathname()
  const navItems = [
    { icon: Home, label: "Home", active: false, href: "/beam" },
    { icon: Plus, label: "Create", active: false, href: "/beam/create", }, // Add mediaType
    { icon: GalleryHorizontal, label: "Gallery", active: false, href: "/beam/gallery" }, // Add mediaType

  ]

  return (
    <aside className="hidden md:absolute left-3 top-2 bottom-2   w-[72px] border-2  md:flex flex-col items-center  gap-2 rounded-lg z-10  bg-primary/20 p-1 ">
      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full rounded-lg ">
        {navItems.map((item, index) => (
          <button
            key={index}
            className={`relative w-full rounded-lg  flex flex-col items-center gap-1 py-3 transition-colors ${item.href === path
              ? "text-sidebar-foreground  bg-primary rounded-lg shadow-sm shadow-foreground"
              : "text-muted-foreground hover:text-sidebar-foreground hover:bg-primary"
              }`}
            onClick={() => router.push(item.href)}

          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>


    </aside>
  )
}
