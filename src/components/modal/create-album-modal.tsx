"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { type SubmitHandler, useForm } from "react-hook-form"
import { Music, PlusCircle, Upload, X } from "lucide-react"
import Image from "next/image"
import toast from "react-hot-toast"
import { z } from "zod"
import { api } from "~/utils/api"
import { UploadS3Button } from "../common/upload-button"
import { useCreateAlbumStore } from "../store/album-create-store"


export const AlbumCreateFormShema = z.object({
    name: z
        .string()
        .max(20, { message: "Album name must be between 3 to 20 characters" })
        .min(3, { message: "Album name must be between 3 to 20 characters" }),
    description: z.string(),
    coverImgUrl: z.string({
        required_error: "Cover image is required",
        message: "Cover image is required",
    }),
})

type AlbumFormType = z.TypeOf<typeof AlbumCreateFormShema>

const CreateAlbumModal = () => {
    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<AlbumFormType>()
    const { setIsOpen, isOpen } = useCreateAlbumStore()
    const [coverUrl, setCoverUrl] = useState<string>()
    const [isUploading, setIsUploading] = useState(false)

    const CreateAlbumMutation = api.fan.music.createAlbum.useMutation({
        onSuccess: () => {
            setIsOpen(false)
            toast.success("Album created successfully")
            handleOpenChange(false)
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const onSubmit: SubmitHandler<z.infer<typeof AlbumCreateFormShema>> = (data) => {
        console.log(data)
        if (data.coverImgUrl === undefined) {
            toast.error("Cover image is required")
            return
        }

        CreateAlbumMutation.mutate(data)
    }

    const handleOpenChange = (openState: boolean) => {
        if (!openState) {
            reset()
            setCoverUrl(undefined)
        }
        setIsOpen(openState)
    }

    const removeCoverImage = () => {
        setCoverUrl(undefined)
        setValue("coverImgUrl", "")
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>

            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-xl border-none shadow-2xl">

                <DialogHeader className=" p-4">
                    <DialogTitle className="text-2xl font-bold  flex items-center">
                        <Music className="mr-2 h-5 w-5" />
                        Create New Album
                    </DialogTitle>
                </DialogHeader>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className=""
                >
                    <form onSubmit={handleSubmit(onSubmit)} className="px-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Album Name
                                </Label>
                                <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                                    <Input
                                        {...register("name")}
                                        id="name"
                                        type="text"
                                        required
                                        placeholder="Enter album name"
                                        className="w-full rounded-lg border-gray-300  transition-all duration-200"
                                    />
                                </motion.div>
                                {errors.name && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-red-500 text-xs mt-1"
                                    >
                                        {errors.name.message}
                                    </motion.p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-sm font-medium ">
                                    Description
                                </Label>
                                <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                                    <Textarea
                                        {...register("description")}
                                        id="description"
                                        required
                                        placeholder="Describe your album"
                                        className="w-full rounded-lg   transition-all duration-200"
                                        rows={3}
                                    />
                                </motion.div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium ">Cover Image</Label>

                                <AnimatePresence>
                                    {!coverUrl ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col bg-primary items-center justify-center border-2 border-dashed rounded-lg p-6 transition-all "
                                        >
                                            <div className="relative w-full">
                                                <UploadS3Button
                                                    variant="button"
                                                    endpoint="imageUploader"
                                                    className="w-full"
                                                    onClientUploadComplete={(res) => {
                                                        const data = res
                                                        if (data?.url) {
                                                            setCoverUrl(data.url)
                                                            setValue("coverImgUrl", data.url)
                                                            setIsUploading(false)
                                                        }
                                                    }}

                                                    onUploadError={(error: Error) => {
                                                        toast.error(`ERROR! ${error.message}`)
                                                        setIsUploading(false)
                                                    }}

                                                />

                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="relative rounded-lg overflow-hidden shadow-md group"
                                        >
                                            <Image
                                                alt="Album cover preview"
                                                src={coverUrl || "/placeholder.svg"}
                                                width={400}
                                                height={400}
                                                className="w-full h-48 object-cover rounded-lg"
                                            />
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                type="button"
                                                onClick={removeCoverImage}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-80 hover:opacity-100 transition-all"
                                            >
                                                <X className="h-4 w-4" />
                                            </motion.button>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                                                <p className="text-white p-3 text-sm font-medium">Cover Image</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {errors.coverImgUrl && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-red-500 text-xs mt-1"
                                    >
                                        {errors.coverImgUrl.message}
                                    </motion.p>
                                )}
                            </div>
                        </div>
                    </form>


                </motion.div>
                <DialogFooter className="px-6 pb-6">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                        <Button
                            type="submit"
                            onClick={handleSubmit(onSubmit)}
                            disabled={CreateAlbumMutation.isLoading || isUploading}
                            className="w-full shadow-sm shadow-foreground  font-medium py-2 rounded-lg transition-all duration-300  disabled:opacity-70"
                        >
                            {CreateAlbumMutation.isLoading ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1, ease: "linear" }}
                                    className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                                />
                            ) : null}
                            {CreateAlbumMutation.isLoading ? "Creating Album..." :
                                <span className="flex items-center justify-center">
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Create Album
                                </span>
                            }
                        </Button>
                    </motion.div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default CreateAlbumModal

