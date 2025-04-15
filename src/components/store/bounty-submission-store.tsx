import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";
import { SongItemType } from "~/types/song/song-item-types";

interface BountySubmissionModalProps {
    isOpen: boolean;
    data: {
        submissionId?: number;
        bountyId?: number;
    };
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: { submissionId?: number; bountyId?: number }) => void;
}

export const useBountySubmissionModalStore = create<BountySubmissionModalProps>((set) => ({
    isOpen: false,
    data: {}, // Empty object is fine for now, as it's optional
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
