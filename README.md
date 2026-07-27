# Heat_Map

Simple heatmap, privacy conscious, and secure by default.

This repository contains the Minimum Viable Product (MVP) for a privacy-first spatial application. It allows users to visualize activity density on a map without ever exposing their exact location or their email address to the public, or even to the database administrators.

## Core Privacy Architecture

This application relies on three foundational privacy mechanisms:

1. **Location Fuzzing:** Exact coordinates are never saved to the database. When a user submits an address, the backend geocodes it, applies a spherical trigonometry formula (a variation of the Haversine formula) to generate a random coordinate within a user-defined "privacy radius", and immediately drops the exact coordinates from memory.
2. **Symmetric Encryption (AES-256-GCM):** Email addresses are securely encrypted at rest. If the database is compromised, user contact information remains hidden. The GCM mode includes an authentication tag, preventing malicious tampering with the ciphertexts.
3. **Double-Blind Handshake:** Users can request to connect with others in a specific geographic area (a "say hello" radius). The backend securely processes this by decrypting emails *in-memory only*, dispatching a generic relay email containing a secure token. Neither party sees the other's email address until the recipient explicitly opts-in by clicking the secure link, triggering a mutual exchange email.

## Tech Stack

*   **Frontend:** HTML/CSS/JS, Leaflet.js (OpenStreetMap wrapper), and `heatmap.js`.
*   **Backend:** Node.js (Express).
*   **Database:** PostgreSQL with PostGIS extension for rapid geospatial queries.
*   **Email Relay:** Nodemailer (using Ethereal Email for local testing).

---

## Getting Started

### Prerequisites

You will need the following installed on your machine:
*   [Docker](https://docs.docker.com/get-docker/) & Docker Compose
*   [Node.js](https://nodejs.org/) (v18+ recommended) - *Only required if running in baremetal mode.*

### Running the Application

A convenience script (`run.sh`) is provided to easily boot the application.

You must pass a mode to the script: `container` or `baremetal`.

#### Option 1: Full Containerized Stack (Recommended)
This mode runs both the Node.js API and the PostgreSQL database inside Docker containers.

```bash
chmod +x run.sh
./run.sh container
```
*The app will be available at `http://localhost:3000`.*

#### Option 2: Baremetal Mode
This mode runs the PostgreSQL database in Docker, but installs NPM dependencies and runs the Node.js application directly on your host machine.

```bash
chmod +x run.sh
./run.sh baremetal
```
*The app will be available at `http://localhost:3000`.*

### Testing

This repository contains a comprehensive test suite covering the cryptography, spatial fuzzing math, API endpoints, and End-to-End (E2E) UI flows.

The test suite uses **Jest**, **Supertest**, and **Playwright**.

To run all tests:
```bash
npm test
```
*Note: You must run `npm install` first if you haven't already.*

---

## Usage Guide

1. **Registering a Location:**
   Navigate to `http://localhost:3000`. In the "Register Location" panel, enter an address (e.g., "Central Park, NY"), your email, and a privacy radius in meters. When you submit, a fuzzed location will be plotted on the heatmap.
2. **Initiating a Connection:**
   In the "Say Hello" panel, enter your sender email and a search radius. Click anywhere on the map to drop a pin. The backend will find all users whose *fuzzed* coordinates fall within that radius.
3. **Accepting a Connection:**
   Because this is a local development environment, real emails are not sent. Instead, look at your terminal console running the server. You will see an Ethereal Email "Preview URL" printed out. Click that link to view the mock email and click the connection link to complete the double-blind handshake.