-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    location GEOMETRY(Point, 4326) NOT NULL,
    encrypted_email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a spatial index for fast querying
CREATE INDEX IF NOT EXISTS users_location_idx ON users USING GIST (location);

-- Create connection_requests table
CREATE TABLE IF NOT EXISTS connection_requests (
    token VARCHAR(255) PRIMARY KEY,
    sender_encrypted_email TEXT NOT NULL,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index to quickly find requests by token or cleanup expired ones
CREATE INDEX IF NOT EXISTS connection_requests_expires_at_idx ON connection_requests(expires_at);
