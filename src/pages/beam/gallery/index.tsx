"use client"

import { useState } from "react"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import {
  Eye,
  Heart,
  MessageCircle,
  ImageIcon,
  Video,
  FileText,
  Wand2,
  Sparkles,
  Grid3X3,
  LayoutList,
  Search,
} from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { Input } from "~/components/shadcn/ui/input"
import { api } from "~/utils/api"
import { cn } from "~/lib/utils"

type BeamType = "IMAGE" | "VIDEO" | "CARD" | "AI"
type StyleCategory = "CHRISTMAS" | "EVERYDAY" | "BIRTHDAY"

export default function GalleryPage() {
  const [typeFilter, setTypeFilter] = useState<BeamType | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<StyleCategory | "ALL">("ALL")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const { data: beams, isLoading } = api.beam.getPublicBeams.useQuery({
    type: typeFilter === "ALL" ? undefined : typeFilter,
    styleCategory: categoryFilter === "ALL" ? undefined : categoryFilter,
  })

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

  if (isLoading) {
    return (

      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-foreground" />
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      </div>

    )
  }

  return (

    <div className="space-y-8 animate-fade-in p-6 m-2 ">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Public Gallery</h1>
          <p className="mt-1 text-muted-foreground">
            Explore {beams?.length ?? 0} creative Beams shared by the community
          </p>
        </div>
        <Button asChild>
          <Link href="/beam/create">
            <Sparkles className="mr-2 h-4 w-4" />
            Create Public Beam
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search beams..." className="pl-9" />
              </div>

              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as BeamType | "ALL")}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="IMAGE">Image</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="AI">AI Art</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as StyleCategory | "ALL")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="CHRISTMAS">Christmas</SelectItem>
                  <SelectItem value="EVERYDAY">Everyday</SelectItem>
                  <SelectItem value="BIRTHDAY">Birthday</SelectItem>
                </SelectContent>
              </Select>

              {(typeFilter !== "ALL" || categoryFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTypeFilter("ALL")
                    setCategoryFilter("ALL")
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gallery */}
      {!beams || beams.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-foreground/5">
              <Sparkles className="h-10 w-10 text-foreground/50" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">No public Beams yet</h3>
            <p className="mb-6 max-w-md text-muted-foreground">
              Be the first to share your creative Beam with the community!
            </p>
            <Button asChild>
              <Link href="/beam/create">Create a Public Beam</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            "grid gap-6",
            viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1",
          )}
        >
          {beams.map((beam, index) => {
            const Icon = getBeamIcon(beam.type)
            const gradient = getBeamGradient(beam.type)

            return (
              <Link
                key={beam.id}
                href={`/beam/${beam.id}`}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {beam.type === "VIDEO" ? (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}
                        >
                          <Video className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={beam.contentUrl ?? "https://app.action-tokens.com/images/logo.png"}
                        alt={`${beam.type} Beam`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                    {/* Type badge */}
                    <div className="absolute right-3 top-3">
                      <Badge className={`gap-1 bg-gradient-to-r ${gradient} text-white border-0`}>
                        <Icon className="h-3 w-3" />
                        {beam.type}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <p className="mb-3 text-sm">
                      By <span className="font-medium">{beam.user.name ?? "Anonymous"}</span>
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>

  )
}
