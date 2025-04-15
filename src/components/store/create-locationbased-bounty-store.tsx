import { create } from "zustand";

interface Location {
    lat: number;
    lng: number;
}

interface CreateLoactionBasedBountyProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    data?: Location;
    setData: (data: Location) => void;
}

export const useCreateLocationBasedBountyStore = create<CreateLoactionBasedBountyProps>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
    data: undefined,
    setData: (data) => set({ data }),
}));
