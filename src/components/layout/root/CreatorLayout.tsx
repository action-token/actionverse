"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "~/lib/utils";
import type { NavItem } from "~/types/icon-types";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import { ToggleButton } from "~/components/common/toggle-button-admin";
import { api } from "~/utils/api";
import { usePathname, useRouter } from "next/navigation";
import { useCreatorSidebar } from "~/hooks/use-creator-sidebar";
import { ModeSwitch } from "~/components/common/mode-switch";
import Link from "next/link";
import { Icons } from "../Left-sidebar/icons";
import { SkeletonEffect } from "~/components/loading/skeleton-effect";
import { useToast } from "~/components/shadcn/ui/use-toast";
import TrendingSidebar from "~/components/post/trending-sidebar";
import CreatorSidebar from "~/components/post/followed-creator";
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card";
import { Mode, useModeStore } from "~/components/store/mode-store";

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [cursorVariant, setCursorVariant] = useState("default");
  const creators = api.fan.creator.getAllCreator.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const path = usePathname();
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const { isMinimized, toggle } = useCreatorSidebar();
  const { selectedMode, toggleSelectedMode } = useModeStore();
  const creator = api.fan.creator.meCreator.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

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
  };

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
  };

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
  };

  // i want if user try to access creator page but he is on user page then it should redirect to user page
  useEffect(() => {
    CreatorNavigation.map((item) => {
      if (item.href === path && selectedMode === Mode.User) {
        toggleSelectedMode();
        toast.toast({
          title: "Mode Changed",
          description: "You are now in creator mode",
          variant: "destructive",
        });
      }
    });
  }, [creator.data?.id]);

  return (
    <div className="relative overflow-hidden">
      <div className="flex h-[calc(100vh-10.8vh)] gap-4 overflow-hidden">
        {selectedMode === Mode.User ? (
          <>
            <motion.div
              className="flex-grow overflow-y-auto scrollbar-hide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex h-[calc(100vh-10.8vh)] w-full flex-col">
                {children}
              </div>
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
            <div className="hidden h-[calc(100vh-21vh)]  bg-background md:block">
              <motion.div
                className="sticky top-0 hidden h-full overflow-y-auto p-1 md:block"
                initial={false}
                animate={isMinimized ? "collapsed" : "expanded"}
                variants={sidebarVariants}
                style={{ perspective: "1000px" }}
              >
                <motion.div
                  className="no-scrollbar  flex h-full w-full flex-col items-center justify-start gap-4 py-2"
                  initial={false}
                  animate={isMinimized ? "collapsed" : "expanded"}
                  variants={contentVariants}
                >
                  <Card className="flex min-h-[72%]    w-full flex-col gap-2 overflow-x-hidden scrollbar-hide">
                    <CardHeader className="sticky top-0 z-10 bg-primary p-2">
                      <h3 className="text-center   font-medium ">
                        Trending Creators
                      </h3>
                    </CardHeader>
                    <CardContent className="p-1 ">
                      <TrendingSidebar />
                    </CardContent>
                  </Card>
                  <Card className="flex h-full  w-full flex-col gap-2 overflow-x-hidden  scrollbar-hide">
                    <CardHeader className="sticky top-0 z-10 bg-primary p-2">
                      <h3 className="sticky  top-0 mb-3 text-center font-medium">
                        Followed Creators
                      </h3>
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
              className="flex-grow overflow-y-auto scrollbar-hide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {creator.isLoading && selectedMode === Mode.Creator ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="w-full max-w-4xl space-y-4 px-4">
                    <SkeletonEffect variant="card" count={3} />
                  </div>
                </div>
              ) : creator.data?.id && selectedMode === Mode.Creator ? (
                <div className="flex h-screen w-full flex-col">{children}</div>
              ) : (
                !creator.data && (
                  <div className="flex h-full w-full items-center justify-center">
                    <h1 className="text-3xl font-bold">
                      You are not authorized to view this page
                    </h1>
                  </div>
                )
              )}
            </motion.div>

            <div
              className={`fixed bottom-4 z-50 -translate-x-1/2 transition-all duration-500 ease-in-out ${isExpanded ? " right-20 md:right-32 " : "right-16 md:right-20 "}`}
            >
              <div className="relative">
                {/* Expanded Items */}
                <ExpandedItem isExpanded={isExpanded} />
                {/* Toggle Button */}

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
                        {isExpanded ? (
                          <ChevronDown className="h-6 w-6" />
                        ) : (
                          <ChevronUp className="h-6 w-6" />
                        )}
                      </motion.div>
                    </AnimatePresence>
                    <span className="sr-only">
                      {isExpanded ? "Close menu" : "Open menu"}
                    </span>
                  </Button>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="fixed bottom-2 right-4 z-50 w-32">
        <ModeSwitch />
        {/* <p>vong cong tong long pong</p> */}
      </div>
    </div>
  );
}

function ExpandedItem({ isExpanded }: { isExpanded: boolean }) {
  const path = usePathname();
  if (isExpanded)
    return (
      //   <AnimatePresence>
      <div className="absolute -left-4 bottom-12 -translate-x-1/2 md:bottom-10">
        {CreatorNavigation.map((item, index) => {
          const Icon = Icons[item.icon as keyof typeof Icons];

          return (
            <Link
              key={index}
              href={item.disabled ? "/artist/wallet" : item.href}
            >
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
                  onClick={() => console.log(`Clicked ${item.label}`)}
                >
                  {Icon && <Icon />}
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
          );
        })}
      </div>
      //   </AnimatePresence>
    );
}

export const LeftNavigation: NavItem[] = [
  { href: "/", icon: "dashboard", title: "HOMEPAGE" },
  { href: "/my-collection", icon: "collection", title: "MY COLLECTION" },
  { href: "/music", icon: "music", title: "MUSIC" },
  { href: "/marketplace", icon: "store", title: "MARKETPLACE" },
  { href: "/bounty", icon: "bounty", title: "BOUNTY" },
  { href: "/artist/home", icon: "creator", title: "ARTISTS" },
  { href: "/settings", icon: "setting", title: "SETTINGS" },
];

type DockerItem = {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  color: string;
  href: string;
};

const CreatorNavigation: DockerItem[] = [
  {
    href: "/artist",
    icon: "wallet",
    label: "PROFILE",
    color: "bg-blue-500",
  },
  {
    href: "/artist/posts",
    icon: "admin",
    label: "POST",
    color: "bg-purple-500",
  },
  { href: "/artist/store", icon: "pins", label: "STORE", color: "bg-pink-500" },
  // {
  //   href: "/artist/music",
  //   icon: "report",
  //   label: "MUSIC",
  //   color: "bg-amber-500",
  // },
  {
    href: "/artist/gift",
    icon: "creator",
    label: "GIFT",
    color: "bg-emerald-500",
  },
  {
    href: "/artist/bounty",
    icon: "users",
    label: "BOUNTY",
    color: "bg-blue-500",
  },
  {
    href: "/artist/settings",
    icon: "bounty",
    label: "SETTINGS",
    color: "bg-purple-500",
  },
  {
    href: "/artist/map",
    icon: "map",
    label: "MAP",
    color: "bg-pink-500",
  },
];
