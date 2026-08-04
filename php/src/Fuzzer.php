<?php

namespace App;

class Fuzzer {
    public static function fuzzLocation(float $exactLat, float $exactLng, float $maxRadiusMeters): array {
        $earthRadius = 6371000; // Earth's mean radius in meters

        // 1. Generate uniform random distance and bearing
        $distance = $maxRadiusMeters * sqrt(mt_rand() / mt_getrandmax());
        $bearing = 2 * M_PI * (mt_rand() / mt_getrandmax());

        // 2. Convert starting exact coordinates to radians
        $lat1 = deg2rad($exactLat);
        $lng1 = deg2rad($exactLng);

        // Angular distance in radians
        $angularDistance = $distance / $earthRadius;

        // 3. Spherical trigonometry to find new latitude
        $lat2 = asin(
            sin($lat1) * cos($angularDistance) +
            cos($lat1) * sin($angularDistance) * cos($bearing)
        );

        // 4. Spherical trigonometry to find new longitude
        $lng2 = $lng1 + atan2(
            sin($bearing) * sin($angularDistance) * cos($lat1),
            cos($angularDistance) - sin($lat1) * sin($lat2)
        );

        // 5. Convert the fuzzed radians back to degrees
        return [
            'lat' => rad2deg($lat2),
            'lng' => rad2deg($lng2)
        ];
    }
}
