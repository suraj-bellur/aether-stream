# Aether Stream - DevOps Architecture

This document outlines the DevOps, Infrastructure, and Deployment strategies implemented in this project. By treating infrastructure as code and containerizing applications, we ensure that the environment is reproducible, scalable, and secure.

## 1. Infrastructure as Code (IaC) & Provisioning
*   **Vagrant**: We use Vagrant to provision and manage a Virtual Machine. This ensures that the development environment is consistent across any host operating system (Windows, Mac, Linux) and isolates the project's dependencies from the host machine.

## 2. Containerization (Docker)
*   **Dockerfiles**: The application is broken down into microservices, and each custom service (like the frontend and backend) has its own `Dockerfile`. This packages the application code along with its exact dependencies (like Python 3.11, FastAPI, Nginx) into an immutable image.

## 3. Container Orchestration (Docker Compose)
*   **Docker Compose**: The `docker-compose.yml` file defines our multi-container architecture. It handles:
    *   **Networking**: Automatically creating a private bridge network so containers can communicate using their service names (e.g., `http://backend`).
    *   **Dependency Management**: Using `depends_on` ensures Nginx waits for the backend and frontend to start first.
    *   **Lifecycle Management**: `restart: unless-stopped` ensures the services automatically recover if they crash or the VM reboots.

## 4. Reverse Proxy & API Gateway
*   **Nginx**: Acts as the single entry point (API Gateway) for all traffic on port 80.
    *   **Routing**: It intelligently routes `/api` requests to the Python backend and all other requests `/` to the static frontend.
    *   **Security & Auth**: It uses `auth_request` to intercept video stream requests and verify authentication with the backend before serving the file.

## 5. Storage & State Management
*   **Bind Mounts**: 
    *   We mount `./backend` into the container for live-reloading during development without rebuilding the image.
    *   We mount the host OS's `/media/videos` directory into the containers as read-only (`ro`), allowing the app to stream massive files without duplicating them inside the container.
*   **Named Volumes**: We use a named volume `thumbnail-cache` so that generated video thumbnails and photo renditions persist even if the backend container is destroyed and recreated. The private site has its own volume, `thumbnail-cache-private`.

## 6. Configuration & Secrets Management
*   **Environment Variables & `.env`**: We decouple configuration from code. `.env` is the single place to change settings (library folders, passwords, tunnel tokens, the private on/off switch, session and performance tuning); `.env.example` is the short template and the README's "Settings (`.env`)" table lists every option. Docker Compose reads it for the containers, and the `Vagrantfile` reads it for the folder mounts.
*   **Explicit container environments**: Each backend gets only the variables it needs, listed under `environment:`, rather than the whole `.env` through `env_file`. This keeps the public container from ever seeing the private site's password or tunnel token (and vice versa).

## 6b. The Private Site as a Compose Profile
*   `docker-compose.yml` also defines a second stack (`backend-private`, `nginx-private`, `cloudflared-private`; the private gateway also serves the web UI files, so there is no separate frontend container) marked `profiles: ["private"]`. Compose starts profile services only when the profile is active, and `COMPOSE_PROFILES=private` in `.env` activates it, so the same line is the on/off switch for Compose and for the Vagrantfile.
*   The private services sit on their own Docker network (`private`) and use their own volume, gateway config and tunnel token, so nothing but the code in `./backend` and `./frontend` is shared with the public site.
*   Deactivating the profile does not stop containers that are already running; they are removed explicitly with `docker compose rm -sf backend-private nginx-private cloudflared-private`.
*   The Vagrantfile mounts the private Windows folder at `/media/private` and refuses to run `up` / `reload` if the public and private folders are identical or nested, which would leak files between the sites.

## 7. Secure Remote Networking
*   **Cloudflare Tunnels (`cloudflared`)**: Instead of opening firewall ports or port-forwarding on a router, we run a Cloudflare Tunnel container. It establishes an outbound secure connection to Cloudflare's edge, exposing our local Nginx server safely to the public internet (e.g., `your-public-hostname`).

## 8. Microservices Architecture
Instead of one massive application, the system is decoupled into four distinct, single-responsibility services:
1.  **Frontend**: Static asset delivery.
2.  **Backend**: API logic and video processing.
3.  **Proxy**: Traffic routing and security.
4.  **Tunnel**: External network ingress.
