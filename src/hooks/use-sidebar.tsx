import { create } from "zustand";

interface SidebarStore {
    isMinimized: boolean;
    isSheetOpen: boolean;
    toggle: () => void;
    setIsSheetOpen: (isSheetOpen: boolean) => void;
}

export const useSidebar = create<SidebarStore>((set) => ({
    isMinimized: false,
    isSheetOpen: false,
    toggle: () => set((state) => ({ isMinimized: !state.isMinimized })),
    setIsSheetOpen: (isSheetOpen) => set({ isSheetOpen: isSheetOpen }),
}));
