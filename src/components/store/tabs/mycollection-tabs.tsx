import { create } from "zustand";

export enum MyCollectionMenu {
    COLLECTION = "MY COLLECTION",
    SECONDARY = "SECONDARY MARKETPLACE",

}

interface MyCollectionTabsState {
    selectedMenu: MyCollectionMenu;
    setSelectedMenu: (menu: MyCollectionMenu) => void;
}

export const useMyCollectionTabs = create<MyCollectionTabsState>((set) => ({
    selectedMenu: MyCollectionMenu.COLLECTION,
    setSelectedMenu: (menu) => set({ selectedMenu: menu }),
}));
