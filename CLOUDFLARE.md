# Cloudflare Tunnel Setup

This guide explains how the public address `https://your-public-hostname` reaches your Aether Stream containers, why each piece exists, and how to tear down and rebuild the tunnel.

---

## The big picture

Your home PC has no public address, and your router doesn't forward ports. A normal setup would need both. A Cloudflare Tunnel avoids them:

1. The `cloudflared` container starts an **outbound** connection to Cloudflare. Outbound connections are allowed through home routers and CGNAT, so nothing needs opening.
2. When someone visits `your-public-hostname`, Cloudflare receives the request, then passes it back down that existing connection.
3. `cloudflared` hands the request to nginx, which routes it to the right container.

Because the connection starts from your machine, your home IP is never exposed, and Cloudflare provides the HTTPS certificate for the public address.

```
Browser -> https://your-public-hostname
  -> Cloudflare edge      (HTTPS ends here; DNS points the name at Cloudflare)
    -> outbound tunnel    (the connection cloudflared opened earlier)
      -> video-tunnel     (cloudflared container, using TUNNEL_TOKEN)
        -> video-proxy    (nginx:80, the single entry point)
          -> /api/*  -> video-backend:8000   (FastAPI: login, library, thumbnails)
          -> /*      -> video-frontend:80    (the web UI)
```

---

## The pieces

| Piece | Where it lives | What it does and why it exists |
|---|---|---|
| **Domain registration** | GoDaddy | Only records that you own `your-domain.example` and renew it each year. It doesn't serve traffic. |
| **Nameservers** | GoDaddy, pointing to Cloudflare | Tell the internet that Cloudflare answers DNS questions for the domain. This is the "move" you did earlier. |
| **DNS records** | Cloudflare -> `your-domain.example` -> DNS | The phone book entries. The public subdomain's record tells browsers to connect to Cloudflare for that name. |
| **Tunnel** | Cloudflare Zero Trust -> Networks -> Tunnels | A named connection identity, `aether-stream`. Its ID is inside the token. |
| **Connector token** | `.env` as `TUNNEL_TOKEN` | Proves to Cloudflare that a given `cloudflared` is allowed to join the tunnel. Anyone holding it can run a connector for your tunnel. |
| **Public route** | Tunnel -> Routes | Says "requests for `your-public-hostname` go to `http://nginx:80`". This is where routing is configured. |
| **Connector container** | `video-tunnel` in `docker-compose.yml` | Runs `cloudflared` and keeps the outbound connection alive. |
| **Gateway** | `video-proxy` (nginx) | Splits traffic between the backend API and the frontend UI. |

### Why the public subdomain's DNS record is a "Tunnel" record

When you save a public route in the dashboard, Cloudflare creates a DNS record for it automatically. It's a proxied record pointing at your tunnel, so the name resolves to Cloudflare's edge rather than your home IP. You don't need to create it yourself, and it's safe to delete when you tear the tunnel down, since the tunnel no longer exists.

### Why `nginx:80` and not `localhost:80`

The connector runs in its own container. Inside that container, `localhost` means the connector itself, and nothing listens on port 80 there. `nginx` is the name of the nginx service on Docker's internal network, so `nginx:80` reaches the gateway.

### Why the compose command has no `--url` flag

Earlier, the command was `tunnel --no-autoupdate run --url http://nginx:80`. The flag set a **fallback** destination for every request, whatever the hostname. The site worked, but the dashboard showed zero routes, so the setup was hidden. The dashboard route now defines the destination explicitly, and the flag is removed. If the route is ever missing, the site goes down, which is what you want. It tells you the route needs fixing.

### Public route vs private route

The Routes tab offers several route types. Two are easy to confuse:

- **Published application / public hostname:** a website anyone on the internet can open. This is what Aether Stream needs.
- **Tunnel Hostname (private):** a private name that only devices running the Cloudflare WARP client can reach, typically for internal tools. Choosing it here would leave the public address broken.

---

## Configuration in this repo

`docker-compose.yml`:
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: video-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    depends_on:
      - nginx
