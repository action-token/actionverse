"use client"
import { useState } from "react"
import { motion } from "framer-motion"

import { ChevronLeft, LogOut, Sun, Moon, ChevronRight } from "lucide-react"

import { useSidebar } from "~/hooks/use-sidebar"

import { DashboardNav } from "./dashboard-nav"
import { ConnectWalletButton } from "package/connect_wallet"

import { useTheme } from "next-themes"
import Link from "next/link"
import { HomeIcon } from "lucide-react"
import Image from "next/image"
import { cn } from "~/utils/utils"
import { Button } from "~/components/shadcn/ui/button"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { FaFacebook, FaInstagram, FaLinkedinIn } from "react-icons/fa"
import { NavItem } from "~/types/icon-types"

interface SidebarProps {
  className?: string
}

export const LeftNavigation: NavItem[] = [
  { href: "/", icon: "dashboard", title: "HOMEPAGE" },
  { href: "/my-collection", icon: "collection", title: "MY COLLECTION" },
  { href: "/marketplace", icon: "store", title: "MARKETPLACE" },
  { href: "/bounty", icon: "bounty", title: "ACTION" },
  { href: "/reward-checker", icon: "setting", title: "REWARD CHEKCER" },
  { href: "/organization/home", icon: "creator", title: "ORGANIZATIONS" },
  { href: "/beam", icon: "scan", title: "Beam" },
  { href: "/settings", icon: "setting", title: "SETTINGS" },

]

export const BeamNavigation: NavItem[] = [
  { href: "/", icon: "back", title: "BACK" },
  { href: "/beam", icon: "home", title: "HOME" },
  { href: "/beam/create", icon: "create", title: "CREATE" },
  { href: "/beam/gallery", icon: "gallery", title: "GALLERY" },
]

export const BottomNavigation = {
  Home: { path: "/maps/pins", icon: HomeIcon, text: "CLAIM" },
} as const

