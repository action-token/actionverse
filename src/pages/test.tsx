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
import { clientsign } from "package/connect_wallet"
import toast from "react-hot-toast"
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
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error, isLoading, refetch } =
        api.fan.creator.getTrandingCreators.useInfiniteQuery(
            { limit: 5 },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        )
    const dummyData = {
        user: {
            id: "user_123",
            name: "John Doe",
        }
    }
    console.log(data, error,)
    return (
        <>
            <div>
                {
                    JSON.stringify(data, null, 2)
                }

            </div>
            <div>
                {
                    JSON.stringify(dummyData, null, 2)
                }
            </div>
            <div>
                {
                    JSON.stringify(error, null, 2)
                }
            </div>
        </>
    )

}
