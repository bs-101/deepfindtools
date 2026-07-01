# DeepFind Tools

> 中文说明在前，English documentation follows below.

DeepFind Tools 是一个 AI 工具导航站，包含工具分类、工具搜索、SEO 友好的详情页、每日 AI 资讯，以及用于维护工具和资讯内容的私有后台。

## 中文说明

### 项目特性

- AI 工具目录和左侧分类导航。
- 工具详情页，路径兼容 `/sites/{id}.html`。
- 工具详情支持后台自定义 Markdown、详情图片、核心能力、使用场景和 FAQ。
- 每日 AI 资讯页面：`/daily-ai-news/`。
- 私有后台，可新增、编辑、删除工具和资讯。
- 候选审核池：采集脚本只生成待审候选，人工确认后再入库。
- SEO 基础能力：`sitemap.xml`、`robots.txt`、canonical、Open Graph、JSON-LD。
- 工具 logo 代理和缓存，路径类似 `/api/logo/{id}.png?v=...`。
- Docker Compose 一键部署，包含 MySQL、后端、前端和 Nginx。

### 技术架构

- 前端：Next.js + React。
- 后端：Python HTTP 服务，负责 API、登录鉴权、数据持久化、logo 代理缓存。
- 数据库：MySQL，通过 Docker Compose 启动。
- 入口层：Nginx 作为唯一对外入口，可接 Cloudflare Tunnel 或服务器反向代理。

### 渲染与 SEO

公开页面使用 Next.js 混合渲染：

- `/`：SSG + ISR。
- `/category/[id]`：SSG + ISR。
- `/daily-ai-news`：SSG + ISR。
- `/sites/[id]`：SSG + ISR，同时兼容 `/sites/{id}.html`。
- `/sitemap.xml` 和 `/robots.txt`：SSR。
- `/admin`：SSR 鉴权，未登录不可访问。

ISR 默认 5 分钟刷新一次，内容更新后无需整站重新构建。

### 环境要求

- Node.js 22+
- Python 3.12+
- Docker 和 Docker Compose

生产部署建议直接使用 Docker Compose。

### 环境变量

复制示例配置：

```bash
cp .env.example .env
```

启动前请设置强密码：

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

不要提交 `.env`，也不要把真实密码写进 GitHub。

### 本地开发

安装依赖：

```bash
npm install
```

启动后端：

```bash
python server.py
```

启动前端：

```bash
npm run dev
```

也可以使用 Docker 本地启动：

```bash
docker compose up -d --build
```

默认通过 Nginx 暴露在：

```text
127.0.0.1:${APP_PORT:-8080}
```

### Cloudflare Tunnel 本地映射

如果 Cloudflare Tunnel 指向本地机器，使用：

```bash
docker compose -f docker-compose.cloudflare.yml up -d --build
```

如果 `cloudflared` 直接安装在 Windows 上，在 Cloudflare Public Hostname 里填写：

```text
http://localhost:8080
```

建议始终让 Nginx 作为唯一入口，不要直接暴露前端或后端容器端口。

### 生产部署

服务器上执行：

```bash
git clone https://github.com/bs-101/deepfindtools.git
cd deepfindtools
cp .env.example .env
nano .env
docker compose up -d --build
```

常用维护命令：

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend frontend nginx
docker compose down
docker compose up -d --build
```

### 后台管理

登录页：

```text
/login
```

后台页：

```text
/admin
```

后台账号由服务器环境变量 `ADMIN_USER` 和 `ADMIN_PASSWORD` 控制。生产环境没有安全的公开默认密码，部署前必须自行设置强密码。

### 自动化运营

项目内置候选采集脚本，只会写入后台“候选审核”，不会自动发布。

手动采集一次：

```bash
python scripts/collect_candidates.py --limit 12
```

Docker 定时采集：

```bash
docker compose --profile automation up -d --build collector
```

本地 Cloudflare 方案：

```bash
docker compose -f docker-compose.cloudflare.yml --profile automation up -d --build collector
```

默认每小时采集一次，可通过 `.env` 调整：

```bash
CANDIDATE_LIMIT=12
COLLECT_INTERVAL_SECONDS=3600
PRODUCT_HUNT_TOKEN=
```

国内资讯优先采集量子位官方 RSS、36氪 AI 频道、InfoQ 中文和 IT之家；36氪 AI 频道也会汇集机器之心、新智元等头部媒体内容。GitHub、Hacker News、arXiv 作为工具、海外资讯和论文补充源；配置 `PRODUCT_HUNT_TOKEN` 后会额外启用 Product Hunt。每轮最多入队 `CANDIDATE_LIMIT` 条，所有内容只进入后台候选审核，不会自动发布。

#### 微信公众号监控

项目可选集成 We-MP-RSS，用于监控量子位、智谱AI、机器之心、新智元、APPSO 等公众号，并保留原始 `mp.weixin.qq.com` 文章链接。

先在 `.env` 中设置独立后台账号和密钥：

```bash
WECHAT_RSS_USER=admin
WECHAT_RSS_PASSWORD=请设置独立强密码
WECHAT_RSS_SECRET_KEY=请设置至少32位随机字符串
WECHAT_RSS_PORT=8001
WECHAT_RSS_URL=http://we-mp-rss:8001/feed/all.json?limit=100
WECHAT_ACCOUNT_ALLOWLIST=
```

启动微信公众号服务和候选采集器：

```bash
docker compose --profile wechat --profile automation up -d we-mp-rss collector
```

本地 Cloudflare 方案：

```bash
docker compose -f docker-compose.cloudflare.yml --profile wechat --profile automation up -d we-mp-rss collector
```

在本机打开 `http://127.0.0.1:8001`，使用 `.env` 中的独立账号登录，完成微信扫码授权并添加要监控的公众号。服务只绑定 `127.0.0.1`，没有配置到项目 Nginx 或 Cloudflare Tunnel，公网无法直接访问。部署在远程服务器时，可通过 SSH 隧道临时访问：

