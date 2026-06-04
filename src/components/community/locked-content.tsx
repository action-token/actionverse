"use client"

import { Lock, Coins } from "lucide-react"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"

interface TokenRequirement {
  id: number
  assetCode: string
  assetIssuer: string
  assetImage: string | null
  requiredBalance: number
}

interface LockedContentProps {
  tokenRequirements?: TokenRequirement[]
  tokenGateLogic?: string
  onJoin?: () => void
  message?: string
}

export function LockedContent({
  tokenRequirements,
  tokenGateLogic = "AND",
  onJoin,
  message = "This content is restricted to community members.",
}: LockedContentProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <p className="font-medium">{message}</p>
        {tokenRequirements && tokenRequirements.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {tokenGateLogic === "AND"
                ? "You need all of these tokens to join:"
                : "You need at least one of these tokens to join:"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tokenRequirements.map((req) => (
                <span
                  key={req.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {req.assetImage ? (
                    <Image
                      src={req.assetImage}
                      alt={req.assetCode}
                      width={16}
                      height={16}
                      className="rounded-full"
                    />
                  ) : (
                    <Coins className="h-3.5 w-3.5" />
                  )}
                  {req.requiredBalance > 0
                    ? `${req.requiredBalance} ${req.assetCode}`
                    : `${req.assetCode} (trust only)`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {onJoin && (
        <Button onClick={onJoin}>
          Join Community
        </Button>
      )}
    </div>
  )
}
