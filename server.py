from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from html import escape
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse, parse_qsl
from urllib.request import Request, urlopen
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import time

import psycopg2
from psycopg2.extras import Json, RealDictCursor

try:
    import pymysql
    from pymysql.cursors import DictCursor as MySqlDictCursor
except ImportError:
    pymysql = None
    MySqlDictCursor = None


ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "dist"
DATA_DIR = ROOT / "data"
SEED_PATH = DATA_DIR / "seed.json"
DB_PATH = DATA_DIR / "db.json"
LOGO_CACHE_DIR = DATA_DIR / "logo-cache"

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
SESSION_COOKIE = "deepfind_session"
SESSIONS = set()


def read_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def next_id(prefix, items=None):
    count = len(items or [])
    return f"{prefix}-{int(time.time() * 1000)}-{count + 1}"


def db_config():
    return {
        "dbname": os.environ.get("DB_NAME", "adops_db"),
        "user": os.environ.get("DB_USER", "adops_user"),
        "password": os.environ.get("DB_PASSWORD", "your_password"),
        "host": os.environ.get("DB_HOST", "localhost"),
        "port": int(os.environ.get("DB_PORT", "5432")),
        "connect_timeout": 5,
    }


def mysql_config():
    return {
        "database": os.environ.get("DB_NAME", "adops_db"),
        "user": os.environ.get("DB_USER", "adops_user"),
        "password": os.environ.get("DB_PASSWORD", "your_password"),
        "host": os.environ.get("DB_HOST", "localhost"),
        "port": int(os.environ.get("DB_PORT", "3306")),
        "charset": "utf8mb4",
        "connect_timeout": 5,
        "autocommit": False,
    }


def wants_postgres():
    engine = os.environ.get("DB_ENGINE", "django.db.backends.postgresql")
    return "postgres" in engine.lower()


def wants_mysql():
    engine = os.environ.get("DB_ENGINE", "django.db.backends.postgresql")
    return "mysql" in engine.lower() or "mariadb" in engine.lower()


class JsonStore:
    name = "json"

    def ensure(self):
        if not DB_PATH.exists():
            shutil.copyfile(SEED_PATH, DB_PATH)

    def read(self):
        self.ensure()
        return read_json(DB_PATH)

    def save(self, data):
        write_json(DB_PATH, data)

    def categories(self):
        return self.read().get("categories", [])

    def tools(self, include_drafts=False):
        tools = self.read().get("tools", [])
        return tools if include_drafts else [item for item in tools if item.get("status", "published") == "published"]

    def news(self, include_drafts=False):
        news = self.read().get("news", [])
        return news if include_drafts else [item for item in news if item.get("status", "published") == "published"]

    def create(self, collection, payload):
        data = self.read()
        items = data.setdefault(collection, [])
        prefix = "tool" if collection == "tools" else "news"
        payload["id"] = payload.get("id") or next_id(prefix, items)
        items.insert(0, payload)
        self.save(data)
        return payload

    def update(self, collection, item_id, payload):
        data = self.read()
        items = data.setdefault(collection, [])
        for index, item in enumerate(items):
            if str(item.get("id")) == str(item_id):
                payload["id"] = item.get("id")
                items[index] = {**item, **payload}
                self.save(data)
                return items[index]
        return None

    def delete(self, collection, item_id):
        data = self.read()
        items = data.setdefault(collection, [])
        next_items = [item for item in items if str(item.get("id")) != str(item_id)]
        if len(next_items) == len(items):
            return False
        data[collection] = next_items
        self.save(data)
        return True

    def reset(self):
        shutil.copyfile(SEED_PATH, DB_PATH)


