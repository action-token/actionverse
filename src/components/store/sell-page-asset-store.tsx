import { create } from "zustand";

interface SellPageAssetProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const useSellPageAssetStore = create<SellPageAssetProps>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));
