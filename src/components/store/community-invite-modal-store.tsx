import { create } from "zustand";

interface CommunityInviteModalProps {
  isOpen: boolean;
  communityId?: number;
  setIsOpen: (isOpen: boolean) => void;
  setCommunityId: (id: number) => void;
}

export const useCommunityInviteModalStore =
  create<CommunityInviteModalProps>((set) => ({
    isOpen: false,
    communityId: undefined,
    setIsOpen: (isOpen) => set({ isOpen }),
    setCommunityId: (communityId) => set({ communityId }),
  }));
