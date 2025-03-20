import { create } from "zustand";

interface CreatorSidebarStore {
    isMinimized: boolean;
    isSheetOpen: boolean;
    toggle: () => void;
    setIsSheetOpen: (isSheetOpen: boolean) => void;
}

export const useCreatorSidebar = create<CreatorSidebarStore>((set) => ({
    isMinimized: false,
    isSheetOpen: false,
    toggle: () => set((state) => ({ isMinimized: !state.isMinimized })),
    setIsSheetOpen: (isSheetOpen) => set({ isSheetOpen: isSheetOpen }),
}));
