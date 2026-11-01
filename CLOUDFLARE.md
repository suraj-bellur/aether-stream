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

## Private site on its own tunnel (`your-private-hostname`)

The private site is a second copy of the whole stack (see the README, "Private Site"). It gets its **own tunnel**, so the two sites are independent: stopping, deleting or breaking one never affects the other.

```
Browser -> https://your-private-hostname
  -> Cloudflare edge
    -> outbound tunnel `aether-private`
      -> video-tunnel-private    (cloudflared container, using PRIVATE_TUNNEL_TOKEN)
        -> video-proxy-private   (nginx:80, on the private Docker network)
          -> /api/* -> video-backend-private:8000
          -> /*     -> served by video-proxy-private itself (the web UI files)
```

Why the route URL is `nginx-private:80` and not `nginx:80`: the private connector sits on its own Docker network (`private`), where the only gateway is called `nginx-private`. The public containers and their `nginx` are not visible from there, which is exactly the separation you want.

You can also use the private site on your local network, without any of this (see [Access Points](./README.md#-access-points)). The tunnel is only needed for an internet address.

### Add the private site (first time, re-adding, or creating a new one)

Before you start: in `.env` set `COMPOSE_PROFILES=private`, `PRIVATE_MEDIA_DIR` and `PRIVATE_SITE_PASSWORD`, then run `vagrant reload` once (see the README, "Private Site"). A new tunnel, a new token and a new name all follow the same steps; if you reuse the name `aether-private`, make sure the old tunnel was deleted first.

1. **Create the tunnel (dashboard):** Networks -> Tunnels -> Create a tunnel -> **Cloudflared** -> name it `aether-private` -> Save. On the install page choose **Docker** and copy **only the long token after `--token`**. Don't run the command the page shows, because `docker-compose.yml` already runs the connector for you.

2. **Save the token (VM):** put it in `.env` as `PRIVATE_TUNNEL_TOKEN=eyJ...`. Don't paste it into chats, commits or screenshots.

3. **Start the connector first (VM):** the dashboard's Continue button waits for a live connection, so an offline connector blocks the wizard.
   ```bash
   vagrant ssh -c "cd /vagrant && docker compose up -d --build && docker compose restart nginx nginx-private"
   vagrant ssh -c "docker logs video-tunnel-private --tail 20"
   ```
   Wait for `Registered tunnel connection` lines. The dashboard should then show `aether-private` as **Healthy**.

4. **Add the public route (dashboard):** open the tunnel -> **Routes** -> add -> choose **published application / public hostname**. Don't choose "Tunnel Hostname" (that one is private to WARP clients and would leave the address unreachable). Fill in:
   - **Subdomain:** your private subdomain (any name you choose)
   - **Domain:** `your-domain.example`
   - **Path:** empty (routes the whole site)
   - **Service type:** `HTTP`
   - **URL:** `nginx-private:80`

   Save.

5. **Check the DNS record (dashboard):** your-domain.example -> DNS -> Records. You should see your private subdomain, type Tunnel, Proxied. Saving the route normally creates it. If it's missing, add a proxied record for your private subdomain pointing at the `aether-private` tunnel by hand.

6. **Verify:**

   | Check | Where | Expected |
   |---|---|---|
   | Tunnel status | Dashboard -> `aether-private` | Healthy, Routes: 1 |
   | DNS | `nslookup your-private-hostname your-cloudflare-nameserver` | Cloudflare IPs |
   | HTTP | VM: `curl -sI https://your-private-hostname \| head -3` | `HTTP/2 200` |
   | Login | Browser | The private password works; the public password is rejected |

### Remove the private site

Do this if you no longer want the private site, or before re-creating it with a new tunnel.

1. **Stop the containers and connector (VM):**
   ```bash
   vagrant ssh -c "cd /vagrant && docker compose rm -sf backend-private nginx-private cloudflared-private"
   ```
   Stopping the connector first lets Cloudflare delete the tunnel, because a tunnel with active connections can't be removed. The public site is not touched.

2. **Delete the route and the tunnel (dashboard):** Networks -> Tunnels -> `aether-private` -> Routes -> delete the `your-private-hostname` route. Then **...** -> Delete the tunnel. If it refuses because of active connections, wait a minute and retry.

3. **Delete the private subdomain's DNS record (dashboard):** your-domain.example -> DNS -> Records -> delete your private subdomain (type Tunnel) if it is still listed. Deleting the tunnel doesn't always remove its record.

4. **Clear the settings (`.env`):** set `PRIVATE_TUNNEL_TOKEN=` and `COMPOSE_PROFILES=` (both empty), then run `vagrant reload` to drop the private folder mount and port 8081. The public site is unaffected throughout. To also delete the private thumbnail cache: `docker volume rm vagrant_thumbnail-cache-private`.

5. **Confirm the name is gone (Windows PowerShell):**
   ```powershell
   ipconfig /flushdns
   nslookup your-private-hostname 1.1.1.1
   ```
   Expect "Non-existent domain." Your local resolver can cache old answers for a while, which is why the flush is there.

### Optional: put a login in front of it (Cloudflare Access)

The private site already has its own passkey and login lockout, but it holds personal photos, so a second layer is worth the two minutes. With Cloudflare Access, visitors must first prove their email address with a one-time code before they even see the site's login page.

Zero Trust -> Access -> Applications -> Add an application -> **Self-hosted** -> application domain `your-private-hostname` -> add a policy: Action **Allow**, include **Emails** -> your address. Use the one-time PIN login method. This is free for small groups, and it is configured only in the dashboard (nothing changes in this repo). To remove it, delete the application in the same place.

### Troubleshooting (private site)

| Symptom | What it means | Fix |
|---|---|---|
| Error **1033** | Cloudflare has no live connector for `aether-private` | `docker logs video-tunnel-private --tail 20`. The token is probably wrong, empty, or has a space or line break; fix `PRIVATE_TUNNEL_TOKEN` and run `docker compose up -d`. |
| Error **502 / 521** | The tunnel works, but the route can't reach the gateway | Check the route URL is `nginx-private:80` and `docker compose ps` shows `video-proxy-private` running. After a rebuild, run `docker compose restart nginx-private`. |
| Private containers keep restarting | The private folder isn't mounted in the VM | Set `COMPOSE_PROFILES=private` and `PRIVATE_MEDIA_DIR` in `.env`, then `vagrant reload`. |
| `vagrant reload` stops with "Private site misconfigured" | The two library folders are identical or nested | Choose two separate folders (see the README, "Settings"). |
| Private site shows the wrong or old thumbnails | The cache belongs to a previous folder | Remove the private containers and the `vagrant_thumbnail-cache-private` volume (README, "Settings"), then `docker compose up -d`. |

---

## Learning ideas

- **Same tunnel, second hostname (the alternative to what the private site does):** instead of a second tunnel you could add another route, for example `status.your-domain.example`, to the existing tunnel and point it at any container on the same Docker network. One tunnel then serves several names. The private site uses its own tunnel on purpose, for independence.
- **Locally managed tunnel:** `cloudflared tunnel login`, `create`, `route dns`, plus a `config.yml`. This is the other way to run a tunnel, with the routing in a file instead of the dashboard. It's a good comparison to understand what the dashboard is doing for you.
- **Cloudflare Access:** an email one-time-code login in front of the site, as a second layer on top of the passkey.
