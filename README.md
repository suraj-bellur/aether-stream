# 🎬 AETHER STREAM - Personal Video Streaming Platform

A high-performance, self-hosted video streaming architecture designed for zero-copy streaming of large personal video libraries. Built with microservices, Docker, Vagrant, FastAPI, Nginx, and Cloudflare Tunnels for instant, secure HTTPS access across Mobile and Desktop.

---

## 🏗️ Tech Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Virtualization & VM** | **Vagrant** + **VirtualBox** | Ubuntu 22.04 LTS (`ubuntu/jammy64`) environment setup |
| **Orchestration** | **Docker** & **Docker Compose** | Containerized microservice lifecycle & network management |
| **Backend Service** | **Python 3.11** + **FastAPI** + **Uvicorn** | Dynamic file scanner, metadata parser, authentication |
| **Media Processing** | **FFmpeg** | On-demand thumbnails: best-of-several frame selection |
| **Frontend Web App** | **Vanilla JS (ES6+)** + **CSS3** | Ambient cinema UI (colour-adaptive theme, card→player morph, hover previews), passkey login, search/sort, resume & up-next playback |
| **Web Gateway** | **Nginx** (`nginx:alpine`) | Reverse proxy, secure video streaming (`sendfile`), route protection (`auth_request`) |
| **Remote Access & SSL** | **Cloudflare Tunnels** + **GoDaddy DNS** | Zero-trust HTTPS tunnel (`https://your-public-hostname`) |

---

## 🧩 Architectural Concepts & Engineering Design

### 1. Zero-Copy Host Storage Mounting
* Large video collections (50GB+) remain on the host Windows machine, in the folder set in the `Vagrantfile`.
* VirtualBox Synced Folders mount this path into the Ubuntu VM at `/media/videos`.
* Docker Compose bind-mounts `/media/videos` **read-only** (`:ro`) into the `backend` and `nginx` containers.
* **Benefit**: Zero disk duplication, zero upload overhead, instant availability of new videos.

### 2. High-Performance Video Streaming
* Nginx directly streams the video files from the host mount using `sendfile` and `tcp_nopush`, bypassing the Python backend for massive performance gains.
* Nginx natively handles Partial Content (`206 Partial Content`) chunked byte ranges (`bytes=start-end`) for seamless scrubbing.
* All streams are strictly protected; Nginx intercepts video requests and verifies the session token using `auth_request` before serving any bytes.

### 3. Dynamic File Discovery & On-Demand Thumbnails
* Adding a `.mp4`, `.mkv`, `.webm`, or `.mov` file to the host folder immediately surfaces it on web page refresh.
* MD5 hash caching (`get_file_hash`) generates and stores a `.jpg` thumbnail (up to 1280px) in a persistent Docker volume (`thumbnail-cache`) only when requested. FFmpeg samples frames at 15/35/55/75% of the video and keeps the most detailed one, so black fades, title cards and blurry transitions are skipped. The video list is cached for 30 seconds, so new files show up within moments of a refresh.
* The UI letterboxes non-16:9 thumbnails (portrait, 4:3, ultra-wide) over a blurred copy of themselves instead of cropping, and tints the page with each thumbnail's dominant colour.

### 4. Global Passkey Authentication
* The entire platform is locked behind a single shared passkey (`SITE_PASSWORD`, required).
* Login creates a random server-side session token (stored hashed, persisted in the cache volume so restarts keep you signed in). The cookie holds only that token and is `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS.
* Sessions last 12 hours, or 30 days with **Remember me**. A logout button invalidates the session server-side, and the UI returns to the login screen automatically when a session expires.
* Failed logins are rate limited per client IP (5 attempts, then a 15 minute lockout).
* Nginx intercepts all API and video streaming routes using the `auth_request` module to verify the session at the edge.

### 5. Cloudflare Tunnel Gateway
* `cloudflared` runs as a microservice inside Docker (`video-tunnel`).
* Outbound QUIC/HTTP2 tunnel connects to Cloudflare Edge servers using `TUNNEL_TOKEN`.
* Bypasses router port forwarding, CGNAT, and home dynamic IP limitations while providing free SSL/HTTPS encryption.

---

## 📁 Repository Structure

```text
video-streaming/
├── Vagrantfile               # Ubuntu VM spec (4GB RAM, 4 CPUs, Synced Folders)
├── bootstrap.sh              # Shell provisioner installing Docker & FFmpeg
├── docker-compose.yml        # Orchestrates Backend, Frontend, Nginx, Cloudflared
├── .env                      # Local secret variables (TUNNEL_TOKEN, SITE_PASSWORD) - Git ignored
├── .env.example              # Environment template file
├── .gitignore                # Git exclusion rules
├── README.md                 # Developer & Architecture documentation
├── DEVOPS.md                 # Detailed Infrastructure & DevOps documentation
├── backend/                  # Microservice 1: FastAPI Video Engine
│   ├── main.py               # Video scanner, FFmpeg thumbnailer, session auth routes
│   ├── requirements.txt      # Python dependencies (fastapi, uvicorn)
│   └── Dockerfile            # Python 3.11-slim + FFmpeg image
├── frontend/                 # Microservice 2: Cinema Web Application
│   ├── index.html            # Responsive UI, Passkey Auth overlay, modal layout
│   ├── styles.css            # Dark mode design system, glassmorphism, CSS grid
│   ├── app.js                # Auth/session logic, search & sort, player with resume
│   └── Dockerfile            # Lightweight nginx:alpine image
└── nginx/                    # Microservice 3: Gateway Reverse Proxy
    └── nginx.conf            # Routing rules, `auth_request`, stream `sendfile`
```

---

## 🛠️ Maintenance & Developer Guide

> [!NOTE]  
> For a deep dive into the Docker implementation and orchestration, please read the [DEVOPS.md](./DEVOPS.md) guide.

### Starting the Application
```bash
# 1. SSH into Vagrant VM
vagrant ssh

# 2. Navigate to project root & start containers
cd /vagrant
docker compose up -d
```

### Applying Frontend/Backend Code Updates
When modifying files in `frontend/` or `backend/`:
```bash
# Rebuild & restart frontend container
docker compose up -d --build frontend

# Rebuild & restart backend container
docker compose up -d --build backend

# Make sure the full stack (nginx + tunnel included) is running
docker compose up -d
```

### Environment Setup (`.env`)
Create a `.env` file in the root directory:
```env
TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
SITE_PASSWORD=your_secure_passkey_here
```

### Container Status & Log Inspection
```bash
# Check all container states
docker compose ps

# View Cloudflare Tunnel logs
docker logs video-tunnel --tail 50

# View Backend API logs
docker logs video-backend --tail 50
```

---

## 🌐 Access Points

Addresses and ports are defined in the `Vagrantfile` (VM address and port forwarding) and in the Cloudflare dashboard (public address). They are not repeated here, so this section stays correct when they change.

| From outside your network | On your PC | On your local network |
| :--- | :--- | :--- |
| The public hostname set up in Cloudflare (see [CLOUDFLARE.md](./CLOUDFLARE.md)) | The forwarded port in the `Vagrantfile` (`forwarded_port` for guest port 80) | The VM's static address in the `Vagrantfile` (`private_network`), on port 80 |

Log in with the passkey set as `SITE_PASSWORD` in `.env`.
