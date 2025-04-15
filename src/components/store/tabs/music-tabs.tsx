
import { create } from "zustand";

interface MusicTabsProps {
    seletedTab: string;
    setSelectedTab: (seletedTab: string) => void;
}

export const useMusicTabStore = create<MusicTabsProps>((set) => ({
    seletedTab: "ALL SONGS",


    setSelectedTab: (seletedTab) => set({ seletedTab }),
}));