class PostgresStore:
    name = "postgresql"

    def connect(self):
        return psycopg2.connect(**db_config())

    def ensure(self):
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    create table if not exists deepfind_categories (
                        id text primary key,
                        name text not null,
                        icon text,
                        sort_order integer default 0
                    );
                    create table if not exists deepfind_tools (
                        id text primary key,
                        payload jsonb not null,
                        status text generated always as (coalesce(payload->>'status', 'published')) stored,
                        category text generated always as (coalesce(payload->>'category', 'chat')) stored,
                        created_at timestamptz default now()
                    );
                    create table if not exists deepfind_news (
                        id text primary key,
                        payload jsonb not null,
                        status text generated always as (coalesce(payload->>'status', 'published')) stored,
                        created_at timestamptz default now()
                    );
                    """
                )
                cur.execute("select count(*) from deepfind_tools")
                empty = cur.fetchone()[0] == 0
                if empty:
                    self.seed(cur)

    def seed(self, cur):
        seed = read_json(SEED_PATH)
        for index, category in enumerate(seed.get("categories", [])):
            cur.execute(
                """
                insert into deepfind_categories (id, name, icon, sort_order)
                values (%s, %s, %s, %s)
                on conflict (id) do update set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order
                """,
                (category["id"], category["name"], category.get("icon", ""), index),
            )
        for tool in seed.get("tools", []):
            cur.execute(
                "insert into deepfind_tools (id, payload) values (%s, %s) on conflict (id) do nothing",
                (str(tool["id"]), Json(tool)),
            )
        for item in seed.get("news", []):
            cur.execute(
                "insert into deepfind_news (id, payload) values (%s, %s) on conflict (id) do nothing",
                (str(item["id"]), Json(item)),
            )

    def categories(self):
        with self.connect() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("select id, name, icon from deepfind_categories order by sort_order, name")
            return [dict(row) for row in cur.fetchall()]

    def tools(self, include_drafts=False):
        where = "" if include_drafts else "where status = 'published'"
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(f"select payload from deepfind_tools {where} order by created_at desc, id desc")
            return [row[0] for row in cur.fetchall()]

    def news(self, include_drafts=False):
        where = "" if include_drafts else "where status = 'published'"
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(f"select payload from deepfind_news {where} order by created_at desc, id desc")
            return [row[0] for row in cur.fetchall()]

    def create(self, collection, payload):
        table = "deepfind_tools" if collection == "tools" else "deepfind_news"
        prefix = "tool" if collection == "tools" else "news"
        payload["id"] = payload.get("id") or next_id(prefix)
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(f"insert into {table} (id, payload) values (%s, %s)", (str(payload["id"]), Json(payload)))
        return payload

    def update(self, collection, item_id, payload):
        table = "deepfind_tools" if collection == "tools" else "deepfind_news"
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(f"select payload from {table} where id = %s", (str(item_id),))
            row = cur.fetchone()
            if not row:
                return None
            next_payload = {**row[0], **payload, "id": row[0].get("id", item_id)}
            cur.execute(f"update {table} set payload = %s where id = %s", (Json(next_payload), str(item_id)))
        return next_payload

    def delete(self, collection, item_id):
        table = "deepfind_tools" if collection == "tools" else "deepfind_news"
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(f"delete from {table} where id = %s", (str(item_id),))
            return cur.rowcount > 0

    def reset(self):
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute("truncate deepfind_tools, deepfind_news, deepfind_categories")
            self.seed(cur)


class MySqlStore:
    name = "mysql"

    def connect(self):
        if pymysql is None:
            raise RuntimeError("PyMySQL is not installed")
        return pymysql.connect(**mysql_config())

    def ensure(self):
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    create table if not exists deepfind_categories (
                        id varchar(191) primary key,
                        name varchar(255) not null,
                        icon varchar(64),
                        sort_order integer default 0
                    ) character set utf8mb4 collate utf8mb4_unicode_ci
                    """
                )
                cur.execute(
                    """
                    create table if not exists deepfind_tools (
                        id varchar(191) primary key,
                        payload json not null,
                        created_at timestamp default current_timestamp
                    ) character set utf8mb4 collate utf8mb4_unicode_ci
                    """
                )
                cur.execute(
                    """
                    create table if not exists deepfind_news (
                        id varchar(191) primary key,
                        payload json not null,
                        created_at timestamp default current_timestamp
                    ) character set utf8mb4 collate utf8mb4_unicode_ci
                    """
                )
                cur.execute("select count(*) from deepfind_tools")
                empty = cur.fetchone()[0] == 0
                if empty:
                    self.seed(cur)
            conn.commit()

    def seed(self, cur):
        seed = read_json(SEED_PATH)
        for index, category in enumerate(seed.get("categories", [])):
            cur.execute(
                """
                insert into deepfind_categories (id, name, icon, sort_order)
                values (%s, %s, %s, %s)
                on duplicate key update name = values(name), icon = values(icon), sort_order = values(sort_order)
                """,
                (category["id"], category["name"], category.get("icon", ""), index),
            )
        for tool in seed.get("tools", []):
            cur.execute(
                "insert ignore into deepfind_tools (id, payload) values (%s, %s)",
                (str(tool["id"]), json.dumps(tool, ensure_ascii=False)),
            )
        for item in seed.get("news", []):
            cur.execute(
                "insert ignore into deepfind_news (id, payload) values (%s, %s)",
                (str(item["id"]), json.dumps(item, ensure_ascii=False)),
            )

    def categories(self):
        with self.connect() as conn, conn.cursor(MySqlDictCursor) as cur:
            cur.execute("select id, name, icon from deepfind_categories order by sort_order, name")
            return [dict(row) for row in cur.fetchall()]

    def read_payloads(self, table):
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(f"select payload from {table} order by created_at desc, id desc")
            rows = cur.fetchall()
        payloads = []
        for row in rows:
            value = row[0]
            payloads.append(json.loads(value) if isinstance(value, str) else value)
        return payloads

    def tools(self, include_drafts=False):
        tools = self.read_payloads("deepfind_tools")
        return tools if include_drafts else [item for item in tools if item.get("status", "published") == "published"]

    def news(self, include_drafts=False):
        news = self.read_payloads("deepfind_news")
        return news if include_drafts else [item for item in news if item.get("status", "published") == "published"]

    def create(self, collection, payload):
        table = "deepfind_tools" if collection == "tools" else "deepfind_news"
        prefix = "tool" if collection == "tools" else "news"
        payload["id"] = payload.get("id") or next_id(prefix)
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"insert into {table} (id, payload) values (%s, %s)",
                    (str(payload["id"]), json.dumps(payload, ensure_ascii=False)),
                )
            conn.commit()
        return payload

    def update(self, collection, item_id, payload):
        table = "deepfind_tools" if collection == "tools" else "deepfind_news"
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"select payload from {table} where id = %s", (str(item_id),))
                row = cur.fetchone()
                if not row:
                    return None
                current_payload = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                next_payload = {**current_payload, **payload, "id": current_payload.get("id", item_id)}
                cur.execute(
                    f"update {table} set payload = %s where id = %s",
                    (json.dumps(next_payload, ensure_ascii=False), str(item_id)),
                )
            conn.commit()
        return next_payload

    def delete(self, collection, item_id):
        table = "deepfind_tools" if collection == "tools" else "deepfind_news"
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"delete from {table} where id = %s", (str(item_id),))
                ok = cur.rowcount > 0
            conn.commit()
        return ok

    def reset(self):
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute("truncate table deepfind_tools")
                cur.execute("truncate table deepfind_news")
                cur.execute("truncate table deepfind_categories")
                self.seed(cur)
            conn.commit()


