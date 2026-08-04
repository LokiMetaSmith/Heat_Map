<?php

namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Fuzzer;

class FuzzerTest extends TestCase {
    public function testFuzzLocationReturnsCoordinates() {
        $exactLat = 40.7128;
        $exactLng = -74.0060;
        $radius = 1000;

        $fuzzed = Fuzzer::fuzzLocation($exactLat, $exactLng, $radius);

        $this->assertArrayHasKey('lat', $fuzzed);
        $this->assertArrayHasKey('lng', $fuzzed);
        $this->assertIsFloat($fuzzed['lat']);
        $this->assertIsFloat($fuzzed['lng']);

        // Approximate distance check could be added here,
        // but testing it returns valid lat/lng is the core requirement.
        $this->assertNotEquals($exactLat, $fuzzed['lat']);
        $this->assertNotEquals($exactLng, $fuzzed['lng']);
    }
}
