import clsx from "clsx";
import { format } from "date-fns";
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    Award,
    Calendar,
    CheckCircle,
    ChevronDown,
    Clock,
    Crown,
    DollarSign,
    Edit,
    Eye,
    File,
    FileIcon,
    FilePlus,
    FileText,
    FileX,
    ListChecks,
    Loader2,
    MapPin,
    MessageCircle,
    MessageSquare,
    MessageSquareIcon,
    Paperclip,
    Search,
    Send,
    Trash,
    Trophy,
    UserCheck,
    UserPlus,
    Users,
    XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AdvancedMarker, APIProvider, Map, Marker } from "@vis.gl/react-google-maps"
import { motion, AnimatePresence } from "framer-motion"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "~/components/shadcn/ui/avatar";
import { Badge } from "~/components/shadcn/ui/badge";
import { Button } from "~/components/shadcn/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select";
import { Separator } from "~/components/shadcn/ui/separator";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "~/components/shadcn/ui/tabs";

import useNeedSign from "~/lib/hook";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import {
    PLATFORM_ASSET,
    PLATFORM_FEE,
    TrxBaseFeeInPlatformAsset,
} from "~/lib/stellar/constant";

import { useSession } from "next-auth/react";

import { api } from "~/utils/api";

import { Bounty, BountySubmission, SubmissionViewType, UserRole } from "@prisma/client";
import { clientsign, WalletType } from "package/connect_wallet";
import { Input } from "~/components/shadcn/ui/input";

import { clientSelect } from "~/lib/stellar/fan/utils";
import { cn } from "~/lib/utils";
import { addrShort } from "~/utils/utils";
import Loading from "~/components/common/loading";
import { Alert } from "~/components/shadcn/ui/alert";
import CustomAvatar from "~/components/common/custom-avatar";
import Chat from "~/components/chat/chat";
import ViewBountyComment from "~/components/comment/View-Bounty-Comment";
import { AddBountyComment } from "~/components/comment/Add-Bounty-Comment";
import DOMPurify from "isomorphic-dompurify"
import { useEditBuyModalStore } from "~/components/store/edit-bounty-modal-store";
import { useBountySubmissionModalStore } from "~/components/store/bounty-submission-store";
import { useViewBountySubmissionModalStore } from "~/components/store/view-bounty-attachment-store";
import { Circle } from "~/components/common/circle";
import { Progress } from "~/components/shadcn/ui/progress";
type Message = {
    role: UserRole
    message: string
}
function SafeHTML({
    html,
}: {
    html: string
}) {
    return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
}
const SingleBountyPage = () => {
    const router = useRouter();
    const { id } = router.query;
    const { data: Owner } = api.bounty.Bounty.isOwnerOfBounty.useQuery({
        BountyId: Number(id),
    });

    return <div className="relative w-full  flex h-[calc(100vh-10.8vh)] flex-col gap-4 overflow-y-auto scrollbar-hide ">{Owner?.isOwner ? <AdminBountyPage /> : <UserBountyPage />}</div>;
};

export default SingleBountyPage;