def make_store():
    if wants_mysql():
        try:
            store = MySqlStore()
            store.ensure()
            return store
        except Exception as exc:
            print(f"MySQL unavailable, falling back to JSON: {exc}")
    if wants_postgres():
        try:
            store = PostgresStore()
            store.ensure()
            return store
        except Exception as exc:
            print(f"PostgreSQL unavailable, falling back to JSON: {exc}")
    store = JsonStore()
    store.ensure()
    return store


STORE = make_store()


def password_ok(username, password):
    if not ADMIN_PASSWORD:
        return False
    return username == ADMIN_USER and hmac.compare_digest(password or "", ADMIN_PASSWORD)


def is_remote_url(value):
    parsed = urlparse(value or "")
    return parsed.scheme in ["http", "https"] and bool(parsed.netloc)


def sanitize_external_url(value):
    if not is_remote_url(value):
        return value or ""
    parsed = urlparse(value)
    if "ai-bot.cn" in parsed.netloc.lower():
        return ""
    kept = []
    for key, val in parse_qsl(parsed.query, keep_blank_values=True):
        marker = f"{key}={val}".lower()
        if key.lower().startswith("utm_"):
            continue
        if "ai-bot" in marker or "aibot" in marker:
            continue
        kept.append((key, val))
    return urlunparse(parsed._replace(query=urlencode(kept, doseq=True)))


