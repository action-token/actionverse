import { create } from "zustand";

interface AdminSidebarStore {
    isMinimized: boolean;
    isSheetOpen: boolean;
    toggle: () => void;
    setIsSheetOpen: (isSheetOpen: boolean) => void;
}

export const useAdminSidebar = create<AdminSidebarStore>((set) => ({
    isMinimized: false,
    isSheetOpen: false,
    toggle: () => set((state) => ({ isMinimized: !state.isMinimized })),
    setIsSheetOpen: (isSheetOpen) => set({ isSheetOpen: isSheetOpen }),
}));
