const { encryptEmail, decryptEmail } = require('../encryption');

describe('Encryption Module', () => {
    it('should encrypt and decrypt an email address correctly', () => {
        const email = 'test@example.com';
        const encrypted = encryptEmail(email);

        expect(encrypted).not.toBe(email);
        expect(encrypted).toContain(':'); // Should have IV, Tag, and Ciphertext

        const decrypted = decryptEmail(encrypted);
        expect(decrypted).toBe(email);
    });

    it('should fail to decrypt if the ciphertext is tampered with', () => {
        const email = 'secure@example.com';
        const encrypted = encryptEmail(email);

        // Tamper with the ciphertext (last part)
        const parts = encrypted.split(':');
        // flip the last character
        const lastChar = parts[2].slice(-1) === 'a' ? 'b' : 'a';
        parts[2] = parts[2].slice(0, -1) + lastChar;
        const tampered = parts.join(':');

        expect(() => decryptEmail(tampered)).toThrow();
    });

    it('should fail to decrypt if the auth tag is tampered with', () => {
        const email = 'auth@example.com';
        const encrypted = encryptEmail(email);

        const parts = encrypted.split(':');
        // flip the last character of auth tag (middle part)
        const lastChar = parts[1].slice(-1) === 'a' ? 'b' : 'a';
        parts[1] = parts[1].slice(0, -1) + lastChar;
        const tampered = parts.join(':');

        expect(() => decryptEmail(tampered)).toThrow();
    });

    it('should format the output correctly (iv:authTag:encryptedData)', () => {
        const encrypted = encryptEmail('format@test.com');
        const parts = encrypted.split(':');

        expect(parts).toHaveLength(3);
        // IV should be 12 bytes = 24 hex chars
        expect(parts[0]).toHaveLength(24);
        // Auth tag should be 16 bytes = 32 hex chars
        expect(parts[1]).toHaveLength(32);
        // Ciphertext should be some hex string
        expect(parts[2].length).toBeGreaterThan(0);
    });
});