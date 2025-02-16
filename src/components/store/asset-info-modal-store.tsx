import { create } from "zustand";
import { AssetType } from "~/types/market/market-asset-type";

interface AssetInfoModalProps {
    isOpen: boolean;
    data?: AssetType;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: AssetType) => void;
}

export const useAssestInfoModalStore = create<AssetInfoModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
