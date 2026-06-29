"use client"
import { useRouter } from "next/router"
import { useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import {
    ArrowLeft, Heart, MessageCircle, Trophy, Crown,
    Package, Info, Users, Star, Sparkles, X, Scan, Music2
} from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "~/components/shadcn/ui/avatar"
import { Badge } from "~/components/shadcn/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Dialog, DialogContent, DialogTitle } from "~/components/shadcn/ui/dialog"
import Loading from "~/components/common/loading"
import { api } from "~/utils/api"
import ARPhotoFrame from "~/components/ar/ar-photo-frame"
import ARVideoFrame from "~/components/ar/ar-video-frame"
import ARAudioFrame from "~/components/ar/ar-audio-frame"
import { Markdown } from "~/components/bounty/markdown"

// ── Shared full-screen AR Dialog ───────────────────────────────────────────────
function ARDialog({
    open,
    onClose,
    children,
}: {
    open: boolean
    onClose: () => void
    children: React.ReactNode
}) {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent
                showCloseButton={false}
                //close button hiden
                className="p-0 m-0 w-full h-full max-w-none rounded-none "

                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogTitle className="sr-only">AR Viewer</DialogTitle>
                <button
                    onClick={onClose}
                    className="
            absolute top-4 right-4 z-[10000]
            w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-xl
            border border-white/20 flex items-center justify-center
            text-white hover:bg-black/90 transition-colors
          "
                    aria-label="Close AR viewer"
                >
                    <X className="w-4 h-4" />
                </button>
                {open && <div className="w-full h-full">{children}</div>}
            </DialogContent>
        </Dialog>
    )
}

// ── Open-in-AR button — video ─────────────────────────────────────────────────
function OpenInARVideoButton({ onClick }: { onClick: () => void }) {
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <button
                onClick={onClick}
                className="group relative w-full overflow-hidden rounded-3xl border border-border bg-card px-6 py-5 flex items-center justify-between hover:border-primary/40 transition-colors duration-200"
            >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Scan className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            Open in AR <Sparkles className="w-3.5 h-3.5 text-primary" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">View this video in augmented reality</p>
                    </div>
                </div>
                <Badge className="bg-primary/10 text-primary border border-primary/25 rounded-xl px-3 py-1 text-xs font-semibold shrink-0">AR</Badge>
            </button>
        </motion.div>
    )
}

