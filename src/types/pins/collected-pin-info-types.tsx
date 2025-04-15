import { Location, LocationGroup } from "@prisma/client";

export type collectedPinInfoType = {
    location: Location & {
        locationGroup: LocationGroup | null;
    };
};