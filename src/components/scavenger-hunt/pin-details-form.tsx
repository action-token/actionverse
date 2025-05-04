"use client"

import { useFormContext } from "react-hook-form"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"
import { Input } from "~/components/shadcn/ui/input"

import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Link, ImageIcon, UploadCloud, X } from "lucide-react"

import { UploadS3Button } from "../common/upload-button"
import toast from "react-hot-toast"
import { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { cn } from "~/lib/utils"
import { Button } from "../shadcn/ui/button"
import { useRef, useState } from "react"

export default function PinDetailsForm() {
    const { control, setValue } = useFormContext<ScavengerHuntFormValues>()
    const [preview, setPreview] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const handleRemove = () => {
        setValue("pinImageUrl", "")
        setPreview(null)
        if (inputRef.current) {
            inputRef.current.value = ""
        }
    }
    const [progress, setProgress] = useState(0)
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Pin Details</h2>
                <p className="text-sm text-muted-foreground">
                    Upload an image and provide a URL for the pins in your scavenger hunt.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <ImageIcon className="h-6 w-6 text-blue-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="pinImageUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pin Image*</FormLabel>
                                            <FormControl>
                                                <div className={cn("space-y-2")}>
                                                    {!preview ? (
                                                        <div
                                                            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 transition-colors hover:border-gray-400 cursor-pointer"
                                                            onClick={() => document.getElementById("pincoverimage")?.click()}
                                                        >

                                                            <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                                                            <p className="text-sm text-muted-foreground mb-1">Click to upload image</p>
                                                            <p className="text-xs text-muted-foreground mb-4">PNG, JPG, GIF up to 1GB</p>

                                                        </div>
                                                    ) : (
                                                        <div className="relative border rounded-lg overflow-hidden">
                                                            <img src={preview || "/placeholder.svg"} alt="Preview" className="w-full h-48 object-cover" />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                className="absolute top-2 right-2 rounded-full"
                                                                onClick={handleRemove}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <UploadS3Button
                                                        id="pincoverimage"
                                                        endpoint="imageUploader"
                                                        variant="hidden"
                                                        onUploadProgress={(progress => {
                                                            setIsUploading(true)
                                                            setProgress(progress)
                                                            if (progress === 100) {
                                                                setIsUploading(false)
                                                            }
                                                            setError(null)

                                                        }
                                                        )}

                                                        onClientUploadComplete={(res) => {
                                                            const data = res
                                                            if (data?.url) {
                                                                field.onChange(data.url)
                                                                setPreview(data.url)
                                                                setIsUploading(false)
                                                            }
                                                        }}
                                                        onUploadError={(error: Error) => {
                                                            toast.error(`ERROR! ${error.message}`)
                                                        }}
                                                    />
                                                    {error && <p className="text-sm text-red-500">{error}</p>}

                                                    {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                                                </div>

                                            </FormControl>
                                            <FormDescription>This image will be displayed on the pins.
                                                <br />
                                                <p>
                                                    {
                                                        progress > 0 && progress < 100 ? ` (${progress}%)` : ""
                                                    }
                                                </p>

                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Link className="h-6 w-6 text-indigo-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="pinUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://example.com" {...field} />
                                            </FormControl>

                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
