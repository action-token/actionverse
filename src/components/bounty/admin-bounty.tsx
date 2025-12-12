import clsx from "clsx";
import { format } from "date-fns";
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    Award,
    Calendar,
    Check,
    CheckCircle,
    CheckCircle2,
    ChevronDown,
    Clock,
    Coins,
    Copy,
    Crown,
    DollarSign,
    Edit,
    Eye,
    File,
    FileIcon,
    FilePlus,
    FileText,
    FileX,
    Gift,
    ListChecks,
    Loader2,
    MapPin,
    MessageCircle,
    MessageSquare,
    MessageSquareIcon,
    Paperclip,
    Search,
    Send,
    Ticket,
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
import { usePaymentMethodStore } from "~/components/common/payment-options";
import UserBountyPage from "~/components/bounty/user-bounty";
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
    const session = useSession()
    const [loadingBountyId, setLoadingBountyId] = useState<number | null>(null)
    const { needSign } = useNeedSign()
    const [input, setInput] = useState("")
    const inputLength = input.trim().length
    const [messages, setMessages] = useState<Message[]>([])
    const [isDialogOpenWinner, setIsDialogOpenWinner] = useState(false)
    const { id } = router.query
    const { setData, setIsOpen } = useEditBuyModalStore()
    const [selectedSubmission, setSelectedSubmission] = useState<extendedBountySubmission | null>(null)
    const { paymentMethod, } = usePaymentMethodStore()

    const isLocationBasedBounty = (bounty: Bounty) => {
        console.log(bounty?.latitude, bounty?.longitude, bounty?.radius)
        return bounty?.latitude !== null && bounty?.longitude !== null && bounty?.radius !== null
    }
    const { data: redeemCodes, isLoading: redeemCodesLoading } = api.bounty.Bounty.getBountyRedeemCodes.useQuery(
        {
            bountyId: Number(id),
        },
        {
            enabled: !!Number(id),
        },
    )
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

    const SendBalanceToBountyMother = api.bounty.Bounty.sendBountyBalanceToMotherAcc.useMutation({
        onSuccess: async (data, { method, bountyId, userId }) => {
            if (data) {
                try {
                    const clientResponse = await clientsign({
                        presignedxdr: data.xdr,
                        walletType: session.data?.user?.walletType,
                        pubkey: data.pubKey,
                        test: clientSelect(),
                    })
                    if (clientResponse) {
                        MakeWinnerMutation.mutate({
                            BountyId: bountyId ?? 0,
                            userId: userId ?? "",
                        });
                    } else {
                        toast.error("Error in signing transaction")
                    }
                    setIsOpen(false)
                } catch (error) {
                    console.error("Error sending balance to bounty mother", error)
                }
            }
        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)
            setIsOpen(false)
        },
    })

    const handleWinner = ({ payNow, bountyId, priceInUSD, userId, prize }: { payNow: boolean, bountyId: number, priceInUSD: number, userId: string, prize: number }) => {
        setLoadingBountyId(bountyId);

        if (!payNow) {
            SendBalanceToBountyMother.mutate({
                signWith: needSign(),
                prize: prize > 0 ? prize : priceInUSD,
                fees: 0,
                method: paymentMethod,
                bountyId: bountyId,
                userId: userId,
            })
        }
        else {
            MakeWinnerMutation.mutate({
                BountyId: bountyId,
                userId: userId,
            });
        }
        setLoadingBountyId(null);
    };
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





    const handleDelete = (id: number, prizeInBand: number, prizeInUSD: number, payNow: boolean) => {
        if (payNow) {
            setLoadingBountyId(id)
            GetDeleteXDR.mutate({ prizeInBand: prizeInBand, prizeInUSD: prizeInUSD, bountyId: id })
            setLoadingBountyId(null)
        }
        else {
            DeleteMutation.mutate({
                BountyId: id ?? 0,
            })
        }
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
        {
            id: "redeem-codes",
            label: "Redeem Codes",
            icon: Ticket,
        },
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
                                                {data?.priceInUSD > 0 ? `$${data.priceInUSD.toFixed(2)} USDC` : `${data?.priceInBand.toFixed(3)} ${PLATFORM_ASSET.code.toLocaleUpperCase()}`}
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
                                                    {tab.id === "redeem-codes" && redeemCodes && (
                                                        <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-xs">
                                                            {redeemCodes.length}
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
                                <TabsContent value="redeem-codes" className="mt-0">
                                    <RedeemCodesTab redeemCodes={redeemCodes} isLoading={redeemCodesLoading} />
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
                                                                                    data.BountyWinner.some((winner) => winner.user.id === submission.user.id)
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
                                        <Dialog
                                            open={isDialogOpenWinner}
                                            onOpenChange={setIsDialogOpenWinner}
                                        >
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle className="text-xl">
                                                        Confirm Winner
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                                    <div className="mb-4 flex items-center gap-3">
                                                        <CustomAvatar
                                                            className="h-12 w-12"
                                                            winnerCount={selectedSubmission.userWinCount}
                                                            url={selectedSubmission.user.image}
                                                        />
                                                        <div>
                                                            <p className="font-medium">
                                                                {selectedSubmission.user.name}
                                                            </p>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                {addrShort(selectedSubmission.userId, 6)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="text-slate-700 dark:text-slate-300">
                                                        Do you want to make this user a winner? This action
                                                        cannot be undone.
                                                    </p>
                                                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                                                        <p className="text-sm text-amber-800 dark:text-amber-300">
                                                            The prize amount of{" "}
                                                            {
                                                                data.priceInBand > 0 ?
                                                                    `${(data.priceInBand / data.totalWinner).toFixed(5)} ${PLATFORM_ASSET.code.toLocaleUpperCase()}`
                                                                    :
                                                                    `$${(data.priceInUSD / data.totalWinner).toFixed(5)} USDC`
                                                            } will be{" "}
                                                            claim later.
                                                        </p>
                                                    </div>
                                                </div>
                                                <DialogFooter className="flex flex-col gap-3 sm:flex-row">
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
                                                            data.BountyWinner.some(
                                                                (winner) =>
                                                                    winner.user.id === selectedSubmission.userId,
                                                            ) ||
                                                            MakeWinnerMutation.isLoading
                                                        }

                                                        className="flex-1 shadow-sm shadow-foreground"
                                                        onClick={() =>
                                                            handleWinner(
                                                                {
                                                                    payNow: data.payNow,
                                                                    bountyId: data.id,
                                                                    priceInUSD: data.priceInUSD / data.totalWinner,
                                                                    userId: selectedSubmission.userId,
                                                                    prize: data.priceInBand / data.totalWinner,
                                                                }
                                                            )
                                                        }
                                                    >
                                                        {MakeWinnerMutation.isLoading ? (
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
                                                                                {participant.user.name ?? "Unnamed User"}
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
                                                                                    handleWinner(
                                                                                        {
                                                                                            payNow: data.payNow,
                                                                                            bountyId: data.id,
                                                                                            priceInUSD: data.priceInUSD / data.totalWinner,
                                                                                            userId: participant.user.id,
                                                                                            prize: data.priceInBand / data.totalWinner,
                                                                                        }
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    loadingBountyId === data.id ||
                                                                                    data.totalWinner <= data.currentWinnerCount
                                                                                }
                                                                                className="bg-green-500 hover:bg-green-600 text-white mt-2"
                                                                            >

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
                                                    onClick={() => handleDelete(data.id, data.priceInBand, data.priceInUSD, data.payNow)}
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


interface RedeemCode {
    id: number
    code: string
    isMarkedUsed: boolean
    isRedeemed: boolean
    redeemedAt: Date | null
    createdAt: Date
    redeemedUser: {
        id: string
        name: string | null
        image: string | null
    } | null
}

interface RedeemCodesTabProps {
    redeemCodes: RedeemCode[] | undefined
    isLoading: boolean
}

export function RedeemCodesTab({ redeemCodes, isLoading }: RedeemCodesTabProps) {
    const [copiedCode, setCopiedCode] = useState<string | null>(null)
    const [locallyMarkedIds, setLocallyMarkedIds] = useState<number[]>([])
    const utils = api.useUtils()

    const markMutation = api.bounty.Bounty.markRedeemCode.useMutation({
        onSuccess: async () => {
            toast.success("Code marked")
            // try to refresh the parent query that provides redeemCodes
            try {
                await utils.bounty.Bounty.getBountyRedeemCodes.refetch()
            } catch {
                // fallback: do nothing
            }
        },
        onError: (err) => {
            toast.error(err.message)
        },
    })

    const copyToClipboard = async (code: string) => {
        await navigator.clipboard.writeText(code)
        setCopiedCode(code)
        toast.success("Code copied to clipboard")
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const handleMark = (id: number) => {
        // prevent double marking
        if (locallyMarkedIds.includes(id)) return

        // optimistic UI
        setLocallyMarkedIds((prev) => [...prev, id])
        markMutation.mutate(
            { id },
            {
                onError: () => {
                    // rollback on error
                    setLocallyMarkedIds((prev) => prev.filter((i) => i !== id))
                },
            },
        )
    }

    const redeemedCount = redeemCodes?.filter((c) => c.isRedeemed).length ?? 0
    const totalCount = redeemCodes?.length ?? 0

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Redeem Codes</h2>
                <div className="flex gap-3">
                    <Badge
                        variant="outline"
                        className="gap-1.5 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {redeemedCount} Redeemed
                    </Badge>
                    <Badge
                        variant="outline"
                        className="gap-1.5 border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                    >
                        <Clock className="h-4 w-4" />
                        {totalCount - redeemedCount} Available
                    </Badge>
                </div>
            </div>

            {/* Empty State */}
            {!redeemCodes || redeemCodes.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-700 dark:bg-slate-800/50"
                >
                    <div className="mb-4 text-slate-400 dark:text-slate-500">
                        <Ticket size={48} />
                    </div>
                    <h3 className="mb-1 text-lg font-medium text-slate-900 dark:text-white">No redeem codes yet</h3>
                    <p className="max-w-md text-center text-slate-500 dark:text-slate-400">
                        There are no redeem codes generated for this bounty yet.
                    </p>
                </motion.div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {redeemCodes.map((redeemCode, idx) => {
                        const isMarked = redeemCode.isMarkedUsed
                        // only show "Mark" button when code is NOT redeemed
                        const showMarkButton = !redeemCode.isRedeemed

                        return (
                            <motion.div
                                key={redeemCode.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: idx * 0.05 }}
                                className={`group relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md ${redeemCode.isRedeemed
                                    ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-900/20 dark:to-slate-800"
                                    : "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-800 dark:from-amber-900/20 dark:to-slate-800"
                                    }`}
                            >
                                {/* Status Indicator */}
                                <div className="absolute right-3 top-3">
                                    {redeemCode.isRedeemed ? (
                                        <Badge className="gap-1 bg-emerald-500 text-white hover:bg-emerald-600">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Redeemed
                                        </Badge>
                                    ) : (
                                        <Badge className={`gap-1 ${isMarked ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-amber-500 text-white hover:bg-amber-600"}`}>
                                            <Clock className="h-3 w-3" />
                                            {isMarked ? "Marked" : "Available"}
                                        </Badge>
                                    )}
                                </div>

                                {/* Code Display */}
                                <div className="mb-4 mt-2">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Code
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code
                                            className={`font-mono text-lg font-semibold ${redeemCode.isRedeemed
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : isMarked
                                                    ? "text-emerald-700 dark:text-emerald-400"
                                                    : "text-amber-700 dark:text-amber-400"
                                                }`}
                                        >
                                            {redeemCode.code}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => copyToClipboard(redeemCode.code)}
                                        >
                                            {copiedCode === redeemCode.code ? (
                                                <Check className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-slate-400" />
                                            )}
                                        </Button>

                                        {/* Mark Button - only when not redeemed */}
                                        {showMarkButton && (
                                            <div className="ml-auto">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleMark(redeemCode.id)}
                                                    disabled={isMarked || markMutation.isLoading}
                                                    className={`${isMarked ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"} h-8 px-3`}
                                                >
                                                    {isMarked ? "Marked" : "Mark"}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Redeemed User Info */}
                                {redeemCode.isRedeemed && redeemCode.redeemedUser && (
                                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/50 p-2 dark:bg-slate-800/50">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={redeemCode.redeemedUser.image ?? undefined} />
                                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                                {redeemCode.redeemedUser.name?.charAt(0) ?? "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                                {redeemCode.redeemedUser.name ?? "Anonymous"}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Redeemed by</p>
                                        </div>
                                    </div>
                                )}

                                {/* Timestamps */}
                                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <p>Created: {format(new Date(redeemCode.createdAt), "MMM dd, yyyy")}</p>
                                    {redeemCode.redeemedAt && (
                                        <p>Redeemed: {format(new Date(redeemCode.redeemedAt), "MMM dd, yyyy 'at' h:mm a")}</p>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default AdminBountyPage;