```bash
ssh -L 8001:127.0.0.1:8001 user@server
```

授权后只添加需要监控的公众号即可，订阅列表本身就是来源白名单。如果确实需要二次限制，可在 `WECHAT_ACCOUNT_ALLOWLIST` 中填写与 We-MP-RSS 显示完全一致的公众号名称。DeepFindTools 每小时读取聚合源，将新文章放入“候选审核”，不会自动发布。

### 数据持久化

MySQL 数据保存在 Docker volume：

```text
deepfindtools_mysql_data
```

Logo 缓存保存在：

```text
deepfindtools_logo_cache
```

微信公众号授权、订阅和文章缓存保存在：

```text
deepfindtools_wechat_rss_data
```

执行 `docker compose down` 不会删除数据。执行 `docker compose down -v` 会删除数据库 volume，请谨慎使用。

### 初始数据

项目包含 `data/seed.json`。首次启动时，如果数据库为空，后端会自动导入这份种子数据。

如果需要把本地数据导出为种子数据：

```bash
python scripts/export_seed.py
```

只有在数据允许公开时，才提交 `data/seed.json`。

### 缓存策略

Next.js 静态资源由前端服务提供，公开页面使用 ISR。

工具 logo 通过后端代理，并返回适合浏览器和 CDN 缓存的路径和响应头：

```text
/api/logo/{id}.png?v={hash}
Cache-Control: public, max-age=604800, stale-while-revalidate=2592000
```

Cloudflare 等 CDN 可以缓存这些 logo，减少回源和首屏等待。

### 安全注意事项

- 对外开放前必须设置 `ADMIN_PASSWORD`。
- `.env` 只能保存在服务器，不要提交。
- 不要直接暴露 backend 或 frontend 容器，只暴露 Nginx。
- 使用 Cloudflare 或服务器反向代理配置 HTTPS。
- 如果曾经使用过公开默认密码，请立即轮换后台密码。

### 许可证

当前项目尚未声明许可证。如果希望接受外部贡献，请先补充 LICENSE 文件。

---

## English Documentation

DeepFind Tools is an AI tools directory with tool categories, searchable listings, SEO-friendly detail pages, daily AI briefings, and a private admin console for managing tools and news.

### Features

- AI tool directory with category navigation.
- Tool detail pages at `/sites/{id}.html`.
- Customizable tool detail content with Markdown, images, feature lists, use cases, and FAQ.
- Daily AI news page at `/daily-ai-news/`.
- Admin console for adding and editing tools/news.
- Candidate review queue: collectors create pending items only, and publishing requires manual approval.
- Sitemap, robots.txt, canonical tags, Open Graph tags, and JSON-LD for SEO.
- Proxied tool logos with cache-friendly URLs such as `/api/logo/{id}.png?v=...`.
- Docker Compose deployment with MySQL, backend, frontend, and Nginx.

### Architecture

- Frontend: Next.js and React.
- Backend: Python HTTP service for APIs, authentication, data persistence, and logo proxy/cache.
- Database: MySQL through Docker Compose.
- Edge: Nginx as the single entry point, with optional Cloudflare Tunnel or a server reverse proxy.

### Rendering And SEO

Public pages use Next.js hybrid rendering:

- `/`: SSG + ISR.
- `/category/[id]`: SSG + ISR.
- `/daily-ai-news`: SSG + ISR.
- `/sites/[id]`: SSG + ISR, compatible with `/sites/{id}.html`.
- `/sitemap.xml` and `/robots.txt`: SSR.
- `/admin`: SSR auth guard, hidden from unauthenticated users.

ISR is configured with a 5-minute revalidate window, so content can be refreshed without rebuilding the whole site.

