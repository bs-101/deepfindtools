# Cloudflare Tunnel local deployment

This file is for running DeepFind Tools on your local machine and exposing it through Cloudflare Tunnel.

## Architecture

```text
Cloudflare domain
  -> Cloudflare Tunnel
  -> local cloudflared
  -> nginx container
  -> app container
  -> mysql container
```

The app container is not exposed directly. Nginx is the only local HTTP entry.

## Option A: run cloudflared in Docker

Create a tunnel in Cloudflare Zero Trust, then copy the tunnel token into `.env`:

```bash
CLOUDFLARE_TUNNEL_TOKEN=your_token_here
LOCAL_NGINX_PORT=8080
```

Start everything:

```bash
docker compose -f docker-compose.cloudflare.yml --profile tunnel up -d --build
```

In Cloudflare Tunnel public hostname settings, set the service URL to:

```text
http://nginx:80
```

That hostname works because `cloudflared`, `nginx`, `app`, and `mysql` are in the same Docker Compose network.

## Option B: run cloudflared on Windows directly

Start only the local stack:

```bash
docker compose -f docker-compose.cloudflare.yml up -d --build
```

Test locally:

```text
http://localhost:8080
```

In Cloudflare Tunnel public hostname settings, set the service URL to:

```text
http://localhost:8080
```

Use this option when `cloudflared` is installed directly on Windows rather than running as a Docker container.

## Notes

- Do not expose MySQL to the host or public network.
- Do not point Cloudflare directly at the app port. Keep Nginx as the only entry.
- HTTPS is handled by Cloudflare. Local Nginx can stay HTTP.
- Change `ADMIN_PASSWORD`, `DB_PASSWORD`, and `MYSQL_ROOT_PASSWORD` in `.env` before exposing the site.
