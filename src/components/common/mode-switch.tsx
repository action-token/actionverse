"use client";

import { motion } from "framer-motion";
import { Paintbrush, User } from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/shadcn/ui/tooltip";

import { Mode, useModeStore } from "../store/mode-store";

export function ModeSwitch() {
  const { selectedMode, toggleSelectedMode } = useModeStore();
  const [isHovering, setIsHovering] = useState(false);

  const isCreator = selectedMode === Mode.Creator;
  const router = useRouter();
  return (
    <TooltipProvider>
      <div className="inline-flex flex-col rounded-md bg-gray-100/50 p-1 shadow-sm shadow-black backdrop-blur-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                if (isCreator) {
                  toggleSelectedMode();
                  router.push("/artist/home");
                }
              }}
              className={cn(
                "relative mb-1 rounded-md transition-colors",
                "flex flex-col items-center justify-center gap-1 p-2",
                "h-10 w-10 md:h-12 md:w-12", // Smaller on mobile, regular on md+
                isCreator ? "text-gray-600 " : "animate-bounce text-white",
              )}
              disabled={!isCreator}
            >
              {!isCreator && (
                <motion.div
                  layoutId="activeBackgroundIcon"
                  className="absolute inset-0 rounded-md bg-blue-500"
                  transition={{
                    type: "spring",
                    bounce: 0.15,
                    duration: 0.5,
                  }}
                />
              )}
              <User className="relative h-4 w-4" />
              <span className="relative hidden text-[10px] font-medium md:inline">
                User
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium" sideOffset={8}>
            {!isCreator ? "User Mode" : "Switch to User Mode"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                if (!isCreator) {
                  toggleSelectedMode();
                  router.push("/artist/profile");
                }
              }}
              className={cn(
                "relative rounded-md transition-colors",
                "flex flex-col items-center justify-center gap-1 p-2",
                "h-10 w-10 md:h-12 md:w-12", // Smaller on mobile, regular on md+
                isCreator ? "animate-bounce text-white" : "text-gray-600",
              )}
              disabled={isCreator}
            >
              {isCreator && (
                <motion.div
                  layoutId="activeBackgroundIcon"
                  className="absolute inset-0 rounded-md bg-purple-500"
                  transition={{
                    type: "spring",
                    bounce: 0.15,
                    duration: 0.5,
                  }}
                />
              )}
              <Paintbrush className="relative h-4 w-4" />
              <span className="relative hidden text-[10px] font-medium md:inline">
                Creator
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium" sideOffset={8}>
            {isCreator ? "Creator Mode" : "Switch to Creator Mode"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";

const VisuallyHidden = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        "absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0",
        "clip-[rect(0px,0px,0px,0px)]",
        className,
      )}
      {...props}
    />
  );
});
VisuallyHidden.displayName = "VisuallyHidden";

export { VisuallyHidden };
