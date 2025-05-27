import { type HolderWithPlots } from "~/lib/stellar/action-token/script";

export interface AppState {
  isOpen: boolean;
  selectedRow?: HolderWithPlots;
  setIsOpen: (value: boolean) => void;
  setSelectedRow: (row: HolderWithPlots) => void;
  reward?: { date: string; rewardedAt?: Date; data: HolderWithPlots[] };
  setReward: (value?: {
    date: string;
    rewardedAt?: Date;
    data: HolderWithPlots[];
  }) => void;
  currentReward?: { date: string; data: HolderWithPlots[] };
  setCurrentReward: (value: { date: string; data: HolderWithPlots[] }) => void;
}

export type AssetType = { code: string; issuer: string };
