"use client"

import { useState, useRef } from "react"
import { api } from "~/utils/api"
import { MediaType } from "@prisma/client"
import {
  ImageIcon,
  Video,
  Music,
  X,
  Loader2,
} from "lucide-react"
import Image from "next/image"
import axios from "axios"

import { Button } from "~/components/shadcn/ui/button"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Label } from "~/components/shadcn/ui/label"
import { Switch } from "~/components/shadcn/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import toast from "react-hot-toast"
import { useCommunityPostModalStore } from "../store/community-post-modal-store"
import { useSession } from "next-auth/react"
import { BountyLinksFromContent } from "../bounty/bounty-embed-card"

interface MediaItem {
  url: string
  type: MediaType
}

const computeSHA256 = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

interface MediaConfig {
  type: MediaType
  icon: typeof ImageIcon
  label: string
  accept: string
  endpoint: "imageUploader" | "videoUploader" | "musicUploader"
}

const mediaConfig: MediaConfig[] = [
  {
    type: MediaType.IMAGE,
    icon: ImageIcon,
    label: "Photo",
    accept: "image/*",
    endpoint: "imageUploader",
  },
  {
    type: MediaType.VIDEO,
    icon: Video,
    label: "Video",
    accept: "video/*",
    endpoint: "videoUploader",
  },
  {
    type: MediaType.MUSIC,
    icon: Music,
    label: "Audio",
    accept: "audio/*",
    endpoint: "musicUploader",
  },
]

export function CreateCommunityPostModal() {
  const { isOpen, setIsOpen, communityId } = useCommunityPostModalStore()
  const { data: session } = useSession()
  const [content, setContent] = useState("")
  const [medias, setMedias] = useState<MediaItem[]>([])
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingMediaType, setPendingMediaType] = useState<MediaConfig | null>(null)
  const utils = api.useUtils()

  const getSignedURL = api.s3.getSignedURL.useMutation()

  const createPost = api.community.post.create.useMutation({
    onSuccess: () => {
      toast.success("Post created!")
      void utils.community.post.getAll.invalidate()
      void utils.community.activity.getCommunityActivity.invalidate()
      handleClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleClose = () => {
    setIsOpen(false)
    setContent("")
    setMedias([])
    setCommentsEnabled(true)
    setUploading(false)
    setPendingMediaType(null)
  }

  const handleMediaClick = (config: MediaConfig) => {
    setPendingMediaType(config)
    if (fileInputRef.current) {
      fileInputRef.current.accept = config.accept
      fileInputRef.current.click()
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingMediaType) return

    setUploading(true)
    try {
      const checksum = await computeSHA256(file)
      const isOBJ = file.name.endsWith(".obj")
      const isGLB = file.name.endsWith(".glb")
      const fileType = isOBJ ? ".obj" : isGLB ? ".glb" : file.type

      const signed = await getSignedURL.mutateAsync({
        fileSize: file.size,
        fileType,
        checksum,
        endPoint: pendingMediaType.endpoint,
        fileName: file.name,
      })

      await axios.put(signed.uploadUrl, file, {
        headers: { "Content-Type": file.type },
      })

      setMedias((prev) => [
        ...prev,
        { url: signed.fileUrl, type: pendingMediaType.type },
      ])
      toast.success("Uploaded!")
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
      setPendingMediaType(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = () => {
    if (!communityId || !content.trim()) return
    createPost.mutate({
      communityId,
      content,
      medias: medias.length > 0 ? medias : undefined,
      commentsEnabled,
    })
  }

  const removeMedia = (index: number) => {
    setMedias((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelected}
        />

        <div className="space-y-4">
          {/* Author preview */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback>
                {session?.user?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {session?.user?.name ?? "You"}
            </span>
          </div>

          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="resize-none rounded-lg border-0 bg-muted/50 text-sm focus-visible:ring-1"
          />

          {/* Bounty link preview — real-time */}
          <BountyLinksFromContent content={content} />

          {/* Media preview */}
          {medias.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {medias.map((media, index) => (
                <div
                  key={index}
                  className="relative aspect-square overflow-hidden rounded-lg"
                >
                  {media.type === MediaType.IMAGE ? (
                    <Image
                      src={media.url}
                      alt={`Media ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted">
                      {media.type === MediaType.VIDEO ? (
                        <Video className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Music className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload in progress */}
          {uploading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </div>
          )}

          {/* Media buttons + settings */}
          <div className="flex items-center justify-between rounded-lg border p-2">
            <div className="flex items-center gap-1">
              {mediaConfig.map(({ type, icon: Icon, label, ...rest }) => (
                <Button
                  key={type}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-3 text-xs"
                  onClick={() => handleMediaClick({ type, icon: Icon, label, ...rest })}
                  disabled={uploading}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Comments toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Allow comments
            </Label>
            <Switch
              checked={commentsEnabled}
              onCheckedChange={setCommentsEnabled}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || createPost.isLoading || uploading}
            className="w-full gap-2 rounded-full"
          >
            {createPost.isLoading && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
