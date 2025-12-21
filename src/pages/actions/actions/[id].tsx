"use client"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/router"
import Image from "next/image"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage"
import {
  ArrowLeft,
  Upload,
  FileText,
  Trophy,
  Users,
  DollarSign,
  Award,
  MapPin,
  Navigation,
  Target,
  X,
  CheckCircle2,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Badge } from "~/components/shadcn/ui/badge"
import { Progress } from "~/components/shadcn/ui/progress"
import { useBounty } from "~/lib/state/augmented-reality/useBounty"
import type { Bounty } from "~/types/game/bounty"
import { z } from "zod"
import { storage } from "package/connect_wallet/src/lib/firebase/firebase-auth"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { UploadSubmission } from "~/lib/augmented-reality/upload-submission"
import { Preview } from "~/components/common/quill-preview"
import { motion, AnimatePresence } from "framer-motion"
import { BountyTypeIndicator } from "~/components/bounty/bounty-type-indicator"
import { ScavengerProgress } from "~/components/bounty/scavenger-progress"
import { useLocation } from "~/hooks/use-location"
import { isWithinRadius } from "~/utils/location"
import { api } from "~/utils/api"

type UploadProgress = Record<string, number>

export const SubmissionMediaInfo = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
})

type SubmissionMediaInfoType = z.TypeOf<typeof SubmissionMediaInfo>

export type FileItem = File | { name: string; size: number; type: string; downloadableURL?: string }

