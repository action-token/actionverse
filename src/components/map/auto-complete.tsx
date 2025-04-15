import React, { useRef, useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useSelectedAutoSuggestion } from "~/lib/state/map/useSelectedAutoSuggestion";
import { Input } from "../shadcn/ui/input";
import { Search } from "lucide-react";

interface Props {
    onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
    onCenterChange: (latLng: google.maps.LatLngLiteral) => void; // Callback to set map center
    setIsCordsSearch: (isCordsSearch: boolean) => void;
    setCordSearchLocation: (location: google.maps.LatLngLiteral) => void;
    setSearchCoordinates: (searchCoordinates: google.maps.LatLngLiteral) => void;
    setZoom: (zoom: number) => void;
}

// This is an example of the classic "Place Autocomplete" widget.
// https://developers.google.com/maps/documentation/javascript/place-autocomplete
export const PlaceAutocomplete = ({
    onPlaceSelect,
    onCenterChange,
    setIsCordsSearch,
    setCordSearchLocation,
    setSearchCoordinates,
    setZoom
}: Props) => {
    const { setSelectedPlace } = useSelectedAutoSuggestion();

    const [placeAutocomplete, setPlaceAutocomplete] =
        useState<google.maps.places.Autocomplete | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary("places");

    useEffect(() => {
        if (!places || !inputRef.current) return;

        const options = {
            fields: ["geometry", "name", "formatted_address"],
        };

        setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
    }, [places]);

    useEffect(() => {
        if (!placeAutocomplete) return;

        placeAutocomplete.addListener("place_changed", () => {
            const place = placeAutocomplete.getPlace();
            onPlaceSelect(place);

            const lat = place.geometry?.location?.lat();
            const lng = place.geometry?.location?.lng();

            if (lat !== undefined && lng !== undefined) {
                const latLng = { lat, lng };
                setSelectedPlace(latLng);
                setSearchCoordinates(latLng);
                onCenterChange(latLng); // Center map on selected place
                setZoom(16);
            }
        });
    }, [onPlaceSelect, placeAutocomplete, setSelectedPlace, onCenterChange]);

    const handleCoordinatesInput = () => {
        if (inputRef.current) {
            const value = inputRef.current.value.trim();
            const [latStr, lngStr] = value.split(",").map((str) => str.trim());
            const lat = Number(latStr);
            const lng = Number(lngStr);

            if (!isNaN(lat) && !isNaN(lng)) {
                const latLng: google.maps.LatLngLiteral = { lat, lng };
                onCenterChange(latLng);
                setSelectedPlace(latLng);
                setIsCordsSearch(true);
                setCordSearchLocation(latLng);
                setZoom(16);
            } else {
                console.error(
                    "Invalid coordinates. Please enter valid latitude and longitude.",
                );
            }
        }
    };

    return (
        <div className="w-full relative mt-1">
            <Search className="absolute top-3 left-3" />
            <Input
                ref={inputRef}
                placeholder="Enter a location or coordinates"
                type="text"
                className="h-12 w-80 pl-9  rounded-lg border-2 "
                onKeyDown={() => handleCoordinatesInput()}
            />
        </div>
    );
};
