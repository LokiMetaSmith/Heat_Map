<?php

namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Encryption;

class EncryptionTest extends TestCase {
    public function testEncryptAndDecrypt() {
        $encryption = new Encryption();
        $encryption->setKey(bin2hex(random_bytes(32))); // Ensure we have a key

        $email = "test@example.com";
        $encrypted = $encryption->encryptEmail($email);

        // Assert it's in the expected iv:tag:data format
        $this->assertEquals(3, count(explode(':', $encrypted)));

        $decrypted = $encryption->decryptEmail($encrypted);
        $this->assertEquals($email, $decrypted);
    }
}
