# Video Streaming Platform - Complete Deployment & Walkthrough Guide

The entire microservices-based video streaming application codebase is fully created and committed to Git (`commit 1db4b6e`).

---

## Codebase Architecture Summary

```text
video-streaming/
├── Vagrantfile               # Ubuntu 22.04 VM, static IP <vm-address>, Synced Folder
├── bootstrap.sh              # Automatic VM provisioner (Docker Engine, Compose, FFmpeg)
├── docker-compose.yml        # Orchestrates Backend, Frontend, and Nginx containers
├── .gitignore                # Git ignore rules for Vagrant & temporary build files
├── backend/                  # Microservice 1: Python FastAPI API & Streaming Engine
│   ├── main.py               # Video scanner, FFmpeg thumbnail generator, Range streaming
│   ├── requirements.txt      # FastAPI & Uvicorn dependencies
│   └── Dockerfile            # Python 3.11-slim + FFmpeg container
├── frontend/                 # Microservice 2: Glassmorphic UI Web App
│   ├── index.html            # Responsive layout & modal player
│   ├── styles.css            # Dark mode glassmorphism styles
│   ├── app.js                # API fetcher, live search, player controls
│   ├── nginx.conf            # Static web server config
│   └── Dockerfile            # Lightweight nginx:alpine container
└── nginx/                    # Microservice 3: Reverse Proxy Gateway
    └── nginx.conf            # Gateway routing /api -> backend:8000 and / -> frontend:80
```

---

## Step-by-Step Deployment Instructions

### Step 1: Spin up the Ubuntu VM
Open PowerShell in your workspace directory `your project folder` and run:

```powershell
vagrant up
```
* Vagrant will download the Ubuntu 22.04 box (if not cached), assign static IP `<vm-address>`, mount your host video folder `the media folder` to `/media/videos` inside the VM, and run `bootstrap.sh` to install Docker & FFmpeg.

---

### Step 2: SSH into the VM and Launch Docker Microservices
Once `vagrant up` completes, SSH into the VM:

```powershell
vagrant ssh
```

Inside the VM shell (which lands in `/vagrant`, synced to your project folder), start the Docker Compose stack:

```bash
docker compose up -d --build
```

You can verify all 3 containers are running:
```bash
docker compose ps
```

Expected output:
* `video-backend` (Up, listening internally on 8000)
* `video-frontend` (Up, listening internally on 80)
* `video-proxy` (Up, mapping `0.0.0.0:80->80/tcp`)

---

### Step 3: Access the Web Streaming Application

Open any browser on your Windows host machine:

#### Option A: Direct IP Access
Navigate to:
```text
http://<vm-address>
```

#### Option B: Custom Local Domain Access (Optional)
If you want to use `http://stream.local` instead of the IP:
1. Open PowerShell **as Administrator** on Windows.
2. Edit `C:\Windows\System32\drivers\etc\hosts` and append:
   ```text
   <vm-address>   stream.local
   ```
3. Open `http://stream.local` in your browser!

---

## Verification & Features Checklist

- [x] **Zero-Copy Video Storage:** 55GB video folder mounted instantly via Vagrant synced folder without duplicating files onto the VM disk.
- [x] **Automatic Thumbnail Generation:** FFmpeg automatically captures a 5-second snapshot of each video into persistent cache.
- [x] **Instant Seeking & Scrubbing:** FastAPI handles `206 Partial Content` HTTP Range requests.
- [x] **Real-time Title Search:** Search through 400+ videos live in the browser.
- [x] **Reverse Proxy Gateway:** Nginx routes API traffic to FastAPI and UI traffic to Frontend transparently.
