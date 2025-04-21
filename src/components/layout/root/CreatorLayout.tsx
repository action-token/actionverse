"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "~/lib/utils"
import type { NavItem } from "~/types/icon-types"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { ToggleButton } from "~/components/common/toggle-button-admin"
import { api } from "~/utils/api"
import { usePathname, useRouter } from "next/navigation"
import { useCreatorSidebar } from "~/hooks/use-creator-sidebar"
import { Mode, useModeStore } from "~/components/store/mode-store"

import { ModeSwitch } from "~/components/common/mode-switch"
import Link from "next/link"
import { Icons } from "../Left-sidebar/icons"
import { useToast } from "~/components/shadcn/ui/use-toast"
import TrendingSidebar from "~/components/post/trending-sidebar"
import CreatorSidebar from "~/components/post/followed-creator"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import JoinArtistPage from "~/components/creator/join-artist"
import JoinArtistPageLoading from "~/components/loading/join-artist-loading"
import PendingArtistPage from "~/components/creator/pending-artist"
import { BannedCreatorCard } from "~/components/creator/ban-artist"

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const router = useRouter()
  const toast = useToast()
  const [cursorVariant, setCursorVariant] = useState("default")

  const path = usePathname()
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const { isMinimized, toggle } = useCreatorSidebar()
  const { selectedMode, toggleSelectedMode, isTransitioning, startTransition, endTransition } = useModeStore()
  const creator = api.fan.creator.meCreator.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })
  console.log(creator.data)

  // Animation variants for sidebar
  const sidebarVariants = {
    expanded: {
      width: "300px",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    collapsed: {
      width: "0px",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
  }

  // Animation variants for sidebar content
  const contentVariants = {
    expanded: {
      opacity: 1,
      rotateY: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.07,
        delayChildren: 0.1,
      },
    },
    collapsed: {
      opacity: 0.7,
      rotateY: 30,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05,
        staggerDirection: -1,
      },
    },
  }

  // Animation variants for sidebar items
  const itemVariants = {
    expanded: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    collapsed: {
      opacity: 0,
      x: -20,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
  }

  // Modified routing logic to allow navigation to organization/create
  useEffect(() => {
    // Skip redirection if user is trying to access the create page
    if (path === "/organization/create") {
      return
    }

    if (path === "/organization/home" && selectedMode === Mode.ORG) {
      router.push("/organization/profile")
    } else {
      CreatorNavigation.forEach((item) => {
        if (item.href === path && selectedMode === Mode.USER) {
          console.log("Redirecting to user page")
          router.push("/organization/home")
        }
      })
    }
    console.log(selectedMode)
  }, [path, selectedMode, router])

  return (
    <div className="relative overflow-hidden h-[calc(100vh-10.8vh)]">
      <div className="flex h-[calc(100vh-10.8vh)] gap-4 overflow-hidden">
        {selectedMode === Mode.USER ? (
          <>
            <motion.div
              className="flex-grow overflow-y-auto scrollbar-hide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex overflow-y-auto w-full flex-col">{children}</div>
            </motion.div>
            <AnimatePresence>
              <motion.div
                className={cn(
                  "fixed right-[19rem] top-1/2 z-40 hidden rotate-180 rounded-sm md:block",
                  isMinimized && "right-[.5rem] -rotate-180",
                )}
                initial={false}
                animate={isMinimized ? "collapsed" : "expanded"}
                transition={{
                  duration: 0.5,
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                <ToggleButton
                  isActive={!isMinimized}
                  onToggle={toggle}
                  onMouseEnter={() => setCursorVariant("hover")}
                  onMouseLeave={() => setCursorVariant("default")}
                />
              </motion.div>
            </AnimatePresence>
            <div className="hidden h-[calc(100vh-10vh)]  bg-background md:block">
              <motion.div
                className="sticky top-0 hidden h-full overflow-y-auto p-1 md:block"
                initial={false}
                animate={isMinimized ? "collapsed" : "expanded"}
                variants={sidebarVariants}
                style={{ perspective: "1000px" }}
              >
                <motion.div
                  className="no-scrollbar  flex gap-4 h-full w-full flex-col items-center justify-start py-2"
                  initial={false}
                  animate={isMinimized ? "collapsed" : "expanded"}
                  variants={contentVariants}
                >
                  <Card className="flex min-h-[72%]    w-full flex-col gap-2 overflow-x-hidden scrollbar-hide">
                    <CardHeader className="sticky top-0 bg-primary z-10 p-2">
                      <h3 className="font-medium   text-center ">Trending Creators</h3>
                    </CardHeader>
                    <CardContent className="p-1 ">
                      <TrendingSidebar />
                    </CardContent>
                  </Card>
                  <Card className="flex h-full  w-full flex-col gap-2 overflow-x-hidden  scrollbar-hide">
                    <CardHeader className="sticky top-0 bg-primary z-10 p-2">
                      <h3 className="font-medium  mb-3 text-center sticky top-0">Followed Creators</h3>
                    </CardHeader>
                    <CardContent>
                      <div className=" overflow-y-auto">
                        <CreatorSidebar />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </div>
          </>
        ) : (
          <>
            <motion.div
              className="flex w-full overflow-y-auto  scrollbar-hide "
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Special case for the create page */}
              {path === "/organization/create" ? (
                <div className="flex h-screen overflow-y-auto w-full flex-col">{children}</div>
              ) : creator.isLoading && selectedMode === Mode.ORG ? (
                <div className="flex h-full w-full items-center justify-center">
                  <JoinArtistPageLoading />
                </div>
              ) : creator.data?.id && creator.data?.approved === true && selectedMode === Mode.ORG ? (
                <div className="flex overflow-y-hidden  w-full flex-col ">{children}</div>
              ) : creator.data?.aprovalSend && creator.data?.approved === null ? (
                <div className="flex h-full w-full items-center justify-center">
                  <PendingArtistPage createdAt={creator.data?.createdAt} />
                </div>
              ) : creator.data?.aprovalSend && creator.data?.approved === false ? (
                <div className="flex h-full w-full items-center justify-center">
                  <BannedCreatorCard creatorName={creator.data.name}

                  />
                </div>
              ) : (
                !creator.data && (
                  <div className="flex h-full w-full items-center justify-center">
                    <JoinArtistPage />
                  </div>
                )
              )}
            </motion.div>

            <div
              className={`fixed bottom-4 z-50 -translate-x-1/2 transition-all duration-500 ease-in-out ${isExpanded ? " right-20 md:right-32 " : "right-16 md:right-20 "}`}
            >
              <div className="relative">
                {/* Expanded Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <div className="absolute -left-4 bottom-12 -translate-x-1/2 md:bottom-10">
                      {CreatorNavigation.map((item, index) => {
                        const Icon = Icons[item.icon as keyof typeof Icons]

                        return (
                          <Link key={index} href={item.disabled ? "/organization/wallet" : item.href}>
                            <motion.div
                              initial={{
                                y: 0,
                                x: 0,
                                scale: 0.5,
                                opacity: 0,
                              }}
                              animate={{
                                y: -60 * (index + 1),
                                x: -Math.sin((index + 1) * 0.4) * 25, // Create a small natural curve
                                scale: 1,
                                opacity: 1,
                              }}
                              exit={{
                                y: 0,
                                x: Math.sin((index + 1) * 0.5) * 5, // Maintain curve during exit
                                scale: 0.5,
                                opacity: 0,
                                transition: {
                                  duration: 0.2,
                                  delay: (LeftNavigation.length - index) * 0.05,
                                },
                              }}
                              transition={{
                                duration: 0.3,
                                delay: index * 0.05,
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                              }}
                              className="absolute left-1/2 -translate-x-1/2"
                            >
                              <Button
                                size="icon"
                                className={cn(
                                  "hover:scale-109 h-12 w-12 shadow-lg transition-transform hover:bg-foreground hover:text-primary",
                                  item.color,
                                  "text-white",
                                  path === item.href ? "bg-foreground " : "",
                                )}
                                onClick={() =>
                                  setIsExpanded(false)
                                }
                              >
                                <Icon />
                                <span className="sr-only">{item.label}</span>
                              </Button>
                              <motion.span
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.05 + 0.2 }}
                                className={cn(
                                  "absolute left-full top-2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-background px-2 py-1 text-sm font-medium shadow-sm hover:bg-foreground hover:text-primary",
                                  path === item.href ? "bg-foreground text-primary" : "",
                                )}
                              >
                                {item.label}
                              </motion.span>
                            </motion.div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </AnimatePresence>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`relative z-10 flex items-center justify-center rounded-sm ${isExpanded ? "" : "animate-bounce"}`}
                >
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={toggleExpand}
                    className="h-10 w-10 rounded-sm border-2 border-[#dbdd2c] font-bold"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isExpanded ? "down" : "up"}
                        initial={{ opacity: 0, y: isExpanded ? -10 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: isExpanded ? 10 : -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronUp className="h-6 w-6" />}
                      </motion.div>
                    </AnimatePresence>
                    <span className="sr-only">{isExpanded ? "Close menu" : "Open menu"}</span>
                  </Button>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="fixed bottom-2 right-4 z-50">
        <ModeSwitch />
      </div>
    </div>
  )
}

export const LeftNavigation: NavItem[] = [
  { href: "/", icon: "dashboard", title: "HOMEPAGE" },
  { href: "/my-collection", icon: "collection", title: "MY COLLECTION" },
  { href: "/music", icon: "music", title: "MUSIC" },
  { href: "/marketplace", icon: "store", title: "MARKETPLACE" },
  { href: "/bounty", icon: "bounty", title: "BOUNTY" },
  { href: "/organization/home", icon: "creator", title: "ARTISTS" },
  { href: "/settings", icon: "setting", title: "SETTINGS" },
]

type DockerItem = {
  disabled?: boolean
  icon: React.ReactNode
  label: string
  color: string
  href: string
}

const CreatorNavigation: DockerItem[] = [
  {
    href: "/organization/profile",
    icon: "wallet",
    label: "PROFILE",
    color: "bg-blue-500",
  },

  { href: "/organization/store", icon: "pins", label: "STORE", color: "bg-pink-500" },
  // {
  //   href: "/organization/gift",
  //   icon: "creator",
  //   label: "GIFT",
  //   color: "bg-emerald-500",
  // },
  {
    href: "/organization/bounty",
    icon: "users",
    label: "BOUNTY",
    color: "bg-blue-500",
  },
  // {
  //   href: "/organization/settings",
  //   icon: "bounty",
  //   label: "SETTINGS",
  //   color: "bg-purple-500",
  // },
  {
    href: "/organization/map",
    icon: "map",
    label: "MAP",
    color: "bg-pink-500",
  },
]

