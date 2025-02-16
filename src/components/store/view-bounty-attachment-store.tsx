import { SubmissionAttachment } from "@prisma/client";
import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";
import { SongItemType } from "~/types/song/song-item-types";

interface ViewBountySubmissionModalProps {
    isOpen: boolean;
    data?: SubmissionAttachment[];
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: SubmissionAttachment[]) => void;
}

export const useViewBountySubmissionModalStore = create<ViewBountySubmissionModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
