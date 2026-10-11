# Production Deployment Guide (DigitalOcean + Cloudflare)

This guide walks you through deploying the Heat_Map application to a cheap Virtual Private Server (VPS) like a DigitalOcean Droplet, configuring it behind a Cloudflare reverse proxy for free SSL and DDoS protection, and using SendGrid for reliable email delivery.

## Prerequisites

1.  **DigitalOcean Account:** Or any other provider offering a cheap Linux VPS (e.g., AWS EC2 free tier, Hetzner, Linode).
2.  **Cloudflare Account:** A free account to manage your domain's DNS and provide the reverse proxy/SSL.
3.  **A Domain Name:** Registered with any registrar and pointed to Cloudflare's nameservers.
4.  **SendGrid Account:** A free SendGrid account to securely send the relay emails.

---

## Step 1: Provision the Server

1.  Log in to your DigitalOcean (or equivalent) account.
2.  Create a new Droplet (Virtual Machine).
3.  **OS:** Choose **Ubuntu 24.04 LTS** (or 22.04).
4.  **Size:** Choose the cheapest basic plan (e.g., 1GB RAM / 1 vCPU is plenty for this Node.js/PostgreSQL stack).
5.  **Authentication:** Add your SSH keys for secure access.
6.  Deploy the Droplet and note its **Public IPv4 Address**.

---

## Step 2: Configure Cloudflare DNS & SSL

By using Cloudflare, we don't need to manually install Let's Encrypt certificates (like Certbot) on the server. Cloudflare provides "Edge Certificates" for free.

1.  Log in to your Cloudflare dashboard and select your domain.
2.  Go to the **DNS** tab.
3.  Add an `A` record pointing your domain (or a subdomain like `map.yourdomain.com`) to your Droplet's **Public IP Address**.
    *   *Make sure the "Proxy status" is toggled to **Proxied (orange cloud)**.*
4.  Go to the **SSL/TLS** tab.
5.  Set the encryption mode to **Flexible** or **Full**.
    *   *Note: Since Cloudflare acts as a reverse proxy directly hitting our Dockerized app on port 80/3000 (which is HTTP), "Flexible" is the easiest setup. If you use "Full", you'll need to set up a self-signed certificate on the droplet using an Nginx/Caddy container.*

---

## Step 3: Server Setup

Open your terminal and connect to your newly created Droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

### 1. Install Docker and Git

Update your packages and install the necessary dependencies:

```bash
# Update packages
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Git
apt-get install git -y
```

### 2. Clone the Repository

```bash
git clone https://github.com/LokiMetaSmith/Heat_Map.git
cd Heat_Map
```

### 3. Create the Production Environment File

You need to provide the encryption key and your SendGrid credentials to the application.

Create a `.env` file (`vi .env` or `echo "..." > .env`) and add the following configuration:

```env
# Secure encryption key for emails (Generate one via: openssl rand -hex 32)
EMAIL_SECRET_KEY=your_secure_64_character_hex_string_here

# SendGrid SMTP Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
# Your actual SendGrid API Key goes here
SMTP_PASS=your_sendgrid_api_key
```

---

## Step 4: Run the Application

Because the architecture relies on Docker Compose, deploying is extremely straightforward.

To run the application in the background (detached mode) so it stays running after you close your SSH session, use Docker Compose directly:

```bash
docker compose up -d --build
```

This command will:
1. Pull the PostGIS database image.
2. Build the Node.js application image.
3. Start both containers and link them together.

*Note: The `docker-compose.yml` binds the Node.js app to port `3000` on the host. Since Cloudflare's flexible SSL expects traffic on port 80, you can either forward port 80 to 3000 via iptables, or modify the `docker-compose.yml` port mapping for `app-node` to `"80:3000"`.*

### Binding to Port 80 (Optional but Recommended)

If you want the app accessible directly without specifying a port in the URL (which Cloudflare requires for its standard HTTP proxying):

Open `docker-compose.yml` and find the `app-node` service. Change the ports block:
```yaml
  app-node:
    build: .
    ports:
      - "80:3000" # Changed from "3000:3000"
```
Restart the containers:
```bash
docker compose down
docker compose up -d --build
```

---

## Step 5: Verification

1.  Navigate to your domain in your web browser (e.g., `https://map.yourdomain.com`).
2.  You should see the Heat_Map interface loaded securely over HTTPS.
3.  Register a location using an email address you have access to.
4.  Try to initiate a connection to test the SendGrid integration. You should receive the relay email in your inbox!

## Maintenance

To view logs for your application to ensure emails are sending correctly:
```bash
docker compose logs -f app-node
```

To update the application when new code is pushed to GitHub:
```bash
git fetch && git merge origin/main
docker compose up -d --build
```