// ── Open-in-AR button — audio ─────────────────────────────────────────────────
function OpenInARAudioButton({ onClick }: { onClick: () => void }) {
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <button
                onClick={onClick}
                className="group relative w-full overflow-hidden rounded-3xl border border-border bg-card px-6 py-5 flex items-center justify-between hover:border-violet-500/40 transition-colors duration-200"
            >
                {/* Shimmer */}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                {/* Ripple ring */}
                <span className="pointer-events-none absolute left-6 w-12 h-12 rounded-full border border-violet-500/20 group-hover:scale-150 group-hover:opacity-0 transition-all duration-700" />

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <Music2 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            Listen in AR <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Spinning vinyl with AR backdrop</p>
                    </div>
                </div>
                <Badge className="bg-violet-500/10 text-violet-400 border border-violet-500/25 rounded-xl px-3 py-1 text-xs font-semibold shrink-0">AR</Badge>
            </button>
        </motion.div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
const SingleCollectionPostItem = () => {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("overview")
    const [arVideoOpen, setArVideoOpen] = useState(false)
    const [arAudioOpen, setArAudioOpen] = useState(false)

    const { data: postData, isLoading: postDataLoading } =
        api.fan.post.getAConsumedPost.useQuery(
            Number(router.query.id),
            { enabled: !!router.query.id }
        )

    if (postDataLoading) return <Loading />

    if (!postData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="w-20 h-20 rounded-3xl bg-muted border border-border flex items-center justify-center mx-auto mb-6">
                        <Package className="w-9 h-9 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Not Found</h2>
                    <p className="text-muted-foreground mb-8 text-sm">This collection doesn{"'"}t exist or you don{"'"}t have access.</p>
                    <Button onClick={() => router.replace("/action/collections")} className="rounded-2xl px-8 font-semibold">Go Back</Button>
                </motion.div>
            </div>
        )
    }

    const videoMedia = postData?.medias.find((m) => m.type === "VIDEO")
    const imageMedia = postData?.medias.find((m) => m.type === "IMAGE")
    const audioMedia = postData?.medias.find((m) => m.type === "MUSIC")

    return (
        <div className="min-h-screen bg-background pb-32 text-foreground">

            {/* Sticky Header */}
            <motion.div
                className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            >
                <div className="px-5 py-4 flex items-center justify-between max-w-2xl mx-auto">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.replace("/action/collections")}
                            className="w-9 h-9 rounded-2xl bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <div>
                            <h1 className="text-sm font-semibold text-foreground line-clamp-1">{postData.heading}</h1>
                            <p className="text-xs text-muted-foreground">Your Collection</p>
                        </div>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 rounded-xl px-3 py-1 text-xs font-semibold gap-1.5">
                        <Trophy className="w-3 h-3" /> Collected
                    </Badge>
                </div>
            </motion.div>

            <div className="max-w-2xl mx-auto px-5 space-y-6 pt-6">

                {/* Hero Image */}
                <motion.div
                    className="relative overflow-hidden rounded-3xl aspect-[4/3]"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                >
                    <Image src={imageMedia?.url ?? "https://bandcoin.io/images/logo.png"} alt={postData.heading} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <div className="absolute bottom-5 left-5">
                        <div className="flex items-center gap-3 bg-background/80 backdrop-blur-xl border border-border rounded-2xl px-4 py-2.5">
                            <Avatar className="w-8 h-8 border border-border">
                                <AvatarImage src={postData.creator.profileUrl ?? ""} />
                                <AvatarFallback className="bg-muted text-foreground text-xs">{postData.creator.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-foreground text-sm font-semibold leading-none">{postData.creator.name}</p>
                                <p className="text-muted-foreground text-xs mt-0.5">Creator</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Title + Stats */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
                    <h2 className="text-2xl font-bold text-foreground">{postData.heading}</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <Heart className="w-4 h-4" /><span>{postData._count.likes}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <MessageCircle className="w-4 h-4" /><span>{postData._count.comments}</span>
                        </div>
                        {postData.subscription && (
                            <Badge className="bg-secondary/15 text-secondary border border-secondary/25 rounded-xl px-3 text-xs gap-1">
                                <Crown className="w-3 h-3" />{postData.subscription.name}
                            </Badge>
                        )}
                    </div>
                </motion.div>

                {/* Tabs */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full bg-muted border border-border rounded-2xl p-1 grid grid-cols-2">
                            <TabsTrigger value="overview" className="rounded-xl text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-sm font-medium">Overview</TabsTrigger>
                            <TabsTrigger value="details" className="rounded-xl text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-sm font-medium">Details</TabsTrigger>
                        </TabsList>

                        {/* Overview */}
                        <TabsContent value="overview" className="mt-5 space-y-4">
                            <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Info className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">About</span>
                                </div>
                                <div className="text-foreground/80 text-sm leading-relaxed">
                                    <Markdown content={postData.description ?? postData.content ?? ""} />
                                </div>
                            </div>

                            {videoMedia && <OpenInARVideoButton onClick={() => setArVideoOpen(true)} />}
                            {audioMedia && <OpenInARAudioButton onClick={() => setArAudioOpen(true)} />}
                            {imageMedia && <ARPhotoFrame imageUrl={imageMedia.url} />}
                        </TabsContent>

                        {/* Details */}
                        <TabsContent value="details" className="mt-5 space-y-4">
                            <div className="bg-card border border-border rounded-3xl p-5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Creator</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Avatar className="w-12 h-12 border border-border">
                                        <AvatarImage src={postData.creator.profileUrl ?? ""} />
                                        <AvatarFallback className="bg-muted text-foreground">{postData.creator.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-foreground">{postData.creator.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-[200px]">{postData.creator.id}</p>
                                    </div>
                                </div>
                            </div>

                            {postData.subscription && (
                                <div className="bg-card border border-border rounded-3xl p-5 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Crown className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscription</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-foreground">{postData.subscription.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{postData.subscription.description}</p>
                                        </div>
                                        <Badge className="bg-secondary/15 text-secondary border border-secondary/25 rounded-xl text-xs">${postData.subscription.price}</Badge>
                                    </div>
                                </div>
                            )}

                            {postData.creator.pageAsset && (
                                <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asset</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Code</span>
                                        <span className="text-sm font-mono text-foreground">{postData.creator.pageAsset.code}</span>
                                    </div>
                                    <div className="h-px bg-border" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Issuer</span>
                                        <span className="text-sm font-mono text-muted-foreground truncate max-w-[180px]">{postData.creator.pageAsset.issuer}</span>
                                    </div>
                                </div>
                            )}

                            <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted rounded-2xl p-3 text-center">
                                        <p className="text-2xl font-bold text-foreground">{postData._count.likes}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Likes</p>
                                    </div>
                                    <div className="bg-muted rounded-2xl p-3 text-center">
                                        <p className="text-2xl font-bold text-foreground">{postData._count.comments}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Comments</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </div>

            {/* AR Dialogs */}
            {videoMedia && (
                <ARDialog open={arVideoOpen} onClose={() => setArVideoOpen(false)}>
                    <ARVideoFrame videoUrl={videoMedia.url} aspectRatio={16 / 9} frame={{ style: "wood" }} />
                </ARDialog>
            )}

            {audioMedia && (
                <ARDialog open={arAudioOpen} onClose={() => setArAudioOpen(false)}>
                    <ARAudioFrame
                        audioUrl={audioMedia.url}
                        brandLogoUrl={"https://bandcoin.io/images/logo.png"}
                        brandName={postData.creator.name ?? "Artist"}
                        trackTitle={postData.heading}
                        accentColor="#a855f7"
                    />
                </ARDialog>
            )}
        </div>
    )
}

export default SingleCollectionPostItem