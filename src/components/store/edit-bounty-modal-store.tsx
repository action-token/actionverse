import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";
import { SongItemType } from "~/types/song/song-item-types";

interface EditBountyModalProps {
    isOpen: boolean;
    data?: number;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: number) => void;
}

export const useEditBuyModalStore = create<EditBountyModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