def public_tool(tool):
    item = dict(tool)
    tool_id = str(item.get("id") or "")
    official_url = sanitize_external_url(item.get("url") or "")
    item["url"] = official_url
    item["officialUrl"] = official_url
    item["detailUrl"] = f"/sites/{tool_id}.html" if tool_id else official_url
    if item.get("logo"):
        item["logo"] = f"/api/logo/{tool_id}" if tool_id else item.get("logo")
    item.pop("logoRemote", None)
    return item


def public_tools(tools):
    return [public_tool(tool) for tool in tools]


def find_tool(tool_id, include_drafts=False):
    for tool in STORE.tools(include_drafts=include_drafts):
        if str(tool.get("id")) == str(tool_id):
            return tool
    return None


def site_base(headers):
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL
    host = headers.get("X-Forwarded-Host") or headers.get("Host") or "localhost:4173"
    proto = headers.get("X-Forwarded-Proto") or ("https" if host and not host.startswith(("localhost", "127.0.0.1")) else "http")
    return f"{proto}://{host}".rstrip("/")


def html_description(tool):
    summary = tool.get("summary") or ""
    category = tool.get("category") or "AI工具"
    return f"{tool.get('name', 'AI工具')}：{summary or category}。DeepFind Tools 收录的 AI 工具详情、分类、标签和官网入口。"


