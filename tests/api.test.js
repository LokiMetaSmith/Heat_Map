const request = require('supertest');
const app = require('../server');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const crypto = require('crypto');

// Mock dependencies
jest.mock('axios');
jest.mock('nodemailer');
jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

const { encryptEmail } = require('../encryption');

describe('API Endpoints', () => {
    let pool;
    let mockTransporter;

    beforeEach(() => {
        pool = new Pool();
        jest.clearAllMocks();

        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
        };
        nodemailer.createTestAccount.mockImplementation(async () => {
            return { user: 'test', pass: 'test' };
        });
        nodemailer.createTransport.mockReturnValue(mockTransporter);
        nodemailer.getTestMessageUrl = jest.fn().mockReturnValue('http://test.url');

        // Force server.js to use our mock transporter
        app.set('transporter', mockTransporter);
    });

    describe('POST /api/register', () => {
        it('should register a user, geocode, fuzz, and store', async () => {
            // Mock Nominatim geocoding
            axios.get.mockResolvedValue({
                data: [{ lat: '40.7128', lon: '-74.0060' }]
            });

            // Mock DB insert
            pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

            const res = await request(app)
                .post('/api/register')
                .send({
                    address: '123 Main St, New York',
                    email: 'user@test.com',
                    radius: 2000
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('User registered successfully with fuzzed location');
            expect(res.body.fuzzedLat).toBeDefined();
            expect(res.body.fuzzedLng).toBeDefined();

            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining('123%20Main%20St%2C%20New%20York'),
                expect.any(Object)
            );
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                expect.arrayContaining([
                    expect.any(Number), // Lng
                    expect.any(Number), // Lat
                    expect.stringContaining(':') // Encrypted email
                ])
            );
        });

        it('should return 400 if fields are missing', async () => {
            const res = await request(app).post('/api/register').send({});
            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toBe('Missing required fields');
        });

        it('should return 400 if geocoding fails', async () => {
            axios.get.mockResolvedValue({ data: [] });
            const res = await request(app)
                .post('/api/register')
                .send({ address: 'Fake', email: 'a@b.com', radius: 1000 });
            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toBe('Could not geocode address');
        });
    });

    describe('GET /api/heatmap', () => {
        it('should return heatmap data', async () => {
            pool.query.mockResolvedValue({
                rows: [
                    { lat: 40.7, lng: -74.0 },
                    { lat: 40.8, lng: -73.9 }
                ]
            });

            const res = await request(app).get('/api/heatmap');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toHaveProperty('lat', 40.7);
            expect(res.body[0]).toHaveProperty('count', 1);
        });
    });

    describe('POST /api/connect', () => {
        it('should find users in radius and send emails', async () => {
            const targetEmail = 'target@test.com';
            const encryptedTarget = encryptEmail(targetEmail);

            pool.query
                // First query: find users
                .mockResolvedValueOnce({
                    rows: [{ id: 10, encrypted_email: encryptedTarget }]
                })
                // Second query: insert token
                .mockResolvedValueOnce({});

            const res = await request(app)
                .post('/api/connect')
                .send({
                    lat: 40.7,
                    lng: -74.0,
                    radius: 5000,
                    sender_email: 'sender@test.com'
                });

            // Wait a tick for async initialization of nodemailer if needed (it happens globally in server.js but mocked)
            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('Connection requests sent to 1 users');

            expect(pool.query).toHaveBeenCalledTimes(2); // Search, then insert token

            // Check that the email was decrypted properly for the recipient
            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: targetEmail,
                    subject: 'Someone in your area wants to say hello!'
                })
            );
        });

        it('should return message if no users found', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/connect')
                .send({
                    lat: 40.7,
                    lng: -74.0,
                    radius: 5000,
                    sender_email: 'sender@test.com'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('No users found in that area.');
            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/connect/:token', () => {
        it('should validate token, send mutual emails, and delete token', async () => {
            const senderEmail = 'sender@test.com';
            const recipientEmail = 'target@test.com';

            pool.query
                // First query: get token info
                .mockResolvedValueOnce({
                    rows: [{
                        sender_encrypted_email: encryptEmail(senderEmail),
                        recipient_id: 10,
                        recipient_encrypted_email: encryptEmail(recipientEmail)
                    }]
                })
                // Second query: delete token
                .mockResolvedValueOnce({});

            const token = 'fake-token-123';
            const res = await request(app).get(`/api/connect/${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain('Connection successful!');

            expect(pool.query).toHaveBeenCalledTimes(2);
            expect(pool.query).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('DELETE FROM connection_requests'),
                [token]
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: [senderEmail, recipientEmail],
                    subject: 'You have a new mutual connection!'
                })
            );
        });

        it('should return 404 for invalid token', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/connect/invalid-token');

            expect(res.statusCode).toEqual(404);
            expect(res.text).toBe('Invalid or expired token.');
        });
    });
});