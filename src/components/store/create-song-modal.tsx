import { create } from "zustand";

interface CreateSongModalProps {
    isOpen: boolean;
    albumId?: number;
    setIsOpen: (isOpen: boolean) => void;
    setData: (albumId: number) => void;
}

export const useCreateSongModalStore = create<CreateSongModalProps>((set) => ({
    isOpen: false,
    albumId: undefined,
    setData: (albumId) => set({ albumId }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
