/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/utils";

import { Dispatch, SetStateAction } from "react";

import { useSidebar } from "~/hooks/use-sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/shadcn/ui/tooltip";
import { Icons } from "./icons";
import { NavItem } from "~/types/icon-types";
import { Button } from "~/components/shadcn/ui/button";

interface DashboardNavProps {
  items: NavItem[];
  setOpen?: Dispatch<SetStateAction<boolean>>;
  isMobileNav?: boolean;
}

export function DashboardNav({ items, setOpen }: DashboardNavProps) {
  const path = usePathname();
  const { isMinimized, setIsSheetOpen, isSheetOpen } = useSidebar();
  if (!items.length) {
    return null
  }
  return (
    <nav className="grid w-full gap-3 p-1 ">
      <TooltipProvider>
        {items.map((item, index) => {
          const Icon = Icons[item.icon as keyof typeof Icons];
          return (
            item.href && (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Link href={item.disabled ? "/" : item.href} >
                    <Button
                      className={cn(
                        " flex    w-full items-center shadow-sm  justify-start   gap-2 overflow-hidden rounded-md text-sm font-medium ",
                        path === item.href
                          ? "text-destructive border-2 border-destructive bg-background hover:bg-background font-bold"
                          : "transparent shadow-black ",
                        item.disabled && "cursor-not-allowed opacity-80",
                      )}
                      onClick={() => {
                        if (setOpen) setOpen(false);
                        if (isSheetOpen) setIsSheetOpen(false);
                      }}
                    >
                      {
                        isMinimized ? (
                          <Icon />
                        ) :
                          <div className="flex items-center justify-center gap-4">
                            <Icon />

                            <span className="mr-2 truncate ">{item.title}</span>

                          </div>
                      }

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
          );
        })}
      </TooltipProvider>
    </nav >
  );
}