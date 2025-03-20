import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";

interface CreatorStoredAssetModalProps {
    isOpen: boolean;
    data?: MarketAssetType;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: MarketAssetType) => void;
}

export const useCreatorStoredAssetModalStore = create<CreatorStoredAssetModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
