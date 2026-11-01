## Archived: 2026-10-31

* The project can be run using the `run.sh` script, which accepts a mode (`container` or `baremetal`) as the first argument, and optionally the target backend (`node` or `php`, defaults to node) as the second argument, supporting both Docker and Podman.
* Use Nodemailer (in Node.js) and PHPMailer (in PHP) with Ethereal Email for local testing of email-sending functionalities. This is overridden in production by providing real SMTP credentials (e.g., SendGrid) via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
* The backend handles all external API logic, including geocoding raw address strings, to prevent exposing exact coordinates on the client side.
* The application architecture and implementation must be kept simple and lightweight so it can run on the lowest-cost virtual machine possible.
* The vanilla PHP 8 backend is isolated in the `php/` directory, managed with Composer, and served using the official `php:8-apache` Docker image, functioning interchangeably with the Node.js backend on host port 3000.
* Playwright test artifacts, including the HTML test reports, are generated and stored in the `playwright-report/` directory.
* Before making changes, start a deep planning mode to ask clarifying questions using user input tools until requirements are crystal clear, then create a plan and execute autonomously.
* The database uses a separate 'connection_requests' table to store temporary tokens, sender encrypted details, recipient IDs, and expiration timestamps to keep the double-blind handshake decoupled from the main users table.
* Production deployment is documented in `DEPLOYMENT.md`, targeting a basic Linux VPS (like a DigitalOcean droplet) configured with a Cloudflare reverse proxy and deployed via Docker Compose.
* The repository is a privacy-first spatial app built with both a Node.js (Express) and a vanilla PHP 8 backend, PostgreSQL with PostGIS, and a frontend utilizing Leaflet.js and heatmap.js.
* The project uses Jest and Supertest for Node.js unit and API testing, PHPUnit for PHP backend testing, and Playwright for end-to-end (E2E) testing to ensure API parity between backends.
* To execute the complete test suite, run the command `npm test`, which is configured to execute both Jest and Playwright tests.
* When configuring Docker containers (e.g., in `docker-compose.yml`), use fully qualified image names (e.g., `docker.io/postgis/postgis:15-3.3-alpine` instead of just `postgis/postgis`) to ensure compatibility with Podman's unqualified-search registry restrictions.
* To set up the testing environment locally, execute `npm install` followed by `npx playwright install` and `npx playwright install-deps` to ensure all Node modules and Playwright browser/system dependencies are available.
* The application prioritizes data minimization by fuzzing exact locations using a Haversine formula variation before database insertion, and encrypting user emails using AES-256-GCM.
