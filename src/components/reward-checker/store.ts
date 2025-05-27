import { create } from "zustand";
import { AppState } from "./types";

export const useRewardStore = create<AppState>((set) => ({
  isOpen: false,
  setIsOpen: (value) => set({ isOpen: value }),
  setSelectedRow: (row) => set({ selectedRow: row }),
  setReward: (value) => set({ reward: value }),
  setCurrentReward: (value) => set({ currentReward: value }),
}));
