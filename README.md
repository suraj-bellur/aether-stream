# 🎬 AETHER STREAM - Personal Video Streaming Platform

A high-performance, self-hosted video streaming architecture designed for zero-copy streaming of large personal video libraries. Built with microservices, Docker, Vagrant, FastAPI, Nginx, and Cloudflare Tunnels for instant, secure HTTPS access across Mobile and Desktop.

---

## 🏗️ Tech Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Virtualization & VM** | **Vagrant** + **VirtualBox** | Ubuntu 22.04 LTS (`ubuntu/jammy64`) environment setup |
| **Orchestration** | **Docker** & **Docker Compose** | Containerized microservice lifecycle & network management |
| **Backend Service** | **Python 3.11** + **FastAPI** + **Uvicorn** | Dynamic file scanner, metadata parser, authentication |
| **Media Processing** | **FFmpeg** | On-demand 3-frame vertical collage generation for thumbnails |
| **Frontend Web App** | **Vanilla JS (ES6+)** + **CSS3** | Cinema-grade dark UI, passkey login, responsive grid |
| **Web Gateway** | **Nginx** (`nginx:alpine`) | Reverse proxy, secure video streaming (`sendfile`), route protection (`auth_request`) |
| **Remote Access & SSL** | **Cloudflare Tunnels** + **GoDaddy DNS** | Zero-trust HTTPS tunnel (`https://your-public-hostname`) |

---

## 🧩 Architectural Concepts & Engineering Design

### 1. Zero-Copy Host Storage Mounting
* Large video collections (50GB+) remain on the host Windows machine (the media folder).
* VirtualBox Synced Folders mount this path into the Ubuntu VM at `/media/videos`.
* Docker Compose bind-mounts `/media/videos` **read-only** (`:ro`) into the `backend` and `nginx` containers.
* **Benefit**: Zero disk duplication, zero upload overhead, instant availability of new videos.

### 2. High-Performance Video Streaming
* Nginx directly streams the video files from the host mount using `sendfile` and `tcp_nopush`, bypassing the Python backend for massive performance gains.
* Nginx natively handles Partial Content (`206 Partial Content`) chunked byte ranges (`bytes=start-end`) for seamless scrubbing.
* All streams are strictly protected; Nginx intercepts video requests and verifies the session token using `auth_request` before serving any bytes.

### 3. Dynamic File Discovery & On-Demand Thumbnails
* Adding a `.mp4`, `.mkv`, `.webm`, or `.mov` file to the host folder immediately surfaces it on web page refresh.
* MD5 hash caching (`get_file_hash`) generates and stores 3-frame `.jpg` thumbnail collages in a persistent Docker volume (`thumbnail-cache`) only when requested.

### 4. Global Passkey Authentication
* The entire platform is locked behind a global passkey (session-based cookie).
* The FastAPI backend issues the session token, while Nginx intercepts all API and video streaming routes using the `auth_request` module to verify the token at the edge.

### 5. Cloudflare Tunnel Gateway
* `cloudflared` runs as a microservice inside Docker (`video-tunnel`).
* Outbound QUIC/HTTP2 tunnel connects to Cloudflare Edge servers using `TUNNEL_TOKEN`.
* Bypasses router port forwarding, CGNAT, and home dynamic IP limitations while providing free SSL/HTTPS encryption.

---

## 📁 Repository Structure

```text
video-streaming/
├── Vagrantfile               # Ubuntu VM spec (2GB RAM, 2 CPUs, Synced Folders)
├── bootstrap.sh              # Shell provisioner installing Docker & FFmpeg
├── docker-compose.yml        # Orchestrates Backend, Frontend, Nginx, Cloudflared
├── .env                      # Local secret variables (TUNNEL_TOKEN, SITE_PASSWORD) - Git ignored
├── .env.example              # Environment template file
├── .gitignore                # Git exclusion rules
├── README.md                 # Developer & Architecture documentation
├── DEVOPS.md                 # Detailed Infrastructure & DevOps documentation
├── backend/                  # Microservice 1: FastAPI Video Engine
│   ├── main.py               # Video scanner, FFmpeg thumbnailer, Auth routes
│   ├── requirements.txt      # Python dependencies (fastapi, uvicorn)
│   └── Dockerfile            # Python 3.11-slim + FFmpeg image
├── frontend/                 # Microservice 2: Cinema Web Application
│   ├── index.html            # Responsive UI, Passkey Auth overlay, modal layout
│   ├── styles.css            # Dark mode design system, glassmorphism, CSS grid
│   ├── app.js                # Auth logic, Instant search, high-speed player
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

## 🌐 Public Access Endpoints

* **Public Domain**: `https://your-public-hostname` *(via Cloudflare Tunnel)*
* **Local VM Static IP**: `http://<vm-address>`
* **Local Host Forwarded Port**: `http://localhost:<port>`
