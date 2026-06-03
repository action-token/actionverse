import { create } from "zustand";

interface CommunityMemberDialogProps {
  isOpen: boolean;
  communityId?: number;
  setIsOpen: (isOpen: boolean) => void;
  setCommunityId: (id: number) => void;
}

export const useCommunityMemberDialogStore =
  create<CommunityMemberDialogProps>((set) => ({
    isOpen: false,
    communityId: undefined,
    setIsOpen: (isOpen) => set({ isOpen }),
    setCommunityId: (communityId) => set({ communityId }),
  }));
