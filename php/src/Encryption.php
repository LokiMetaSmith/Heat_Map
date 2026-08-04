<?php

namespace App;

class Encryption {
    private const ALGORITHM = 'aes-256-gcm';
    private string $key;

    public function __construct() {
        $envKey = getenv('EMAIL_SECRET_KEY') ?: ($_ENV['EMAIL_SECRET_KEY'] ?? '');
        if (!empty($envKey)) {
            $this->key = hex2bin($envKey);
        } else {
            // For local development compatibility if env var is missing
            $this->key = random_bytes(32);
        }
    }

    // For testing purposes
    public function setKey(string $hexKey): void {
        $this->key = hex2bin($hexKey);
    }

    public function encryptEmail(string $text): string {
        $iv = random_bytes(12);
        $tag = '';

        $encrypted = openssl_encrypt(
            $text,
            self::ALGORITHM,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );

        return bin2hex($iv) . ':' . bin2hex($tag) . ':' . bin2hex($encrypted);
    }

    public function decryptEmail(string $encryptedTextString): string {
        $parts = explode(':', $encryptedTextString);
        if (count($parts) !== 3) {
            throw new \Exception('Invalid encrypted string format');
        }

        $iv = hex2bin($parts[0]);
        $tag = hex2bin($parts[1]);
        $encryptedText = hex2bin($parts[2]);

        $decrypted = openssl_decrypt(
            $encryptedText,
            self::ALGORITHM,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($decrypted === false) {
            throw new \Exception('Decryption failed');
        }

        return $decrypted;
    }
}
