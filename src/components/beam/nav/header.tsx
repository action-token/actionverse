"use client"

import { Button } from "~/components/shadcn/ui/button"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { LogOut, Menu, Bell, Search, Moon, User, Settings } from "lucide-react"
import { cn } from "~/lib/utils"
import { Input } from "~/components/shadcn/ui/input"
import { Badge } from "~/components/shadcn/ui/badge"

interface HeaderProps {
  sidebarCollapsed: boolean
  onMobileMenuToggle: () => void
}

export function Header({ sidebarCollapsed, onMobileMenuToggle }: HeaderProps) {

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-xl px-4 transition-all duration-300",
        sidebarCollapsed ? "left-0 lg:left-20" : "left-0 lg:left-72",
      )}
    >
      {/* Left side - Mobile menu + Search */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuToggle}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden md:flex items-center gap-2 relative">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search beams..."
            className="w-64 pl-9 bg-background/50 border-border/50 focus:bg-background transition-all"
          />
        </div>
      </div>

      {/* Right side - Actions + User */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">3</Badge>
        </Button>

        {/* Theme toggle placeholder */}
        <Button variant="ghost" size="icon">
          <Moon className="h-5 w-5" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 gap-2 rounded-full pl-2 pr-4 hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarImage src="/diverse-avatars.png" />
                <AvatarFallback className="bg-foreground text-background text-xs">JD</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">John Doe</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 animate-scale-in">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">John Doe</p>
                <p className="text-xs leading-none text-muted-foreground">john@example.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
