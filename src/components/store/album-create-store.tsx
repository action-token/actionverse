import { create } from "zustand";

interface CreateAlbumProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const useCreateAlbumStore = create<CreateAlbumProps>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));
