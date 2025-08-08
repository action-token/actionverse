"use client"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage"
import { ArrowLeft, Upload, FileText, Trophy, Users, DollarSign, Award, MapPin, Navigation, Target } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState("information")
  const [solution, setSolution] = useState("")
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  const [media, setMedia] = useState<SubmissionMediaInfoType[]>([])
  const [uploadFiles, setUploadFiles] = useState<FileItem[]>([])
  const queryClient = useQueryClient()
  const { data } = useBounty()
  const { item: bounty } = data

  // Add location hook
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

  // Check if user can participate based on bounty type
  const canParticipate = () => {
    if (bounty.bountyType === "LOCATION_BASED") {
      if (!location) return false
      if (bounty.latitude && bounty.longitude) {
        return isWithinRadius(
          location.latitude,
          location.longitude,
          bounty.latitude,
          bounty.longitude,
          bounty.radius ?? 500
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
        return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
      case "PENDING":
        return "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
      case "REJECTED":
        return "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25"
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-lg shadow-gray-500/25"
    }
  }

  return (
    <motion.div
      className="min-h-screen pb-32 "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header remains the same */}
      <motion.div
        className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white line-clamp-1">{bounty.title}</h1>
                <BountyTypeIndicator bountyType={bounty.bountyType} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Bounty Details</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
        {/* Hero Image with type-specific overlays */}
        <motion.div
          className="relative overflow-hidden rounded-3xl shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Image
            src={bounty.imageUrls[0] ?? "https://app.action-tokens.com/images/action/logo.png"}
            alt={bounty.title}
            width={800}
            height={400}
            className="h-64 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 flex items-center gap-3">
            <Badge className={`${getStatusColor(bounty.status)} border-0 px-4 py-2 text-sm font-semibold`}>
              {bounty.status}
            </Badge>
            {bounty.bountyType === "LOCATION_BASED" && (
              <div className="flex items-center space-x-2 bg-green-500/90 backdrop-blur-sm rounded-full px-4 py-2">
                <MapPin className="h-4 w-4 text-white" />
                <span className="text-sm text-white font-medium">Location Required</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Location Requirements Card for Location-based Bounties */}
        {bounty.bountyType === "LOCATION_BASED" && (
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Location Required</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      You must be within 500 meters of the bounty location to participate
                    </p>
                  </div>
                </div>
                <Button
                  onClick={requestLocation}
                  disabled={locationLoading}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {locationLoading ? "Getting Location..." : "Check Location"}
                </Button>
              </div>
              {location && bounty.latitude && bounty.longitude && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center space-x-2">
                    {canParticipate() ? (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          You are within range!
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-red-700 dark:text-red-400 font-medium">
                          You are too far from the bounty location
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scavenger Hunt Progress Card */}
        {bounty.bountyType === "SCAVENGER_HUNT" && bounty.isJoined && (
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-purple-500" />
                <span>Scavenger Hunt Progress</span>
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

        {/* Bounty Stats - same as before */}
        <div className="flex flex-col gap-6">
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Prize Pool</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">${bounty.priceInUSD.toFixed(2)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {bounty.priceInBand.toFixed(2)} {PLATFORM_ASSET.code}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Participants</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{bounty._count.participants}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Active participants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Winners</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {bounty.totalWinner - bounty.currentWinnerCount}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Spots remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Progress */}
        {uploadFiles.length > 0 && (
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Uploading Files</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadFiles.map((file, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {uploadProgress[file.name]?.toFixed(1) ?? 0}%
                    </span>
                  </div>
                  <Progress value={uploadProgress[file.name] ?? 0} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg p-1 rounded-2xl">
            <TabsTrigger
              value="information"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-slate-900 font-medium"
            >
              <FileText className="h-4 w-4 mr-2" /> Information
            </TabsTrigger>
            <TabsTrigger
              value="submission"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-slate-900 font-medium"
            >
              <Award className="h-4 w-4 mr-2" /> Submission
            </TabsTrigger>
          </TabsList>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <TabsContent value="information" className="space-y-6 mt-0">
                <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none dark:prose-invert">
                      <Preview value={bounty.description} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="submission" className="space-y-6 mt-0">
                {bounty.BountyWinner.length < bounty.totalWinner && !bounty.isOwner ? (
                  <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Submit Your Solution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Your Solution *
                        </label>
                        <Textarea
                          placeholder="Describe your solution in detail..."
                          value={solution}
                          onChange={(e) => setSolution(e.target.value)}
                          className="min-h-[120px] bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Attachments (Optional)
                        </label>
                        <Input
                          type="file"
                          multiple
                          onChange={handleFileChange}
                          className="bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                        />
                      </div>
                      <Button
                        onClick={handleSubmitSolution}
                        disabled={solution.length === 0 || createBountyAttachmentMutation.isLoading}
                        className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200"
                      >
                        {createBountyAttachmentMutation.isLoading ? "Submitting..." : "Submit Solution"}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-xl font-bold text-slate-900 dark:text-white">
                        <Trophy className="h-6 w-6 text-amber-500" />
                        <span>Winners</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bounty.BountyWinner.length > 0 ? (
                        <div className="space-y-3">
                          {bounty.BountyWinner.map((winner, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl"
                            >
                              <div className="p-2 rounded-full bg-green-500">
                                <Trophy className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-green-700 dark:text-green-400">{winner.user.id}</p>
                                <p className="text-sm text-green-600 dark:text-green-500">Winner #{index + 1}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Trophy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                          <p className="text-slate-600 dark:text-slate-400">No winners yet</p>
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
    </motion.div>
  )
}

export default SingleBountyItem
