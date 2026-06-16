import { create } from "zustand";
import { ConsumedLocation } from "~/types/game/location";
import { LocationCoords } from "~/utils/location";

export type ModalType =
  | "Delete"
  | "LocationInformation"
  | "NearbyPin"
  | "ArQrSelection";

export interface ModalData {
  collectionId?: string;
  collectionName?: string;
  Collection?: ConsumedLocation;
  userCurrentBalance?: number;
  balance?: number;
  userLocation?: LocationCoords | null;
}

interface ModalStore {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;

  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: () => void;
}

export const useModal = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  onOpen: (type, data = {}) => set({ isOpen: true, type, data }),
  onClose: () => set({ type: null, isOpen: false }),
}));