def inject_head(html, title, description, canonical, image="", json_ld=None):
    title = escape(title)
    description = escape(description)
    canonical = escape(canonical)
    image = escape(image or "")
    tags = [
        f"<title>{title}</title>",
        f'<meta name="description" content="{description}" />',
        f'<link rel="canonical" href="{canonical}" />',
        f'<meta property="og:title" content="{title}" />',
        f'<meta property="og:description" content="{description}" />',
        f'<meta property="og:url" content="{canonical}" />',
        '<meta property="og:type" content="website" />',
        '<meta name="twitter:card" content="summary_large_image" />',
    ]
    if image:
        tags.append(f'<meta property="og:image" content="{image}" />')
    if json_ld:
        tags.append(f'<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>')
    html = re.sub(r"<title>.*?</title>", "", html, flags=re.I | re.S)
    html = re.sub(r'<meta name="description" content=".*?"\s*/?>', "", html, flags=re.I | re.S)
    html = re.sub(r'<link rel="canonical" href=".*?"\s*/?>', "", html, flags=re.I | re.S)
    html = re.sub(r'<meta property="og:[^"]+" content=".*?"\s*/?>', "", html, flags=re.I | re.S)
    html = re.sub(r'<meta name="twitter:[^"]+" content=".*?"\s*/?>', "", html, flags=re.I | re.S)
    html = re.sub(r'<script type="application/ld\+json">.*?</script>', "", html, flags=re.I | re.S)
    return html.replace("</head>", "\n    " + "\n    ".join(tags) + "\n  </head>")


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

    def translate_path(self, path):
        if DIST_DIR.exists():
            original_root = self.directory if hasattr(self, "directory") else None
            self.directory = str(DIST_DIR)
            translated = super().translate_path(path)
            if original_root is not None:
                self.directory = original_root
            return translated
        return super().translate_path(path)

    def serve_spa(self):
        index_path = DIST_DIR / "index.html" if DIST_DIR.exists() else ROOT / "index.html"
        body = index_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_html(self, html, status=200):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_text(self, text, content_type="text/plain; charset=utf-8", status=200):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_tool_page(self, tool_id):
        raw_tool = find_tool(tool_id)
        if not raw_tool:
            return self.send_json({"error": "Not found"}, 404)
        tool = public_tool(raw_tool)
        index_path = DIST_DIR / "index.html" if DIST_DIR.exists() else ROOT / "index.html"
        base = site_base(self.headers)
        canonical = f"{base}/sites/{escape(str(tool.get('id')))}.html"
        logo_url = f"{base}{tool.get('logo')}" if str(tool.get("logo", "")).startswith("/") else tool.get("logo", "")
        title = f"{tool.get('name')} - {tool.get('summary') or 'AI工具详情'} | DeepFind Tools"
        description = html_description(tool)
        json_ld = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": tool.get("name"),
            "description": tool.get("summary") or description,
            "applicationCategory": tool.get("category") or "AIApplication",
            "url": canonical,
            "image": logo_url,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CNY"},
        }
        html = index_path.read_text(encoding="utf-8")
        return self.serve_html(inject_head(html, title, description, canonical, logo_url, json_ld))

    def serve_logo(self, tool_id):
        raw_tool = find_tool(tool_id, include_drafts=True)
        if not raw_tool:
            return self.send_json({"error": "Not found"}, 404)
        source = raw_tool.get("logoRemote") or raw_tool.get("logo") or ""
        if not source:
            return self.send_json({"error": "Logo not found"}, 404)
        if not is_remote_url(source):
            path = source.replace("./", "/").lstrip("/")
            return self.serve_root_file(f"/{path}")

        LOGO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        suffix = Path(urlparse(source).path).suffix.lower()
        if suffix not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
            suffix = ".img"
        cache_path = LOGO_CACHE_DIR / f"{re.sub(r'[^a-zA-Z0-9_-]', '_', str(tool_id))}{suffix}"
        if not cache_path.exists():
            request = Request(source, headers={"User-Agent": "DeepFindTools/1.0"})
            with urlopen(request, timeout=12) as response:
                data = response.read(2 * 1024 * 1024 + 1)
            if len(data) > 2 * 1024 * 1024:
                return self.send_json({"error": "Logo too large"}, 413)
            cache_path.write_bytes(data)

        body = cache_path.read_bytes()
        content_type = mimetypes.guess_type(str(cache_path))[0] or "image/png"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_robots(self):
        base = site_base(self.headers)
        return self.serve_text(f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nSitemap: {base}/sitemap.xml\n")

    def serve_sitemap(self):
        base = site_base(self.headers)
        urls = [
            f"{base}/",
            f"{base}/daily-ai-news/",
        ]
        urls.extend(f"{base}/category/{category.get('id')}" for category in STORE.categories())
        urls.extend(f"{base}/sites/{tool.get('id')}.html" for tool in STORE.tools())
        body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for url in urls:
            body.append(f"  <url><loc>{escape(str(url))}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>")
        body.append("</urlset>")
        return self.serve_text("\n".join(body), "application/xml; charset=utf-8")

    def serve_root_file(self, path):
        target = (ROOT / path.lstrip("/")).resolve()
        if not str(target).startswith(str(ROOT.resolve())) or not target.exists() or not target.is_file():
            return False
        body = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if content_type.startswith("text/") or target.suffix in [".js", ".css", ".json", ".svg"]:
            content_type = f"{content_type}; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return True

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def session_token(self):
        raw = self.headers.get("Cookie", "")
        jar = cookies.SimpleCookie(raw)
        morsel = jar.get(SESSION_COOKIE)
        return morsel.value if morsel else ""

    def is_logged_in(self):
        token = self.session_token()
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return token and digest in SESSIONS

    def require_admin(self):
        if self.is_logged_in():
            return True
        self.send_json({"error": "Unauthorized"}, 401)
        return False

    def do_GET(self):
        parsed = urlparse(self.path)

        if (parsed.path == "/admin" or parsed.path.startswith("/admin/")) and not self.is_logged_in():
            return self.send_json({"error": "Not found"}, 404)
        if parsed.path in ["/login", "/login/"] and self.is_logged_in():
            return self.redirect("/admin")

        if parsed.path == "/robots.txt":
            return self.serve_robots()
        if parsed.path == "/sitemap.xml":
            return self.serve_sitemap()
        if parsed.path.startswith("/sites/") and parsed.path.endswith(".html"):
            return self.serve_tool_page(Path(parsed.path).stem)

        if not parsed.path.startswith("/api/"):
            target = Path(self.translate_path(parsed.path))
            if target.exists() and target.is_file():
                return super().do_GET()
            if parsed.path.startswith(("/assets/", "/data/")) and self.serve_root_file(parsed.path):
                return
            if parsed.path == "/" or "." not in Path(parsed.path).name:
                return self.serve_spa()
            return super().do_GET()

        query = parse_qs(parsed.query)
        include_drafts = query.get("includeDrafts", ["0"])[0] == "1"
        if include_drafts and not self.require_admin():
            return

        if parsed.path == "/api/tools":
            tools = STORE.tools(include_drafts=include_drafts)
            return self.send_json(tools if include_drafts else public_tools(tools))
        if parsed.path.startswith("/api/tools/"):
            tool = find_tool(parsed.path.rsplit("/", 1)[-1], include_drafts=include_drafts)
            if not tool:
                return self.send_json({"error": "Not found"}, 404)
            return self.send_json(tool if include_drafts else public_tool(tool))
        if parsed.path.startswith("/api/logo/"):
            return self.serve_logo(parsed.path.rsplit("/", 1)[-1])
        if parsed.path == "/api/categories":
            return self.send_json(STORE.categories())
        if parsed.path == "/api/news":
            return self.send_json(STORE.news(include_drafts=include_drafts))
        if parsed.path == "/api/meta":
            return self.send_json({"store": STORE.name, "adminUser": ADMIN_USER})
        if parsed.path == "/api/session":
            return self.send_json({"authenticated": bool(self.is_logged_in()), "user": ADMIN_USER if self.is_logged_in() else None})

        return self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/login":
            payload = self.read_body()
            if not password_ok(payload.get("username"), payload.get("password")):
                return self.send_json({"error": "用户名或密码不正确"}, 401)
            token = secrets.token_urlsafe(32)
            SESSIONS.add(hashlib.sha256(token.encode("utf-8")).hexdigest())
            body = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/logout":
            token = self.session_token()
            SESSIONS.discard(hashlib.sha256(token.encode("utf-8")).hexdigest())
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
            self.end_headers()
            self.wfile.write(b'{"ok": true}')
            return

        if not parsed.path.startswith("/api/") or not self.require_admin():
            return

        payload = self.read_body()
        if parsed.path == "/api/tools":
            return self.send_json(STORE.create("tools", payload), 201)
        if parsed.path == "/api/news":
            return self.send_json(STORE.create("news", payload), 201)
        if parsed.path == "/api/reset":
            STORE.reset()
            return self.send_json({"ok": True})

        return self.send_json({"error": "Not found"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/") or not self.require_admin():
            return

        payload = self.read_body()
        if parsed.path.startswith("/api/tools/"):
            item = STORE.update("tools", parsed.path.rsplit("/", 1)[-1], payload)
            return self.send_json(item if item else {"error": "Not found"}, 200 if item else 404)
        if parsed.path.startswith("/api/news/"):
            item = STORE.update("news", parsed.path.rsplit("/", 1)[-1], payload)
            return self.send_json(item if item else {"error": "Not found"}, 200 if item else 404)

        return self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/") or not self.require_admin():
            return

        if parsed.path.startswith("/api/tools/"):
            ok = STORE.delete("tools", parsed.path.rsplit("/", 1)[-1])
            return self.send_json({"ok": ok}, 200 if ok else 404)
        if parsed.path.startswith("/api/news/"):
            ok = STORE.delete("news", parsed.path.rsplit("/", 1)[-1])
            return self.send_json({"ok": ok}, 200 if ok else 404)

        return self.send_json({"error": "Not found"}, 404)


def main():
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "4173"))
    server = ThreadingHTTPServer((host, port), Handler)
    display_host = "127.0.0.1" if host == "0.0.0.0" else host
    print(f"DeepFind Tools running at http://{display_host}:{port}/ using {STORE.name}")
    server.serve_forever()


if __name__ == "__main__":
    main()
