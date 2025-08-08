import { MapPin, Trophy, Search, Zap } from 'lucide-react';
import { Badge } from "~/components/shadcn/ui/badge";
import type { Bounty } from "~/types/game/bounty";

interface BountyTypeIndicatorProps {
    bountyType: Bounty["bountyType"];
    className?: string;
}

export function BountyTypeIndicator({ bountyType, className = "" }: BountyTypeIndicatorProps) {
    const getTypeConfig = (type: Bounty["bountyType"]) => {
        switch (type) {
            case "GENERAL":
                return {
                    icon: Trophy,
                    label: "General",
                    color: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
                };
            case "LOCATION_BASED":
                return {
                    icon: MapPin,
                    label: "Location",
                    color: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
                };
            case "SCAVENGER_HUNT":
                return {
                    icon: Search,
                    label: "Scavenger",
                    color: "bg-gradient-to-r from-purple-500 to-violet-500 text-white",
                };
            default:
                return {
                    icon: Trophy,
                    label: "General",
                    color: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
                };
        }
    };

    const config = getTypeConfig(bountyType);
    const Icon = config.icon;

    return (
        <Badge className={`${config.color} border-0 px-3 py-1 font-semibold ${className}`}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
        </Badge>
    );
}
