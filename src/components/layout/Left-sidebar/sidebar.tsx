"use client";
import React from "react";

import { motion } from "framer-motion";
import { Sun, Moon, Cloud, Star } from "lucide-react";
import { LogOut } from "lucide-react";

import { useSidebar } from "~/hooks/use-sidebar";

import { DashboardNav } from "./dashboard-nav";
import { ConnectWalletButton } from "package/connect_wallet";
import { FaXTwitter } from "react-icons/fa6";
import { TbBrandFacebook } from "react-icons/tb";

import Link from "next/link";
import { HomeIcon } from "lucide-react";
import { cn } from "~/utils/utils";

import { NavItem } from "~/types/icon-types";
import { Button } from "~/components/shadcn/ui/button";
import { signOut, useSession } from "next-auth/react";
import { FaInstagram } from "react-icons/fa";
import { useTheme } from "next-themes";

export const LeftNavigation: NavItem[] = [
  { href: "/", icon: "dashboard", title: "HOMEPAGE" },

  { href: "/my-collection", icon: "collection", title: "MY COLLECTION" },
  // Search: { path: "/search", icon: Search, text: "Search" },
  // { href: "/music", icon: "music", title: "MUSIC" },
  // { href: "/marketplace", icon: "store", title: "MARKETPLACE" },
  // { href: "/bounty", icon: "bounty", title: "BOUNTY" },
  { href: "/artist/home", icon: "artist", title: "ARTISTS" },
  { href: "/settings", icon: "setting", title: "SETTINGS" },
];

export const BottomNavigation = {
  Home: { path: "/maps/pins", icon: HomeIcon, text: "CLAIM" },
} as const;

type SidebarProps = {
  className?: string;
};

export default function Sidebar({ className }: SidebarProps) {
  const { isMinimized, toggle } = useSidebar();

  const session = useSession();
  return (
    <div
      className={cn(
        ` sticky top-[5.8rem] hidden h-[calc(100vh-10.8vh)] w-full overflow-hidden border-r  p-1 transition-[width] duration-500 md:block`,
        !isMinimized ? "w-[280px]" : "w-[78px]",
        className,
      )}
    >
      <div className=" no-scrollbar  flex   h-full  w-full flex-col items-center   justify-between   py-2  ">
        <div className="flex   w-full flex-col   overflow-x-hidden  ">
          <DashboardNav items={LeftNavigation} />
        </div>
        <div
          className={`${isMinimized ? "hidden" : "flex"} w-full flex-col items-center `}
        >
          <LeftBottom />
        </div>
        {session.status == "authenticated" && isMinimized && (
          <div className="">
            <LogOutButon />
          </div>
        )}
      </div>
    </div>
  );
}
function LogOutButon() {
  async function disconnectWallet() {
    await signOut({
      redirect: false,
    });
  }
  return (
    <Button
      className="flex flex-col p-3 shadow-sm shadow-black"
      onClick={disconnectWallet}
    >
      <span>
        {" "}
        <LogOut />
      </span>
      <span className="text-xs">Logout</span>
    </Button>
  );
}

export function LeftBottom() {
  const { setTheme, theme } = useTheme();

  const tougleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex w-full  flex-col   gap-4 p-1">
      <div className="flex  items-center justify-center">
        <button
          onClick={() => tougleTheme()}
          className="relative h-14 w-36  rounded-full transition-shadow duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-purple-400"
          style={{
            boxShadow:
              theme === "dark"
                ? "inset 0 0 15px rgba(255, 255, 255, 0.2), 0 0 20px rgba(138, 43, 226, 0.4)"
                : "inset 0 0 15px rgba(0, 0, 0, 0.1), 0 0 20px rgba(59, 130, 246, 0.4)",
          }}
        >
          <motion.div
            className="absolute bottom-1 left-1 right-1 top-1 rounded-full bg-gradient-to-br"
            animate={{
              background:
                theme === "dark"
                  ? "linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)"
                  : "linear-gradient(135deg, #60a5fa 0%, #e0f2fe 100%)",
            }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            className="absolute   top-1 h-12 w-12 rounded-full "
            animate={{
              x: theme === "dark" ? 92 : 5,
              background: theme === "dark" ? "#f1c40f" : "#ffffff",
            }}
            transition={{
              type: "spring",
              stiffness: 700,
              damping: 30,
            }}
          />
          <div className="relative flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Sun className="h-8 w-8 text-yellow-400" />
              <Cloud className="h-6 w-6 text-gray-200" />
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-200" />
              <Moon className="h-8 w-8 text-indigo-200" />
            </div>
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
      <div className="flex w-full items-center justify-center ">
        <ConnectWalletButton />
      </div>

      <div className="flex  items-center justify-between  gap-4 ">
        <Link
          href={"https://facebook.com/bandcoinio"}
          className="btn flex h-12 w-full flex-col items-center justify-center rounded-lg  bg-transparent text-xs  normal-case shadow-sm shadow-black"
          target="_blank"
        >
          <TbBrandFacebook size={26} className="text-destructive" />
        </Link>
        <Link
          href={"https://x.com/bandcoinio"}
          className="btn flex h-12 w-full flex-col items-center justify-center rounded-lg  bg-transparent text-xs  normal-case shadow-sm shadow-black"
          target="_blank"
        >
          <FaXTwitter className="text-destructive" size={26} />
        </Link>
        <Link
          href={"https://www.instagram.com/bandcoin"}
          className="btn flex h-12 w-full flex-col items-center justify-center rounded-lg  bg-transparent text-xs  normal-case shadow-sm shadow-black"
          target="_blank"
        >
          <FaInstagram className="text-destructive" size={26} />
        </Link>
      </div>
      <div className="text-base-content flex w-full flex-col text-center text-xs">
        <p>© 2024 Actionverse</p>
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
        <p>v 1.0.0</p>
      </div>
    </div>
  );
}
