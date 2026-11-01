# 🎬 AETHER STREAM - Personal Video Streaming Platform

A high-performance, self-hosted video streaming architecture designed for zero-copy streaming of large personal video libraries. Built with microservices, Docker, Vagrant, FastAPI, Nginx, and Cloudflare Tunnels for instant, secure HTTPS access across Mobile and Desktop.

---

## 🏗️ Tech Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Virtualization & VM** | **Vagrant** + **VirtualBox** | Ubuntu 22.04 LTS (`ubuntu/jammy64`) environment setup |
| **Orchestration** | **Docker** & **Docker Compose** | Containerized microservice lifecycle & network management |
| **Backend Service** | **Python 3.11** + **FastAPI** + **Uvicorn** | Dynamic file scanner, metadata parser, authentication |
| **Media Processing** | **FFmpeg** + **Pillow** | On-demand video thumbnails (best-of-several frame selection) and resized photo renditions |
| **Frontend Web App** | **Vanilla JS (ES6+)** + **CSS3** | Ambient cinema UI (colour-adaptive theme, card→player morph, hover previews), passkey login, search/sort, resume & up-next playback |
| **Web Gateway** | **Nginx** (`nginx:alpine`) | Reverse proxy, secure video streaming (`sendfile`), route protection (`auth_request`) |
| **Remote Access & SSL** | **Cloudflare Tunnels** + **GoDaddy DNS** | Zero-trust HTTPS tunnel (`https://your-public-hostname`) |

---

## 🧩 Architectural Concepts & Engineering Design

### 1. Zero-Copy Host Storage Mounting
* Large video and photo collections (50GB+) remain on the host Windows machine, in the folders set by `PUBLIC_MEDIA_DIR` and `PRIVATE_MEDIA_DIR` in `.env`.
* VirtualBox Synced Folders mount this path into the Ubuntu VM at `/media/videos`.
* Docker Compose bind-mounts `/media/videos` **read-only** (`:ro`) into the `backend` and `nginx` containers.
* **Benefit**: Zero disk duplication, zero upload overhead, instant availability of new videos.

### 2. High-Performance Video Streaming
* Nginx directly streams the video files from the host mount using `sendfile` and `tcp_nopush`, bypassing the Python backend for massive performance gains.
* Nginx natively handles Partial Content (`206 Partial Content`) chunked byte ranges (`bytes=start-end`) for seamless scrubbing.
* All streams are strictly protected; Nginx intercepts video requests and verifies the session token using `auth_request` before serving any bytes.

