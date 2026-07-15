import { create } from "zustand"

interface ShareBountyData {
  id: string
  title: string
  prizeAmount: number
  participantCount?: number
  submissionCount?: number
}

interface ShareBountyModalStore {
  isOpen: boolean
  bounty: ShareBountyData | null
  open: (bounty: ShareBountyData) => void
  close: () => void
}

export const useShareBountyModalStore = create<ShareBountyModalStore>((set) => ({
  isOpen: false,
  bounty: null,
  open: (bounty) => set({ isOpen: true, bounty }),
  close: () => set({ isOpen: false, bounty: null }),
}))
