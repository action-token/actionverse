"use client"

import { Play, Upload, Music, Loader2, Trash2, AlertTriangle, Check } from "lucide-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardTitle } from "~/components/shadcn/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/shadcn/ui/dialog"
import { api } from "~/utils/api"
import { addrShort } from "~/utils/utils"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "~/components/shadcn/ui/use-toast"
import CreatorLayout from "~/components/layout/root/CreatorLayout"
import { useCreateSongModalStore } from "~/components/store/create-song-modal"
import { MarketAssetType } from "~/types/market/market-asset-type"
import { SongItemType } from "~/types/song/song-item-types"

export default function Album() {
    const params = useParams()
    const router = useRouter()
    const { setData, setIsOpen } = useCreateSongModalStore()
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [songToDelete, setSongToDelete] = useState<SongItemType | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteSuccess, setDeleteSuccess] = useState(false)

    const deleteSongMutation = api.music.song.deleteAsong.useMutation({
        onSuccess: () => {
            setIsDeleting(false)
            setDeleteSuccess(true)

            // Reset and close after showing success animation
            setTimeout(() => {
                setDeleteDialogOpen(false)
                setSongToDelete(null)
                setDeleteSuccess(false)
                refetch()

                toast({
                    title: "Song deleted",
                    description: "The song has been successfully removed from your album.",
                })
            }, 1500)
        },
        onError: (error) => {
            setIsDeleting(false)
            toast({
                title: "Error",
                description: error.message || "Failed to delete song. Please try again.",
                variant: "destructive",
            })
        },
    })

    const {
        data: album,
        isLoading,
        error,
        refetch,
    } = api.fan.music.getAlbum.useQuery(
        {
            id: Number(params?.id),
        },
        {
            enabled: !!Number(params?.id),
        },
    )

    const handleDeleteClick = (song: SongItemType) => {
        setSongToDelete(song)
        setDeleteDialogOpen(true)
    }

    const confirmDelete = () => {
        if (!songToDelete) return

        setIsDeleting(true)
        deleteSongMutation.mutate({
            songId: songToDelete.id,
        })
    }

    if (isLoading) {
        return <AlbumSkeleton />
    }
    if (error) {
        return <ErrorMessage message={error.message} />
    }

    return (
        <CreatorLayout>
            <div className="min-h-screen w-full overflow-hidden">
                {/* Album Header Section */}
                <div className="relative h-auto min-h-[400px] w-full overflow-hidden rounded-t-md">
                    <Image
                        src={album?.coverImgUrl ?? "/placeholder.svg"}
                        alt="Background"
                        fill
                        className="rounded-md object-cover transition-all duration-1000 ease-in-out hover:scale-105"
                        style={{ filter: "blur(15px)" }}
                    />
                    <div className="absolute inset-0 bg-black/50" />

                    {/* Content Container */}
                    <div className="relative z-10 flex h-full flex-col items-center p-4 md:flex-row md:items-center md:p-8">
                        {/* Album Art */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="relative mb-6 md:mb-0"
                        >
                            <div className="group h-[250px] w-[250px] overflow-hidden rounded-lg shadow-2xl md:h-[300px] md:w-[300px]">
                                <Image
                                    src={album?.coverImgUrl ?? "/placeholder.svg"}
                                    alt="Album Cover"
                                    height={300}
                                    width={300}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                        </motion.div>

                        {/* Album Info */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-center md:ml-8 md:text-left"
                        >
                            <h1 className="mb-4 text-4xl font-bold truncate text-white md:text-8xl">{album?.name}</h1>
                            <div className="space-y-2">
                                <p className="text-sm text-gray-200">{album.description}</p>
                            </div>

                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3, delay: 0.4 }}
                                className="mt-6"
                            >
                                <Button
                                    variant="accent"
                                    onClick={() => setIsOpen(true)}
                                    className="group px-6 py-2 rounded-full shadow-sm hover:shadow-xl transition-all duration-300"
                                >
                                    <Upload className="mr-2 h-5 w-5 transition-transform duration-300 group-hover:-translate-y-1" />
                                    Upload Song
                                </Button>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>

                {/* Album Details Section */}
                <div className="container mx-auto px-4 py-8">
                    <AnimatePresence>
                        {album?.songs.length === 0 && <EmptyAlbum coverImgUrl={album.coverImgUrl} albumId={album.id} />}
                    </AnimatePresence>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, staggerChildren: 0.1 }}
                        className="space-y-4"
                    >
                        {album?.songs.map((song, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                exit={{ opacity: 0, x: -100 }}
                                layout
                            >
                                <Card className="my-2 flex w-full flex-col items-start gap-4 p-2 md:flex-row md:items-center shadow-md hover:shadow-lg transition-all duration-300">
                                    <div className="group relative h-16 w-16 flex items-center justify-center bg-gray-700 rounded-lg overflow-hidden">
                                        <Image
                                            src={song.asset.thumbnail ?? "/placeholder.svg"}
                                            alt="Artist"
                                            width={300}
                                            height={300}
                                            className="h-16 w-16 object-cover transition-transform duration-300 group-hover:scale-110"
                                        />
                                    </div>
                                    <div className="flex w-full flex-col items-start gap-4 rounded-lg bg-primary p-4 md:flex-row md:items-center md:justify-between">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <h3 className="text-lg font-semibold">{song.asset.name}</h3>
                                                <p className="text-gray-400">
                                                    ARTIST: {song.asset.creatorId ? addrShort(song.asset.creatorId, 5) : "ADMIN"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex w-full items-center justify-between gap-4 md:w-auto md:gap-8">
                                            <Button
                                                variant="destructive"
                                                className="shadow-sm shadow-black px-6 py-2 gap-1 flex items-center justify-center group"
                                                onClick={() => handleDeleteClick(song)}
                                            >
                                                <Trash2 className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                                                <span>DELETE</span>
                                            </Button>
                                            <Button
                                                variant="accent"
                                                className="shadow-sm shadow-black px-6 py-2 gap-1 flex items-center justify-center group"
                                            >
                                                <Play className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                                                <span>PLAY</span>
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                {/* Delete Confirmation Dialog */}
                <Dialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                        if (!open && !isDeleting) {
                            setDeleteDialogOpen(false)
                            setSongToDelete(null)
                            setDeleteSuccess(false)
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
                        <AnimatePresence mode="wait">
                            {deleteSuccess ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center p-8 text-center"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 0.5, type: "spring" }}
                                        className="mb-6 rounded-full bg-green-100 p-6"
                                    >
                                        <Check className="h-16 w-16 text-green-500" />
                                    </motion.div>
                                    <h2 className="mb-2 text-2xl font-bold">Success!</h2>
                                    <p className="text-gray-500">The song has been successfully deleted.</p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="confirm"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="relative"
                                >
                                    {songToDelete && (
                                        <>
                                            <div className="relative h-40 w-full overflow-hidden">
                                                <Image
                                                    src={songToDelete.asset.thumbnail ?? "/placeholder.svg"}
                                                    alt="Song thumbnail"
                                                    fill
                                                    className="object-cover brightness-50"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
                                                <div className="absolute bottom-0 left-0 p-6">
                                                    <h2 className="text-2xl font-bold text-white">{songToDelete.asset.name}</h2>
                                                    <p className="text-sm text-gray-300">
                                                        {songToDelete.asset.creatorId ? addrShort(songToDelete.asset.creatorId, 5) : "ADMIN"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-6">
                                                <DialogHeader className="mb-4">
                                                    <DialogTitle className="flex items-center text-xl">
                                                        <AlertTriangle className="mr-2 h-6 w-6 text-amber-500" />
                                                        Confirm Deletion
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        Are you sure you want to delete this song? This action cannot be undone.
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                                                    <p className="font-medium">Warning:</p>
                                                    <ul className="ml-4 mt-2 list-disc">
                                                        <li>This will permanently remove the song from your album</li>
                                                        <li>Any users who purchased this song will still have access</li>
                                                        <li>The song asset will remain on the blockchain</li>
                                                    </ul>
                                                </div>

                                                <div className="flex justify-end gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => {
                                                            setDeleteDialogOpen(false)
                                                            setSongToDelete(null)
                                                        }}
                                                        disabled={isDeleting}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        onClick={confirmDelete}
                                                        disabled={isDeleting}
                                                        className="relative overflow-hidden"
                                                    >
                                                        {isDeleting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Deleting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete Song
                                                            </>
                                                        )}
                                                        {isDeleting && (
                                                            <motion.div
                                                                className="absolute bottom-0 left-0 h-1 bg-white/30"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: "100%" }}
                                                                transition={{ duration: 2 }}
                                                            />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </DialogContent>
                </Dialog>
            </div>
        </CreatorLayout>
    )
}

export const AlbumSkeleton = () => {
    return (
        <div className="min-h-screen w-full">
            {/* Album Header Section */}
            <div className="relative h-[400px] w-full overflow-hidden">
                {/* Background Skeleton */}
                <div className="absolute inset-0 bg-gray-800 animate-pulse" />

                {/* Content Container */}
                <div className="relative z-10 flex h-full items-center p-8">
                    {/* Album Art Skeleton */}
                    <div className="relative">
                        <div className="h-[300px] w-[300px] rounded-lg bg-gray-700 animate-pulse shadow-2xl" />
                    </div>

                    {/* Album Info Skeleton */}
                    <div className="ml-8 space-y-4">
                        <div className="h-20 w-96 bg-gray-700 animate-pulse rounded" />
                        <div className="space-y-2">
                            <div className="h-8 w-64 bg-gray-700 animate-pulse rounded" />
                        </div>
                        <div className="h-10 w-40 bg-gray-700 animate-pulse rounded-full mt-6" />
                    </div>
                </div>
            </div>

            {/* Song List Skeleton */}
            <div className="container mx-auto px-4 py-8">
                {Array.from({ length: 5 }, (_, index: number) => (
                    <Card key={index} className="my-2 flex w-full items-center gap-4 p-2">
                        <div className="h-16 w-16 bg-gray-700 animate-pulse rounded" />
                        <div className="flex w-full items-center justify-between rounded-lg bg-primary p-4">
                            <div className="flex items-center gap-4">
                                <div className="space-y-2">
                                    <div className="h-6 w-48 bg-gray-700 animate-pulse rounded" />
                                    <div className="h-4 w-32 bg-gray-700 animate-pulse rounded" />
                                </div>
                            </div>
                            <div className="h-10 w-24 bg-gray-700 animate-pulse rounded" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}

export const EmptyAlbum = ({
    coverImgUrl,
    albumId,
}: {
    coverImgUrl: string
    albumId: number
}) => {
    const { setData, setIsOpen } = useCreateSongModalStore()
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="container mx-auto px-4 py-8"
        >
            <Card className="w-full overflow-hidden border-none shadow-lg">
                <CardContent className="p-8">
                    <div className="flex flex-col items-center justify-center space-y-6 text-center">
                        <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="rounded-full bg-gray-100 p-4">
                            <div className="text-gray-400">
                                <Image
                                    src={coverImgUrl ?? "/placeholder.svg"}
                                    alt="Background"
                                    height={80}
                                    width={80}
                                    className="rounded-full h-20 w-20"
                                />
                            </div>
                        </motion.div>
                        <CardTitle className="text-2xl">No Songs Available</CardTitle>
                        <p className="text-gray-500 max-w-md">
                            This album doesn{"'"}t have any songs yet. Upload your first song to get started!
                        </p>

                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                                variant="accent"
                                onClick={() => {
                                    setData(albumId)
                                    setIsOpen(true)
                                }}
                                className="group shadow-secondary px-6 py-2 rounded-full shadow-sm hover:shadow-md transition-all duration-300"
                                size="lg"
                            >
                                <Upload className="mr-2 h-5 w-5" />
                                Upload Your First Song
                            </Button>
                        </motion.div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// Error Component
export const ErrorMessage = ({ message }: { message: string }) => {
    return (
        <div className="container mx-auto flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-100 to-indigo-100 px-4 py-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="w-full max-w-md overflow-hidden rounded-xl border-none shadow-xl">
                    <CardContent className="p-8 text-center">
                        <div className="mb-6 flex justify-center">
                            <div className="rounded-full bg-red-100 p-4">
                                <Music className="h-12 w-12 text-red-500" />
                            </div>
                        </div>
                        <h2 className="mb-4 text-2xl font-semibold text-red-600">Error</h2>
                        <p className="text-gray-600">{message}</p>
                        <Button className="mt-6 w-full" variant="outline" onClick={() => window.history.back()}>
                            Go Back
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}

