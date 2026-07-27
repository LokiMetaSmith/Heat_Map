const { fuzzLocation } = require('../fuzzer');

// Haversine formula to calculate the distance between two points in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres
    return d;
}

describe('Fuzzer Module', () => {
    it('should return a fuzzed location within the specified radius', () => {
        const exactLat = 40.7128;
        const exactLng = -74.0060;
        const radiusMeters = 3000; // 3km

        // Run multiple times to ensure randomness stays within bounds
        for (let i = 0; i < 50; i++) {
            const { lat, lng } = fuzzLocation(exactLat, exactLng, radiusMeters);

            expect(lat).not.toBe(exactLat);
            expect(lng).not.toBe(exactLng);

            const distance = getDistance(exactLat, exactLng, lat, lng);
            // Allow a tiny margin of error for floating point arithmetic
            expect(distance).toBeLessThanOrEqual(radiusMeters + 1);
        }
    });

    it('should handle coordinates near the equator', () => {
        const exactLat = 0.0;
        const exactLng = -50.0;
        const radiusMeters = 10000;

        const { lat, lng } = fuzzLocation(exactLat, exactLng, radiusMeters);
        const distance = getDistance(exactLat, exactLng, lat, lng);
        expect(distance).toBeLessThanOrEqual(radiusMeters + 1);
    });

    it('should handle coordinates near the poles', () => {
        const exactLat = 89.0;
        const exactLng = 10.0;
        const radiusMeters = 5000;

        const { lat, lng } = fuzzLocation(exactLat, exactLng, radiusMeters);
        const distance = getDistance(exactLat, exactLng, lat, lng);
        expect(distance).toBeLessThanOrEqual(radiusMeters + 1);
    });
});