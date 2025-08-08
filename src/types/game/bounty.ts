export type Bounty = {
    id: string;
    title: string;
    description: string;
    priceInUSD: number;
    priceInBand: number;
    requiredBalance: number;
    currentWinnerCount: number;
    latitude?: number | null;
    longitude?: number | null;
    radius?: number | null;

    imageUrls: string[];
    totalWinner: number;
    bountyType: "GENERAL" | "LOCATION_BASED" | "SCAVENGER_HUNT";
    status: "PENDING" | "APPROVED" | "REJECTED";
    creatorId: string;
    _count: {
        participants: number;
        BountyWinner: number;
    }
    creator: {
        name: string;
        profileUrl: string;
    },
    BountyWinner: {
        user: {
            id: string;
        }
    }[],
    isJoined: boolean;
    isOwner: boolean;
    currentStep: number | undefined;
    ActionLocation?: ActionLocation[]
}
export interface ActionLocation {
    id: number;
    bountyId: number;
    bounty: BountyTypeEnum;
    locationGroupId: string;
    serial: number;
    creatorId: string;
    createdAt: Date;
}

export enum BountyTypeEnum {
    "ALL" = "ALL",
    GENERAL = "GENERAL",
    LOCATION_BASED = "LOCATION_BASED",
    SCAVENGER_HUNT = "SCAVENGER_HUNT",
}

export enum sortOptionEnum {
    DATE_ASC = "DATE_ASC",
    DATE_DESC = "DATE_DESC",
    PRICE_ASC = "PRICE_ASC",
    PRICE_DESC = "PRICE_DESC",
}