### 3. Dynamic File Discovery & On-Demand Thumbnails
* Adding a video (`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.m4v`) or photo (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`) to the host folder surfaces it on web page refresh.
* Media can live in the root folder or in sub-folders at any depth. The UI has a **Videos / Photos** toggle and mirrors the folder tree (same names as on disk) with breadcrumbs; folders without media of the current type are hidden. `GET /api/library` returns videos, photos and folders (with recursive counts and cover files) in one call.
* Photos are shown Google Photos style: justified rows at their true aspect ratio, grouped by the EXIF capture date, with no file names in the grid. Clicking one opens a viewer that shows the name, date and size, supports swipe/arrow navigation and double-click zoom, and downloads the original.
* A background **cache warmer** pre-renders every missing video thumbnail and photo rendition after each library scan, so browsing never waits on the media drive. Its reads are throttled (`WARM_MAX_MB_PER_SEC`, default 12) so it doesn't starve video playback on a slow drive. The library is rescanned in the background too: requests are always answered from the last scan.
* Photo renditions are cached in the same volume (both are produced from a single read of the original): `thumb` (480px tall, grid) and `view` (up to 2048px, viewer) via `GET /api/photo/{thumb|view}/<path>`. Photo dimensions and EXIF dates are cached in `photo_meta.json`, so only new or changed files are re-read.
* MD5 hash caching (`get_file_hash`) generates and stores a `.jpg` thumbnail (up to 1280px) in a persistent Docker volume (`thumbnail-cache`) only when requested. FFmpeg samples frames at 15/35/55/75% of the video and keeps the most detailed one, so black fades, title cards and blurry transitions are skipped. The video list is cached for 30 seconds, so new files show up within moments of a refresh.
* The UI letterboxes non-16:9 thumbnails (portrait, 4:3, ultra-wide) over a blurred copy of themselves instead of cropping, and tints the page with each thumbnail's dominant colour.

### 4. Passkey Authentication
* Each site is locked behind its own shared passkey: `SITE_PASSWORD` for the public site and `PRIVATE_SITE_PASSWORD` for the private site. Neither password works on the other site, and each site has its own session cookie.
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
├── Vagrantfile               # Ubuntu VM spec (4GB RAM, 4 CPUs); reads the media folders from .env
├── bootstrap.sh              # Shell provisioner installing Docker & FFmpeg
├── docker-compose.yml        # Public site (always) + private site (profile "private"): Backend, Frontend, Nginx, Cloudflared
├── .env                      # YOUR settings and secrets (folders, passwords, tokens) - Git ignored
├── .env.example              # Short template of the settings you need - copy it to .env
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
│   ├── theme.css             # Theme overrides (empty: the public site's default look)
│   ├── theme.private.css     # Private site's "Noir red" theme (accent variables at the top); not served on the public site
│   ├── app.js                # Auth/session logic, search & sort, player with resume
│   └── Dockerfile            # Lightweight nginx:alpine image
└── nginx/                    # Microservice 3: Gateway Reverse Proxy
    ├── nginx.conf            # Public site: routing rules, `auth_request`, stream `sendfile`
    └── nginx.private.conf    # Private site: same rules, private backend and media folder, serves the UI
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

### Settings (`.env`)
Everything you can change lives in one git-ignored file, **`.env`**. Copy [`.env.example`](./.env.example) to `.env` and fill in the passwords, tokens and folders; the table below lists every setting you can add. Use forward slashes in Windows paths (`E:/Media`), one `KEY=value` per line, no comments after a value.

| Group | Settings | Applies after |
| :--- | :--- | :--- |
| **Library folders** | `PUBLIC_MEDIA_DIR` (default `E:/`), `PRIVATE_MEDIA_DIR` | `vagrant reload` |
| **Public site** | `SITE_PASSWORD`, `TUNNEL_TOKEN` | `docker compose up -d` |
| **Private site** | `COMPOSE_PROFILES` (`private` = on, empty = off), `PRIVATE_SITE_PASSWORD`, `PRIVATE_TUNNEL_TOKEN` | `vagrant reload`, then `docker compose up -d` |
| **Login and sessions** | `SESSION_HOURS` (12), `REMEMBER_DAYS` (30), `MAX_FAILED_LOGINS` (5), `LOGIN_LOCKOUT_MINUTES` (15) | `docker compose up -d` |
| **Performance** | `LIBRARY_RESCAN_SECONDS` (30), `WARM_MAX_MB_PER_SEC` (12), `PRIVATE_WARM_MAX_MB_PER_SEC` (12) | `docker compose up -d` |

Only the folders, passwords and tokens are needed. Anything you leave out (or leave empty) uses the default shown in brackets. Not in `.env`: the local ports (set in the `Vagrantfile`), the Cloudflare address-to-site mapping (set in the dashboard, see [CLOUDFLARE.md](./CLOUDFLARE.md)) and the private site's colours (top of `frontend/theme.private.css`).

> [!IMPORTANT]
> The two library folders must be **different and neither inside the other**. Each site scans its folder recursively, so a private folder such as `E:/Private` inside a public `E:/` would show up on the public site. `vagrant up` / `reload` refuses to continue if the folders are nested or identical.

To **swap which folder is public and which is private**, swap the two path values and run `vagrant reload`, then clear both thumbnail caches (thumbnails are keyed by file path, so a different folder needs a fresh cache):
```bash
vagrant ssh -c "cd /vagrant && docker compose rm -sf backend backend-private && docker volume rm vagrant_thumbnail-cache vagrant_thumbnail-cache-private && docker compose up -d && docker compose restart nginx nginx-private"
```

### Private Site
A second, **fully separate** copy of the site for your own photos and videos: its own library folder, password, backend, frontend, thumbnail cache, Docker network and Cloudflare tunnel, with a darker "Noir red" look (and a PRIVATE tag by the logo). Its services live in the same `docker-compose.yml`, marked with the profile `private`, so **one setting in `.env` turns it on or off**.

```
your-private-hostname -> Cloudflare -> video-tunnel-private -> video-proxy-private:80
   -> /api/* -> video-backend-private:8000   (own password and session cookie, own cache volume)
   -> /*     -> served by video-proxy-private itself (same UI files + frontend/theme.private.css)
   media: /media/private (read-only)  <-  PRIVATE_MEDIA_DIR
```

**Turn it on**
1. In `.env`: `COMPOSE_PROFILES=private`, `PRIVATE_MEDIA_DIR=...`, `PRIVATE_SITE_PASSWORD=...` (a different password from the public one), and `PRIVATE_TUNNEL_TOKEN=...` (from **Add the private site** in [CLOUDFLARE.md](./CLOUDFLARE.md)).
2. `vagrant reload` (mounts the folder, opens port 8081).
3. `vagrant ssh -c "cd /vagrant && docker compose up -d --build && docker compose restart nginx nginx-private"`

After that it starts with the VM like everything else, and every normal `docker compose up -d` includes it. Its addresses are listed under [Access Points](#-access-points).

**Check on it**
```bash
docker compose ps                         # all containers, public and private
docker logs video-backend-private --tail 50
docker logs video-tunnel-private --tail 20
```

**Turn it off** (the public site is not touched)
1. In `.env`: empty the line, `COMPOSE_PROFILES=`.
2. Stop the private containers (emptying the setting alone doesn't stop ones that are already running):
   ```bash
   vagrant ssh -c "cd /vagrant && docker compose rm -sf backend-private nginx-private cloudflared-private"
   ```
3. Optional, to also drop the folder mount and port 8081: `vagrant reload`. To delete its thumbnail cache too: `docker volume rm vagrant_thumbnail-cache-private`.
4. If you don't want the address any more, remove the tunnel in Cloudflare (**Remove the private site** in [CLOUDFLARE.md](./CLOUDFLARE.md)). To add it again later, repeat **Turn it on**.

Because the private site keeps its own gateway config, a rule changed in `nginx/nginx.conf` (gzip, streaming, auth) must be mirrored in `nginx/nginx.private.conf`. That is deliberate: the public gateway can never be affected by private-site changes.

### Cache Cleanup
The backend cleans its cache **automatically every time it starts**: on `docker compose up`, `restart` and `up --build`, and on every VM boot or `vagrant reload` (the container has `restart: unless-stopped`, so Docker starts it on boot). It deletes:
* legacy thumbnails from older versions of the thumbnailer (`<md5>.jpg` and `<md5>_collage3.jpg`)
* temp files (`*.tmp.jpg`) older than 10 minutes, left behind by interrupted renders

Current files (`*_v2.jpg` video thumbnails, `*_thumb.jpg` / `*_view.jpg` photo renditions, `photo_meta.json`, `sessions.json`) are never touched, so nothing has to be regenerated afterwards.

To run it by hand at any time (safe while the site is in use):
```bash
docker exec video-backend python -c "import main; main.cleanup_cache()"

# from Windows, without opening an SSH session first:
vagrant ssh -c 'docker exec video-backend python -c "import main; main.cleanup_cache()"'
```
It prints what it removed, e.g. `Cache cleanup: removed 1259 legacy thumbnails and 0 stale temp files, freed …`. The automatic run's summary is in `docker logs video-backend`.

> [!CAUTION]
> Don't delete `*_thumb.jpg` by hand: that's the name of the photo grid thumbnails, and the warmer would have to re-read every original from the drive.

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

Addresses and ports are defined in the `Vagrantfile` (VM address and port forwarding) and in the Cloudflare dashboard (public addresses). They are not repeated here, so this section stays correct when they change.

| Site | From outside your network | On your PC | On your local network |
| :--- | :--- | :--- | :--- |
| **Public** (always on) | The public hostname set up in Cloudflare (see [CLOUDFLARE.md](./CLOUDFLARE.md)) | The forwarded port in the `Vagrantfile` (`forwarded_port` for guest port 80) | The VM's static address in the `Vagrantfile` (`private_network`), on port 80 |
| **Private** (only with `COMPOSE_PROFILES=private`) | Its own hostname, set up in Cloudflare; not published in this repository | The forwarded port in the `Vagrantfile` (`forwarded_port` for guest port 81) | The VM's static address, on port 81 |

Each site has its own password (`SITE_PASSWORD` and `PRIVATE_SITE_PASSWORD` in `.env`).
