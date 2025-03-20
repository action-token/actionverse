import { create } from "zustand"
import { persist } from "zustand/middleware"

export enum Mode {
    User = "User",
    Creator = "Creator",
}

interface ModeState {
    selectedMode: Mode
    isTransitioning: boolean
    setSelectedMode: (mode: Mode) => void
    toggleSelectedMode: () => void
    startTransition: () => void
    endTransition: () => void
}

export const useModeStore = create<ModeState>()(
    persist(
        (set) => ({
            selectedMode: Mode.User,
            isTransitioning: false,
            setSelectedMode: (mode) => set({ selectedMode: mode }),
            toggleSelectedMode: () =>
                set((state) => ({
                    selectedMode: state.selectedMode === Mode.User ? Mode.Creator : Mode.User,
                })),
            startTransition: () => set({ isTransitioning: true }),
            endTransition: () => set({ isTransitioning: false }),
        }),
        {
            name: "mode-storage",
        }
    )
)