import { Bounty } from "@prisma/client";
import { create } from "zustand";
import { ConsumedLocation } from "~/types/game/location";
import { LocationCoords } from "~/utils/location";

export type ModalType =
  | "Delete"
  | "LocationInformation"
  | "JoinBounty"
  | "NearbyPin"
  | "ArQrSelection";

export interface ModalData {
  collectionId?: string;
  collectionName?: string;
  Collection?: ConsumedLocation;
  userCurrentBalance?: number;
  balance?: number;
  bounty?: Bounty & {
    ActionLocation?: ConsumedLocation[];
    isJoined: boolean;
    isOwner: boolean;
  };

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
