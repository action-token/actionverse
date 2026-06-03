"use client"

import { Lock, Shield } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"

interface LockedContentProps {
  requiredBalance?: number | null
  requiredBalanceCode?: string | null
  onJoin?: () => void
  message?: string
}

export function LockedContent({
  requiredBalance,
  requiredBalanceCode,
  onJoin,
  message = "This content is restricted to community members.",
}: LockedContentProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{message}</p>
        {requiredBalance && requiredBalanceCode && (
          <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            Requires {requiredBalance} {requiredBalanceCode} to join
          </p>
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