const UserBountyPage = () => {
    const { setIsOpen, setData } = useBountySubmissionModalStore()
    const { setIsOpen: setAttachmentModal, setData: setAttachment } = useViewBountySubmissionModalStore()
    const session = useSession()
    const { needSign } = useNeedSign()
    const router = useRouter()
    const { id } = router.query
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [loading, setLoading] = useState<boolean>(false)
    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<Message[]>([])
    const messagesEndRef: MutableRefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null)

    const inputLength = input.trim().length
    const utils = api.useUtils()
    const { data, isLoading: bountyLoading } = api.bounty.Bounty.getBountyByID.useQuery(
        {
            BountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )

    const { data: submissionData } = api.bounty.Bounty.getBountyAttachmentByUserId.useQuery({
        BountyId: Number(id),
    })

    const bountyComment = api.bounty.Bounty.getBountyComments.useQuery(
        {
            bountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )

    const DeleteSubmissionMutation = api.bounty.Bounty.deleteBountySubmission.useMutation({
        onSuccess: async () => {
            toast.success("Submission Deleted")
            await utils.bounty.Bounty.getBountyAttachmentByUserId.refetch()
        },
    })
    const handleSubmissionDelete = (id: number) => {
        DeleteSubmissionMutation.mutate({
            submissionId: id,
        })
    }
    const { platformAssetBalance } = useUserStellarAcc()

    const joinBountyMutation = api.bounty.Bounty.joinBounty.useMutation({
        onSuccess: async (data) => {
            toast.success("Bounty Joined")
            await utils.bounty.Bounty.isAlreadyJoined.refetch()
            await router.push(`/bounty/${Number(id)}`)
        },
    })

    const handleJoinBounty = (id: number) => {
        joinBountyMutation.mutate({ BountyId: id })
    }

    const MakeSwapUpdateMutation = api.bounty.Bounty.makeSwapUpdate.useMutation({
        onSuccess: async (data) => {
            toast.success("Swap Successfull")

            await utils.bounty.Bounty.getBountyByID.refetch()
            setIsDialogOpen(false)
            setLoading(false)
        },
    })
    const swapAssetToUSDC = api.bounty.Bounty.swapAssetToUSDC.useMutation({
        onSuccess: async (data, variables) => {
            if (data) {
                setLoading(true)
                const clientResponse = await clientsign({
                    presignedxdr: data.xdr,
                    walletType: session.data?.user?.walletType,
                    pubkey: data.pubKey,
                    test: clientSelect(),
                })
                if (clientResponse) {
                    setLoading(true)
                    MakeSwapUpdateMutation.mutate({
                        bountyId: variables.bountyId,
                    })
                }
            }
        },
        onError: (error) => {
            setLoading(false)
            toast.error(error.message)
        },
    })

    const handleSwap = (id: number, priceInBand: number, priceInUSD: number) => {
        setLoading(true)

        swapAssetToUSDC.mutate({
            bountyId: id,
            priceInBand: priceInBand,
            priceInUSD: priceInUSD,
            signWith: needSign(),
        })
        setLoading(false)
    }

    const { data: Owner } = api.bounty.Bounty.isOwnerOfBounty.useQuery(
        {
            BountyId: Number(id) ?? 0,
        },
        {
            enabled: !!Number(id),
        },
    )

    const isAlreadyJoin = api.bounty.Bounty.isAlreadyJoined.useQuery(
        {
            BountyId: Number(id) ?? 0,
        },
        {
            enabled: !!Number(id),
        },
    )

    const getMotherTrustLine = api.bounty.Bounty.hasMotherTrustOnUSDC.useQuery()

    const { data: oldMessage, isSuccess: oldMessageSucess } = api.bounty.Bounty.getBountyForCreatorUser.useQuery(
        {
            bountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )

    const isLocationBasedBounty = (bounty: Bounty) => {
        console.log(bounty?.latitude, bounty?.longitude, bounty?.radius)
        return bounty?.latitude !== null && bounty?.longitude !== null && bounty?.radius !== null
    }
    const NewMessageMutation = api.bounty.Bounty.createUpdateBountyDoubtForUserCreator.useMutation()

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (input.length === 0) return

        try {
            // Create a new message (API Call)
            await NewMessageMutation.mutateAsync({
                bountyId: Number(id),
                content: input,
                role: UserRole.USER,
            })

            setMessages((prevMessages: Message[]) => [...prevMessages, { role: UserRole.USER, message: input }])
            setInput("")
        } catch (error) {
            console.error("Error sending message:", error)
        }
    }
    useEffect(() => {
        if (oldMessage && oldMessageSucess) {
            setMessages(oldMessage)
        }
    }, [oldMessage, oldMessageSucess])
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }

    // Call scrollToBottom on initial render and whenever new content is added
    useEffect(() => {
        scrollToBottom()
    }, [messages])

    if (bountyLoading || isAlreadyJoin.isLoading) return <Loading />

    if (data && isAlreadyJoin.data) {
        return (
            <div className="">
                {isAlreadyJoin.isLoading ? (
                    <div className="w-full h-64 animate-pulse rounded-xl"></div>
                ) : isAlreadyJoin.data.isJoined || Owner?.isOwner ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-6xl mx-auto"
                    >
                        <Card className="border-0 shadow-xl overflow-hidden ">
                            {/* Header Section with Image or Map */}
                            <div className="relative">
                                {isLocationBasedBounty(data) && data.latitude && data.longitude && data.radius ? (
                                    <div className="h-96 w-full overflow-hidden relative">
                                        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!}>
                                            <Map
                                                defaultCenter={{
                                                    lat: data.latitude,
                                                    lng: data.longitude,
                                                }}
                                                defaultZoom={16}
                                                mapId={"bf51eea910020fa25a"}
                                                fullscreenControl={false}
                                                streetViewControl={false}
                                                zoomControl={false}
                                                mapTypeControl={false}

                                                className="h-full w-full"
                                            >
                                                <Circle
                                                    center={{
                                                        lat: data.latitude,
                                                        lng: data.longitude,
                                                    }}
                                                    radius={data.radius}

                                                />
                                                <AdvancedMarker position={{
                                                    lat: data.latitude,
                                                    lng: data.longitude,
                                                }} >
                                                    <div className="p-2 bg-primary rounded-full">
                                                        <MapPin size={20} className="text-white" />
                                                    </div>
                                                </AdvancedMarker>
                                            </Map>
                                        </APIProvider>
                                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm dark:bg-black/70 py-2 px-4 rounded-full shadow-md">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={16} className="text-primary" />
                                                <p className="font-medium text-sm text-white">Location-based Bounty</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ scale: 1.05, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.7, ease: "easeOut" }}
                                        className="h-80 w-full"
                                    >
                                        <Image
                                            src={data?.imageUrls[0] ?? "/images/logo.png"}
                                            alt={data?.title}
                                            width={1200}
                                            height={600}
                                            className="h-80 w-full object-cover"
                                            priority
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                    </motion.div>
                                )}

                                {/* Title and Creator Info - Overlay on image */}
                                <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                                    <div className="bg-gradient-to-t from-black via-black/70 to-transparent absolute inset-0"></div>
                                    <div className="relative z-10 flex justify-between items-end">
                                        <motion.div
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ duration: 0.5, delay: 0.3 }}
                                            className="flex-1"
                                        >
                                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-lg">{data?.title}</h1>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <Badge variant="default" className="bg-primary/90 hover:bg-primary shadow-sm">
                                                    <Trophy className="mr-1 h-4 w-4" />
                                                    {data?.priceInUSD} USD
                                                </Badge>
                                                <Badge variant="secondary" className=" shadow-sm">
                                                    <Award className="mr-1 h-4 w-4" />
                                                    {data?.priceInBand.toFixed(3)} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="bg-black/40 backdrop-blur-sm text-white border-white/30 shadow-sm"
                                                >
                                                    <Users className="mr-1 h-4 w-4" />
                                                    {data?._count.participants} participants
                                                </Badge>
                                            </div>
                                        </motion.div>

                                        <motion.div
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ duration: 0.5, delay: 0.4 }}
                                            className="hidden md:flex items-center gap-3 bg-black/20 backdrop-blur-sm p-2 rounded-lg"
                                        >
                                            <CustomAvatar
                                                className="h-8 w-8"
                                                url={data?.creator.profileUrl}
                                            />
                                            <div className="flex items-center justify-center gap-2">
                                                <p className="text-white/90 text-sm">Created by</p>
                                                <Link
                                                    href={`/organization/${data?.creator.id}`}
                                                    className="text-white font-medium hover:text-primary transition-colors"
                                                >
                                                    {data?.creator.name}
                                                </Link>
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </div>

                            <CardContent className="px-6 pt-6 pb-2">
                                <Tabs defaultValue="details" className="w-full">
                                    <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                                        <TabsList className="bg-transparent p-0 h-auto space-x-6">
                                            {[
                                                { id: "details", label: "Details", icon: FileText },
                                                { id: "submissions", label: "Submissions", icon: File },
                                                { id: "doubt", label: "Chat", icon: MessageCircle },
                                                { id: "comments", label: "Comments", icon: MessageSquare },
                                            ].map((tab) => (
                                                <TabsTrigger
                                                    key={tab.id}
                                                    value={tab.id}

                                                    className="relative py-3 px-2 bg-transparent rounded-none data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <tab.icon size={18} />
                                                        <span>{tab.label}</span>
                                                    </div>
                                                    <motion.div
                                                        className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary rounded-full opacity-0 scale-x-0 group-data-[state=active]:opacity-100 group-data-[state=active]:scale-x-100 transition-all duration-200"
                                                        initial={{ opacity: 0, scaleX: 0 }}
                                                    />
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </div>

                                    <TabsContent value="details" className="mt-0 space-y-6">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4 }}
                                            className="prose prose-slate dark:prose-invert max-w-none"
                                        >
                                            <SafeHTML html={data.description} />
                                        </motion.div>
                                    </TabsContent>

                                    <TabsContent value="submissions" className="mt-0">
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Submissions</h2>
                                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                    <Button
                                                        onClick={() => {
                                                            setData({
                                                                bountyId: data.id,
                                                            })
                                                            setIsOpen(true)
                                                        }}
                                                        disabled={data.currentWinnerCount === data.totalWinner}
                                                        className="bg-primary hover:bg-primary/90"
                                                    >
                                                        <FilePlus className="mr-2 h-4 w-4" />
                                                        Submit Solution
                                                    </Button>
                                                </motion.div>
                                            </div>

                                            {submissionData?.length === 0 ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.4 }}
                                                    className="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
                                                >
                                                    <div className="text-slate-400 dark:text-slate-500 mb-4">
                                                        <FileX size={48} />
                                                    </div>
                                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                                                        No submissions yet
                                                    </h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                                                        Submit your solution to this bounty and increase your chances of winning the prize.
                                                    </p>
                                                </motion.div>
                                            ) : (
                                                <AnimatePresence>
                                                    <div className="space-y-4">
                                                        {submissionData?.map((submission, idx) => (
                                                            <motion.div
                                                                key={submission.id}
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.3, delay: idx * 0.1 }}
                                                                className="relative group"
                                                            >
                                                                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:shadow-md transition-all duration-200">
                                                                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-4">
                                                                                {submission.status === "UNCHECKED" ? (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                                                                    >
                                                                                        <Clock size={14} className="mr-1" /> Unchecked
                                                                                    </Badge>
                                                                                ) : submission.status === "CHECKED" ? (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                                                                                    >
                                                                                        <Eye size={14} className="mr-1" /> Checked
                                                                                    </Badge>
                                                                                ) : submission.status === "ONREVIEW" ? (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"
                                                                                    >
                                                                                        <Search size={14} className="mr-1" /> On Review
                                                                                    </Badge>
                                                                                ) : submission.status === "REJECTED" ? (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                                                                                    >
                                                                                        <XCircle size={14} className="mr-1" /> Rejected
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                                                                                    >
                                                                                        <CheckCircle size={14} className="mr-1" /> Accepted
                                                                                    </Badge>
                                                                                )}
                                                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                                    {format(new Date(submission.createdAt), "MMM dd, yyyy")}
                                                                                </p>
                                                                            </div>

                                                                            <div className="mb-4 max-h-24 overflow-hidden relative">
                                                                                {submission.content.length > 200 ? (
                                                                                    <>
                                                                                        <div className="prose prose-sm prose-slate dark:prose-invert">
                                                                                            <SafeHTML html={submission.content.substring(0, 200) + "..."} />
                                                                                        </div>
                                                                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-slate-800 to-transparent"></div>
                                                                                    </>
                                                                                ) : (
                                                                                    <div className="prose prose-sm prose-slate dark:prose-invert">
                                                                                        <SafeHTML html={submission.content} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-row md:flex-col gap-2 justify-end">
                                                                            <Button
                                                                                variant="outline"
                                                                                className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                                onClick={() => {
                                                                                    setAttachment(submission.medias)
                                                                                    setAttachmentModal(true)
                                                                                }}
                                                                            >
                                                                                <Paperclip size={16} className="mr-2" /> View Attachments
                                                                            </Button>

                                                                            <div className="flex gap-2">
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className="h-9 w-9 p-0"
                                                                                    onClick={() => {
                                                                                        setData({
                                                                                            submissionId: submission.id,
                                                                                            bountyId: data.id,
                                                                                        })
                                                                                        setIsOpen(true)
                                                                                    }}
                                                                                >
                                                                                    <Edit size={16} />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className="h-9 w-9 p-0 text-destructive border-destructive hover:bg-destructive/10"
                                                                                    disabled={data.BountyWinner.some(
                                                                                        (winner) => winner.user.id === session.data?.user.id,
                                                                                    )}
                                                                                    onClick={() => handleSubmissionDelete(submission.id)}
                                                                                >
                                                                                    <Trash size={16} />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {submission.content.length > 200 && (
                                                                        <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }} className="mt-2">
                                                                            <Button
                                                                                variant="ghost"
                                                                                className="text-sm h-8 px-2"
                                                                                onClick={() => setAttachment(submission.medias)}
                                                                            >
                                                                                Read More <ChevronDown size={14} className="ml-1" />
                                                                            </Button>
                                                                        </motion.div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="doubt" className="mt-0">
                                        <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
                                            <CardHeader className="flex flex-row items-center border-b border-slate-200 dark:border-slate-700 px-4 py-3">
                                                <div className="flex items-center space-x-4">
                                                    <Avatar>
                                                        <AvatarImage src={data.creator.profileUrl ?? ""} alt={data.creator.name} />
                                                        <AvatarFallback>{data.creator.name.slice(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium leading-none">{addrShort(data.creator.id)}</p>
                                                        <p className="text-sm text-muted-foreground">{data.creator.name}</p>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4">
                                                <div
                                                    ref={messagesEndRef}
                                                    className="max-h-[400px] min-h-[300px] space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 pr-2"
                                                >
                                                    <AnimatePresence>
                                                        {messages?.map((message, index) => (
                                                            <motion.div
                                                                key={index}
                                                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                                                className={cn(
                                                                    "flex w-full",
                                                                    message.role === UserRole.USER ? "justify-end" : "justify-start",
                                                                )}
                                                            >
                                                                <div
                                                                    className={cn(
                                                                        "max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                                                        message.role === UserRole.USER
                                                                            ? "bg-primary text-primary-foreground"
                                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100",
                                                                    )}
                                                                >
                                                                    <div className="break-words">{sanitizeInput(message.message).sanitizedInput}</div>

                                                                    {/* URL Previews */}
                                                                    {sanitizeInput(message.message).urls?.map((url, i) => (
                                                                        <motion.div
                                                                            key={i}
                                                                            whileHover={{ scale: 1.02 }}
                                                                            className={cn(
                                                                                "mt-2 rounded-md p-2 shadow-sm",
                                                                                message.role === UserRole.USER ? "bg-white/10" : "bg-white dark:bg-slate-700",
                                                                            )}
                                                                        >
                                                                            <Link
                                                                                href={url}
                                                                                className="flex items-center gap-2"
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                            >
                                                                                <FileIcon
                                                                                    className={cn(
                                                                                        "h-4 w-4",
                                                                                        message.role === UserRole.USER
                                                                                            ? "text-white"
                                                                                            : "text-slate-900 dark:text-white",
                                                                                    )}
                                                                                />
                                                                                <span
                                                                                    className={cn(
                                                                                        "text-sm font-medium",
                                                                                        message.role === UserRole.USER
                                                                                            ? "text-white"
                                                                                            : "text-slate-900 dark:text-white",
                                                                                    )}
                                                                                >
                                                                                    {shortURL(url)}
                                                                                </span>
                                                                            </Link>
                                                                        </motion.div>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </AnimatePresence>

                                                    {messages?.length === 0 && (
                                                        <div className="flex flex-col items-center justify-center h-[300px] text-center p-6">
                                                            <MessageCircle size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
                                                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                                                                No messages yet
                                                            </h3>
                                                            <p className="text-slate-500 dark:text-slate-400 max-w-md">
                                                                Start a conversation with the bounty creator to ask questions or clarify details.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                            <CardFooter className="p-4 border-t border-slate-200 dark:border-slate-700">
                                                <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
                                                    <Input
                                                        id="message"
                                                        placeholder="Type your message..."
                                                        className="flex-1 border-slate-200 dark:border-slate-700 focus:ring-primary"
                                                        autoComplete="off"
                                                        value={input}
                                                        onChange={(event) => setInput(event.target.value)}
                                                    />
                                                    <Button
                                                        type="submit"
                                                        size="icon"
                                                        className="bg-primary hover:bg-primary/90"
                                                        disabled={inputLength === 0 || NewMessageMutation.isLoading}
                                                    >
                                                        {NewMessageMutation.isLoading ? (
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                                            >
                                                                <Loader2 className="h-4 w-4" />
                                                            </motion.div>
                                                        ) : (
                                                            <Send className="h-4 w-4" />
                                                        )}
                                                        <span className="sr-only">Send</span>
                                                    </Button>
                                                </form>
                                                {NewMessageMutation.isError && (
                                                    <Alert className="mt-2" variant="destructive" content={NewMessageMutation.error.message} />
                                                )}
                                            </CardFooter>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="comments" className="mt-0">
                                        <div className="space-y-4">
                                            <AddBountyComment bountyId={Number(id)} />
                                            <div className="max-h-[650px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                                {bountyComment.data && bountyComment.data.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {bountyComment.data?.map((comment, idx) => (
                                                            <motion.div
                                                                key={comment.id}
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.3, delay: idx * 0.1 }}
                                                            >
                                                                <ViewBountyComment
                                                                    comment={comment}
                                                                    bountyChildComments={comment.bountyChildComments}
                                                                />
                                                                <Separator className="my-4" />
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-[300px] text-center p-6">
                                                        <MessageSquareIcon size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
                                                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No comments yet</h3>
                                                        <p className="text-slate-500 dark:text-slate-400 max-w-md">
                                                            Be the first to comment on this bounty.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>

                            {/* Card Footer with Actions */}
                            <CardFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
                                <div className="w-full sm:w-auto">
                                    {data.BountyWinner.some((winner) => winner.user.id === session.data?.user.id) && (
                                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md"
                                                    disabled={
                                                        loading ||
                                                        data.BountyWinner.some(
                                                            (winner) => winner.user.id === session.data?.user.id && winner?.isSwaped === true,
                                                        ) ||
                                                        swapAssetToUSDC.isLoading ||
                                                        MakeSwapUpdateMutation.isLoading
                                                    }
                                                >
                                                    <motion.div
                                                        className="flex items-center gap-2"
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                    >
                                                        <span>Swap</span>
                                                        <span>{PLATFORM_ASSET.code}</span>
                                                        <ArrowRight size={16} />
                                                        <span>USDC</span>
                                                    </motion.div>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle className="text-center text-xl">Swap Assets</DialogTitle>
                                                    <DialogDescription className="text-center">
                                                        Convert your bounty reward from {PLATFORM_ASSET.code} to USDC
                                                    </DialogDescription>
                                                </DialogHeader>

                                                {!getMotherTrustLine.data ? (
                                                    <Alert
                                                        className="flex items-center justify-center"
                                                        variant="destructive"
                                                        content="Please contact Admin at support@wadzzo.com"
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                            <div className="space-y-5">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="text-sm text-slate-500 dark:text-slate-400">You{"'ll"} swap</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                            <Trophy size={16} className="text-primary" />
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-semibold">
                                                                                {(data?.priceInBand / data.totalWinner).toFixed(3)}
                                                                            </div>
                                                                            <div className="text-xs text-slate-500">{PLATFORM_ASSET.code}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-center">
                                                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                                        <ArrowDown size={20} className="text-slate-500" />
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-between items-center">
                                                                    <div className="text-sm text-slate-500 dark:text-slate-400">You{"'ll"} receive</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                                                            <DollarSign size={16} className="text-green-500" />
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-semibold">
                                                                                {(data.priceInUSD / data.totalWinner).toFixed(2)}
                                                                            </div>
                                                                            <div className="text-xs text-slate-500">USDC</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center">
                                                                    <AlertTriangle size={12} className="mr-1" />
                                                                    This is a one-time operation and cannot be undone.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-4">
                                                            <Button
                                                                variant="outline"
                                                                className="flex-1 border-slate-200 dark:border-slate-700"
                                                                onClick={() => setIsDialogOpen(false)}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                disabled={
                                                                    loading ||
                                                                    data.BountyWinner.some(
                                                                        (winner) => winner.user.id === session.data?.user.id && winner?.isSwaped === true,
                                                                    ) ||
                                                                    swapAssetToUSDC.isLoading ||
                                                                    MakeSwapUpdateMutation.isLoading
                                                                }
                                                                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                                                                onClick={() =>
                                                                    handleSwap(
                                                                        data.id,
                                                                        data.priceInBand / data.totalWinner,
                                                                        data.priceInUSD / data.totalWinner,
                                                                    )
                                                                }
                                                            >
                                                                {loading || swapAssetToUSDC.isLoading || MakeSwapUpdateMutation.isLoading ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                        <span>Processing...</span>
                                                                    </div>
                                                                ) : (
                                                                    "Confirm Swap"
                                                                )}
                                                            </Button>
                                                        </DialogFooter>
                                                    </>
                                                )}
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>

                                <div className="w-full sm:w-auto flex justify-center">
                                    <div className="flex flex-wrap gap-3 justify-center">
                                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                            <Badge variant="outline" className="py-2 px-3 gap-1 border-slate-200 dark:border-slate-700">
                                                <Calendar className="h-4 w-4 text-slate-500" />
                                                <span>Created {format(new Date(data.createdAt), "MMM dd, yyyy")}</span>
                                            </Badge>
                                        </motion.div>
                                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                            <Badge variant="outline" className="py-2 px-3 gap-1 border-slate-200 dark:border-slate-700">
                                                <Trophy className="h-4 w-4 text-amber-500" />
                                                <span>
                                                    {data.currentWinnerCount}/{data.totalWinner} Winners
                                                </span>
                                            </Badge>
                                        </motion.div>
                                    </div>
                                </div>
                            </CardFooter>
                        </Card>
                    </motion.div>
                ) : data.requiredBalance > platformAssetBalance ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="max-w-lg mx-auto mt-10"
                    >
                        <Card className="border-red-200 dark:border-red-800 shadow-lg bg-white dark:bg-slate-900">
                            <CardHeader>
                                <div className="flex justify-center mb-2">
                                    <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <AlertTriangle size={32} className="text-red-500 dark:text-red-400" />
                                    </div>
                                </div>
                                <CardTitle className="text-center text-xl">Insufficient Balance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-slate-600 dark:text-slate-400 mb-4">
                                    To join this bounty, you need a minimum balance of:
                                </p>
                                <div className="flex justify-center mb-6">
                                    <Badge
                                        variant="outline"
                                        className="text-lg px-4 py-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                    >
                                        {data.requiredBalance} {PLATFORM_ASSET.code}
                                    </Badge>
                                </div>
                                <div className="flex justify-center">
                                    <Button
                                        variant="outline"
                                        className="border-slate-200 dark:border-slate-700"
                                        onClick={() => router.push("/wallet")}
                                    >
                                        Go to Wallet
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-lg mx-auto mt-10 px-4"
                    >
                        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-slate-900">
                            <div className="relative h-40">
                                <Image
                                    src={data?.imageUrls[0] ?? "/images/logo.png"}
                                    alt={data?.title}
                                    width={500}
                                    height={200}
                                    className="w-full h-40 object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h1 className="text-xl font-bold text-white mb-1 drop-shadow-md">{data?.title}</h1>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default" className="bg-primary/90 shadow-sm">
                                            <Trophy className="mr-1 h-3 w-3" />
                                            {data?.priceInUSD} USD
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            <CardContent className="p-6">
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold mb-2">Join this Bounty</h2>
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Gain access to this bounty and submit your solutions to win the prize.
                                    </p>
                                </div>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                                    <Button
                                        className="w-full bg-primary hover:bg-primary/90 h-12 text-base shadow-md"
                                        disabled={joinBountyMutation.isLoading || isAlreadyJoin.isLoading}
                                        onClick={() => handleJoinBounty(data.id)}
                                    >
                                        {joinBountyMutation.isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span>Joining...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <UserPlus className="h-5 w-5" />
                                                <span>Join Bounty</span>
                                            </div>
                                        )}
                                    </Button>
                                </motion.div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>
        )
    }
}


interface extendedBountySubmission extends BountySubmission {
    user: {
        id: string
        name?: string | null
        image?: string | null
    }
    userWinCount: number
}



const AdminBountyPage = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const { setIsOpen: setAttachmentModal, setData: setAttachment } = useViewBountySubmissionModalStore()
    const router = useRouter()
    const [loadingBountyId, setLoadingBountyId] = useState<number | null>(null)
    const { needSign } = useNeedSign()
    const [input, setInput] = useState("")
    const inputLength = input.trim().length
    const [messages, setMessages] = useState<Message[]>([])
    const [isDialogOpenWinner, setIsDialogOpenWinner] = useState(false)
    const { id } = router.query
    const { setData, setIsOpen } = useEditBuyModalStore()
    const [selectedSubmission, setSelectedSubmission] = useState<extendedBountySubmission | null>(null)

    const isLocationBasedBounty = (bounty: Bounty) => {
        console.log(bounty?.latitude, bounty?.longitude, bounty?.radius)
        return bounty?.latitude !== null && bounty?.longitude !== null && bounty?.radius !== null
    }
    const { data, isLoading: bountyLoading } = api.bounty.Bounty.getBountyByID.useQuery(
        {
            BountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )

    const DeleteMutation = api.bounty.Bounty.deleteBounty.useMutation({
        onSuccess: async (data, variables) => {
            setLoadingBountyId(variables.BountyId)
            await router.push("/organization/bounty")
            toast.success("Bounty Deleted")
            setLoadingBountyId(null)
        },
        onError: (error) => {
            toast.error(error.message)
            setLoadingBountyId(null)
        },
    })

    const { data: allSubmission, isLoading: allSubmissionLoading } = api.bounty.Bounty.getBountyAllSubmission.useQuery(
        {
            BountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )

    const bountyComment = api.bounty.Bounty.getBountyComments.useQuery(
        {
            bountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )

    const GetDeleteXDR = api.bounty.Bounty.getDeleteXdr.useMutation({
        onSuccess: async (data, variables) => {
            setLoadingBountyId(variables.bountyId)
            if (data) {
                const res = await submitSignedXDRToServer4User(data)
                if (res) {
                    DeleteMutation.mutate({
                        BountyId: GetDeleteXDR.variables?.bountyId ?? 0,
                    })
                }
            }
            setLoadingBountyId(null)
        },
        onError: (error) => {
            toast.error(error.message)
            setLoadingBountyId(null)
        },
    })

    const MakeWinnerMutation = api.bounty.Bounty.makeBountyWinner.useMutation({
        onSuccess: async (data, variables) => {
            setLoadingBountyId(variables.BountyId)
            toast.success("Winner Marked")
            setLoadingBountyId(null)
            setIsDialogOpenWinner(false)
        },
    })

    const GetSendBalanceToWinnerXdr = api.bounty.Bounty.getSendBalanceToWinnerXdr.useMutation({
        onSuccess: async (data, variables) => {
            setLoadingBountyId(variables.BountyId)
            if (data) {
                const res = await submitSignedXDRToServer4User(data)
                if (res) {
                    MakeWinnerMutation.mutate({
                        BountyId: variables?.BountyId,
                        userId: variables?.userId,
                    })
                }
            }
            setLoadingBountyId(null)
        },
        onError: (error) => {
            toast.error(error.message)
            setLoadingBountyId(null)
        },
    })

    const handleWinner = (bountyId: number, userId: string, prize: number) => {
        setLoadingBountyId(bountyId)
        console.log("handleWinner", bountyId, userId, prize)
        GetSendBalanceToWinnerXdr.mutate({
            BountyId: bountyId,
            userId: userId,
            prize: prize,
        })
        setLoadingBountyId(null)
    }

    const handleDelete = (id: number, prize: number) => {
        setLoadingBountyId(id)
        GetDeleteXDR.mutate({ prize: prize, bountyId: id })
        setLoadingBountyId(null)
    }

    const UpdateSubmissionStatusMutation = api.bounty.Bounty.updateBountySubmissionStatus.useMutation()

    const updateSubmissionStatus = (creatorId: string, submissionId: number, status: SubmissionViewType) => {
        UpdateSubmissionStatusMutation.mutate({
            creatorId: creatorId,
            submissionId: submissionId,
            status: status,
        })
    }
    const tabsConfig = [
        { id: "details", label: "Details", icon: Trophy },
        { id: "submissions", label: "Submissions", icon: Paperclip, count: data?._count.submissions },
        ...(data?.bountyType === "SCAVENGER_HUNT"
            ? [{ id: "participants", label: "Participants", icon: ListChecks, count: data._count.participants }]
            : []),
        { id: "doubt", label: "Chat", icon: MessageSquare },
        { id: "comments", label: "Comments", icon: MessageSquare, count: data?._count.comments },
    ]
    if (bountyLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Loading bounty details...</p>
                </div>
            </div>
        )
    }

    if (data)
        return (
            <div className="">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-6xl mx-auto"
                >
                    <Card className="border-0 shadow-xl overflow-hidden ">
                        <div className="relative">
                            {isLocationBasedBounty(data) && data.latitude && data.longitude && data.radius ? (
                                <div className="h-96 w-full overflow-hidden relative">
                                    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!}>
                                        <Map
                                            defaultCenter={{
                                                lat: data.latitude,
                                                lng: data.longitude,
                                            }}
                                            defaultZoom={16}
                                            mapId={"bf51eea910020fa25a"}
                                            fullscreenControl={false}
                                            streetViewControl={false}
                                            zoomControl={false}
                                            mapTypeControl={false}

                                            className="h-full w-full"
                                        >
                                            <Circle
                                                center={{
                                                    lat: data.latitude,
                                                    lng: data.longitude,
                                                }}
                                                radius={data.radius}

                                            />
                                            <AdvancedMarker position={{
                                                lat: data.latitude,
                                                lng: data.longitude,
                                            }} >
                                                <div className="p-2 bg-primary rounded-full">
                                                    <MapPin size={20} className="text-white" />
                                                </div>
                                            </AdvancedMarker>
                                        </Map>
                                    </APIProvider>
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm dark:bg-black/70 py-2 px-4 rounded-full shadow-md">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-primary" />
                                            <p className="font-medium text-sm text-white">Location-based Bounty</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ scale: 1.05, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.7, ease: "easeOut" }}
                                    className="h-80 w-full"
                                >
                                    <Image
                                        src={data?.imageUrls[0] ?? "/images/logo.png"}
                                        alt={data?.title}
                                        width={1200}
                                        height={600}
                                        className="h-80 w-full object-cover"
                                        priority
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                </motion.div>
                            )}

                            {/* Title and Creator Info - Overlay on image */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                                <div className="bg-gradient-to-t from-black via-black/70 to-transparent absolute inset-0"></div>
                                <div className="relative z-10 flex justify-between items-end">
                                    <motion.div
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.3 }}
                                        className="flex-1"
                                    >
                                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-lg">{data?.title}</h1>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <Badge variant="default" className="bg-primary/90 hover:bg-primary shadow-sm">
                                                <Trophy className="mr-1 h-4 w-4" />
                                                {data?.priceInUSD} USD
                                            </Badge>
                                            <Badge variant="secondary" className=" shadow-sm">
                                                <Award className="mr-1 h-4 w-4" />
                                                {data?.priceInBand.toFixed(3)} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className="bg-black/40 backdrop-blur-sm text-white border-white/30 shadow-sm"
                                            >
                                                <Users className="mr-1 h-4 w-4" />
                                                {data?._count.participants} participants
                                            </Badge>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.4 }}
                                        className="hidden md:flex items-center gap-3 bg-black/20 backdrop-blur-sm p-2 rounded-lg"
                                    >
                                        <CustomAvatar
                                            className="h-8 w-8"
                                            url={data?.creator.profileUrl}
                                        />
                                        <div className="flex items-center justify-center gap-2">
                                            <p className="text-white/90 text-sm">Created by</p>
                                            <Link
                                                href={`/organization/${data?.creator.id}`}
                                                className="text-white font-medium hover:text-primary transition-colors"
                                            >
                                                {data?.creator.name}
                                            </Link>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                        <CardContent className="px-6 pt-6 pb-2">
                            <Tabs defaultValue="details" className="w-full">
                                <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                                    <TabsList className="bg-transparent p-0 h-auto space-x-6">
                                        {tabsConfig.map((tab) => (
                                            <TabsTrigger
                                                key={tab.id}
                                                value={tab.id}
                                                className="relative py-3 px-2 bg-transparent rounded-none data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent group whitespace-nowrap"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <tab.icon size={18} />
                                                    <span>{tab.label}</span>
                                                    {tab.count !== undefined && (
                                                        <Badge variant="outline" className="ml-1 px-1.5 py-0.5 text-xs">
                                                            {tab.count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <motion.div
                                                    className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary rounded-full opacity-0 scale-x-0 group-data-[state=active]:opacity-100 group-data-[state=active]:scale-x-100 transition-all duration-200"
                                                    initial={{ opacity: 0, scaleX: 0 }}
                                                />
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </div>

                                <TabsContent value="details" className="mt-0 space-y-6">
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4 }}
                                        className="prose prose-slate dark:prose-invert max-w-none"
                                    >
                                        <SafeHTML html={data.description} />
                                    </motion.div>
                                </TabsContent>

                                <TabsContent value="submissions" className="mt-0">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                                Recent Submissions ({data?._count.submissions})
                                            </h2>
                                        </div>

                                        {allSubmission?.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
                                            >
                                                <div className="text-slate-400 dark:text-slate-500 mb-4">
                                                    <Paperclip size={48} />
                                                </div>
                                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No submissions yet</h3>
                                                <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                                                    There are no submissions for this bounty yet.
                                                </p>
                                            </motion.div>
                                        ) : (
                                            <AnimatePresence>
                                                <div className="space-y-4">
                                                    {allSubmissionLoading ? (
                                                        <div className="flex justify-center py-8">
                                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                        </div>
                                                    ) : (
                                                        allSubmission?.map((submission, idx) => (
                                                            <motion.div
                                                                key={submission.id}
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.3, delay: idx * 0.1 }}
                                                                className="relative group"
                                                            >
                                                                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:shadow-md transition-all duration-200">
                                                                    <div className="flex items-center mb-4">
                                                                        <CustomAvatar
                                                                            className="h-12 w-12"
                                                                            winnerCount={submission.userWinCount}
                                                                            url={submission.user.image}
                                                                        />
                                                                        <div className="flex w-full items-center justify-between">
                                                                            <div className="ml-3">
                                                                                <div className="text-sm font-medium">{submission.user.name}</div>
                                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                    {format(new Date(submission.createdAt), "MMM dd, yyyy")}
                                                                                </div>
                                                                            </div>
                                                                            <SubmissionStatusSelect
                                                                                defaultValue={submission.status as string}
                                                                                submissionId={submission.id}
                                                                                creatorId={data.creatorId}
                                                                                updateSubmissionStatus={updateSubmissionStatus}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="mb-4">
                                                                        {submission.content.length > 400 ? (
                                                                            <ShowMore content={submission.content} />
                                                                        ) : (
                                                                            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                                                                                <SafeHTML html={submission?.content} />
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap gap-3 mt-4">
                                                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                                                            <Button
                                                                                onClick={() => {
                                                                                    setIsDialogOpenWinner(true)
                                                                                    setSelectedSubmission(submission)
                                                                                }}
                                                                                disabled={
                                                                                    loadingBountyId === data.id ||
                                                                                    data.totalWinner === data.currentWinnerCount ||
                                                                                    data.BountyWinner.some((winner) => winner.user.id === submission.user.id) ||
                                                                                    GetSendBalanceToWinnerXdr.isLoading
                                                                                }
                                                                                className="bg-primary hover:bg-primary/90 text-white"
                                                                            >
                                                                                <Crown className="mr-2 h-4 w-4" /> Mark as Winner
                                                                            </Button>
                                                                        </motion.div>
                                                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                                                            <Button
                                                                                variant="outline"
                                                                                className="border-slate-200 dark:border-slate-700"
                                                                                onClick={() => {
                                                                                    updateSubmissionStatus(data.creatorId, submission.id, "CHECKED")
                                                                                    setAttachment(submission.medias)
                                                                                    setAttachmentModal(true)
                                                                                }}
                                                                            >
                                                                                <Paperclip className="mr-2 h-4 w-4" /> View Attachments
                                                                            </Button>
                                                                        </motion.div>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))
                                                    )}
                                                </div>
                                            </AnimatePresence>
                                        )}
                                    </div>

                                    {selectedSubmission && (
                                        <Dialog open={isDialogOpenWinner} onOpenChange={setIsDialogOpenWinner}>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle className="text-xl">Confirm Winner</DialogTitle>
                                                </DialogHeader>
                                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <CustomAvatar
                                                            className="h-12 w-12"
                                                            winnerCount={selectedSubmission.userWinCount}
                                                            url={selectedSubmission.user.image}
                                                        />
                                                        <div>
                                                            <p className="font-medium">{selectedSubmission.user.name}</p>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                {addrShort(selectedSubmission.userId, 6)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="text-slate-700 dark:text-slate-300">
                                                        Do you want to make this user a winner? This action cannot be undone.
                                                    </p>
                                                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                                                        <p className="text-sm text-amber-800 dark:text-amber-300">
                                                            The prize amount of {(data.priceInBand / data.totalWinner).toFixed(3)}{" "}
                                                            {PLATFORM_ASSET.code} will be transferred to this user.
                                                        </p>
                                                    </div>
                                                </div>
                                                <DialogFooter className="flex flex-col sm:flex-row gap-3">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 border-slate-200 dark:border-slate-700"
                                                        onClick={() => setIsDialogOpenWinner(false)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        disabled={
                                                            loadingBountyId === data.id ||
                                                            data.totalWinner <= data.currentWinnerCount ||
                                                            data.BountyWinner.some((winner) => winner.user.id === selectedSubmission.userId) ||
                                                            GetSendBalanceToWinnerXdr.isLoading
                                                        }
                                                        className="flex-1 bg-primary hover:bg-primary/90"
                                                        onClick={() => handleWinner(data.id, selectedSubmission.userId, data.priceInBand)}
                                                    >
                                                        {GetSendBalanceToWinnerXdr.isLoading ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                <span>Processing...</span>
                                                            </div>
                                                        ) : (
                                                            "Confirm Winner"
                                                        )}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </TabsContent>
                                {data.bountyType === "SCAVENGER_HUNT" && (
                                    <TabsContent value="participants" className="mt-0">
                                        <div className="space-y-6">
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                                Participants ({data._count.participants})
                                            </h2>
                                            {data.participants.length === 0 ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.4 }}
                                                    className="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
                                                >
                                                    <div className="text-slate-400 dark:text-slate-500 mb-4">
                                                        <Users size={48} />
                                                    </div>
                                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No participants yet</h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                                                        No one has joined this scavenger hunt yet.
                                                    </p>
                                                </motion.div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {data.participants.map((participant, idx) => {
                                                        const isCompleted = data._count.ActionLocation > 0 && participant.currentStep >= data._count.ActionLocation
                                                        const progressPercentage =
                                                            data._count.ActionLocation > 0 ? (participant.currentStep / data._count.ActionLocation) * 100 : 0
                                                        const isAlreadyWinner = data.BountyWinner.some(
                                                            (winner) => winner.user.id === participant.user.id,
                                                        )

                                                        return (
                                                            <motion.div
                                                                key={participant.user.id}
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.3, delay: idx * 0.1 }}
                                                                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm"
                                                            >
                                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <CustomAvatar url={participant.user.image} className="h-10 w-10" />
                                                                        <div>
                                                                            <p className="font-medium text-slate-900 dark:text-white">
                                                                                {participant.user.name || "Unnamed User"}
                                                                            </p>
                                                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                                Step {participant.currentStep} of {data._count.ActionLocation}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-2">
                                                                        <div className="w-full flex items-center justify-center gap-2">
                                                                            {
                                                                                isCompleted ? (
                                                                                    <Badge variant="default" className="bg-green-500 text-white">
                                                                                        <CheckCircle className="mr-1 h-4 w-4" />
                                                                                        Completed
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Badge variant="outline" className="text-slate-500 dark:text-slate-400">
                                                                                        <Clock className="mr-1 h-4 w-4" />
                                                                                        {progressPercentage.toFixed(0)}% Completed
                                                                                    </Badge>
                                                                                )
                                                                            }
                                                                        </div>
                                                                        {isCompleted && !isAlreadyWinner && (
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    handleWinner(data.id, participant.user.id, data.priceInBand / data.totalWinner)
                                                                                }
                                                                                disabled={
                                                                                    loadingBountyId === data.id ||
                                                                                    data.totalWinner <= data.currentWinnerCount ||
                                                                                    GetSendBalanceToWinnerXdr.isLoading
                                                                                }
                                                                                className="bg-green-500 hover:bg-green-600 text-white mt-2"
                                                                            >
                                                                                {GetSendBalanceToWinnerXdr.isLoading && loadingBountyId === data.id ? (
                                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <Crown className="mr-2 h-4 w-4" />
                                                                                )}
                                                                                Select as Winner
                                                                            </Button>
                                                                        )}
                                                                        {isAlreadyWinner && (
                                                                            <Badge variant="default" className="mt-2 bg-amber-500 text-white">
                                                                                <UserCheck className="mr-1 h-4 w-4" /> Winner
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                )}
                                <TabsContent value="doubt" className="mt-0 ">
                                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" >
                                        <Chat bountyId={data.id} />
                                    </div>
                                </TabsContent>

                                <TabsContent value="comments" className="mt-0">
                                    <div className="space-y-4">
                                        <AddBountyComment bountyId={Number(id)} />
                                        <div className="max-h-[650px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                            {bountyComment.data && bountyComment.data.length > 0 ? (
                                                <div className="space-y-4">
                                                    {bountyComment.data?.map((comment, idx) => (
                                                        <motion.div
                                                            key={comment.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.3, delay: idx * 0.1 }}
                                                        >
                                                            <ViewBountyComment comment={comment} bountyChildComments={comment.bountyChildComments} />
                                                            <Separator className="my-4" />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-[300px] text-center p-6">
                                                    <MessageSquare size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
                                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No comments yet</h3>
                                                    <p className="text-slate-500 dark:text-slate-400 max-w-md">
                                                        There are no comments on this bounty yet.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>

                        <CardFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="w-full sm:w-auto flex flex-wrap gap-3">
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Button
                                        className="bg-primary hover:bg-primary/90"
                                        onClick={() => {
                                            setData(data.id)
                                            setIsOpen(true)
                                        }}
                                    >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit Bounty
                                    </Button>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                disabled={
                                                    DeleteMutation.isLoading || loadingBountyId === data.id || data.currentWinnerCount > 0
                                                }
                                            >
                                                <Trash className="mr-2 h-4 w-4" />
                                                Delete Bounty
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl">Delete Bounty</DialogTitle>
                                            </DialogHeader>
                                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                                <p className="text-slate-700 dark:text-slate-300">
                                                    Are you sure you want to delete this bounty? This action cannot be undone.
                                                </p>
                                                {data.currentWinnerCount > 0 && (
                                                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                                                        <p className="text-sm text-amber-800 dark:text-amber-300">
                                                            This bounty already has winners and cannot be deleted.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter className="flex flex-col sm:flex-row gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 border-slate-200 dark:border-slate-700"
                                                    onClick={() => setIsDialogOpen(false)}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    disabled={loadingBountyId === data.id || data.currentWinnerCount > 0}
                                                    variant="destructive"
                                                    className="flex-1"
                                                    onClick={() => handleDelete(data.id, data.priceInBand)}
                                                >
                                                    {DeleteMutation.isLoading ? (
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            <span>Processing...</span>
                                                        </div>
                                                    ) : (
                                                        "Delete Permanently"
                                                    )}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </motion.div>
                            </div>

                            <div className="w-full sm:w-auto flex justify-center">
                                <div className="flex flex-wrap gap-3 justify-center">
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <Badge variant="outline" className="py-2 px-3 gap-1 border-slate-200 dark:border-slate-700">
                                            <Trophy className="h-4 w-4 text-amber-500" />
                                            <span>
                                                {data.currentWinnerCount}/{data.totalWinner} Winners
                                            </span>
                                        </Badge>
                                    </motion.div>
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <Badge variant="outline" className="py-2 px-3 gap-1 border-slate-200 dark:border-slate-700">
                                            <Users className="h-4 w-4 text-blue-500" />
                                            <span>{data?._count.participants} Participants</span>
                                        </Badge>
                                    </motion.div>
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div >
        )
}

function ShowMore({ content }: { content: string }) {
    const [isExpanded, setIsExpanded] = useState<boolean>(false)

    return (
        <div className="w-full">
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                {isExpanded ? (
                    <SafeHTML html={content} />
                ) : (
                    <>
                        <SafeHTML html={content.substring(0, 300) + "..."} />
                        <div className="h-8 bg-gradient-to-t from-white dark:from-slate-800 to-transparent"></div>
                    </>
                )}
            </div>

            <button
                className="mt-2 text-primary hover:text-primary/80 text-sm font-medium flex items-center"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded ? "Show Less" : "Show More"}
            </button>
        </div>
    )
}

const SubmissionStatusSelect = ({
    defaultValue,
    submissionId,
    creatorId,
    updateSubmissionStatus,
}: {
    defaultValue: string
    submissionId: number
    creatorId: string
    updateSubmissionStatus: (creatorId: string, submissionId: number, status: SubmissionViewType) => void
}) => {
    const handleStatusChange = (value: SubmissionViewType) => {
        updateSubmissionStatus(creatorId, submissionId, value)
    }

    return (
        <Select onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[120px] shadow-sm shadow-slate-300">
                <SelectValue placeholder={defaultValue} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="CHECKED">CHECKED</SelectItem>
                <SelectItem value="ONREVIEW">REVIEW</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
            </SelectContent>
        </Select>
    )
}



function sanitizeInput(input: string) {
    // Updated regex to match more general URL formats (handling more complex domains and paths)
    const regex = /https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?/g

    // Find all matching URLs
    const urlMatches = input.match(regex) ?? []

    // Remove all URLs from the input string
    const sanitizedInput = input.replace(regex, "").trim()

    console.log("Sanitized Input:", sanitizedInput)
    console.log("Matched URLs:", urlMatches)

    return {
        sanitizedInput,
        urls: urlMatches.length ? urlMatches : null,
    }
}

const shortURL = (url: string) => {
    if (url.length > 30) {
        return `${url.slice(0, 30)}...`
    }
    return url
}