// Mini Calendar component that only shows current and next week
const MiniCalendar = () => {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)

  // Get the current week's start (Sunday) and calculate days
  const getWeekDays = (date: Date) => {
    const day = date.getDay() // 0 is Sunday, 6 is Saturday
    const diff = date.getDate() - day
    const weekStart = new Date(date)
    weekStart.setDate(diff)

    const days = []
    for (let i = 0; i < 7; i++) {
      const newDate = new Date(weekStart)
      newDate.setDate(weekStart.getDate() + i)
      days.push(newDate)
    }
    return days
  }

  const currentWeek = getWeekDays(currentDate)
  const nextWeek = currentWeek.map((day) => {
    const newDate = new Date(day)
    newDate.setDate(day.getDate() + 7)
    return newDate
  })

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString()
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  // Navigate weeks
  const goToPreviousWeek = () => {
    const prevDate = new Date(currentDate)
    prevDate.setDate(currentDate.getDate() - 7)
    setCurrentDate(prevDate)
  }

  const goToNextWeek = () => {
    const nextDate = new Date(currentDate)
    nextDate.setDate(currentDate.getDate() + 7)
    setCurrentDate(nextDate)
  }

  return (
    <div className="w-full rounded-lg p-2 border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button onClick={goToPreviousWeek} className="p-1 hover:bg-muted rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium">
          {currentWeek[0] && `${monthNames[currentWeek[0].getMonth()]} ${currentWeek[0].getFullYear()}`}
        </span>
        <button onClick={goToNextWeek} className="p-1 hover:bg-muted rounded-full">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((day, i) => (
          <div key={`header-${i}`} className="text-center text-xs text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Current week */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {currentWeek.map((date, i) => (
          <button
            key={`current-${i}`}
            onClick={() => setSelectedDate(date)}
            className={cn(
              "h-6 w-6 rounded-full text-xs flex items-center justify-center",
              isToday(date) ? "bg-primary text-primary-foreground font-bold" : "",
              isSelected(date) && !isToday(date) ? "bg-accent text-accent-foreground" : "",
              !isToday(date) && !isSelected(date) ? "hover:bg-muted" : "",
            )}
          >
            {date.getDate()}
          </button>
        ))}
      </div>

      {/* Next week */}
      <div className="grid grid-cols-7 gap-1">
        {nextWeek.map((date, i) => (
          <button
            key={`next-${i}`}
            onClick={() => setSelectedDate(date)}
            className={cn(
              "h-6 w-6 rounded-full text-xs flex items-center justify-center",
              isToday(date) ? "bg-primary text-primary-foreground font-bold" : "",
              isSelected(date) && !isToday(date) ? "bg-accent text-accent-foreground" : "",
              !isToday(date) && !isSelected(date) ? "hover:bg-muted" : "",
            )}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ className }: SidebarProps) {
  const { isMinimized, toggle } = useSidebar()
  const session = useSession()
  const router = useRouter()
  const isHome = router.pathname === "/"

  const isBeamRoute = router.pathname.startsWith("/beam")

  const navigationItems = isBeamRoute ? BeamNavigation : LeftNavigation

  return (
    <div
      className={cn(
        `sticky p-1 w-full  overflow-hidden border-r hidden md:block transition-all duration-500 ease-in-out`,
        !isMinimized ? "w-[280px]" : "w-[78px]",
        isHome ? "top-0 h-[100vh]" : "top-[5.8rem] h-[calc(100vh-10.8vh)]",
        className,
      )}
    >
      <div className=" flex  h-full   w-full  flex-col items-center justify-between   gap-1   no-scrollbar  ">
        <div className="flex w-full flex-col items-center justify-between p-1">
          {isHome && (
            <div className="flex flex-col items-center transition-all duration-500 ease-in-out">
              <div className="relative hidden h-24 w-24 md:block transition-all duration-500 ease-in-out">
                <Image
                  alt="logo"
                  src="/images/action/logo.png"
                  height={200}
                  width={200}
                  className="h-full w-full transition-transform duration-500 ease-in-out"
                />
              </div>
            </div>
          )}
          <div className="flex w-full  overflow-x-hidden flex-col justify-between h-full">
            <DashboardNav items={navigationItems} />


          </div>
        </div>

        <div
          className={cn(
            "flex w-full flex-col items-center transition-all duration-500 ease-in-out",
            isMinimized ? "opacity-0 max-h-0 overflow-hidden" : "opacity-100 max-h-[1000px]",
          )}
        >
          <LeftBottom />
        </div>
        {isMinimized && session.status == "authenticated" && (
          <div
            className={cn(
              "transition-all duration-500 ease-in-out",
              isMinimized ? "opacity-100 max-h-20" : "opacity-0 max-h-0 overflow-hidden",
            )}
          >
            <LogOutButon />
          </div>
        )}
      </div>
    </div>
  )
}

function LogOutButon() {
  async function disconnectWallet() {
    await signOut({
      redirect: false,
    })
  }
  return (
    <Button className="flex flex-col p-3 shadow-sm shadow-black" onClick={disconnectWallet}>
      <span>
        {" "}
        <LogOut />
      </span>
      <span className="text-xs">Logout</span>
    </Button>
  )
}

export function LeftBottom() {
  const { setTheme, theme } = useTheme()
  const tougleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <div className="flex w-full flex-col justify-center gap-4 p-1">
      <MiniCalendar />
      <div className="flex  items-center justify-center">
        <button
          onClick={() => tougleTheme()}
          className="relative h-10 w-20  rounded-full transition-shadow duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-purple-400"
          style={{
            boxShadow:
              theme === "dark"
                ? "inset 0 0 15px rgba(255, 255, 255, 0.2), 0 0 20px rgba(138, 43, 226, 0.4)"
                : "inset 0 0 15px rgba(0, 0, 0, 0.1), 0 0 20px rgba(59, 130, 246, 0.4)",
          }}
        >
          <motion.div
            className="absolute top-1 left-1 right-1 bottom-1 rounded-full bg-gradient-to-br"
            animate={{
              background:
                theme === "dark"
                  ? "linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)"
                  : "linear-gradient(135deg, #60a5fa 0%, #e0f2fe 100%)",
            }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            className="absolute   h-8 w-8 top-1 rounded-full "
            animate={{
              x: theme === "dark" ? 45 : 4,
              background: theme === "dark" ? "#f1c40f" : "#ffffff",
            }}
            transition={{
              type: "spring",
              stiffness: 700,
              damping: 30,
            }}
          />
          <div className="relative flex h-full items-center justify-between px-3">
            <Sun className="h-4 w-4 text-yellow-400" />
            <Moon className="h-4 w-4 text-white" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              boxShadow:
                theme === "dark"
                  ? "inset 4px 4px 8px rgba(0, 0, 0, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.1)"
                  : "inset 4px 4px 8px rgba(0, 0, 0, 0.1), inset -4px -4px 8px rgba(255, 255, 255, 0.5)",
            }}
            transition={{ duration: 0.5 }}
          />
        </button>
      </div>
      <div className="w-full flex items-center justify-center ">
        <ConnectWalletButton />
      </div>

      <div className="flex  items-center justify-between  gap-4 ">
        <Link
          href={"https://www.facebook.com/actiontokens/"}
          className="btn flex h-12 shadow-sm shadow-black  flex-col  justify-center  rounded-lg items-center  text-xs normal-case w-full"
          target="_blank"
        >
          <FaFacebook size={26} />
        </Link>
        <Link
          href={"https://www.linkedin.com/company/action-tokens"}
          className="btn flex h-12 shadow-sm shadow-black  flex-col  justify-center  rounded-lg items-center  text-xs normal-case w-full"
          target="_blank"
        >
          <FaLinkedinIn size={26} />
        </Link>
        <Link
          href={"https://www.instagram.com/actiontokens/"}
          className="btn flex h-12 shadow-sm shadow-black flex-col justify-center  rounded-lg items-center  text-xs normal-case w-full"
          target="_blank"
        >
          <FaInstagram size={26} />
        </Link>
      </div>
      <div className="flex w-full flex-col text-center text-xs text-base-content">
        <p>© 2025 Action Token</p>
        <div className="flex w-full justify-center gap-2 ">
          <Link className="link-hover link" href="/about">
            About
          </Link>
          <Link className="link-hover link" href="/privacy">
            Privacy
          </Link>
          <Link className="link-hover link" href="/support">
            Support
          </Link>
        </div>
        <p>v{1.2}</p>
      </div>
    </div>
  )
}
