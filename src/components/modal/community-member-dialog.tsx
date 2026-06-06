"use client"

import { api } from "~/utils/api"
import { X, UserMinus, Crown, Loader2 } from "lucide-react"
import Image from "next/image"

import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import toast from "react-hot-toast"
import { useCommunityMemberDialogStore } from "../store/community-member-dialog-store"

export function CommunityMemberDialog({ isOwner }: { isOwner: boolean }) {
  const { isOpen, setIsOpen, communityId } = useCommunityMemberDialogStore()
  const utils = api.useUtils()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
  } = api.community.member.getMembers.useInfiniteQuery(
    { communityId: communityId ?? 0, limit: 20 },
    {
      enabled: isOpen && !!communityId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  const removeMember = api.community.member.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed")
      void utils.community.member.getMembers.invalidate()
      void utils.community.community.getById.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const members = data?.pages.flatMap((page) => page.members) ?? []

  if (data?.pages[0]?.locked) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Members</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Member list is only visible to community members.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))
            : members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user.image ?? undefined} />
                      <AvatarFallback>
                        {member.user.name?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.name ?? "Anonymous"}
                      </p>
                      {member.role === "OWNER" && (
                        <Badge variant="secondary" className="mt-0.5 text-xs">
                          <Crown className="mr-1 h-3 w-3" />
                          Owner
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isOwner && member.role !== "OWNER" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!communityId) return
                        removeMember.mutate({
                          communityId,
                          userId: member.user.id,
                        })
                      }}
                      disabled={removeMember.isLoading}
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}

          {hasNextPage && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
