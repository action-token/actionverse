"use client"

import { useState, useRef } from "react"
import { useForm, type SubmitHandler, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { api } from "~/utils/api"
import { MediaType } from "@prisma/client"
import {
    FileAudio, FileVideo, ImageIcon, Music, Users2, Video,
    X, Sparkles, Play, Pause, Volume2, VolumeX, Check, Eye, Upload,
} from "lucide-react"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { Dialog, DialogContent, DialogTitle } from "~/components/shadcn/ui/dialog"
import toast from "react-hot-toast"
import { useRouter } from "next/router"
import { motion, AnimatePresence } from "framer-motion"
import CustomAvatar from "../common/custom-avatar"
import { MarkdownEditor } from "~/components/bounty/markdown-editor"
import { Markdown } from "~/components/bounty/markdown"
import { UploadS3Button } from "../common/upload-button"
import { useCreatePostModalStore } from "../store/create-post-modal-store"
import { cn } from "~/lib/utils"

export const MediaInfo = z.object({
    url: z.string(),
    type: z.nativeEnum(MediaType),
})
type MediaInfoType = z.TypeOf<typeof MediaInfo>

export const PostSchema = z.object({
    heading: z.string().min(1, { message: "Title is required" }),
    content: z.string().min(2, { message: "Content is required" }),
    subscription: z.string().optional(),
    medias: z.array(MediaInfo).optional(),
})

type FormStep = "content" | "media" | "preview"

const STEPS: { key: FormStep; label: string; description: string }[] = [
    { key: "content", label: "Write", description: "Title & content" },
    { key: "media",   label: "Media",   description: "Images & files" },
    { key: "preview", label: "Review",  description: "Preview & publish" },
]

const MEDIA_TYPES = [
    { type: MediaType.IMAGE, icon: ImageIcon, label: "Image",  endpoint: "imageUploader" },
    { type: MediaType.VIDEO, icon: Video,     label: "Video",  endpoint: "videoUploader" },
    { type: MediaType.MUSIC, icon: Music,     label: "Music",  endpoint: "musicUploader" },
] as const

export function CreatePostModal() {
    const { register, handleSubmit, reset, control, getValues, setValue, trigger, formState: { errors } } =
        useForm<z.infer<typeof PostSchema>>({
            resolver: zodResolver(PostSchema),
            mode: "onChange",
            defaultValues: { heading: "", content: "", subscription: "public" },
        })

    const watchedHeading = useWatch({ control, name: "heading" })
    const [media, setMedia]               = useState<MediaInfoType[]>([])
    const [editorContent, setEditorContent] = useState("")
    const [uploadingType, setUploadingType] = useState<MediaType | null>(null)
    const [currentStep, setCurrentStep]   = useState<FormStep>("content")
    const [previewMedia, setPreviewMedia] = useState<MediaInfoType | null>(null)
    const [isPlaying, setIsPlaying]       = useState(false)
    const [isMuted, setIsMuted]           = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)

    const audioRef = useRef<HTMLAudioElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const router   = useRouter()

    const { isOpen, setIsOpen } = useCreatePostModalStore()
    const creator = api.fan.creator.meCreator.useQuery()
    const tiers   = api.fan.member.getAllMembership.useQuery({})
    const createPostMutation = api.fan.post.create.useMutation({
        onSuccess: async (data) => {
            setShowConfetti(true)
            setTimeout(() => { handleClose(); router.push(`/organization/post/${data.id}`) }, 2200)
        },
    })

    const onSubmit: SubmitHandler<z.infer<typeof PostSchema>> = (data) => {
        data.medias = media
        createPostMutation.mutate(data)
    }

    function handleEditorChange(value: string) {
        setEditorContent(value)
        setValue("content", value, { shouldValidate: true })
    }

    const goNext = async () => {
        if (currentStep === "content") {
            const ok = await trigger(["heading", "content"])
            if (ok) setCurrentStep("media")
        } else if (currentStep === "media") {
            setCurrentStep("preview")
        }
    }
    const goBack = () => {
        if (currentStep === "media") setCurrentStep("content")
        else if (currentStep === "preview") setCurrentStep("media")
    }

    const handleClose = () => {
        setIsOpen(false)
        reset()
        setMedia([])
        setEditorContent("")
        setCurrentStep("content")
        setShowConfetti(false)
    }

    const openPreview  = (item: MediaInfoType) => { setPreviewMedia(item); setIsPlaying(false) }
    const closePreview = () => { setPreviewMedia(null); setIsPlaying(false); audioRef.current?.pause(); videoRef.current?.pause() }

    const togglePlay = () => {
        const el = previewMedia?.type === MediaType.MUSIC ? audioRef.current : videoRef.current
        if (!el) return
        isPlaying ? el.pause() : void el.play()
        setIsPlaying(!isPlaying)
    }
    const toggleMute = () => {
        if (audioRef.current) audioRef.current.muted = !isMuted
        if (videoRef.current) videoRef.current.muted = !isMuted
        setIsMuted(!isMuted)
    }

    const stepIndex = STEPS.findIndex((s) => s.key === currentStep)
    const canGoNext = !!watchedHeading && !!editorContent

    if (!creator.data) return null

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent
                    onInteractOutside={(e) => e.preventDefault()}
                    className="p-0 gap-0 sm:max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
                >
                    <DialogTitle className="sr-only">Create a new post</DialogTitle>

                    {/* ── Confetti ── */}
                    {showConfetti && (
                        <div className="fixed inset-0 z-50 pointer-events-none">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.p
                                    initial={{ scale: 0.6, opacity: 0 }}
                                    animate={{ scale: 1, opacity: [0, 1, 1, 0] }}
                                    transition={{ duration: 2.2 }}
                                    className="bg-background/90 backdrop-blur text-foreground font-semibold text-lg px-6 py-3 rounded-full shadow-xl flex items-center gap-2"
                                >
                                    <Sparkles className="h-5 w-5 text-primary" /> Post published!
                                </motion.p>
                            </div>
                            {Array.from({ length: 50 }).map((_, i) => (
                                <motion.span
                                    key={i}
                                    className="absolute block w-2 h-2 rounded-full"
                                    style={{ backgroundColor: ["#f43f5e","#8b5cf6","#3b82f6","#10b981","#f59e0b"][i % 5] }}
                                    initial={{ top: "50%", left: "50%", scale: 0, opacity: 1 }}
                                    animate={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, scale: [0, 1, 0], opacity: [1, 1, 0] }}
                                    transition={{ duration: 1.8 + Math.random() * 1.2, delay: Math.random() * 0.3 }}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <CustomAvatar className="h-10 w-10 ring-2 ring-primary/25 shrink-0" url={creator.data.profileUrl} />
                            <div>
                                <p className="font-semibold text-sm leading-none">{creator.data.name}</p>
                                <div className="mt-2">
                                    {tiers.isLoading ? (
                                        <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
                                    ) : tiers.data && (
                                        <Controller
                                            name="subscription"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <SelectTrigger className="h-7 rounded-full border border-border bg-muted px-3 text-xs font-medium shadow-none focus:ring-1 focus:ring-primary/30 gap-1.5 w-auto">
                                                        <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="public">Public</SelectItem>
                                                        {tiers.data.map((m) => (
                                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                                {m.name} · {m.price} {m.creator.pageAsset?.code ?? m.creator?.customPageAssetCodeIssuer?.split("-")[0]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Step pills */}
                        <div className="flex items-center gap-1.5">
                            {STEPS.map((step, idx) => {
                                const done    = idx < stepIndex
                                const current = idx === stepIndex
                                return (
                                    <button
                                        key={step.key}
                                        type="button"
                                        disabled={!done && !current}
                                        onClick={() => done && setCurrentStep(step.key)}
                                        className={cn(
                                            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all",
                                            current && "bg-primary text-primary-foreground",
                                            done && !current && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20",
                                            !current && !done && "bg-muted text-muted-foreground/50 cursor-default",
                                        )}
                                    >
                                        {done
                                            ? <Check className="h-3 w-3" />
                                            : <span className="text-[10px] font-bold">{idx + 1}</span>
                                        }
                                        {step.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto">
                            <AnimatePresence mode="wait">

                                {/* Step 1 – Write */}
                                {currentStep === "content" && (
                                    <motion.div
                                        key="write"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.18 }}
                                        className="p-6 space-y-5"
                                    >
                                        <div className="space-y-1.5">
                                            <Label htmlFor="heading" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</Label>
                                            <Input
                                                id="heading"
                                                placeholder="Give your post a title…"
                                                {...register("heading")}
                                                className={cn(
                                                    "h-10 text-sm",
                                                    errors.heading && "border-destructive focus-visible:ring-destructive/30",
                                                )}
                                            />
                                            {errors.heading && <p className="text-xs text-destructive">{errors.heading.message}</p>}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content</Label>
                                            <MarkdownEditor
                                                onChange={handleEditorChange}
                                                value={editorContent}
                                                placeholder="Write something for your fans…"
                                                minHeight={240}
                                            />
                                            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2 – Media */}
                                {currentStep === "media" && (
                                    <motion.div
                                        key="media"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.18 }}
                                        className="p-6 space-y-5"
                                    >
                                        {/* Grid */}
                                        {media.length > 0 ? (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                                <AnimatePresence>
                                                    {media.map((el, i) => (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0, scale: 0.85 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.85 }}
                                                            className="relative group aspect-square"
                                                            layout
                                                        >
                                                            <div
                                                                onClick={() => openPreview(el)}
                                                                className="h-full w-full rounded-xl overflow-hidden border border-border hover:border-primary/50 cursor-pointer transition-colors"
                                                            >
                                                                {el.type === MediaType.IMAGE ? (
                                                                    <div className="relative h-full w-full">
                                                                        <Image src={el.url} alt="" fill className="object-cover" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                                                            <Eye className="text-white opacity-0 group-hover:opacity-100 h-5 w-5" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-1.5">
                                                                        {el.type === MediaType.VIDEO
                                                                            ? <FileVideo className="h-7 w-7 text-muted-foreground" />
                                                                            : <FileAudio className="h-7 w-7 text-muted-foreground" />}
                                                                        <span className="text-[10px] text-muted-foreground font-medium">
                                                                            {el.type === MediaType.VIDEO ? "Video" : "Audio"}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setMedia(media.filter((_, j) => j !== i)) }}
                                                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-3 py-14 rounded-2xl border-2 border-dashed border-border bg-muted/20">
                                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                                    <Upload className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-medium">Add media to your post</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">Images, videos or music</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Upload buttons — clicking directly opens file picker */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {MEDIA_TYPES.map(({ type, icon: Icon, label, endpoint }) => (
                                                <div key={type}>
                                                    <button
                                                        type="button"
                                                        disabled={uploadingType === type}
                                                        onClick={() => document.getElementById(`media-upload-${type}`)?.click()}
                                                        className={cn(
                                                            "flex flex-col items-center gap-1.5 rounded-xl border py-4 text-xs font-medium transition-all w-full",
                                                            uploadingType === type
                                                                ? "border-primary bg-primary/5 text-primary"
                                                                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5",
                                                        )}
                                                    >
                                                        {uploadingType === type
                                                            ? <span className="h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin" />
                                                            : <Icon className="h-5 w-5" />
                                                        }
                                                        {uploadingType === type ? "Uploading…" : label}
                                                    </button>
                                                    <UploadS3Button
                                                        id={`media-upload-${type}`}
                                                        endpoint={endpoint}
                                                        variant="hidden"
                                                        showPreview={false}
                                                        onBeforeUploadBegin={(file) => {
                                                            setUploadingType(type)
                                                            return file
                                                        }}
                                                        onClientUploadComplete={(res) => {
                                                            if (res?.url) {
                                                                setMedia(prev => [...prev, { url: res.url, type }])
                                                                setUploadingType(null)
                                                                toast.success(`${label} uploaded!`)
                                                            }
                                                        }}
                                                        onUploadError={(e: Error) => {
                                                            setUploadingType(null)
                                                            toast.error(e.message)
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3 – Preview */}
                                {currentStep === "preview" && (
                                    <motion.div
                                        key="preview"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.18 }}
                                        className="p-6"
                                    >
                                        <div className="rounded-2xl border border-border overflow-hidden">
                                            {/* Post header */}
                                            <div className="flex items-center gap-3 p-4 border-b border-border">
                                                <CustomAvatar className="h-9 w-9" url={creator.data.profileUrl} />
                                                <div>
                                                    <p className="text-sm font-semibold leading-none">{creator.data.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {tiers.data?.find(t => t.id.toString() === getValues("subscription"))?.name ?? "Public"}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Post body */}
                                            <div className="p-4 space-y-3">
                                                <h2 className="text-lg font-bold leading-snug">{getValues("heading")}</h2>
                                                <Markdown content={editorContent} />
                                            </div>

                                            {/* Media grid */}
                                            {media.length > 0 && (
                                                <div className={cn("grid gap-0.5 border-t border-border", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                                                    {media.map((item, i) => (
                                                        <div
                                                            key={i}
                                                            className="relative aspect-video cursor-pointer group overflow-hidden"
                                                            onClick={() => openPreview(item)}
                                                        >
                                                            {item.type === MediaType.IMAGE ? (
                                                                <Image src={item.url} alt="" fill className="object-cover" />
                                                            ) : (
                                                                <div className="h-full w-full bg-muted flex items-center justify-center">
                                                                    {item.type === MediaType.VIDEO
                                                                        ? <FileVideo className="h-10 w-10 text-muted-foreground" />
                                                                        : <FileAudio className="h-10 w-10 text-muted-foreground" />}
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                                                <Eye className="text-white opacity-0 group-hover:opacity-100 h-6 w-6" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>

                        {/* ── Footer ── */}
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30 shrink-0">
                            <button
                                type="button"
                                onClick={currentStep === "content" ? handleClose : goBack}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                            >
                                {currentStep === "content" ? "Cancel" : "← Back"}
                            </button>

                            {currentStep !== "preview" ? (
                                <Button
                                    type="button"
                                    onClick={goNext}
                                    disabled={currentStep === "content" && !canGoNext}
                                    className="rounded-full px-6"
                                >
                                    Continue
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleSubmit(onSubmit)}
                                    disabled={createPostMutation.isLoading}
                                    className="rounded-full px-6 gap-2"
                                >
                                    {createPostMutation.isLoading ? (
                                        <><span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" /> Publishing…</>
                                    ) : (
                                        <><Sparkles className="h-4 w-4" /> Publish Post</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </form>
                </DialogContent>

                {/* ── Lightbox ── */}
                <Dialog open={!!previewMedia} onOpenChange={(open) => !open && closePreview()}>
                    <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-black/95 border-none text-white">
                        <DialogTitle className="sr-only">Media preview</DialogTitle>
                        <div className="relative">
                            {previewMedia?.type === MediaType.IMAGE && (
                                <div className="flex items-center justify-center p-6 h-[80vh] max-h-[600px]">
                                    <Image src={previewMedia.url} alt="" width={800} height={600} className="max-h-full max-w-full object-contain rounded-lg" />
                                </div>
                            )}
                            {previewMedia?.type === MediaType.VIDEO && (
                                <div className="flex flex-col items-center justify-center p-4 h-[80vh] max-h-[600px]">
                                    <video ref={videoRef} src={previewMedia.url} className="max-h-full max-w-full rounded-lg"
                                        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
                                    <div className="absolute bottom-6 flex gap-3">
                                        <Button variant="outline" size="icon" className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur" onClick={togglePlay}>
                                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                        </Button>
                                        <Button variant="outline" size="icon" className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur" onClick={toggleMute}>
                                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {previewMedia?.type === MediaType.MUSIC && (
                                <div className="flex flex-col items-center justify-center gap-8 p-10 h-[50vh]">
                                    <div className="h-40 w-40 rounded-full bg-gradient-to-br from-primary/80 to-primary/20 flex items-center justify-center shadow-2xl">
                                        <Music className="h-16 w-16 text-white" />
                                    </div>
                                    <audio ref={audioRef} src={previewMedia.url} className="hidden"
                                        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
                                    <div className="flex gap-3">
                                        <Button variant="outline" size="icon" className="h-12 w-12 bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur" onClick={togglePlay}>
                                            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-12 w-12 bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur" onClick={toggleMute}>
                                            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </Dialog>
        </>
    )
}
