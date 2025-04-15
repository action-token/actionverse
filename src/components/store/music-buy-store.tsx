import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";
import { SongItemType } from "~/types/song/song-item-types";

interface MusicBuyModalProps {
    isOpen: boolean;
    data?: SongItemType;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: SongItemType) => void;
}

export const useMusicBuyModalStore = create<MusicBuyModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
