import { create } from "zustand";

interface NFTCreateProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const useNFTCreateModalStore = create<NFTCreateProps>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));
