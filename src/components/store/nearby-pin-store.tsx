import { create } from "zustand";
import { Location, LocationGroup } from "@prisma/client";

type Pin = {
    locationGroup:
    | (LocationGroup & {
        creator: { profileUrl: string | null };
    })
    | null;
    _count: {
        consumers: number;
    };
} & Location;

interface NearbyPinsState {
    nearbyPins: Pin[];
    allPins: Pin[];
    setAllPins: (pins: Pin[]) => void;
    setNearbyPins: (pins: Pin[]) => void;
    filterNearbyPins: (center: google.maps.LatLngBoundsLiteral) => void;
}

export const useNearbyPinsStore = create<NearbyPinsState>((set, get) => ({
    nearbyPins: [],
    allPins: [], // Store all pins
    setNearbyPins: (pins: Pin[]) => set({ nearbyPins: pins }),
    setAllPins: (pins: Pin[]) => set({ allPins: pins }),
    filterNearbyPins: (center: google.maps.LatLngBoundsLiteral) => {
        const { allPins } = get();
        const filtered = allPins.filter(
            (pin) =>
                pin.latitude >= center.south &&
                pin.latitude <= center.north &&
                pin.longitude >= center.west &&
                pin.longitude <= center.east,
        );
        set({ nearbyPins: filtered });
    },
}));