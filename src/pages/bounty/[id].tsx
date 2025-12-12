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
import AdminBountyPage from "~/components/bounty/admin-bounty";
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







