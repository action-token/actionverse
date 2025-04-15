"use client"

import {
    Copy,
    Edit3,
    Loader2,
    MapPin,
    Scissors,
    ShieldBan,
    ShieldCheck,
    Trash2,
    Calendar,
    LinkIcon,
    ImageIcon,
    Users,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Check,
} from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import React, { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { api } from "~/utils/api"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/router"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"
import { Input } from "~/components/shadcn/ui/input"

import type { ItemPrivacy } from "@prisma/client"
import { Label } from "~/components/shadcn/ui/label"
import { useCreatorStorageAcc } from "~/lib/state/wallete/stellar-balances"
import { BADWORDS } from "~/utils/banned-word"

import { motion, AnimatePresence } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Separator } from "~/components/shadcn/ui/separator"
import { type Pin, useCreatorMapModalStore } from "../store/creator-map-modal-store"
import { UploadS3Button } from "../common/upload-button"
import { useMapOptionsModalStore } from "../store/map-options-modal-store"

const MapOptionModal = () => {
    const {
        isOpen,
        setIsOpen: setIsMapOtionModal,
        data,
        isPinCut,
        isPinCopied,
        setIsPinCopied,
        isAutoCollect,
        setIsPinCut,
        isForm,
        setIsForm,
    } = useMapOptionsModalStore()
    const [isFormLocal, setIsFormLocal] = React.useState(false)
    const session = useSession()
    const router = useRouter()
    const [pinData, setPinData] = React.useState<Pin>()
    const [activeTab, setActiveTab] = useState<string>("details")

    const { setManual, setDuplicate, setPosition, setIsOpen: setIsMapModalOpen, setPrevData } = useCreatorMapModalStore()

    const handleClose = () => {
        setIsMapOtionModal(false)
        setIsMapModalOpen(false)
        setIsForm(false)
        setActiveTab("details")
    }

    const pinM = api.maps.pin.getPinM.useMutation({
        onSuccess: (data) => {
            setPrevData(data as Pin)
            handleDuplicatePin()
            toast.success("Pin duplicated successfully")
        },
    })

    const pinE = api.maps.pin.getPinM.useMutation({
        onSuccess: (data) => {
            setPinData(data as Pin)
            setIsForm(true) // Use the store's setIsForm
        },
    })

    const ToggleAutoCollectMutation = api.maps.pin.toggleAutoCollect.useMutation({
        onSuccess: () => {
            toast.success(`Auto collect ${data.autoCollect ? "disabled" : "enabled"} successfully`)
            handleClose()
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const handleToggleAutoCollect = async (pinId: string | undefined) => {
        if (pinId) {
            if (data.autoCollect) {
                ToggleAutoCollectMutation.mutate({
                    id: pinId,
                    isAutoCollect: false,
                })
            } else {
                ToggleAutoCollectMutation.mutate({
                    id: pinId,
                    isAutoCollect: true,
                })
            }
        } else {
            toast.error("Pin Id not found")
        }
    }

    const handleCopyPin = () => {
        if (data?.pinId) {
            navigator.clipboard.writeText(data.pinId)
            toast.success("Pin Id copied to clipboard")
            setIsPinCopied(true)
            setTimeout(() => {
                setIsPinCopied(false)
            }, 3000)
        } else {
            toast.error("Pin Id not found")
        }
    }

    const DeletePin = api.maps.pin.deletePin.useMutation({
        onSuccess: (data) => {
            if (data.item) {
                toast.success("Pin deleted successfully")
                handleClose()
            } else {
                toast.error("Pin not found or You are not authorized to delete this pin")
            }
        },
        onError: (error) => {
            toast.error(error.message)
            console.log(error)
        },
    })

    const handleDelete = () => {
        if (data?.pinId) {
            DeletePin.mutate({ id: data?.pinId })
        } else {
            toast.error("Pin Id not found")
        }
    }

    const handleCutPin = () => {
        if (data?.pinId) {
            toast.success("Pin Id copied to clipboard")
            setIsPinCut(true)
            setTimeout(() => {
                setIsPinCut(false)
            }, 3000)
        } else {
            toast.error("Pin Id not found")
        }
    }

    if (!session?.data?.user?.id) {
        return <div>Public Key not found</div>
    }

    function handleDuplicatePin(): void {
        handleClose()
        setManual(true)
        setDuplicate(true)
    }

    if (data)
        return (
            <>
                <AnimatePresence>
                    <Dialog open={isOpen} onOpenChange={handleClose}>
                        <DialogContent className="max-w-2xl p-0 overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.3 }}
                                className="flex flex-col h-full"
                            >
                                <DialogHeader className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4">
                                    <DialogTitle className="flex items-center gap-2 text-xl">
                                        <MapPin className="h-5 w-5 " />
                                        {isForm ? "Edit Pin" : data?.mapTitle ?? "Pin Details"}
                                    </DialogTitle>
                                </DialogHeader>

                                {isForm && data.pinId ? (
                                    <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                                        <PinInfoUpdate
                                            autoCollect={data.autoCollect}
                                            multiPin={data.multiPin}
                                            lat={data.lat}
                                            long={data.long}
                                            id={data.pinId}
                                            image={data.image}
                                            pageAsset={data.pageAsset}
                                            description={data.mapDescription ?? "Description"}
                                            title={data.mapTitle ?? "No Title"}
                                            startDate={data?.startDate}
                                            endDate={data?.endDate}
                                            collectionLimit={data?.pinCollectionLimit}
                                            remainingLimit={data?.pinRemainingLimit}
                                            pinNumber={data?.pinNumber}
                                            link={data.link}
                                            assetId={data.assetId}
                                            privacy={data.privacy}
                                            handleClose={handleClose}
                                            isLoading={pinE.isLoading}
                                        />
                                    </div>
                                ) : (
                                    <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                                        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                                <TabsTrigger
                                                    value="details"
                                                    className="data-[state=active]:bg-primary data-[state=active]:shadow-sm data-[state=active]:shadow-foreground"
                                                >
                                                    Pin Details
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="actions"
                                                    className="data-[state=active]:bg-primary data-[state=active]:shadow-sm data-[state=active]:shadow-foreground"
                                                >
                                                    Actions
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="details" className="mt-0">
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                                                    <PinInfo data={data} isLoading={pinE.isLoading || pinM.isLoading} />
                                                </motion.div>
                                            </TabsContent>

                                            <TabsContent value="actions" className="mt-0">
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="grid grid-cols-1 md:grid-cols-2 gap-2"
                                                >
                                                    <Button
                                                        variant="outline"
                                                        className="flex items-center gap-2 h-auto py-3 justify-start"
                                                        onClick={() => {
                                                            if (data.pinId) {
                                                                pinE.mutate(data.pinId)
                                                            }
                                                        }}
                                                        disabled={pinE.isLoading}
                                                    >
                                                        {pinE.isLoading ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 className="animate-spin h-5 w-5" />
                                                                <div className="text-left">
                                                                    <div className="font-medium">Loading...</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="bg-primary/10 p-2 rounded-full">
                                                                    <Edit3 size={18} className="" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Edit Pin</div>
                                                                    <div className="text-xs text-muted-foreground">Modify pin details</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        type="button"
                                                        className="flex items-center gap-2 h-auto py-3 justify-start"
                                                        onClick={() => {
                                                            data.pinId && pinM.mutate(data.pinId)
                                                        }}
                                                        disabled={pinM.isLoading}
                                                    >
                                                        {pinM.isLoading ? (
                                                            <Loader2 className="animate-spin h-5 w-5 " />
                                                        ) : (
                                                            <>
                                                                <div className="bg-primary/10 p-2 rounded-full">
                                                                    <Copy size={18} className="" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Duplicate Pin</div>
                                                                    <div className="text-xs text-muted-foreground">Create a copy of this pin</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        className="flex items-center gap-2 h-auto py-3 justify-start"
                                                        onClick={handleCopyPin}
                                                        disabled={isPinCopied}
                                                    >
                                                        {isPinCopied ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="bg-green-100 p-2 rounded-full">
                                                                    <Check size={18} className="text-green-600" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Copied!</div>
                                                                    <div className="text-xs text-muted-foreground">Pin ID copied to clipboard</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="bg-primary/10 p-2 rounded-full">
                                                                    <Copy size={18} className="" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Copy Pin ID</div>
                                                                    <div className="text-xs text-muted-foreground">Copy pin identifier</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        className="flex items-center gap-2 h-auto py-3 justify-start"
                                                        onClick={handleCutPin}
                                                        disabled={isPinCut}
                                                    >
                                                        {isPinCut ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="bg-green-100 p-2 rounded-full">
                                                                    <Check size={18} className="text-green-600" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Cut!</div>
                                                                    <div className="text-xs text-muted-foreground">Pin ready to move</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="bg-primary/10 p-2 rounded-full">
                                                                    <Scissors size={18} className="" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Cut Pin</div>
                                                                    <div className="text-xs text-muted-foreground">Move pin to new location</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        className="flex items-center gap-2 h-auto py-3 justify-start"
                                                        onClick={() => {
                                                            router.push(`/maps/pins/${data.pinId}`).finally(() => handleClose())
                                                        }}
                                                    >
                                                        <div className="bg-primary/10 p-2 rounded-full">
                                                            <Users size={18} className="" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-medium">Show Collectors</div>
                                                            <div className="text-xs text-muted-foreground">View who collected this pin</div>
                                                        </div>
                                                    </Button>

                                                    <Button
                                                        variant={isAutoCollect ? "destructive" : "outline"}
                                                        className="flex items-center gap-2 h-auto py-3 justify-start"
                                                        onClick={() => handleToggleAutoCollect(data.pinId)}
                                                        disabled={ToggleAutoCollectMutation.isLoading}
                                                    >
                                                        {ToggleAutoCollectMutation.isLoading ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 className="animate-spin h-5 w-5" />
                                                                <div className="text-left">
                                                                    <div className="font-medium">Updating...</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div
                                                                    className={`${data.autoCollect ? "bg-destructive/20" : "bg-primary/10"} p-2 rounded-full`}
                                                                >
                                                                    {isAutoCollect ? (
                                                                        <ShieldBan
                                                                            size={18}
                                                                            className={isAutoCollect ? "text-destructive-foreground" : ""}
                                                                        />
                                                                    ) : (
                                                                        <ShieldCheck size={18} className="" />
                                                                    )}
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">{data.autoCollect ? "Disable" : "Enable"} Auto Collect</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {data.autoCollect ? "Turn off" : "Turn on"} automatic collection
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="destructive"
                                                        className="flex items-center gap-2 h-auto py-3 justify-start col-span-1 md:col-span-2"
                                                        onClick={handleDelete}
                                                        disabled={DeletePin.isLoading}
                                                    >
                                                        {DeletePin.isLoading ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 className="animate-spin h-5 w-5 text-destructive-foreground" />
                                                                <div className="text-left">
                                                                    <div className="font-medium">Deleting...</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="bg-destructive/20 p-2 rounded-full">
                                                                    <Trash2 size={18} className="text-destructive-foreground" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="font-medium">Delete Pin</div>
                                                                    <div className="text-xs text-destructive-foreground/80">
                                                                        Permanently remove this pin
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>
                                                </motion.div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                )}
                            </motion.div>
                        </DialogContent>
                    </Dialog>
                </AnimatePresence>
            </>
        )

    return null
}

export default MapOptionModal

function PinInfo({
    data,
    isLoading = false,
}: {
    data: {
        mapDescription?: string | null
        long?: number
        lat?: number
        image?: string
        mapTitle?: string
        startDate?: Date
        endDate?: Date
        pinCollectionLimit?: number
        pinRemainingLimit?: number
        link?: string
        autoCollect?: boolean
        multiPin?: boolean
        pinNumber?: number
    }
    isLoading?: boolean
}) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="relative w-full h-48 overflow-hidden rounded-lg bg-gray-200 animate-pulse"></div>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2">
                        <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                        <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-4 w-full bg-gray-200 animate-pulse rounded mb-2"></div>
                        <div className="h-4 w-3/4 bg-gray-200 animate-pulse rounded"></div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                            <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                            <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                            <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {data.image && (
                <div className="relative w-full h-48 overflow-hidden rounded-lg">
                    <Image
                        src={data.image ?? "/placeholder.svg"}
                        alt={data.mapTitle ?? "Pin image"}
                        fill
                        className="object-cover"
                    />
                </div>
            )}

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Location</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <span className="text-muted-foreground">Latitude:</span>
                        <Badge variant="outline" className="ml-2 font-mono">
                            {data.lat?.toFixed(6)}
                        </Badge>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Longitude:</span>
                        <Badge variant="outline" className="ml-2 font-mono">
                            {data.long?.toFixed(6)}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {data.mapDescription && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{data.mapDescription}</p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="h-4 w-4 " />
                            Dates
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>
                            <span className="text-muted-foreground">Start:</span>{" "}
                            {data.startDate ? new Date(data.startDate).toLocaleDateString() : "Not set"}
                        </div>
                        <div>
                            <span className="text-muted-foreground">End:</span>{" "}
                            {data.endDate ? new Date(data.endDate).toLocaleDateString() : "Not set"}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-4 w-4 " />
                            Collection
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>
                            <span className="text-muted-foreground">Limit:</span> {data.pinCollectionLimit ?? "Unlimited"}
                        </div>
                        <div>
                            <span className="text-muted-foreground">Remaining:</span>{" "}
                            {data.pinRemainingLimit ?? "Unlimited"}
                        </div>
                        <div>
                            <span className="text-muted-foreground">Auto Collect:</span>{" "}
                            <Badge variant={data.autoCollect ? "default" : "outline"}>
                                {data.autoCollect ? "Enabled" : "Disabled"}
                            </Badge>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Multi Pin:</span>{" "}
                            <Badge variant={data.multiPin ? "default" : "outline"}>{data.multiPin ? "Enabled" : "Disabled"}</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {data.link && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 " />
                            Link
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <a
                            href={data.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm  flex items-center gap-1 hover:underline"
                        >
                            {data.link}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

type AssetType = {
    id: number
    code: string
    issuer: string
    thumbnail: string
}

const updateMapFormSchema = z.object({
    pinId: z.string(),
    lat: z
        .number({
            message: "Latitude is required",
        })
        .min(-180)
        .max(180),
    lng: z
        .number({
            message: "Longitude is required",
        })
        .min(-180)
        .max(180),
    description: z.string(),
    title: z
        .string()
        .min(3)
        .refine(
            (value) => {
                return !BADWORDS.some((word) => value.includes(word))
            },
            {
                message: "Input contains banned words.",
            },
        ),
    image: z.string().url().optional(),
    startDate: z.date().optional(),
    endDate: z
        .date()
        .min(new Date(new Date().setHours(0, 0, 0, 0)))
        .optional(),
    url: z.string().url().optional(),
    autoCollect: z.boolean(),
    pinRemainingLimit: z.number().optional(),
})

type FormData = z.infer<typeof updateMapFormSchema>

function PinInfoUpdate({
    image,
    description,
    title,
    id,
    startDate,
    endDate,
    collectionLimit,
    remainingLimit,
    multiPin,
    autoCollect,
    lat,
    long,
    pageAsset,
    pinNumber,
    link,
    assetId,
    privacy,
    handleClose,
    isLoading = false,
}: {
    image?: string
    title: string
    description: string
    id: string
    startDate?: Date
    endDate?: Date
    collectionLimit?: number
    remainingLimit?: number
    multiPin?: boolean
    autoCollect?: boolean
    lat?: number
    long?: number
    pageAsset?: boolean
    pinNumber?: number
    link?: string
    assetId?: number
    privacy?: ItemPrivacy
    handleClose: () => void
    isLoading?: boolean
}) {
    const [coverUrl, setCover] = React.useState("")
    const { setIsOpen, setIsForm, isPinCut, setIsPinCut, isOpen } = useMapOptionsModalStore()
    const utils = api.useUtils()
    const [isPageAsset, setIsPageAsset] = useState<boolean>()
    const [selectedToken, setSelectedToken] = useState<AssetType & { bal: number }>()
    const [activeStep, setActiveStep] = useState<string>("basic")

    const { getAssetBalance } = useCreatorStorageAcc()
    const [isInitialLoad, setIsInitialLoad] = useState(true)

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        register,
        setError,
        setValue,
    } = useForm({
        resolver: zodResolver(updateMapFormSchema),
        defaultValues: {
            title: title ?? "",
            description: description ?? "",
            startDate: startDate,
            endDate: endDate,
            image: image,
            autoCollect: autoCollect ?? false,
            pinId: id,
            lat: lat ?? 0,
            lng: long ?? 0,
            url: link ?? "",
            pinRemainingLimit: remainingLimit,
        },
    })

    const tiers = api.fan.member.getAllMembership.useQuery()
    const assets = api.fan.asset.myAssets.useQuery(undefined, {
        enabled: isOpen
    })

    const update = api.maps.pin.updatePin.useMutation({
        onSuccess: async (updatedData) => {
            await utils.maps.pin.getMyPins.refetch()
            toast.success("Pin updated successfully")
            setIsOpen(false)
            setIsForm(false)
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const onSubmit = (formData: FormData) => {
        formData.image = coverUrl || image
        update.mutate(formData)
    }

    // Format dates for input fields
    const formatDateForInput = (date: Date) => {
        return date.toISOString().split("T")[0]
    }

    // Add this function after the formatDateForInput function
    const handleBackToDetails = () => {
        // Don't call handleClose() as it closes the entire modal
        // Instead, just update the parent component's state
        setIsForm(false)
    }

    useEffect(() => {
        // Only load the media from the server on the first load
        if (image && isInitialLoad) {
            setCover(image)
            setIsInitialLoad(false) // After loading, mark initial load as done
        }
    }, [image, isInitialLoad])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-8 w-full bg-gray-200 animate-pulse rounded mb-4"></div>

                <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-10 w-full bg-gray-200 animate-pulse rounded"></div>
                </div>

                <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-24 w-full bg-gray-200 animate-pulse rounded"></div>
                </div>

                <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-10 w-full bg-gray-200 animate-pulse rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Tabs defaultValue="basic" value={activeStep} onValueChange={setActiveStep} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="basic" className="data-[state=active]:bg-primary/20">
                        Basic Info
                    </TabsTrigger>
                    <TabsTrigger value="location" className="data-[state=active]:bg-primary/20">
                        Location
                    </TabsTrigger>
                    <TabsTrigger value="collection" className="data-[state=active]:bg-primary/20">
                        Collection
                    </TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <TabsContent value="basic" className="mt-0">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                                    <span className="">Title</span>
                                </Label>
                                <Input id="title" {...register("title")} placeholder="Enter pin title" />
                                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-sm font-medium flex items-center gap-2">
                                    <span className="">Description</span>
                                </Label>
                                <Textarea
                                    id="description"
                                    {...register("description")}
                                    placeholder="Describe what this pin is about..."
                                    className="min-h-24"
                                />
                                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="url" className="text-sm font-medium flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4 " />
                                    <span>URL / Link</span>
                                </Label>
                                <Input id="url" {...register("url")} placeholder="https://example.com" />
                                {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 " />
                                    <span>Pin Cover Image</span>
                                </Label>
                                <div className="flex flex-col gap-2">
                                    <UploadS3Button
                                        endpoint="imageUploader"
                                        variant="button"
                                        className="w-full"
                                        label="Upload Cover Image"
                                        onClientUploadComplete={(res) => {
                                            if (res?.url) {
                                                setCover(res.url)
                                                setValue("image", res.url)
                                            }
                                        }}
                                        onUploadError={(error: Error) => {
                                            toast.error(`ERROR! ${error.message}`)
                                        }}
                                    />

                                    <AnimatePresence>
                                        {(coverUrl || image) &&
                                            (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="mt-2 rounded-lg border p-2"
                                                >
                                                    <Image
                                                        className="rounded  " width={120}

                                                        alt="preview image"
                                                        src={coverUrl ?? image ?? "/placeholder.svg"}
                                                    />
                                                </motion.div>
                                            )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="location" className="mt-0">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="lat" className="text-sm font-medium flex items-center gap-2">
                                        <MapPin className="h-4 w-4 " />
                                        <span>Latitude</span>
                                    </Label>
                                    <Input
                                        id="lat"
                                        type="number"
                                        step={0.0000000000000000001}
                                        {...register("lat", { valueAsNumber: true })}
                                    />
                                    {errors.lat && <p className="text-sm text-destructive">{errors.lat.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="lng" className="text-sm font-medium flex items-center gap-2">
                                        <MapPin className="h-4 w-4 " />
                                        <span>Longitude</span>
                                    </Label>
                                    <Input
                                        id="lng"
                                        type="number"
                                        step={0.0000000000000000001}
                                        {...register("lng", { valueAsNumber: true })}
                                    />
                                    {errors.lng && <p className="text-sm text-destructive">{errors.lng.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="startDate" className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4 " />
                                    <span>Start Date</span>
                                </Label>
                                <Controller
                                    name="startDate"
                                    control={control}
                                    render={({ field }) => (
                                        <Input
                                            type="date"
                                            id="startDate"
                                            value={field.value instanceof Date ? formatDateForInput(field.value) : ""}
                                            onChange={(e) => {
                                                field.onChange(e.target.value ? new Date(e.target.value) : null)
                                            }}
                                        />
                                    )}
                                />
                                {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endDate" className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4 " />
                                    <span>End Date</span>
                                </Label>
                                <Controller
                                    name="endDate"
                                    control={control}
                                    render={({ field }) => (
                                        <Input
                                            type="date"
                                            id="endDate"
                                            value={field.value instanceof Date ? formatDateForInput(field.value) : ""}
                                            onChange={(e) => {
                                                field.onChange(e.target.value ? new Date(e.target.value) : null)
                                            }}
                                        />
                                    )}
                                />
                                {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
                            </div>
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="collection" className="mt-0">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Collection Limits</CardTitle>
                                    <CardDescription>Original Limit: {collectionLimit ?? "Unlimited"}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <Label htmlFor="pinRemainingLimit" className="text-sm font-medium">
                                            Remaining Limit
                                        </Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            id="pinRemainingLimit"
                                            {...register("pinRemainingLimit", {
                                                valueAsNumber: true,
                                                min: 0,
                                                max: 2147483647,
                                            })}
                                            max={2147483647}
                                        />
                                        {errors.pinRemainingLimit && (
                                            <p className="text-sm text-destructive">{errors.pinRemainingLimit.message}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex items-center space-x-2 p-4 border rounded-lg">
                                <input
                                    type="checkbox"
                                    id="autoCollect"
                                    {...register("autoCollect")}
                                    className="h-4 w-4 rounded border-gray-300  focus:ring-primary"
                                />
                                <div>
                                    <Label htmlFor="autoCollect" className="text-sm font-medium">
                                        Auto Collect
                                    </Label>
                                    <p className="text-xs text-muted-foreground">Automatically collect when in range</p>
                                </div>
                            </div>
                        </motion.div>
                    </TabsContent>

                    <Separator className="my-6" />

                    <div className="flex items-center justify-between">
                        <Button type="button" variant="outline" onClick={handleBackToDetails} className="flex items-center gap-1">
                            <ChevronLeft className="h-4 w-4" />
                            Back to Details
                        </Button>

                        <div className="flex items-center gap-2">
                            {activeStep !== "basic" && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (activeStep === "location") setActiveStep("basic")
                                        if (activeStep === "collection") setActiveStep("location")
                                    }}
                                    className="flex items-center gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                            )}

                            {activeStep !== "collection" ? (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (activeStep === "basic") setActiveStep("location")
                                        if (activeStep === "location") setActiveStep("collection")
                                    }}
                                    className="flex items-center gap-1"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isSubmitting} className="flex items-center gap-1">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        "Update Pin"
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {update.isError && (
                        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-destructive">
                            <p>{update.failureReason?.message}</p>
                        </div>
                    )}
                </form>
            </Tabs>
        </div>
    )
}

