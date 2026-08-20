"use client";

import { MediaType } from "@prisma/client";
import { motion } from "framer-motion";
import { Coins, CuboidIcon as Cube, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/router";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "~/components/shadcn/ui/dialog";
import { AccountSchema } from "~/lib/stellar/fan/utils";
import { BADWORDS } from "~/utils/banned-word";

import { Button } from "../shadcn/ui/button";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/shadcn/ui/tooltip";

import { useNFTCreateModalStore } from "../store/nft-create-modal-store";

export const ExtraSongInfo = z.object({
    artist: z.string(),
    albumId: z.number(),
});

export const NftFormSchema = z.object({
    name: z.string().refine(
        (value) => {
            return !BADWORDS.some((word) => value.includes(word));
        },
        {
            message: "Input contains banned words.",
        },
    ),
    description: z.string(),
    mediaUrl: z.string({
        message: "Media is required",
        required_error: "Media is required",
    }),
    coverImgUrl: z.string().min(1, { message: "Thumbnail is required" }),
    mediaType: z.nativeEnum(MediaType),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .nonnegative()
        .default(2),
    priceUSD: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative()
        .default(1),
    limit: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative(),
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: AccountSchema.optional(),
    songInfo: ExtraSongInfo.optional(),
    isAdmin: z.boolean().optional(),
    tier: z.string().optional(),
});

export const NonStellarItemFormSchema = z.object({
    name: z.string().refine(
        (value) => {
            return !BADWORDS.some((word) => value.includes(word));
        },
        {
            message: "Input contains banned words.",
        },
    ),
    description: z.string(),
    mediaUrl: z.string().optional(),
    coverImgUrl: z.string().min(1, { message: "Thumbnail is required" }),
    mediaType: z.nativeEnum(MediaType),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .nonnegative()
        .default(2),
    priceUSD: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative()
        .default(1),
    limit: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative(),
    tier: z.string().optional(),
});

// Every mint method now lives on its own page (see
// `~/pages/organization/smart-contract/create.tsx`,
// `~/pages/organization/classic-nft/create.tsx`,
// `~/pages/organization/non-stellar-item/create.tsx`) — this modal is just
// the lightweight entry picker; picking any option navigates away and
// closes it, there's nothing left to switch between locally.
export default function NftCreateModal() {
    const { isOpen: isNFTModalOpen, setIsOpen: setNFTModalOpen } =
        useNFTCreateModalStore();

    function handleClose() {
        setNFTModalOpen(false);
    }

    return (
        <Dialog open={isNFTModalOpen} onOpenChange={handleClose}>
            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-0"
            >
                <MintMethodChoice onClose={handleClose} />
            </DialogContent>
        </Dialog>
    );
}

function MintMethodChoice({ onClose }: { onClose: () => void }) {
    const router = useRouter();

    function goTo(path: string) {
        onClose();
        void router.push(path);
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
        >
            <DialogHeader className="px-6 py-4">
                <DialogTitle className="text-xl">Mint New Item</DialogTitle>
                <DialogDescription>
                    Choose how you want to create this item.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={() => goTo("/organization/classic-nft/create")}
                    className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-muted"
                >
                    <Coins className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Classic NFT</span>
                    <span className="text-sm text-muted-foreground">
                        Mint as a classic Stellar asset, distributed through your
                        storage account — the existing, battle-tested way.
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => goTo("/organization/smart-contract/create")}
                    className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-muted"
                >
                    <Cube className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Smart Contract NFT</span>
                    <span className="text-sm text-muted-foreground">
                        Mint on the NFT marketplace smart contract — on-chain
                        ownership, royalties, and resale built in.
                    </span>
                </button>
            </div>
            <DialogFooter className="border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
            </DialogFooter>
        </motion.div>
    );
}

interface VisibilityToggleProps {
    isVisible: boolean;
    toggleVisibility: () => void;
}

export function VisibilityToggle({
    isVisible,
    toggleVisibility,
}: VisibilityToggleProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleVisibility}
                        aria-label={isVisible ? "Set to private" : "Set to visible"}
                    >
                        {isVisible ? (
                            <Eye className="h-4 w-4" />
                        ) : (
                            <EyeOff className="h-4 w-4" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isVisible ? "Visible to all" : "Private"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
