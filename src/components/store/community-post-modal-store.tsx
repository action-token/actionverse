import { create } from "zustand";

interface CommunityPostModalProps {
  isOpen: boolean;
  communityId?: number;
  setIsOpen: (isOpen: boolean) => void;
  setCommunityId: (id: number) => void;
}

export const useCommunityPostModalStore = create<CommunityPostModalProps>(
  (set) => ({
    isOpen: false,
    communityId: undefined,
    setIsOpen: (isOpen) => set({ isOpen }),
    setCommunityId: (communityId) => set({ communityId }),
  }),
);
