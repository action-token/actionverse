"use client";
import React, { useState } from "react";

import { ChevronLeft, LogOut } from "lucide-react";

import { useSidebar } from "~/hooks/use-sidebar";

import { DashboardNav } from "./dashboard-nav";
import { ConnectWalletButton } from "package/connect_wallet";
import { Facebook, Instagram } from "lucide-react";

import Link from "next/link";
import { HomeIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "~/utils/utils";
import { env } from "~/env";

import { NavItem } from "~/types/icon-types";
import { Button } from "~/components/shadcn/ui/button";
import { signOut, useSession } from "next-auth/react";

export const LeftNavigation: NavItem[] = [
  { href: "/", icon: "dashboard", title: "HOMEPAGE" },

  { href: "/my-collection", icon: "collection", title: "MY COLLECTION" },
  // Search: { path: "/search", icon: Search, text: "Search" },
  { href: "/music", icon: "music", title: "MUSIC" },
  { href: "/marketplace", icon: "store", title: "MARKETPLACE" },
  { href: "/bounty", icon: "bounty", title: "BOUNTY" },
  { href: "/artist/home", icon: "creator", title: "ARTISTS" },
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

  const session = useSession()
  return (
    <div
      className={cn(
        ` h-[calc(100vh-10.8vh)] sticky top-[5.8rem] p-1 w-full overflow-hidden border-r  hidden transition-[width] duration-500 md:block`,
        !isMinimized ? "w-[280px]" : "w-[78px]",
        className,
      )}
    >

      <div className=" flex  h-full   w-full  flex-col items-center justify-between   py-2   no-scrollbar  ">
        <div className="flex  w-full overflow-x-hidden   flex-col  ">
          <DashboardNav items={LeftNavigation} />
        </div>
        <div
          className={`${isMinimized ? "hidden" : "flex"} w-full flex-col items-center`}
        >
          <LeftBottom />
        </div>
        {session.status == "authenticated" && isMinimized &&

          <div className="">
            <LogOutButon />
          </div>

        }
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
    <Button className="flex flex-col p-3 shadow-sm shadow-black" onClick={disconnectWallet}>
      <span> <LogOut /></span>
      <span className="text-xs">Logout</span>
    </Button>
  );
}

export function LeftBottom() {
  return (
    <div className="flex w-full flex-col justify-center gap-4 p-1">


      <div className="w-full flex items-center justify-center ">
        <ConnectWalletButton />
      </div>

      <div className="flex  items-center justify-between  gap-4 ">
        <Link
          href={"https://facebook.com/bandcoinio"}
          className="btn flex h-12 shadow-sm shadow-black flex-col bg-primary justify-center  rounded-lg items-center  text-xs normal-case w-full"
          target="_blank"
        >
          <Facebook size={26} />

        </Link>
        <Link
          href={"https://x.com/bandcoinio"}
          className="btn flex h-12 shadow-sm shadow-black flex-col bg-primary justify-center  rounded-lg items-center  text-xs normal-case w-full"
          target="_blank"
        >
          <Image src="/images/icons/x.svg" alt="X" height={18} width={18}
            className="w-5 h-5"
          />

        </Link>
        <Link
          href={"https://www.instagram.com/bandcoin"}
          className="btn flex h-12 shadow-sm shadow-black flex-col bg-primary justify-center  rounded-lg items-center  text-xs normal-case w-full"
          target="_blank"
        >
          <Instagram size={26} />
        </Link>
      </div>
      <div className="flex w-full flex-col text-center text-xs text-base-content">
        <p>© 2024 {env.NEXT_PUBLIC_HOME_DOMAIN}</p>
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
        <p>v{1.1}</p>
      </div>
    </div>
  );
}
