"use client"

import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"

import { useFormContext } from "react-hook-form"
import type { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { ImageIcon, UploadCloud, X } from "lucide-react"
import { Card, CardContent } from "../shadcn/ui/card"
import { cn } from "~/lib/utils"
import { useRef, useState } from "react"
import { UploadS3Button } from "../common/upload-button"
import { Button } from "../shadcn/ui/button"
import toast from "react-hot-toast"
import { MediaType } from "@prisma/client"

export default function BasicInfoForm() {
    const {
        control,
        setValue,
        getValues,
        watch,
        formState: { errors },
    } = useFormContext<ScavengerHuntFormValues>()
    const title = watch("title")

    const [preview, setPreview] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // const handleRemove = () => {
    //     setValue("pinImageUrl", "")
    //     setPreview(null)
    //     if (inputRef.current) {
    //         inputRef.current.value = ""
    //     }
    // }
    const [progress, setProgress] = useState(0)

    // Handle cover image upload
    const handleCoverImageUpload = (url: string) => {
        // Create a MediaInfo object with the uploaded URL
        const mediaInfo = {
            url: url,
            type: MediaType.IMAGE,
        }

        // Get current coverImageUrl array or initialize empty array
        const currentCoverImages = getValues("coverImageUrl") ?? []

        // Update the form with the new array including the new image
        setValue("coverImageUrl", [...currentCoverImages, mediaInfo])

        // Set preview for UI
        setPreview(url)
    }

    // Handle cover image removal
    const handleCoverImageRemove = () => {
        setValue("coverImageUrl", [])
        setPreview(null)
        if (inputRef.current) {
            inputRef.current.value = ""
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Enter the basic details of your scavenger hunt.</p>
            </div>

            <div className="space-y-4">
                <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title*</FormLabel>
                            <FormControl>
                                <Input placeholder="Scavenger Hunt Title" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description*</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe your scavenger hunt" className="min-h-[150px]" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="coverImageUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cover Image*</FormLabel>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-start space-x-4">
                                        <ImageIcon className="h-6 w-6 text-blue-500" />
                                        <div className="w-full space-y-1">
                                            <FormControl>
                                                <div className={cn("space-y-2")}>
                                                    {!preview ? (
                                                        <div
                                                            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 transition-colors hover:border-gray-400 cursor-pointer"
                                                            onClick={() => document.getElementById("coverimage")?.click()}
                                                        >
                                                            <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                                                            <p className="text-sm text-muted-foreground mb-1">Click to upload image</p>
                                                            <p className="text-xs text-muted-foreground mb-4">PNG, JPG, GIF up to 1GB</p>
                                                        </div>
                                                    ) : (
                                                        <div className="relative border rounded-lg overflow-hidden">
                                                            <img
                                                                src={preview ?? "/images/action/logo.png"}
                                                                alt="Preview"
                                                                className="w-full h-48 object-cover"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                className="absolute top-2 right-2 rounded-full"
                                                                onClick={handleCoverImageRemove}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <UploadS3Button
                                                        id="coverimage"
                                                        endpoint="imageUploader"
                                                        variant="hidden"
                                                        onUploadProgress={(progress) => {
                                                            setIsUploading(true)
                                                            setProgress(progress)
                                                            if (progress === 100) {
                                                                setIsUploading(false)
                                                            }
                                                            setError(null)
                                                        }}
                                                        onClientUploadComplete={(res) => {
                                                            const data = res
                                                            if (data?.url) {
                                                                handleCoverImageUpload(data.url)
                                                                setIsUploading(false)
                                                            }
                                                        }}
                                                        onUploadError={(error: Error) => {
                                                            toast.error(`ERROR! ${error.message}`)
                                                        }}
                                                    />
                                                    {error && <p className="text-sm text-red-500">{error}</p>}
                                                    {isUploading && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Uploading...{progress > 0 ? ` (${progress}%)` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormDescription>This image will be displayed as the bounty cover image</FormDescription>
                                            <FormMessage />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </FormItem>
                    )}
                />


            </div>
        </div>
    )
}
