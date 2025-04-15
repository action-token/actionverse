import { create } from "zustand"
import { persist } from "zustand/middleware"

export enum Mode {
    USER = "USER",
    ORG = "ORG",
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
            selectedMode: Mode.USER,
            isTransitioning: false,
            setSelectedMode: (mode) => set({ selectedMode: mode }),
            toggleSelectedMode: () =>
                set((state) => ({
                    selectedMode: state.selectedMode === Mode.USER ? Mode.ORG : Mode.USER,
                })),
            startTransition: () => set({ isTransitioning: true }),
            endTransition: () => set({ isTransitioning: false }),
        }),
        {
            name: "mode-storage",
        }
    )
)