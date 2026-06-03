"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import {
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  Copy,
  Trash2,
  ImageIcon,
  Video,
  FileText,
  Wand2,
  MoreHorizontal,
  Globe,
  Lock,
} from "lucide-react"
import Link from "next/link"
import { api } from "~/utils/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/shadcn/ui/alert-dialog"
import { cn } from "~/lib/utils"
import { ImageBeamForm } from "~/components/beam/create/image-beam-form"
import { VideoBeamForm } from "~/components/beam/create/video-beam-form"
import { CardBeamForm } from "~/components/beam/create/card-beam-form"
import { AIBeamForm } from "~/components/beam/create/ai-beam-form"
import { useRouter } from "next/router"
import toast from "react-hot-toast"

type BeamType = "IMAGE" | "VIDEO" | "CARD" | "AI" | null

export default function MyBeamsPage() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<BeamType>(null)
  const { data: beams, isLoading, refetch } = api.beam.getMyBeams.useQuery()
  const togglePublic = api.beam.togglePublic.useMutation({
    onSuccess: () => {
      toast.success("Beam visibility updated")
    },
    onError: (error) => {
      toast.error(`Error updating visibility: ${error.message}`)
    },
    onSettled: async () => {
      await refetch()
    },
  })
  const deleteBeamMutation = api.beam.delete.useMutation({
    onSuccess: () => {
      toast.success("Beam deleted successfully")
    },
    onError: (error) => {
      toast.error(`Error deleting beam: ${error.message}`)
    },
    onSettled: async () => {
      await refetch()
    },
  })

  const handleCopyLink = async (beamId: string) => {
    const url = `${window.location.origin}/beam/${beamId}`
    await navigator.clipboard.writeText(url)
    toast.success("Beam link copied to clipboard")
  }

  const handleDelete = (beamId: string) => {
    deleteBeamMutation.mutate({ id: beamId })
  }

  const handleSelectType = (type: BeamType) => {
    setSelectedType(type)
    // Update URL without reloading the page
    router.push(`/beam/create${type ? `?type=${type.toLowerCase()}` : ""}`, undefined, { shallow: true })
  }

  const handleBackToList = () => {
    setSelectedType(null)
    router.push("/beam/create", undefined, { shallow: true })
    refetch()
  }
  // Set selectedType based on URL query parameter
  useEffect(() => {
    if (router.isReady) {
      const type = router.query.type as string
      if (type && ["image", "video", "card", "ai"].includes(type.toLowerCase())) {
        setSelectedType(type.toUpperCase() as BeamType)
      } else {
        setSelectedType(null)
      }
    }
  }, [router.isReady, router.query.type])
  const getBeamIcon = (type: string) => {
    switch (type) {
      case "IMAGE":
        return ImageIcon
      case "VIDEO":
        return Video
      case "CARD":
        return FileText
      case "AI":
        return Wand2
      default:
        return ImageIcon
    }
  }

  const getBeamGradient = (type: string) => {
    switch (type) {
      case "IMAGE":
        return "from-rose-500 to-orange-500"
      case "VIDEO":
        return "from-blue-500 to-cyan-500"
      case "CARD":
        return "from-emerald-500 to-teal-500"
      case "AI":
        return "from-violet-500 to-purple-500"
      default:
        return "from-gray-500 to-gray-600"
    }
  }

  if (selectedType) {
    return (
      <>
        {selectedType === "IMAGE" && <ImageBeamForm onBack={handleBackToList} />}
        {selectedType === "VIDEO" && <VideoBeamForm onBack={handleBackToList} />}
        {selectedType === "CARD" && <CardBeamForm onBack={handleBackToList} />}
        {selectedType === "AI" && <AIBeamForm onBack={handleBackToList} />}
      </>
    )
  }

  if (isLoading) {
    return (

      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-foreground" />
          <p className="text-muted-foreground">Loading your Beams...</p>
        </div>
      </div>

    )
  }

  return (

    <div className=" space-y-8 animate-fade-in p-6 m-2">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Beams</h1>
        <p className="mt-1 text-muted-foreground">
          Create new beams or manage your {beams?.length ?? 0} existing Beams
        </p>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Create New Beam</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            className="group cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
            onClick={() => handleSelectType("IMAGE")}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white transition-all group-hover:scale-110">
                <ImageIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Image Beam</h3>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
            onClick={() => handleSelectType("VIDEO")}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white transition-all group-hover:scale-110">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Video Beam</h3>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
            onClick={() => handleSelectType("CARD")}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white transition-all group-hover:scale-110">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Card Beam</h3>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
            onClick={() => handleSelectType("AI")}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white transition-all group-hover:scale-110">
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">AI Art Beam</h3>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">All Beams</h2>
        {/* Beams Grid */}
        {!beams || beams.length === 0 ? (
          <Card className="glass">
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-foreground/5">
                <ImageIcon className="h-10 w-10 text-foreground/50" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">No Beams yet</h3>
              <p className="max-w-md text-muted-foreground">
                {"You haven't created any Beams yet. Use the shortcuts above to create your first Beam!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {beams.map((beam, index) => {
              const Icon = getBeamIcon(beam.type)
              const gradient = getBeamGradient(beam.type)

              return (
                <Card
                  key={beam.id}
                  className="group overflow-hidden transition-all duration-300 hover:shadow-xl animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {beam.type === "VIDEO" ? (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}
                        >
                          <Video className="h-7 w-7 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={beam.contentUrl ?? "/placeholder.svg?height=300&width=400&query=beam content"}
                        alt={`${beam.type} Beam`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}

                    {/* Badges */}
                    <div className="absolute right-3 top-3 flex gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "gap-1",
                          beam.isPublic ? "bg-emerald-500/20 text-emerald-500" : "bg-muted/80 backdrop-blur",
                        )}
                      >
                        {beam.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {beam.isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>

                    <div className="absolute left-3 top-3">
                      <Badge className={`gap-1 bg-gradient-to-r ${gradient} text-white border-0`}>
                        <Icon className="h-3 w-3" />
                        {beam.type}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground">
                        From <span className="font-medium text-foreground">{beam.senderName}</span> to{" "}
                        <span className="font-medium text-foreground">{beam.recipientName}</span>
                      </p>
                      {beam.message && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{beam.message}</p>
                      )}
                    </div>

                    <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {beam.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {beam.reactions.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        {beam.comments.length}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" asChild>
                        <Link href={`/beam/${beam.id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={deleteBeamMutation.isLoading || togglePublic.isLoading}>

                            <MoreHorizontal className="h-4 w-4" />


                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="animate-scale-in">
                          <DropdownMenuItem onClick={() => togglePublic.mutate({
                            id: beam.id,
                            isPublic: beam.isPublic,
                          })}>
                            <Copy className="mr-2 h-4 w-4" />
                            Mark as {beam.isPublic ? "Private" : "Public"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCopyLink(beam.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this Beam?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete your Beam and all
                                  associated reactions and comments.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(beam.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>

  )
}
