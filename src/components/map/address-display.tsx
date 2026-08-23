import { useGeolocation, useReverseGeolocation } from "~/hooks/use-geolocation";
import { Badge } from "../shadcn/ui/badge";
import { cn } from "~/lib/utils";

interface LocationAddressDisplayProps {
    latitude: number;
    longitude: number;
    className?: string;
}

export function LocationAddressDisplay({
    latitude,
    longitude,
    className,
}: LocationAddressDisplayProps) {
    const { address, loading } = useReverseGeolocation(latitude, longitude);
    return (
        <Badge className={cn("gap-1", className)}>
            <div className="flex items-center justify-between text-center">
                <span className="text-sm font-bold ">{loading ? "Loading..." : address}</span>
            </div>
        </Badge>
    )
}