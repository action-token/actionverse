"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Switch } from "~/components/shadcn/ui/switch"
import { ArrowLeft, Upload } from "lucide-react"
import { api } from "~/utils/api"
import { UploadS3Button } from "~/components/common/upload-button"
import toast from "react-hot-toast"

interface ImageBeamFormProps {
  onBack: () => void
}

export function ImageBeamForm({ onBack }: ImageBeamFormProps) {
  const router = useRouter()
  const [senderName, setSenderName] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [message, setMessage] = useState("")
  const [arEnabled, setArEnabled] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const createBeamMutation = api.beam.create.useMutation({
    onSuccess: (data) => {
      toast.success("Beam created successfully!")
      router.push(`/beam/${data.id}`)
    },
    onError: (error) => {
      toast.error(`Failed to create Beam: ${error.message}`)
    },
  })



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()


    createBeamMutation.mutate({
      type: "IMAGE",
      senderName,
      recipientName,
      message,
      contentUrl: imagePreview || "",
      arEnabled,
      isPublic,
    })
  }

  return (
    <div className="w-full  p-6 m-2">
      <Button variant="destructive" onClick={onBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <h1 className="mb-1 text-2xl font-bold text-foreground text-center">Create Image Beam</h1>
      <p className="mb-4 text-sm text-muted-foreground text-center">Upload an image and add your personal touch</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 ">
          {/* Left column: Beam Details (wider) */}
          <div className="flex flex-col gap-4">
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Beam Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sender" className="text-sm">
                      Your Name
                    </Label>
                    <Input
                      id="sender"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Who is this from?"
                      required
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="recipient" className="text-sm">
                      Recipient Name
                    </Label>
                    <Input
                      id="recipient"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Who is this for?"
                      required
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="message" className="text-sm">
                    Card Message (Optional)
                  </Label>
                  <Textarea
                    id="message"
                    className=" min-h-44"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ar-enabled" className="text-sm">
                      AR View
                    </Label>
                    <p className="text-xs text-muted-foreground">Enable augmented reality viewing</p>
                  </div>
                  <Switch id="ar-enabled" checked={arEnabled} onCheckedChange={setArEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is-public" className="text-sm">
                      Public Beam
                    </Label>
                    <p className="text-xs text-muted-foreground">Show in public gallery</p>
                  </div>
                  <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 ">

            {/* Upload Image - stacked under Settings */}
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Upload Image</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 h-[45vh] ">
                  {imagePreview ? (
                    <div className="relative h-full overflow-hidden rounded-lg border-2 border-border">
                      <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <label className="flex h-full  cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50">
                      <Upload className="mb-1 h-6 w-6 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Click to upload image</span>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => document.getElementById("fileInput")?.click()}
                        className="mt-2"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Image
                      </Button>
                    </label>
                  )}
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImagePreview(null)
                        setImageFile(null)
                      }}
                      className="w-full "
                    >
                      Change Image
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="flex-1 bg-transparent">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={createBeamMutation.isLoading} className="flex-1">
            {createBeamMutation.isLoading ? "Creating..." : "Create Beam"}
          </Button>
        </div>
        <UploadS3Button
          id='fileInput'
          className="hidden"
          endpoint="imageUploader"
          onClientUploadComplete={async (res) => {
            const data = res
            if (data?.url) {

              setImagePreview(data.url)
            }
            toast.success("Image uploaded successfully!")
          }
          }
          onUploadError={(error: Error) => {
            console.log("ERROR UPLOADING: ", error)
          }}
        />
      </form>
    </div>
  )
}
