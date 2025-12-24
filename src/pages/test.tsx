"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Loader2,
    Search,
    Users,
    Heart,
    Globe,
    Building2,
    Filter,
    Grid3X3,
    List,
    ChevronUp,
    ChevronDown,
    Crown,
    X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign, WalletType } from "package/connect_wallet"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Switch } from "~/components/shadcn/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Badge } from "~/components/shadcn/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { useBrandFollowMode } from "~/lib/state/augmented-reality/useBrandFollowMode"
import { useAccountAction } from "~/lib/state/augmented-reality/useAccountAction"
import Loading from "~/components/common/loading"
import { Walkthrough } from "~/components/common/walkthrough"
import { useWalkThrough } from "~/hooks/useWalkthrough"
import { submitSignedXDRToServer4UserTestnet } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g"
import { toast as sonner } from "sonner"

type ButtonLayout = {
    x: number
    y: number
    width: number
    height: number
}

type ViewMode = "grid" | "list"
type SortOption = "name" | "followers" | "recent"
type FilterOption = "all" | "following" | "not-following"

interface Creator {
    isFollowed: boolean;
    isCurrentUser: boolean;
    name: string;
    id: string;
    _count: {
        temporalFollows: number;
    };
    profileUrl: string | null;
}

export default function CreatorPage() {
    const session = useSession()
    const { needSign } = useNeedSign()
    const queryClient = useQueryClient()
    const handleSubmit = async () => {
        const preSignedXDR = "AAAAAgAAAAAMBJlzptvGE55Aj2jMQpQEa3l9z5iz8MRXeSO7TppTLwAAAGQAAY/hAAAAKAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAB/Cdzv5w1w6bPRA+ND5dleKmoV44XurkstNKxUsQrpcAAAAAQAAAAAMBJlzptvGE55Aj2jMQpQEa3l9z5iz8MRXeSO7TppTLwAAAAJCYW5kY29pbgAAAAAAAAAA7ZeIY9ir45ovHmBpuOXCEin9skXH01KLGiXiOiF/4bsAAAAAeZfuAAAAAAAAAAABTppTLwAAAEDIAz1qDsXXfAU35XmeX0IeBvdI5X6XASwUTxmCsaytuxaCRNk5alrmZOZ3RKKHayQmVbbcuyo2b3oO4raUk4sO"
        try {
            const result = await clientsign({
                presignedxdr: preSignedXDR,
                pubkey: session.data?.user.id,
                walletType: WalletType.isAdmin,
                test: clientSelect(),
            })

        } catch (error: unknown) {
            console.error("Error in test transaction", error)

            const err = error as {
                message?: string
                details?: string
                errorCode?: string
            }

            sonner.error(
                typeof err?.message === "string"
                    ? err.message
                    : "Transaction Failed",
                {
                    description: `Error Code : ${err?.errorCode ?? "unknown"}`,
                    duration: 8000,
                }
            )

        }

    }
    return (
        <>
            <Button
                onClick={handleSubmit}
            >
                Click Me
            </Button >
        </>
    )

}
