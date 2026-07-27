/**
 * Generates a random, uniformly distributed coordinate within a radius
 * @param {number} exactLat - The real latitude
 * @param {number} exactLng - The real longitude
 * @param {number} maxRadiusMeters - The user's chosen privacy radius in meters
 * @returns {Object} { lat, lng } - The fuzzed coordinates to store in the DB
 */
function fuzzLocation(exactLat, exactLng, maxRadiusMeters) {
    const EARTH_RADIUS = 6371000; // Earth's mean radius in meters

    // 1. Generate uniform random distance and bearing
    // Math.sqrt ensures points don't cluster at the center
    const distance = maxRadiusMeters * Math.sqrt(Math.random());
    const bearing = 2 * Math.PI * Math.random(); // Random angle between 0 and 2π radians

    // 2. Convert starting exact coordinates to radians
    const lat1 = exactLat * (Math.PI / 180);
    const lng1 = exactLng * (Math.PI / 180);

    // Angular distance in radians
    const angularDistance = distance / EARTH_RADIUS;

    // 3. Spherical trigonometry to find new latitude
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    // 4. Spherical trigonometry to find new longitude
    const lng2 = lng1 + Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    // 5. Convert the fuzzed radians back to degrees for database storage
    return {
        lat: lat2 * (180 / Math.PI),
        lng: lng2 * (180 / Math.PI)
    };
}

module.exports = {
    fuzzLocation
};
