import { create } from "zustand";
import { AdminAssetWithTag } from "~/types/market/admin-asset-tag-type";

interface AdminAssetModalProps {
    isOpen: boolean;
    data?: AdminAssetWithTag;
    setIsOpen: (isOpen: boolean) => void;
    setData: (data: AdminAssetWithTag) => void;
}

export const useAdminAssetModalStore = create<AdminAssetModalProps>((set) => ({
    isOpen: false,
    data: undefined,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
}));
