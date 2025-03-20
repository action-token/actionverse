import { type ControlPosition, MapControl } from "@vis.gl/react-google-maps"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { PlaceAutocomplete } from "./auto-complete"

type CustomAutocompleteControlProps = {
    controlPosition: ControlPosition
    onCenterChange: (center: google.maps.LatLngLiteral) => void
    onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void
    setIsCordsSearch: (isCordsSearch: boolean) => void
    setCordSearchLocation: (location: google.maps.LatLngLiteral) => void
    setSearchCoordinates: (searchCoordinates: google.maps.LatLngLiteral) => void
    setZoom: (zoom: number) => void
}

export const CustomMapControl = ({
    controlPosition,
    onPlaceSelect,
    onCenterChange,
    setIsCordsSearch,
    setCordSearchLocation,
    setSearchCoordinates,
    setZoom,
}: CustomAutocompleteControlProps) => {
    return (
        <MapControl position={controlPosition}>
            <div className="autocomplete-control w-full">

                <PlaceAutocomplete
                    onPlaceSelect={onPlaceSelect}
                    onCenterChange={onCenterChange}
                    setIsCordsSearch={setIsCordsSearch}
                    setCordSearchLocation={setCordSearchLocation}
                    setSearchCoordinates={setSearchCoordinates}
                    setZoom={setZoom}
                />
            </div>

        </MapControl>

    )
}