```

- `image` is the official Cloudflare build.
- `restart: unless-stopped` brings the connector back after a crash or a VM reboot.
- `command` starts the tunnel using the token. There's no `--url`, because the dashboard route decides where traffic goes.
- `TUNNEL_TOKEN` is read from `.env`, so the secret never lives in the repo.
- `depends_on: nginx` starts the gateway first, so the first requests don't fail.

`.env` (git-ignored, never commit it):
```env
TUNNEL_TOKEN=eyJ...
```

---

## Rebuild procedure

Only do this if you're replacing the tunnel. Expect about 10-15 minutes of downtime. Keep the GoDaddy registration, the nameservers, and the `www` and `_domainconnect` records. You don't need to touch them.

### Teardown

1. **Stop the connector (VM):**
   ```bash
   vagrant ssh
   cd /vagrant
   docker compose stop cloudflared
   ```
   Stopping it first means the site fails cleanly, and Cloudflare can then delete the tunnel, because a tunnel with active connections can't be removed.

2. **Delete the tunnel (dashboard):** Networks -> Tunnels -> open the tunnel -> **...** -> Delete. If it refuses because of active connections, wait a minute and retry.

3. **Delete the public subdomain's DNS record (dashboard):** your-domain.example -> DNS -> Records -> delete your public subdomain (type Tunnel) if it's still there. Deleting the tunnel doesn't always remove its record.

4. **Clear the token (VM):** set `TUNNEL_TOKEN=` in `.env`, keeping the line so compose still finds the variable.

5. **Confirm the name is gone (Windows PowerShell):**
   ```powershell
   ipconfig /flushdns
   nslookup your-public-hostname 1.1.1.1
   ```
   Expect "Non-existent domain." Your local resolver can cache old answers for a while, which is why the flush is there.

### Rebuild

6. **Create the tunnel (dashboard):** Networks -> Tunnels -> Create a tunnel -> **Cloudflared** -> name it `aether-stream` -> Save. On the install page, choose **Docker** and copy **only the long token after `--token`**. Don't run the command the page shows, because your compose file already runs the connector.

7. **Set the token (VM):** put it in `.env` as `TUNNEL_TOKEN=eyJ...`. Don't paste it into chats, commits or screenshots.

8. **Start the connector (VM):** do this *before* adding the route. The wizard's Continue button waits for a live connection, so an offline connector blocks the wizard.
   ```bash
   cd /vagrant
   docker compose up -d --force-recreate cloudflared
   docker logs video-tunnel --tail 20
   ```
   Wait for `Registered tunnel connection` lines. The dashboard should then show the tunnel as Healthy.

9. **Add the public route (dashboard):** open the tunnel -> **Routes** -> add -> choose **published application** / **public hostname**. Don't choose "Tunnel Hostname". Fill in:
   - **Subdomain:** your public subdomain (any name you choose)
   - **Domain:** `your-domain.example`
   - **Path:** empty (routes the whole site)
   - **Service type:** `HTTP` (the connector talks to nginx over plain HTTP inside Docker; Cloudflare handles HTTPS for visitors)
   - **URL:** `nginx:80`

   Save.

10. **Check the DNS record (dashboard):** your-domain.example -> DNS -> Records. You should see your public subdomain, type Tunnel, Proxied. Saving the route normally creates it. If it's missing, add a proxied record for your public subdomain pointing at the tunnel by hand.

11. **Confirm the command has no `--url` flag (VM):** `docker-compose.yml` should read `command: tunnel --no-autoupdate run`. Recreate the container so the change takes effect:
    ```bash
    docker compose up -d --force-recreate cloudflared
    ```

---

## Verify

| Check | Where | Expected | Why it matters |
|---|---|---|---|
| Tunnel status | Dashboard -> `aether-stream` | Healthy, Routes: 1 | The connector is connected and has a route |
| Authoritative DNS | `nslookup your-public-hostname your-cloudflare-nameserver` | Cloudflare IPs | Cloudflare's own nameserver answers the name |
| Traffic | Dashboard -> tunnel -> **Live logs**, then load the site | Requests appear | Proves traffic flows through this tunnel, not a fallback |
| HTTP | VM: `curl -sI https://your-public-hostname \| head -3` | `HTTP/2 200` | The whole path works end to end |
| App | Browser | Passkey login works | The application responds through the tunnel |

---

## Rollback

If the site stays down after step 11, restore the fallback flag so traffic reaches nginx again while you debug the route:
```yaml
    command: tunnel --no-autoupdate run --url http://nginx:80
```
```bash
docker compose up -d --force-recreate cloudflared
```
Once the route works, remove the flag again.

---

## Troubleshooting

| Symptom | What it means | Fix |
|---|---|---|
| Error **1033** | Cloudflare has no live connector for the tunnel | Run `docker logs video-tunnel`. The token is probably wrong, or has a space or line break. |
| Error **502 / 521** | The tunnel works, but the route can't reach nginx | Check the route URL is `nginx:80`, and that `video-proxy` is running (`docker compose ps`). |
| Name doesn't resolve | The public subdomain's DNS record is missing | Re-save the route, or add a proxied record for your public subdomain pointing at the tunnel. |
| Continue button stays disabled | The connector isn't connected yet | Repeat step 8. |
| Site works but Live logs are empty | You're looking at a different tunnel | Check the tunnel name in the dashboard. |
| Old behaviour in the browser | Browser or local DNS cache | Wait a few minutes, or restart the browser. |

---

## Learning ideas

- **Locally managed tunnel:** `cloudflared tunnel login`, `create`, `route dns`, plus a `config.yml`. This is the other way to run a tunnel, with the routing in a file instead of the dashboard. It's a good comparison to understand what the dashboard is doing for you.
- **Cloudflare Access:** an email one-time-code login in front of the site, as a second layer on top of the passkey.
- **A second hostname:** add another route to the same tunnel, for example `status.your-domain.example`, to see how one tunnel serves several names.
