const { test, expect } = require('@playwright/test');

test.describe('Privacy-First Spatial App', () => {

    test.beforeEach(async ({ page }) => {
        // Mock the geolocation and geocoding api calls
        await page.route('/api/heatmap', async route => {
            const json = [{ lat: 39.8283, lng: -98.5795, count: 1 }];
            await route.fulfill({ json });
        });

        await page.route('/api/register', async route => {
            const json = { message: 'User registered successfully with fuzzed location', fuzzedLat: 39.8, fuzzedLng: -98.5 };
            await route.fulfill({ json });
        });

        await page.route('/api/connect', async route => {
            const json = { message: 'Connection requests sent to 1 users.' };
            await route.fulfill({ json });
        });

        await page.goto('/');
    });

    test('should load the map and controls correctly', async ({ page }) => {
        // Check map container
        const mapContainer = page.locator('#map');
        await expect(mapContainer).toBeVisible();

        // Check forms
        await expect(page.getByRole('heading', { name: 'Register Location' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Say Hello' })).toBeVisible();
    });

    test('should allow a user to register their location', async ({ page }) => {
        // Fill form
        await page.fill('#address', '123 Test St');
        await page.fill('#email', 'test@test.com');
        await page.fill('#radius', '5000');

        // Accept alert dialog automatically
        page.on('dialog', dialog => dialog.accept());

        // Submit form
        await page.click('button[type="submit"]');

        // Check form reset
        await expect(page.locator('#address')).toHaveValue('');
        await expect(page.locator('#email')).toHaveValue('');
    });

    test('should allow a user to click map to connect', async ({ page }) => {
        // Set sender email
        await page.fill('#senderEmail', 'sender@test.com');

        // Accept the confirmation dialog
        page.on('dialog', dialog => dialog.accept());

        // Start waiting for the response BEFORE clicking
        const responsePromise = page.waitForResponse('/api/connect');

        // Click the center of the map to trigger say hello
        await page.locator('#map').click({ position: { x: 300, y: 300 } });

        // Since we mock the route, we just want to ensure it doesn't crash or throw unexpected errors.
        // We're essentially testing the UI flow.

        // To verify the mocked fetch actually happens, we wait for the promise to resolve
        const response = await responsePromise;
        const responseBody = await response.json();
        expect(responseBody.message).toBe('Connection requests sent to 1 users.');
    });
});