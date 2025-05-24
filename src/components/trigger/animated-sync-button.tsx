import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/shadcn/ui/tooltip";
import { Badge } from "~/components/shadcn/ui/badge";
import { cn } from "~/lib/utils";

interface AnimatedSyncButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  status?: {
    status: string;
    createdAt: string;
    updatedAt: string;
    runId: string;
  };
  disabled?: boolean;
  className?: string;
}

export function AnimatedSyncButton({
  onClick,
  isLoading = false,
  status,
  disabled = false,
  className,
}: AnimatedSyncButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "EXECUTING":
        return "bg-blue-500";
      case "COMPLETED":
        return "bg-green-500";
      case "FAILED":
        return "bg-red-500";
      case "PENDING":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "EXECUTING":
        return "Running";
      case "COMPLETED":
        return "Completed";
      case "FAILED":
        return "Failed";
      case "PENDING":
        return "Pending";
      default:
        return "Unknown";
    }
  };

  const buttonContent = (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden transition-all duration-300",
        isLoading &&
          "animate-gradient-x border-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-[length:200%_100%] text-white hover:bg-gradient-to-r hover:from-blue-500 hover:via-purple-500 hover:to-pink-500",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <RefreshCw
        className={cn(
          "h-4 w-4 transition-transform duration-300",
          isLoading && "animate-spin",
        )}
      />
      <span>{isLoading ? "Syncing..." : "Sync Data"}</span>

      {/* Gradient overlay for animation */}
      {isLoading && (
        <div className="animate-shimmer absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </Button>
  );

  if (status && isHovered) {
    return (
      <TooltipProvider>
        <Tooltip open={isHovered}>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-sm space-y-3 p-4"
            sideOffset={8}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    getStatusColor(status.status),
                  )}
                />
                <span className="font-medium">
                  Status: {getStatusText(status.status)}
                </span>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Started:</span>{" "}
                  {new Date(status.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Last updated:</span>{" "}
                  {new Date(status.updatedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Run ID:</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {status.runId.slice(0, 12)}...
                  </Badge>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}