const SingleBountyItem = () => {
  const router = useRouter()
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("information")
  const [solution, setSolution] = useState("")
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  const [media, setMedia] = useState<SubmissionMediaInfoType[]>([])
  const [uploadFiles, setUploadFiles] = useState<FileItem[]>([])
  const queryClient = useQueryClient()

  const { data: bounty, isLoading: bountyLoading } = api.bounty.Bounty.getBountyByIDForApp.useQuery(
    {
      BountyId: Number(id),
    },
    {
      enabled: !!Number(id),
    },
  )
  const { location, loading: locationLoading, requestLocation } = useLocation()

  const addMediaItem = (url: string, name: string, size?: number, type?: string) => {
    if (size && type) {
      setMedia((prevMedia) => [...prevMedia, { url, name, size, type }])
    }
  }

  const createBountyAttachmentMutation = useMutation({
    mutationFn: async ({
      bountyId,
      content,
      media,
    }: {
      bountyId: string
      content: string
      media?: SubmissionMediaInfoType[]
    }) => {
      return await UploadSubmission({ bountyId, content, media })
    },
    onSuccess: async () => {
      toast.success("Solution submitted successfully")
      setMedia([])
      setSolution("")
      setUploadFiles([])
      setUploadProgress({})
      await queryClient.invalidateQueries({ queryKey: ["bounties"] })
    },
    onError: (error) => {
      console.error("Error following bounty:", error)
    },
  })

  if (!bounty) return null

  const canParticipate = () => {
    if (bounty.bountyType === "LOCATION_BASED") {
      if (!location) return false
      if (bounty.latitude && bounty.longitude) {
        return isWithinRadius(
          location.latitude,
          location.longitude,
          bounty.latitude,
          bounty.longitude,
          bounty.radius ?? 500,
        )
      }
    }
    return true
  }

  const handleSubmitSolution = () => {
    createBountyAttachmentMutation.mutate({
      content: solution,
      bountyId: bounty.id ?? "0",
      media: media,
    })
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const fileArray = Array.from(files)
      setUploadFiles((prevFiles) => [...prevFiles, ...fileArray])
      await uploadDocuments(fileArray)
    }
  }

  const uploadDocuments = async (files: File[]) => {
    try {
      for (const file of files) {
        const response = await fetch(URL.createObjectURL(file))
        const blob = await response.blob()
        const fileName = file.name
        if (uploadFiles.some((existingFile) => existingFile.name === fileName)) {
          return
        }
        const storageRef = ref(storage, `action/bounty/${bounty.id}/${fileName}/${new Date().getTime()}`)
        const uploadTask = uploadBytesResumable(storageRef, blob)
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            setUploadProgress((prevProgress) => ({
              ...prevProgress,
              [fileName]: progress,
            }))
          },
          (error) => {
            console.error("Upload error:", error)
          },
          () => {
            void getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
              setUploadFiles((prevFiles) => {
                return prevFiles.map((prevFile) =>
                  prevFile.name === fileName
                    ? {
                      name: fileName,
                      size: file.size,
                      type: file.type,
                      downloadableURL: downloadURL,
                    }
                    : prevFile,
                )
              })
              addMediaItem(downloadURL, file.name, file.size, file.type)
            })
          },
        )
      }
    } catch (error) {
      console.log("error", error)
    }
  }

  const getStatusColor = (status: Bounty["status"]) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-500 text-white"
      case "PENDING":
        return "bg-amber-500 text-white"
      case "REJECTED":
        return "bg-red-500 text-white"
      default:
        return "bg-slate-500 text-white"
    }
  }

  const removeFile = (fileName: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.name !== fileName))
    setMedia((prev) => prev.filter((m) => m.name !== fileName))
  }
  if (bounty)
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-3 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-9 w-9 p-0 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{bounty.title}</h1>
              </div>
              <BountyTypeIndicator bountyType={bounty.bountyType} />
            </div>
          </div>
        </div>

        <div className="px-4 py-6 max-w-4xl mx-auto space-y-6 pb-32">
          <motion.div
            className="relative overflow-hidden rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Image
              src={bounty.imageUrls[0] ?? "https://app.action-tokens.com/images/action/logo.png"}
              alt={bounty.title}
              width={800}
              height={320}
              className="h-52 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <Badge className={`${getStatusColor(bounty.status)} px-3 py-1 text-xs font-semibold shadow-lg`}>
                {bounty.status}
              </Badge>
              {bounty.bountyType === "LOCATION_BASED" && (
                <div className="flex items-center gap-1.5 bg-emerald-500 rounded-full px-3 py-1.5 shadow-lg">
                  <MapPin className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs text-white font-medium">Location Based</span>
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 mb-2">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Prize</p>

                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {bounty.priceInBand > 0 ? `${bounty.priceInBand} ${PLATFORM_ASSET.code}` : `${bounty.priceInUSD.toFixed(0)} USD`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-2">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Joined</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{bounty._count.participants}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">Participants</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 mb-2">
                    <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Spots</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {bounty.totalWinner - bounty.currentWinnerCount}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">left</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {bounty.bountyType === "LOCATION_BASED" && (
            <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-emerald-500 shrink-0">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Location Required</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Be within 500m to participate</p>
                  </div>
                </div>
                <Button
                  onClick={requestLocation}
                  disabled={locationLoading}
                  size="sm"
                  className="w-full h-9 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Navigation className="h-3.5 w-3.5 mr-2" />
                  {locationLoading ? "Checking..." : "Check My Location"}
                </Button>
                {location && bounty.latitude && bounty.longitude && (
                  <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      {canParticipate() ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                            You{"'"}re in range!
                          </span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-700 dark:text-red-400 font-medium">Too far away</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {bounty.bountyType === "SCAVENGER_HUNT" && (
            <Card className="border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span>Hunt Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScavengerProgress
                  currentStep={bounty.currentStep ?? 0}
                  totalSteps={bounty.ActionLocation?.length ?? 0}
                />
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg h-10">
              <TabsTrigger
                value="information"
                className="rounded-md text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Info
              </TabsTrigger>
              <TabsTrigger
                value="submission"
                className="rounded-md text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Award className="h-3.5 w-3.5 mr-1.5" />
                Submit
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <TabsContent value="information" className="mt-0">
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <Preview value={bounty.description ?? ""} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="submission" className="mt-0 space-y-4">
                  {bounty.BountyWinner.length < bounty.totalWinner && !bounty.isOwner ? (
                    <>
                      {uploadFiles.length > 0 && (
                        <Card className="border-slate-200 dark:border-slate-800">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Upload className="h-4 w-4" />
                              Uploading Files
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {uploadFiles.map((file, index) => (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate flex-1">
                                    {file.name}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                      {uploadProgress[file.name]?.toFixed(0) ?? 0}%
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFile(file.name)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <Progress value={uploadProgress[file.name] ?? 0} className="h-1.5" />
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <Card className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Submit Solution</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Your Solution
                            </label>
                            <Textarea
                              placeholder="Describe your solution..."
                              value={solution}
                              onChange={(e) => setSolution(e.target.value)}
                              className="min-h-[100px] text-sm resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Attachments (Optional)
                            </label>
                            <Input
                              type="file"
                              multiple
                              onChange={handleFileChange}
                              className="text-xs h-9 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                            />
                          </div>
                          <Button
                            onClick={handleSubmitSolution}
                            disabled={solution.length === 0 || createBountyAttachmentMutation.isLoading}
                            className="w-full h-10 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium text-sm"
                          >
                            {createBountyAttachmentMutation.isLoading ? "Submitting..." : "Submit Solution"}
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          Winners
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {bounty.BountyWinner.length > 0 ? (
                          <div className="space-y-2">
                            {bounty.BountyWinner.map((winner, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg"
                              >
                                <div className="p-1.5 rounded-lg bg-emerald-500">
                                  <Trophy className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                                    {winner.user.id}
                                  </p>
                                  <p className="text-xs text-emerald-600 dark:text-emerald-500">Winner #{index + 1}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <Trophy className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">No winners yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>
    )
}

export default SingleBountyItem
