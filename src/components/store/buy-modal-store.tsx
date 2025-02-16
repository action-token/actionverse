import { create } from "zustand";
import { MarketAssetType } from "~/types/market/market-asset-type";

interface BuyModalProps {
    isOpen: boolean;
    data?: MarketAssetType;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: MarketAssetType) => void;
}

export const useBuyModalStore = create<BuyModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