### Requirements

- Node.js 22+
- Python 3.12+
- Docker and Docker Compose

For normal deployment, Docker Compose is recommended.

### Environment Variables

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

### Local Development

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

### Cloudflare Tunnel Local Mode

Use `docker-compose.cloudflare.yml` when Cloudflare Tunnel points to your local machine:

```bash
docker compose -f docker-compose.cloudflare.yml up -d --build
```

If `cloudflared` is installed directly on Windows, point the Cloudflare public hostname service URL to:

```text
http://localhost:8080
```

Keep Nginx as the only public entry point.

### Production Deployment

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

### Admin Console

The login page is:

```text
/login
```

The admin page is:

```text
/admin
```

Admin credentials come from `ADMIN_USER` and `ADMIN_PASSWORD` in the server environment. There is no safe public default password for production.

### Operations Automation

The built-in collector writes to the admin review queue only. It does not publish content automatically.

Run once:

```bash
python scripts/collect_candidates.py --limit 12
```

Run as a Docker scheduled worker:

```bash
docker compose --profile automation up -d --build collector
```

For the local Cloudflare setup:

```bash
docker compose -f docker-compose.cloudflare.yml --profile automation up -d --build collector
```

Configure cadence in `.env`:

```bash
CANDIDATE_LIMIT=12
COLLECT_INTERVAL_SECONDS=3600
PRODUCT_HUNT_TOKEN=
```

Chinese sources are prioritized: QbitAI's official RSS, the 36Kr AI channel, InfoQ China, and ITHome. The 36Kr AI channel also aggregates publishers such as Synced and AI Era. GitHub, Hacker News, and arXiv remain as supplementary tool, international news, and research sources. Product Hunt is enabled when `PRODUCT_HUNT_TOKEN` is provided. Each run adds at most `CANDIDATE_LIMIT` review items and never publishes automatically.

#### WeChat Official Account Monitoring

The optional We-MP-RSS sidecar monitors accounts such as QbitAI, Zhipu AI, Synced, AI Era, and APPSO while preserving original `mp.weixin.qq.com` article URLs.

Configure isolated credentials in `.env`:

```bash
WECHAT_RSS_USER=admin
WECHAT_RSS_PASSWORD=set_a_separate_strong_password
WECHAT_RSS_SECRET_KEY=set_a_random_secret_with_at_least_32_characters
WECHAT_RSS_PORT=8001
WECHAT_RSS_URL=http://we-mp-rss:8001/feed/all.json?limit=100
WECHAT_ACCOUNT_ALLOWLIST=
```

Start the sidecar and collector:

```bash
docker compose --profile wechat --profile automation up -d we-mp-rss collector
```

For the local Cloudflare setup:

```bash
docker compose -f docker-compose.cloudflare.yml --profile wechat --profile automation up -d we-mp-rss collector
```

Open `http://127.0.0.1:8001`, sign in with the isolated credentials, authorize WeChat by QR code, and add subscriptions. The management port is bound to localhost only and is not routed through the project Nginx or Cloudflare Tunnel. For a remote server, use an SSH tunnel:

```bash
ssh -L 8001:127.0.0.1:8001 user@server
```

Subscribe only to approved accounts; the subscription list acts as the source allowlist. `WECHAT_ACCOUNT_ALLOWLIST` can optionally enforce exact account-name matches. DeepFindTools reads the aggregated JSON feed hourly and sends new articles to the manual review queue.

### Data Persistence

MySQL data is stored in the Docker volume:

```text
deepfindtools_mysql_data
```

Logo cache files are stored in:

```text
deepfindtools_logo_cache
```

WeChat authorization, subscriptions, and article cache are stored in:

```text
deepfindtools_wechat_rss_data
```

Running `docker compose down` keeps volumes. Running `docker compose down -v` deletes persisted database content.

### Seed Data

The project ships with `data/seed.json`. On first startup, if the database is empty, the backend imports this seed data.

To export current local data back to seed format:

```bash
python scripts/export_seed.py
```

Commit `data/seed.json` only when the data is intended to be public.

### Caching

Next.js static assets are served by the frontend. Public pages use ISR.

Tool logos are proxied through the backend and returned with cache-friendly paths and headers:

```text
/api/logo/{id}.png?v={hash}
Cache-Control: public, max-age=604800, stale-while-revalidate=2592000
```

This allows browsers and CDN layers such as Cloudflare to cache logos.

### Security Notes

- Set `ADMIN_PASSWORD` before exposing the site.
- Keep `.env` private.
- Do not expose the backend or frontend container directly; expose only Nginx.
- Use HTTPS through Cloudflare or a server reverse proxy.
- Rotate admin credentials if a previous default password was ever used publicly.

### License

No license has been declared yet. Add a license before accepting external contributions.
