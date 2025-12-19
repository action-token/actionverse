"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Switch } from "~/components/shadcn/ui/switch"
import { ArrowLeft, Upload } from "lucide-react"
import { UploadS3Button } from "~/components/common/upload-button"
import toast from "react-hot-toast"
import { CreateButton } from "./create-button"

interface VideoBeamFormProps {
  onBack: () => void
}

export function VideoBeamForm({ onBack }: VideoBeamFormProps) {
  const [senderName, setSenderName] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [message, setMessage] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [arEnabled, setArEnabled] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)

  return (
    <div className="w-full  p-6 m-2">
      <Button variant="destructive" onClick={onBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <h1 className="mb-1 text-2xl font-bold text-foreground text-center">Create Video Beam</h1>
      <p className="mb-4 text-sm text-muted-foreground text-center">Share a video message or celebration</p>

      <form className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 ">
          {/* Left column: Beam Details and Settings */}
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
                    Caption (Optional)
                  </Label>
                  <Textarea
                    id="message"
                    className=" min-h-44"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a caption to your video..."
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

            {/* Upload Video */}
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Upload Video</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 h-[45vh] ">
                  {videoPreview ? (
                    <div className="relative h-full overflow-hidden rounded-lg border-2 border-border">
                      <video src={videoPreview} controls className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <label className="flex h-full  cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50">
                      <Upload className="mb-1 h-6 w-6 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Click to upload video</span>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => document.getElementById("fileInput")?.click()}
                        className="mt-2"
                        disabled={isUploading}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {isUploading ? `Uploading... ${progress}%` : "Upload Video"}
                      </Button>
                    </label>
                  )}
                  {videoPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVideoPreview(null)
                        setVideoFile(null)
                      }}
                      className="w-full "
                      disabled={isUploading}
                    >
                      Change Video
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
          <CreateButton
            type="VIDEO"
            senderName={senderName}
            recipientName={recipientName}
            message={message}
            arEnabled={arEnabled}
            isPublic={isPublic}
            contentUrl={videoPreview || ""}
          />
        </div>
      </form>
      <UploadS3Button
        id='fileInput'
        className="hidden"
        endpoint="videoUploader"
        onUploadProgress={(progress) => {
          setProgress(progress)
          setIsUploading(true)
        }}
        onClientUploadComplete={async (res) => {
          const data = res
          if (data?.url) {
            setVideoPreview(data.url)
          }
          setIsUploading(false)
          setProgress(0)
          toast.success("Video uploaded successfully!")
        }}
        onUploadError={(error: Error) => {
          console.log("ERROR UPLOADING: ", error)
          setIsUploading(false)
          setProgress(0)
          toast.error("Upload failed!")
        }}
      />
    </div>
  )
}
