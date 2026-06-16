"use client"

import { useState } from "react"
import { api } from "~/utils/api"
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Share2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { Button } from "~/components/shadcn/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/shadcn/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { Input } from "~/components/shadcn/ui/input"
import toast from "react-hot-toast"
import { useSession } from "next-auth/react"
import { MediaGrid } from "./media-grid"
import { useEditCommunityPostModalStore } from "../store/edit-community-post-modal-store"
import { useShareModalStore } from "../store/share-modal-store"
import { BountyLinkDetector, extractBountyIds } from "~/lib/bounty/bounty-link-detector"

const CONTENT_COLLAPSE_LENGTH = 280
const CONTENT_COLLAPSE_LINES = 6

// Strip bare bounty URLs so they don't appear as raw text alongside the embed
function stripBountyUrls(content: string): string {
  return content
    .replace(/https?:\/\/[^\s]*\/bounty\/\d+/g, "")
    .replace(/\/bounty\/\d+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

interface CommunityPostCardProps {
  post: {
    id: number
    content: string
    commentsEnabled: boolean
    createdAt: Date
    author: {
      id: string
      name: string | null
      image: string | null
    }
    medias: Array<{
      id: number
      url: string
      type: "MUSIC" | "VIDEO" | "IMAGE" | "THREE_D"
    }>
    _count: {
      comments: number
      likes: number
    }
    isLiked: boolean
  }
  communityOwnerId: string
  communityId: number
}

function PostContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  // Strip bounty URLs from visible text — the embed card replaces them
  const hasBountyLinks = extractBountyIds(content).length > 0
  const displayContent = hasBountyLinks ? stripBountyUrls(content) : content

  const lineCount = displayContent.split("\n").length
  const isLong = displayContent.length > CONTENT_COLLAPSE_LENGTH || lineCount > CONTENT_COLLAPSE_LINES

  if (!isLong || expanded) {
    return (
      <div>
        {displayContent.length > 0 && (
          <p className="whitespace-pre-wrap text-sm">{displayContent}</p>
        )}
        {isLong && (
          <button
            onClick={() => setExpanded(false)}
            className="mt-1 text-xs font-medium text-primary hover:underline"
          >
            Show less
          </button>
        )}
        <BountyLinkDetector content={content} />
      </div>
    )
  }

  const truncated = displayContent.length > CONTENT_COLLAPSE_LENGTH
    ? displayContent.slice(0, CONTENT_COLLAPSE_LENGTH)
    : displayContent.split("\n").slice(0, CONTENT_COLLAPSE_LINES).join("\n")

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm">
        {truncated}
        <span className="text-muted-foreground">...</span>
      </p>
      <button
        onClick={() => setExpanded(true)}
        className="mt-1 text-xs font-medium text-primary hover:underline"
      >
        Continue to read
      </button>
      <BountyLinkDetector content={content} />
    </div>
  )
}

export function CommunityPostCard({
  post,
  communityOwnerId,
  communityId,
}: CommunityPostCardProps) {
  const { data: session } = useSession()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [likeCount, setLikeCount] = useState(post._count.likes)
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const utils = api.useUtils()
  const { openWithPost } = useEditCommunityPostModalStore()
  const { setIsOpen: setShareModalOpen, setData: setShareData } = useShareModalStore()

  const isAuthor = session?.user?.id === post.author.id
  const isOwner = session?.user?.id === communityOwnerId

  const likePost = api.community.post.like.useMutation({
    onMutate: () => {
      setIsLiked((prev) => !prev)
      setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1))
    },
    onError: () => {
      setIsLiked((prev) => !prev)
      setLikeCount((prev) => (isLiked ? prev + 1 : prev - 1))
    },
  })

  const deletePost = api.community.post.delete.useMutation({
    onSuccess: () => {
      toast.success("Post deleted")
      void utils.community.post.getAll.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const createComment = api.community.comment.create.useMutation({
    onSuccess: () => {
      setCommentText("")
      void utils.community.comment.getAll.invalidate()
      void utils.community.post.getAll.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const {
    data: commentsData,
    isLoading: commentsLoading,
  } = api.community.comment.getAll.useQuery(
    { postId: post.id, limit: 10 },
    { enabled: showComments },
  )

  const deleteComment = api.community.comment.delete.useMutation({
    onSuccess: () => {
      toast.success("Comment deleted")
      void utils.community.comment.getAll.invalidate()
      void utils.community.post.getAll.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleEdit = () => {
    openWithPost({
      postId: post.id,
      content: post.content,
      commentsEnabled: post.commentsEnabled,
      medias: post.medias,
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.image ?? undefined} />
            <AvatarFallback>
              {post.author.name?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">
              {post.author.name ?? "Anonymous"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>

        {(isAuthor || isOwner) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => deletePost.mutate({ postId: post.id })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pb-2">
        <PostContent content={post.content} />
        {post.medias.length > 0 && <MediaGrid medias={post.medias} />}
      </CardContent>

      <CardFooter className="flex-col items-start gap-2 border-t p-2">
        <div className="flex w-full items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => likePost.mutate({ postId: post.id })}
            className={isLiked ? "text-red-500" : ""}
          >
            <Heart
              className="mr-1 h-4 w-4"
              fill={isLiked ? "currentColor" : "none"}
            />
            {likeCount}
          </Button>

          {post.commentsEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments((prev) => !prev)}
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              {post._count.comments}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShareData(`/community/${communityId}/post/${post.id}`)
              setShareModalOpen(true)
            }}
          >
            <Share2 className="mr-1 h-4 w-4" />
          </Button>
        </div>

        {/* Comments section */}
        {showComments && post.commentsEnabled && (
          <div className="w-full space-y-3 pt-2">
            {commentsLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              commentsData?.comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={comment.user.image ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {comment.user.name?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-lg bg-muted px-3 py-2">
                      <p className="text-xs font-medium">
                        {comment.user.name ?? "Anonymous"}
                      </p>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                    {(comment.user.id === session?.user?.id || isOwner) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          deleteComment.mutate({ commentId: comment.id })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Child comments */}
                  {comment.childComments?.map((child) => (
                    <div key={child.id} className="ml-9 flex items-start gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={child.user.image ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {child.user.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg bg-muted px-3 py-1.5">
                        <p className="text-xs font-medium">
                          {child.user.name ?? "Anonymous"}
                        </p>
                        <p className="text-xs">{child.content}</p>
                      </div>
                      {(child.user.id === session?.user?.id || isOwner) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            deleteComment.mutate({ commentId: child.id })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Comment input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!commentText.trim()) return
                createComment.mutate({
                  postId: post.id,
                  content: commentText,
                })
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="h-9 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!commentText.trim() || createComment.isLoading}
              >
                {createComment.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Post"
                )}
              </Button>
            </form>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
