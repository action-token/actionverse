import { ItemPrivacy } from "@prisma/client";
import { create } from "zustand";

export interface ModalData {
    pinId?: string;
    recipientId?: string;
    amount?: string;
    asset_code?: string;
    long?: number;
    lat?: number;
    mapTitle?: string;
    mapDescription?: string | null;
    location?: Location;
    postUrl?: string | null;
    image?: string;
    startDate?: Date;
    endDate?: Date;
    pinCollectionLimit?: number;
    pinRemainingLimit?: number;
    multiPin?: boolean;
    pinNumber?: number;
    autoCollect?: boolean;
    subscriptionId?: number;
    assetId?: number;
    link?: string;
    pageAsset?: boolean;
    privacy?: ItemPrivacy;
}

interface MapOption {
    data: ModalData;
    isOpen: boolean;
    isPinCopied: boolean;
    isPinCut: boolean;
    isAutoCollect: boolean;
    isForm: boolean;
    setData: (data: ModalData) => void;
    setIsOpen: (isOpen: boolean) => void;
    setIsForm: (isForm: boolean) => void;
    setIsPinCopied: (isPinCopied: boolean) => void;
    setIsPinCut: (isPinCut: boolean) => void;
    setIsAutoCollect: (isAutoCollect: boolean) => void;
}

export const useMapOptionsModalStore = create<MapOption>((set) => ({
    data: {},
    isOpen: false,
    isPinCut: false,
    isPinCopied: false,
    isAutoCollect: false,
    isForm: false,
    setData: (data) => set({ data }),
    setIsOpen: (isOpen) => set({ isOpen }),
    setIsForm: (isForm) => set({ isForm }),
    setIsPinCopied: (isPinCopied) => set({ isPinCopied }),
    setIsPinCut: (isPinCut) => set({ isPinCut }),
    setIsAutoCollect: (isAutoCollect) => set({ isAutoCollect }),
}));
