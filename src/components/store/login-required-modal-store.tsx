import { create } from "zustand";

interface LoginRequiredModalProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;

}

export const useLoginRequiredModalStore = create<LoginRequiredModalProps>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));
