"use client"

import { useState } from "react"
import {
  Loader2,
  CheckCircle2,
  Trophy,
  Users,
  FileText,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select"
import { api } from "~/utils/api"
import toast from "react-hot-toast"
import { useSession } from "next-auth/react"
import { useShareBountyModalStore } from "../store/share-bounty-modal-store"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { cn } from "~/lib/utils"

export function ShareBountyModal() {
  const { isOpen, bounty, close } = useShareBountyModalStore()
  const { data: session } = useSession()
  const [communityId, setCommunityId] = useState<string>("")
  const [caption, setCaption] = useState("")
  const utils = api.useUtils()

  const { data: communities } = api.community.community.getMyPostableCommunities.useQuery(
    undefined,
    { enabled: isOpen },
  )

  const allCommunities = communities ?? []

  const createPost = api.community.post.create.useMutation({
    onSuccess: () => {
      toast.success("Bounty shared to community!")
      void utils.community.post.getAll.invalidate()
      handleClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleClose = () => {
    setCommunityId("")
    setCaption("")
    close()
  }

  const handleShare = () => {
    if (!communityId || !bounty) return
    const bountyUrl = `${window.location.origin}/bounty/${bounty.id}`
    const content = caption.trim()
      ? `${caption.trim()}\n\n${bountyUrl}`
      : bountyUrl
    createPost.mutate({
      communityId: Number(communityId),
      content,
      commentsEnabled: true,
    })
  }

  if (!bounty) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" />
            Share Bounty
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-5 space-y-4">
          {/* Author row */}
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-1 ring-border">
              <AvatarImage src={session?.user?.image ?? ""} />
              <AvatarFallback className="text-xs bg-secondary text-muted-foreground">
                {session?.user?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">{session?.user?.name ?? "You"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">sharing a bounty</p>
            </div>
          </div>

          {/* Caption */}
          <Textarea
            placeholder="Say something about this bounty… (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="resize-none bg-secondary border-border text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1"
          />

          {/* Bounty preview embed */}
          <div className="rounded-xl border border-border bg-background px-4 py-3 space-y-2.5">
            {/* Prize */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-primary font-bold text-[14px]">
                {bounty.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
              </span>
              <span className="text-muted-foreground text-xs">/ winner</span>
            </div>
            {/* Title */}
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {bounty.title}
            </p>
            {/* Stats */}
            {(bounty.participantCount !== undefined || bounty.submissionCount !== undefined) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {bounty.participantCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {bounty.participantCount} joined
                  </span>
                )}
                {bounty.submissionCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {bounty.submissionCount} submitted
                  </span>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/60">
              {typeof window !== "undefined" ? window.location.origin : ""}/bounty/{bounty.id}
            </p>
          </div>

          {/* Community picker */}
          <Select value={communityId} onValueChange={setCommunityId}>
            <SelectTrigger className="bg-secondary border-border text-sm">
              <SelectValue placeholder="Choose a community to post in…" />
            </SelectTrigger>
            <SelectContent>
              {allCommunities.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  You haven&apos;t joined any communities yet
                </div>
              ) : (
                allCommunities.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={!communityId || createPost.isLoading}
              className="min-w-[90px]"
            >
              {createPost.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Posting…
                </>
              ) : (
                "Post to Community"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
