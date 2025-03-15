import { create } from "zustand";

interface ShareModalProps {
  isOpen: boolean;
  data?: string;
  setIsOpen: (isOpen: boolean) => void;
  setData: (data: string) => void;
}

export const useShareModalStore = create<ShareModalProps>((set) => ({
  isOpen: false,
  data: undefined,
  setData: (data) => set({ data }),
  setIsOpen: (isOpen) => set({ isOpen }),
}));
