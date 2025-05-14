import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";
import { SongItemType } from "~/types/song/song-item-types";

interface ScavengerHuntModalProps {
    isOpen: boolean;
    data?: string;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: string) => void;
}

export const useScavengerHuntModalStore = create<ScavengerHuntModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
