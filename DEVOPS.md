# Video Streaming Project - DevOps Architecture

This document outlines the DevOps, Infrastructure, and Deployment strategies implemented in this project. By treating infrastructure as code and containerizing applications, we ensure that the environment is reproducible, scalable, and secure.

## 1. Infrastructure as Code (IaC) & Provisioning
*   **Vagrant**: We use Vagrant to provision and manage a Virtual Machine. This ensures that the development environment is consistent across any host operating system (Windows, Mac, Linux) and isolates the project's dependencies from the host machine.

## 2. Containerization (Docker)
*   **Dockerfiles**: The application is broken down into microservices, and each custom service (like the frontend and backend) has its own `Dockerfile`. This packages the application code along with its exact dependencies (like Python 3.9, FastAPI, Nginx) into an immutable image.

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
*   **Named Volumes**: We use a named volume `thumbnail-cache` so that generated video thumbnails persist even if the backend container is destroyed and recreated.

## 6. Configuration & Secrets Management
*   **Environment Variables & `.env`**: We decouple configuration from code. Sensitive data (like `SITE_PASSWORD` and `TUNNEL_TOKEN`) and environment-specific paths (`VIDEO_DIR`) are passed into the containers at runtime via the `.env` file.

## 7. Secure Remote Networking
*   **Cloudflare Tunnels (`cloudflared`)**: Instead of opening firewall ports or port-forwarding on a router, we run a Cloudflare Tunnel container. It establishes an outbound secure connection to Cloudflare's edge, exposing our local Nginx server safely to the public internet (e.g., `your-public-hostname`).

## 8. Microservices Architecture
Instead of one massive application, the system is decoupled into four distinct, single-responsibility services:
1.  **Frontend**: Static asset delivery.
2.  **Backend**: API logic and video processing.
3.  **Proxy**: Traffic routing and security.
4.  **Tunnel**: External network ingress.
