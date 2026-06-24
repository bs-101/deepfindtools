# DeepFind Tools

DeepFind Tools is an AI tools directory with tool categories, searchable listings, SEO-friendly detail pages, daily AI briefings, and a private admin console for managing tools and news.

The project uses a hybrid rendering architecture:

- Frontend: Next.js, React, SSG/ISR for public pages.
- Backend: Python HTTP service for APIs, auth, data persistence, and logo proxy/cache.
- Database: MySQL through Docker Compose.
- Edge: Nginx as the single local entry point, with optional Cloudflare Tunnel or a server Nginx reverse proxy.

## Features

- AI tool directory with category navigation.
- Tool detail pages at `/sites/{id}.html`.
- Daily AI news page at `/daily-ai-news/`.
- Admin console for adding and editing tools/news.
- Sitemap, robots.txt, canonical tags, Open Graph tags, and JSON-LD for SEO.
- Proxied tool logos with cache-friendly URLs such as `/api/logo/{id}.png?v=...`.
- Docker Compose deployment with MySQL, backend, frontend, and Nginx.

## Rendering And SEO

Public pages use Next.js hybrid rendering:

- `/`: SSG + ISR.
- `/category/[id]`: SSG + ISR.
- `/daily-ai-news`: SSG + ISR.
- `/sites/[id]`: SSG + ISR, compatible with `/sites/{id}.html`.
- `/sitemap.xml` and `/robots.txt`: SSR.
- `/admin`: SSR auth guard, hidden from unauthenticated users.

ISR is configured with a 5-minute revalidate window, so content can be refreshed without rebuilding the whole site.

## Requirements

- Node.js 22+
- Python 3.12+
- Docker and Docker Compose

For normal deployment, Docker Compose is recommended.

## Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Set strong private values before starting:

```bash
DB_ENGINE=django.db.backends.mysql
DB_NAME=adops_db
DB_USER=adops_user
DB_PASSWORD=replace_with_a_strong_database_password
MYSQL_ROOT_PASSWORD=replace_with_a_strong_mysql_root_password
DB_HOST=mysql
DB_PORT=3306

ADMIN_USER=admin
ADMIN_PASSWORD=replace_with_a_strong_admin_password
PUBLIC_BASE_URL=https://www.deepfindtools.com
APP_PORT=8080
```

Do not commit `.env` or real passwords.

## Local Development

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
python server.py
```

Run Next.js:

```bash
npm run dev
```

For Docker-based local running:

```bash
docker compose up -d --build
```

The compose stack exposes Nginx on `127.0.0.1:${APP_PORT:-8080}`.

## Cloudflare Tunnel Local Mode

Use `docker-compose.cloudflare.yml` when Cloudflare Tunnel points to your local machine:

```bash
docker compose -f docker-compose.cloudflare.yml up -d --build
```

If `cloudflared` is installed directly on Windows, point the Cloudflare public hostname service URL to:

```text
http://localhost:8080
```

Keep Nginx as the only public entry point.

## Production Deployment

On the server:

```bash
git clone https://github.com/bs-101/deepfindtools.git
cd deepfindtools
cp .env.example .env
nano .env
docker compose up -d --build
```

Recommended maintenance commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend frontend nginx
docker compose down
docker compose up -d --build
```

## Admin Console

The login page is:

```text
/login
```

The admin page is:

```text
/admin
```

Admin credentials come from `ADMIN_USER` and `ADMIN_PASSWORD` in the server environment. There is no safe public default password for production.

## Data Persistence

MySQL data is stored in the Docker volume:

```text
deepfindtools_mysql_data
```

Logo cache files are stored in:

```text
deepfindtools_logo_cache
```

Running `docker compose down` keeps volumes. Running `docker compose down -v` deletes persisted database content.

## Seed Data

The project ships with `data/seed.json`. On first startup, if the database is empty, the backend imports this seed data.

To export current local data back to seed format:

```bash
python scripts/export_seed.py
```

Commit `data/seed.json` only when the data is intended to be public.

## Caching

Next.js static assets are served by the frontend. Public pages use ISR.

Tool logos are proxied through the backend and returned with cache-friendly paths and headers:

```text
/api/logo/{id}.png?v={hash}
Cache-Control: public, max-age=604800, stale-while-revalidate=2592000
```

This allows browsers and CDN layers such as Cloudflare to cache logos.

## Security Notes

- Set `ADMIN_PASSWORD` before exposing the site.
- Keep `.env` private.
- Do not expose the backend or frontend container directly; expose only Nginx.
- Use HTTPS through Cloudflare or a server reverse proxy.
- Rotate admin credentials if a previous default password was ever used publicly.

## License

No license has been declared yet. Add a license before accepting external contributions.
