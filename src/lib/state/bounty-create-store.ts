import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SelectedTrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  targetPlayCount: number;
  targetDurationSec: number;
  lastFmUrl: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
}

export interface BountyCreateFormState {
  title: string;
  summary: string;
  description: string;
  prizeAmount: string;
  rewardNote: string;
  maxWinners: string;
  instructions: string[];
  selectedAssetKey: string;
  requiresActionCam: boolean;
  enableMusic: boolean;
  musicMode: "MUSIC_ONLY" | "HYBRID";
  ruleType: "ALL" | "ANY_N" | "TOTAL_PLAYS";
  customRequiredTracks: number;
  customTotalPlays: number;
  selectedTracks: SelectedTrackItem[];

  // Actions
  setField: <K extends keyof Omit<BountyCreateFormState, "setField" | "resetForm">>(
    field: K,
    value: BountyCreateFormState[K]
  ) => void;
  resetForm: () => void;
}

const initialValues = {
  title: "",
  summary: "",
  description: "",
  prizeAmount: "",
  rewardNote: "",
  maxWinners: "1",
  instructions: [],
  selectedAssetKey: "",
  requiresActionCam: false,
  enableMusic: false,
  musicMode: "HYBRID" as const,
  ruleType: "ALL" as const,
  customRequiredTracks: 0,
  customTotalPlays: 10,
  selectedTracks: [],
};

export const useBountyCreateStore = create<BountyCreateFormState>()(
  persist(
    (set) => ({
      ...initialValues,
      setField: (field, value) => set((state) => ({ ...state, [field]: value })),
      resetForm: () => set(initialValues),
    }),
    {
      name: "bounty-create-form",
    }
  )
);
