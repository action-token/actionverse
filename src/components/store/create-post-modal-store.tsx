import { create } from "zustand";

interface CreatePostModalProps {
    isOpen: boolean;

    setIsOpen: (isOpen: boolean) => void;

}

export const useCreatePostModalStore = create<CreatePostModalProps>((set) => ({
    isOpen: false,

    setIsOpen: (isOpen) => set({ isOpen }),
}));
