"use client"

import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { useRef, useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Shield,
  Eye,
  PenLine,
  Calendar,
  Trash2,
  Pencil,
  Loader2,
  ExternalLink,
  Users,
  MessageSquare,
  Plus,
} from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { api } from "~/utils/api"
import { CommunityPostCard } from "~/components/community/community-post-card"
import { CommunityDetailSidebar } from "~/components/community/community-detail-sidebar"
import { LockedContent } from "~/components/community/locked-content"
import { CreateCommunityPostModal } from "~/components/modal/create-community-post-modal"
import { EditCommunityPostModal } from "~/components/modal/edit-community-post-modal"
import { CommunityMemberDialog } from "~/components/modal/community-member-dialog"
import { CommunityInviteModal } from "~/components/modal/community-invite-modal"
import { useCommunityPostModalStore } from "~/components/store/community-post-modal-store"
import { useCommunityModalStore } from "~/components/store/community-modal-store"
import { CreateCommunityModal } from "~/components/modal/create-community-modal"
import toast from "react-hot-toast"

const CommunityDetailPage = () => {
  const router = useRouter()
  const { id } = router.query
  const communityId = Number(id)
  const { data: session } = useSession()
  const postModal = useCommunityPostModalStore()
  const communityModal = useCommunityModalStore()
  const utils = api.useUtils()

  const scrollRef = useRef<HTMLDivElement>(null)
  const descriptionRef = useRef<HTMLDivElement>(null)
  const [showStickyHeader, setShowStickyHeader] = useState(false)

  const handleScroll = useCallback(() => {
    if (!descriptionRef.current || !scrollRef.current) return
    const descBottom = descriptionRef.current.getBoundingClientRect().bottom
    const scrollTop = scrollRef.current.getBoundingClientRect().top
    setShowStickyHeader(descBottom < scrollTop)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  const { data: community, isLoading } =
    api.community.community.getById.useQuery(
      { communityId },
      { enabled: !!id && !isNaN(communityId) },
    )

  const posts = api.community.post.getAll.useInfiniteQuery(
    { communityId, limit: 10 },
    {
      enabled: !!id && !isNaN(communityId),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  const deleteCommunity = api.community.community.delete.useMutation({
    onSuccess: () => {
      toast.success("Community deleted")
      void router.push("/community")
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (!community) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Community not found</p>
      </div>
    )
  }

  const canPost =
    community.isMember &&
    (community.postPermission === "ALL_MEMBERS" || community.isOwner)

  const isPostsLocked = posts.data?.pages[0]?.locked

  const isPubnet = process.env.NEXT_PUBLIC_STELLAR_PUBNET === "true"
  const stellarExpertBase = `https://stellar.expert/explorer/${isPubnet ? "public" : "testnet"}`

  const openPostModal = () => {
    postModal.setCommunityId(communityId)
    postModal.setIsOpen(true)
  }

  return (
    <div className="flex h-[calc(100vh-11vh)] w-full flex-col overflow-hidden">
      {/* Content area: main scrollable + fixed sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main scrollable area */}
        <div className="relative flex-1 overflow-hidden">
          {/* Sticky header — absolutely positioned overlay */}
          <div
            className={`absolute left-0 right-0 top-0 z-20 border-b bg-background/95 backdrop-blur-sm transition-all duration-200 ${showStickyHeader
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none"
              }`}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2 md:px-6">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={community.profileUrl}
                  alt={community.title}
                  fill
                  className="object-cover"
                />
              </div>
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                {community.title}
              </h2>
              {canPost && (
                <Button
                  size="sm"
                  className="gap-1.5 rounded-md px-4"
                  onClick={openPostModal}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Post
                </Button>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="h-full overflow-y-auto">
            {/* Cover + Profile header */}
            <div className="relative">
              <div className="relative h-52 w-full md:h-64">
                <Image
                  src={community.coverUrl}
                  alt={community.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </div>

              {/* Profile + info overlay */}
              <div className="relative mx-auto max-w-3xl px-4 md:px-6">
                <div className="relative -mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background shadow-xl sm:h-28 sm:w-28">
                    <Image
                      src={community.profileUrl}
                      alt={community.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 pb-1">
                    <h1 className="text-xl font-bold sm:text-2xl">
                      {community.title}
                    </h1>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {community._count.members} members
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {community._count.posts} posts
                      </span>
                    </div>

                  </div>
                  {/* Owner actions */}
                  {community.isOwner && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-full"
                        onClick={() => {
                          communityModal.setEditData(communityId)
                          communityModal.setIsOpen(true)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this community? This cannot be undone.",
                            )
                          ) {
                            deleteCommunity.mutate({ communityId })
                          }
                        }}
                        disabled={deleteCommunity.isLoading}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Body */}
            <div className="mx-auto max-w-3xl px-4 py-5 md:px-6">
              {/* Description + badges */}
              <div ref={descriptionRef} className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {community.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <Eye className="h-3 w-3" />
                    {community.memberListVisibility === "EVERYONE"
                      ? "Public member list"
                      : "Members-only list"}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <PenLine className="h-3 w-3" />
                    {community.postPermission === "ALL_MEMBERS"
                      ? "All members can post"
                      : "Owner-only posting"}
                  </Badge>
                  {community.isTokenGated && community.tokenRequirements?.length > 0 && (
                    <>
                      <Badge className="gap-1 border-0 bg-amber-500/90 text-xs font-normal text-white">
                        <Shield className="h-3 w-3" />
                        {community.tokenGateLogic === "AND"
                          ? "All tokens required"
                          : "Any token required"}
                      </Badge>
                      {community.tokenRequirements.map((req: { id: number; assetCode: string; assetIssuer: string; requiredBalance: number }) => (
                        <a
                          key={req.id}
                          href={`${stellarExpertBase}/asset/${req.assetCode}-${req.assetIssuer}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Badge variant="outline" className="gap-1 text-xs font-normal hover:bg-muted">
                            {req.requiredBalance > 0
                              ? `${req.requiredBalance} ${req.assetCode}`
                              : `${req.assetCode} (trust)`}
                            <ExternalLink className="ml-0.5 h-3 w-3" />
                          </Badge>
                        </a>
                      ))}
                    </>
                  )}
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Calendar className="h-3 w-3" />
                    Created{" "}
                    {formatDistanceToNow(new Date(community.createdAt), {
                      addSuffix: true,
                    })}
                  </Badge>
                </div>
              </div>

              {/* Post creation prompt */}
              {canPost && (
                <button
                  onClick={openPostModal}
                  className="mt-5 flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={session?.user?.image ?? undefined} />
                    <AvatarFallback>
                      {session?.user?.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    What&apos;s on your mind?
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                    <Plus className="h-3.5 w-3.5" />
                    Create Post
                  </span>
                </button>
              )}

              {/* Posts feed */}
              <div className="mt-5 space-y-4 pb-8">
                {isPostsLocked ? (
                  <LockedContent
                    tokenRequirements={community.tokenRequirements}
                    tokenGateLogic={community.tokenGateLogic}
                  />
                ) : posts.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full rounded-xl" />
                  ))
                ) : (
                  <>
                    {posts.data?.pages.flatMap((page) =>
                      page.posts.map((post) => (
                        <CommunityPostCard
                          key={post.id}
                          post={post}
                          communityOwnerId={community.ownerId}
                        />
                      )),
                    )}

                    {posts.data?.pages[0]?.posts.length === 0 && (
                      <div className="rounded-xl border border-dashed py-14 text-center">
                        <p className="text-sm text-muted-foreground">
                          No posts yet.{" "}
                          {canPost && "Be the first to post!"}
                        </p>
                      </div>
                    )}

                    {posts.hasNextPage && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="outline"
                          className="rounded-full px-8"
                          onClick={() => void posts.fetchNextPage()}
                          disabled={posts.isFetchingNextPage}
                        >
                          {posts.isFetchingNextPage
                            ? "Loading..."
                            : "Load More"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - independent scroll */}
        <div className="hidden w-80 shrink-0 overflow-y-auto border-l p-4 lg:block">
          <CommunityDetailSidebar
            communityId={communityId}
            community={community}
          />
        </div>
      </div>

      {/* Modals */}
      <CreateCommunityModal />
      <CreateCommunityPostModal />
      <EditCommunityPostModal />
      <CommunityMemberDialog isOwner={community.isOwner} />
      <CommunityInviteModal />
    </div>
  )
}

export default CommunityDetailPage
