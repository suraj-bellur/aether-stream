# 🎬 AETHER STREAM - Personal Video Streaming Platform

A high-performance, self-hosted video streaming architecture designed for zero-copy streaming of large personal video libraries. Built with microservices, Docker, Vagrant, FastAPI, Nginx, and Cloudflare Tunnels for instant, secure HTTPS access across Mobile and Desktop.

---

## 🏗️ Tech Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Virtualization & VM** | **Vagrant** + **VirtualBox** | Ubuntu 22.04 LTS (`ubuntu/jammy64`) environment setup |
| **Orchestration** | **Docker** & **Docker Compose** | Containerized microservice lifecycle & network management |
| **Backend Service** | **Python 3.11** + **FastAPI** + **Uvicorn** | Dynamic file scanner, metadata parser, HTTP Range streamer |
| **Media Processing** | **FFmpeg** | On-demand 720p thumbnail generation at timestamp `00:00:05` |
| **Frontend Web App** | **Vanilla JS (ES6+)** + **CSS3** | Cinema-grade dark UI, responsive grid, glassmorphic player |
| **Web Gateway** | **Nginx** (`nginx:alpine`) | Reverse proxy routing, HTTP Range header passthrough, CORS |
| **Remote Access & SSL** | **Cloudflare Tunnels** + **GoDaddy DNS** | Zero-trust HTTPS tunnel (`https://your-public-hostname`) |

---

## 🧩 Architectural Concepts & Engineering Design

### 1. Zero-Copy Host Storage Mounting
* Large video collections (50GB+) remain on the host Windows machine (the media folder).
* VirtualBox Synced Folders mount this path into the Ubuntu VM at `/media/videos`.
* Docker Compose bind-mounts `/media/videos` **read-only** (`:ro`) into the `backend` container.
* **Benefit**: Zero disk duplication, zero upload overhead, instant availability of new videos.

### 2. HTTP Range Streaming (RFC 7233)
* FastAPI backend implements Partial Content (`206 Partial Content`) streaming using chunked byte ranges (`bytes=start-end`).
* Buffers video in 2MB chunks for smooth seeking and instant scrub-bar jumping without downloading entire video files.

### 3. Dynamic File Discovery & On-Demand Thumbnails
* Adding a `.mp4`, `.mkv`, `.webm`, or `.mov` file to the host folder immediately surfaces it on web page refresh.
* MD5 hash caching (`get_file_hash`) generates and stores `.jpg` thumbnails in persistent Docker volume (`thumbnail-cache`) only when requested.

### 4. Cloudflare Tunnel Gateway
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
├── .env                      # Local secret variables (TUNNEL_TOKEN) - Git ignored
├── .env.example              # Environment template file
├── .gitignore                # Git exclusion rules
├── README.md                 # Developer & Architecture documentation
├── backend/                  # Microservice 1: FastAPI Video Engine
│   ├── main.py               # Video scanner, FFmpeg thumbnailer, Range streamer
│   ├── requirements.txt      # Python dependencies (fastapi, uvicorn)
│   └── Dockerfile            # Python 3.11-slim + FFmpeg image
├── frontend/                 # Microservice 2: Cinema Web Application
│   ├── index.html            # Responsive UI & Cinema player modal layout
│   ├── styles.css            # Dark mode design system, glassmorphism, CSS grid
│   ├── app.js                # Instant search, category filters, high-speed player
│   ├── nginx.conf            # Static asset Nginx config with gzip compression
│   └── Dockerfile            # Lightweight nginx:alpine image
└── nginx/                    # Microservice 3: Gateway Reverse Proxy
    └── nginx.conf            # Routing rules (/api/ -> backend:8000, / -> frontend:80)
```

---

## 🛠️ Maintenance & Developer Guide

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
