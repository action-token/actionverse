import { create } from "zustand";
import { collectedPinInfoType } from "~/types/pins/collected-pin-info-types";

interface CollectedPinInfoModalProps {
    isOpen: boolean;
    data?: collectedPinInfoType;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: collectedPinInfoType) => void;
}

export const useCollectedPinInfoModalStore = create<CollectedPinInfoModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
