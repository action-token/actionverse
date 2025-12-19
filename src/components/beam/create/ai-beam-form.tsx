"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Switch } from "~/components/shadcn/ui/switch"
import { ArrowLeft } from "lucide-react"
import { CreateButton } from "./create-button"
import toast from "react-hot-toast"

interface AIBeamFormProps {
  onBack: () => void
}

export function AIBeamForm({ onBack }: AIBeamFormProps) {
  const [senderName, setSenderName] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [message, setMessage] = useState("")
  const [prompt, setPrompt] = useState("")
  const [arEnabled, setArEnabled] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt to generate an image.")
      return
    }

    setIsGenerating(true)
    setGeneratedImageUrl(null)

    try {
      // Start generation
      const response = await fetch("/api/vibe-studio-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          numberOfImages: 1,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to start generation")
      }

      const data = await response.json() as { jobId: string }
      const jobId = data.jobId

      // Poll for status
      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/vibe-studio-ai/status/${jobId}`)
          if (!statusResponse.ok) {
            throw new Error("Failed to check status")
          }

          const statusData = await statusResponse.json() as {
            status: "pending" | "processing" | "completed" | "failed"
            message?: string
            result?: { items: { url: string }[] }
          }

          console.log("Job status:", statusData.status, statusData.message, statusData.result)
          console.log("Full status data:", statusData)

          if (statusData.status === "completed" && statusData.result?.items?.[0]?.url) {
            setGeneratedImageUrl(statusData.result.items[0].url)
            setIsGenerating(false)
            toast.success("Image generated!")
          } else if (statusData.status === "failed") {
            throw new Error(statusData.message ?? "Generation failed")
          } else {
            // Continue polling after 2 seconds
            setTimeout(() => pollStatus(), 2000)
          }
        } catch (error) {
          console.error("Status check error:", error)
          setIsGenerating(false)
          toast.error("Image generation failed. Please try again.")
        }
      }

      // Start polling immediately
      pollStatus().catch(console.error)

    } catch (error) {
      console.error("Generation error:", error)
      setIsGenerating(false)
      toast({
        title: "Generation failed",
        description: "Failed to start image generation. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="w-full  p-6 m-2">
      <Button variant="destructive" onClick={onBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <h1 className="mb-1 text-2xl font-bold text-foreground text-center">Create AI Art Beam</h1>
      <p className="mb-4 text-sm text-muted-foreground text-center">Generate unique artwork with AI</p>

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

            {/* AI Art Prompt */}
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-base">AI Art Prompt</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 h-[45vh] flex flex-col">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prompt" className="text-sm">
                        Describe Your Vision
                      </Label>
                      <div className="flex gap-2">
                        {generatedImageUrl && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setGeneratedImageUrl(null)}
                          >
                            Clear
                          </Button>
                        )}
                        <Button type="button" size="sm"
                          disabled={!prompt.trim() || isGenerating}
                          onClick={handleGenerate}
                        >
                          {isGenerating ? "Generating..." : generatedImageUrl ? "Regenerate" : "Generate"}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="A serene sunset over mountains with vibrant orange and purple hues..."
                      rows={6}
                      required
                      className="h-full resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Describe the image you want to generate. Be specific about colors, mood, and style.
                    </p>
                  </div>
                  {/* Preview */}
                  <div className="flex-1 relative overflow-hidden rounded-lg border-2 border-border bg-muted/30 flex items-center justify-center">
                    {isGenerating ? (
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Generating your AI art...</p>

                      </div>
                    ) : generatedImageUrl ? (
                      <img
                        src={generatedImageUrl}
                        alt="Generated AI art"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">AI-generated image will appear here</p>
                    )}
                  </div>
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
            type="AI"
            senderName={senderName}
            recipientName={recipientName}
            message={message}
            arEnabled={arEnabled}
            isPublic={isPublic}
            contentUrl={generatedImageUrl || ""}
            customPrompt={prompt}
          />
        </div>
      </form>
    </div>
  )
}
