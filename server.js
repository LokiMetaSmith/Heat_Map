require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const { encryptEmail, decryptEmail } = require('./encryption');
const { fuzzLocation } = require('./fuzzer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'heatmap',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: process.env.POSTGRES_PORT || 5432,
});

// Nodemailer setup (Ethereal for local testing)
let transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows'
});

app.set('transporter', transporter); // For testing

async function initNodemailer() {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    let testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
        },
    });
    console.log("Ethereal email initialized:", testAccount.user);
}
initNodemailer();

// API Endpoints

// 1. Register a user's location
app.post('/api/register', async (req, res) => {
    try {
        const { address, email, radius } = req.body; // radius in meters

        if (!address || !email || !radius) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Geocode with Nominatim
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
        const geocodeResponse = await axios.get(nominatimUrl, {
            headers: { 'User-Agent': 'PrivacyApp/1.0' }
        });

        if (!geocodeResponse.data || geocodeResponse.data.length === 0) {
            return res.status(400).json({ error: 'Could not geocode address' });
        }

        const exactLat = parseFloat(geocodeResponse.data[0].lat);
        const exactLng = parseFloat(geocodeResponse.data[0].lon);

        // Fuzz coordinates
        const { lat: fuzzedLat, lng: fuzzedLng } = fuzzLocation(exactLat, exactLng, parseInt(radius));

        // Encrypt email
        const encryptedEmail = encryptEmail(email);

        // Store in DB
        const query = `
            INSERT INTO users (location, encrypted_email)
            VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
            RETURNING id
        `;
        const values = [fuzzedLng, fuzzedLat, encryptedEmail]; // PostGIS expects Longitude, Latitude

        await pool.query(query, values);

        res.json({ message: 'User registered successfully with fuzzed location', fuzzedLat, fuzzedLng });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// 2. Get heatmap data
app.get('/api/heatmap', async (req, res) => {
    try {
        const query = `
            SELECT ST_Y(location) as lat, ST_X(location) as lng
            FROM users
        `;
        const result = await pool.query(query);

        const data = result.rows.map(row => ({
            lat: row.lat,
            lng: row.lng,
            count: 1
        }));

        res.json(data);
    } catch (error) {
        console.error('Heatmap fetch error:', error);
        res.status(500).json({ error: 'Internal server error fetching heatmap data' });
    }
});

// 3. Initiate a connection (Double-blind handshake start)
app.post('/api/connect', async (req, res) => {
    try {
        const { lat, lng, radius, sender_email } = req.body; // radius in meters

        if (!lat || !lng || !radius || !sender_email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const encryptedSenderEmail = encryptEmail(sender_email);

        // Geospatial Query: Find all fuzzed coordinates within the radius
        const query = `
            SELECT id, encrypted_email
            FROM users
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
            )
        `;
        const values = [lng, lat, radius]; // ST_MakePoint takes (lon, lat)

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.json({ message: 'No users found in that area.' });
        }

        let emailsSent = 0;

        for (const user of result.rows) {
            const token = uuidv4();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Store token in DB
            const insertTokenQuery = `
                INSERT INTO connection_requests (token, sender_encrypted_email, recipient_id, expires_at)
                VALUES ($1, $2, $3, $4)
            `;
            await pool.query(insertTokenQuery, [token, encryptedSenderEmail, user.id, expiresAt]);

            // Decrypt recipient email to send the relay
            const recipientEmail = decryptEmail(user.encrypted_email);

            const connectionLink = `http://localhost:${process.env.PORT || 3000}/api/connect/${token}`;

            // Send email
            let currentTransporter = process.env.NODE_ENV === 'test' ? app.get('transporter') : transporter;
            let info = await currentTransporter.sendMail({
                from: '"Privacy App" <noreply@privacyapp.com>',
                to: recipientEmail,
                subject: "Someone in your area wants to say hello!",
                text: `Someone requested to connect with you! Click this link to approve and share contact info: ${connectionLink}`,
                html: `<p>Someone requested to connect with you!</p><p>Click <a href="${connectionLink}">this link</a> to approve and share contact info.</p>`
            });

            console.log("Message sent: %s", info.messageId);
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
            emailsSent++;
        }

        res.json({ message: `Connection requests sent to ${emailsSent} users.` });

    } catch (error) {
        console.error('Connect error:', error);
        res.status(500).json({ error: 'Internal server error initiating connection' });
    }
});

// 4. Accept a connection (Mutual Exchange)
app.get('/api/connect/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find the token
        const tokenQuery = `
            SELECT c.sender_encrypted_email, c.recipient_id, u.encrypted_email as recipient_encrypted_email
            FROM connection_requests c
            JOIN users u ON c.recipient_id = u.id
            WHERE c.token = $1 AND c.expires_at > NOW()
        `;
        const result = await pool.query(tokenQuery, [token]);

        if (result.rows.length === 0) {
            return res.status(404).send('Invalid or expired token.');
        }

        const request = result.rows[0];

        // Decrypt emails
        const senderEmail = decryptEmail(request.sender_encrypted_email);
        const recipientEmail = decryptEmail(request.recipient_encrypted_email);

        // Send mutual exchange email
        let currentTransporter = process.env.NODE_ENV === 'test' ? app.get('transporter') : transporter;
        let info = await currentTransporter.sendMail({
            from: '"Privacy App" <noreply@privacyapp.com>',
            to: [senderEmail, recipientEmail], // Send to both
            subject: "You have a new mutual connection!",
            text: `Great news! You both wanted to connect. \n\nSender: ${senderEmail}\nRecipient: ${recipientEmail}\n\nYou can now reply to this email to chat directly.`,
            html: `<p>Great news! You both wanted to connect.</p><p>Sender: ${senderEmail}<br>Recipient: ${recipientEmail}</p><p>You can now reply to this email to chat directly.</p>`
        });

        console.log("Mutual connection email sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

        // Delete the token so it cannot be used again
        await pool.query('DELETE FROM connection_requests WHERE token = $1', [token]);

        res.send('Connection successful! Check your email to start chatting.');

    } catch (error) {
        console.error('Accept connection error:', error);
        res.status(500).send('Internal server error accepting connection');
    }
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
