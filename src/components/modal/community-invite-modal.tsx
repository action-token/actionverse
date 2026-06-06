"use client"

import { useState } from "react"
import { api } from "~/utils/api"
import { Search, X, Send, Loader2, UserPlus } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import toast from "react-hot-toast"
import { useCommunityInviteModalStore } from "../store/community-invite-modal-store"

export function CommunityInviteModal() {
  const { isOpen, setIsOpen, communityId } = useCommunityInviteModalStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<
    Array<{ id: string; name: string | null; image: string | null }>
  >([])

  const { data: searchResults, isLoading: isSearching } =
    api.community.member.searchUsers.useQuery(
      {
        search: searchQuery || undefined,
        communityId: communityId,
      },
      { enabled: isOpen && !!communityId },
    )

  const invite = api.community.member.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitations sent!")
      handleClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleClose = () => {
    setIsOpen(false)
    setSearchQuery("")
    setSelectedUsers([])
  }

  const toggleUser = (user: {
    id: string
    name: string | null
    image: string | null
  }) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id)
      if (exists) return prev.filter((u) => u.id !== user.id)
      return [...prev, user]
    })
  }

  const handleSend = () => {
    if (!communityId || selectedUsers.length === 0) return
    invite.mutate({
      communityId,
      userIds: selectedUsers.map((u) => u.id),
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Invite Friends
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-full pl-9"
            />
          </div>

          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {user.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {user.name ?? "Anonymous"}
                  <button
                    onClick={() => toggleUser(user)}
                    className="ml-0.5 rounded-full hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* User list */}
          <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border p-1">
            {isSearching ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map(
                (user: {
                  id: string
                  name: string | null
                  image: string | null
                }) => {
                  const isSelected = selectedUsers.some(
                    (u) => u.id === user.id,
                  )
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted ${
                        isSelected ? "bg-primary/5 ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {user.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-sm">
                        {user.name ?? "Anonymous"}
                      </span>
                      {isSelected && (
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                          Selected
                        </span>
                      )}
                    </button>
                  )
                },
              )
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery ? "No users found" : "No users available"}
              </p>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={selectedUsers.length === 0 || invite.isLoading}
            className="w-full gap-2 rounded-full"
          >
            {invite.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Invitations ({selectedUsers.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
