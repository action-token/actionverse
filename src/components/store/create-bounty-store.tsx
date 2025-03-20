import { create } from "zustand";

interface CreateBountyProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const useCreateBountyStore = create<CreateBountyProps>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));
