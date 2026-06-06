import { create } from "zustand"

interface ShareBountyModalState {
  isOpen: boolean
  bountyId: number | null
  bountyUrl: string
  setIsOpen: (isOpen: boolean) => void
  openWithBounty: (bountyId: number) => void
}

export const useShareBountyModalStore = create<ShareBountyModalState>((set) => ({
  isOpen: false,
  bountyId: null,
  bountyUrl: "",
  setIsOpen: (isOpen) => set({ isOpen }),
  openWithBounty: (bountyId) =>
    set({
      isOpen: true,
      bountyId,
      bountyUrl: `/bounty/${bountyId}`,
    }),
}))
