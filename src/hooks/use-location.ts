import { useState, useEffect } from 'react';
import { getCurrentLocation, LocationCoords } from '~/utils/location';

export function useLocation() {
    const [location, setLocation] = useState<LocationCoords | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestLocation = async () => {
        setLoading(true);
        setError(null);

        try {
            const coords = await getCurrentLocation();
            setLocation(coords);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get location');
        } finally {
            setLoading(false);
        }
    };

    return {
        location,
        loading,
        error,
        requestLocation,
    };
}
