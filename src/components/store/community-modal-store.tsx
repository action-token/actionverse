import { create } from "zustand";

interface CommunityModalProps {
  isOpen: boolean;
  editData?: number;
  setIsOpen: (isOpen: boolean) => void;
  setEditData: (data: number | undefined) => void;
}

export const useCommunityModalStore = create<CommunityModalProps>((set) => ({
  isOpen: false,
  editData: undefined,
  setIsOpen: (isOpen) => set({ isOpen }),
  setEditData: (editData) => set({ editData }),
}));
