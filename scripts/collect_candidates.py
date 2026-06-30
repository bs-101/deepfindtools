from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote_plus, urljoin, urlparse
from urllib.request import Request, urlopen
import argparse
import hashlib
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import STORE, sanitize_external_url  # noqa: E402


USER_AGENT = "DeepFindToolsBot/1.0 (+https://ai.deepfindtools.com)"
DEFAULT_LIMIT = int(os.environ.get("CANDIDATE_LIMIT", "12"))

CATEGORY_RULES = [
    ("code", ["code", "coding", "developer", "ide", "github", "agent", "workflow", "api", "sdk"]),
    ("image", ["image", "photo", "drawing", "diffusion", "midjourney", "flux", "visual"]),
    ("video", ["video", "movie", "clip", "animation", "seedance", "runway"]),
    ("audio", ["audio", "music", "voice", "speech", "podcast"]),
    ("office", ["ppt", "document", "spreadsheet", "meeting", "slides", "office"]),
    ("design", ["design", "figma", "ui", "brand", "poster"]),
    ("agent", ["agent", "agents", "automation", "operator"]),
    ("model", ["model", "llm", "multimodal", "benchmark", "training"]),
    ("search", ["search", "research", "browser", "answer engine"]),
]

AI_KEYWORDS = [
    "AI",
    "人工智能",
    "大模型",
    "生成式",
    "智能体",
    "机器学习",
    "深度学习",
    "多模态",
    "具身智能",
    "神经网络",
    "模型",
    "算力",
    "机器人",
    "自动驾驶",
]

DOMESTIC_RSS_SOURCES = [
    {
        "name": "量子位",
        "url": "https://www.qbitai.com/feed",
        "filter_ai": False,
        "score": 88,
    },
    {
        "name": "InfoQ 中文",
        "url": "https://www.infoq.cn/feed",
        "filter_ai": True,
        "score": 78,
    },
    {
        "name": "IT之家",
        "url": "https://www.ithome.com/rss/",
        "filter_ai": True,
        "score": 76,
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def http_json(url: str, headers: dict[str, str] | None = None, timeout: int = 18):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})})
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def http_text(url: str, headers: dict[str, str] | None = None, timeout: int = 18) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def compact_text(value: str, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    return text[: limit - 1] + "…" if len(text) > limit else text


def clean_html_text(value: str, limit: int = 260) -> str:
    text = re.sub(r"<[^>]+>", " ", unescape(value or ""))
    return compact_text(text, limit)


def is_ai_related(title: str, summary: str = "") -> bool:
    haystack = f"{title} {summary}"
    lower = haystack.lower()
    return any(keyword in haystack for keyword in AI_KEYWORDS) or bool(
        re.search(r"\b(ai|aigc|agi|llm|agent|gpt|claude|gemini|deepseek|qwen|openai|anthropic)\b", lower)
    )


def parse_published_at(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return datetime.now().date().isoformat()
    try:
        parsed = parsedate_to_datetime(raw)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            match = re.search(r"(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})", raw)
            if match:
                return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"
            return datetime.now().date().isoformat()
    return parsed.date().isoformat()


def normalize_url(value: str) -> str:
    url = sanitize_external_url(value or "").strip()
    if not url:
        return ""
    parsed = urlparse(url)
    return parsed._replace(fragment="").geturl().rstrip("/")


def candidate_id(source: str, url: str, title: str) -> str:
    digest = hashlib.sha1(f"{source}|{normalize_url(url)}|{title}".encode("utf-8")).hexdigest()[:14]
    return f"cand-{digest}"


def classify(title: str, summary: str) -> str:
    haystack = f"{title} {summary}".lower()
    for category, keywords in CATEGORY_RULES:
        if any(keyword in haystack for keyword in keywords):
            return category
    return "chat"


def tags_for(title: str, summary: str) -> list[str]:
    haystack = f"{title} {summary}".lower()
    tags = []
    if "open source" in haystack or "github" in haystack:
        tags.append("开源")
    if "agent" in haystack:
        tags.append("Agent")
    if "free" in haystack:
        tags.append("免费")
    if "model" in haystack or "llm" in haystack:
        tags.append("模型")
    return tags[:4]


def make_candidate(candidate_type: str, source_name: str, title: str, summary: str, url: str, **extra):
    clean_url = normalize_url(url)
    title = compact_text(title, 90)
    summary = compact_text(summary or title, 260)
    return {
        "id": candidate_id(source_name, clean_url, title),
        "type": candidate_type,
        "title": title,
        "name": title,
        "summary": summary,
        "url": clean_url,
        "sourceName": source_name,
        "sourceUrl": clean_url,
        "status": "pending",
        "score": extra.pop("score", 60),
        "reason": extra.pop("reason", f"来自 {source_name} 的自动采集候选"),
        "category": extra.pop("category", classify(title, summary)),
        "tags": extra.pop("tags", tags_for(title, summary)),
        "createdAt": now_iso(),
        **extra,
    }


def feed_value(entry: ET.Element, names: set[str]) -> str:
    for node in entry.iter():
        local_name = node.tag.rsplit("}", 1)[-1].lower()
        if local_name in names:
            if local_name == "link" and node.attrib.get("href"):
                rel = node.attrib.get("rel", "alternate")
                if rel in {"alternate", ""}:
                    return node.attrib["href"]
            text = "".join(node.itertext()).strip()
            if text:
                return text
    return ""


def collect_feed_source(source: dict, limit: int) -> list[dict]:
    root = ET.fromstring(http_text(source["url"], headers={"Accept": "application/rss+xml, application/atom+xml, text/xml"}))
    entries = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1].lower() in {"item", "entry"}]
    candidates = []
    for entry in entries:
        title = clean_html_text(feed_value(entry, {"title"}), 100)
        summary = clean_html_text(feed_value(entry, {"description", "summary", "content", "encoded"}), 260)
        link = feed_value(entry, {"link", "id", "guid"})
        published_at = parse_published_at(feed_value(entry, {"pubdate", "published", "updated", "date"}))
        if not title or not link:
            continue
        if source.get("filter_ai") and not is_ai_related(title, summary):
            continue
        candidates.append(
            make_candidate(
                "news",
                source["name"],
                title,
                summary or title,
                link,
                kind="资讯",
                publishedAt=published_at,
                score=source["score"],
                reason=f"{source['name']} 官方公开信息源，等待人工核对后发布。",
            )
        )
        if len(candidates) >= limit:
            break
    return candidates


def collect_domestic_feeds(limit: int) -> list[dict]:
    per_source = max(3, (limit + len(DOMESTIC_RSS_SOURCES) - 1) // len(DOMESTIC_RSS_SOURCES))
    candidates = []
    for source in DOMESTIC_RSS_SOURCES:
        try:
            found = collect_feed_source(source, per_source)
            print(f"  {source['name']}: {len(found)} candidates")
            candidates.extend(found)
        except Exception as exc:
            print(f"  {source['name']} failed: {exc}")
    return candidates


class KrAiParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items: dict[str, dict] = {}
        self.last_href = ""
        self.capture: tuple[str, str, str] | None = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        classes = set(values.get("class", "").split())
        if tag == "a" and "article-item-title" in classes:
            href = urljoin("https://www.36kr.com", values.get("href", ""))
            self.last_href = href
            self.items.setdefault(href, {"url": href})
            self.capture = ("a", "title", href)
        elif tag == "a" and "article-item-description" in classes and self.last_href:
            self.capture = ("a", "summary", self.last_href)
        elif tag == "a" and "kr-flow-bar-author" in classes and self.last_href:
            self.capture = ("a", "author", self.last_href)
        elif tag == "span" and "kr-flow-bar-time" in classes and self.last_href:
            self.capture = ("span", "time", self.last_href)

    def handle_data(self, data):
        if not self.capture:
            return
        _, key, href = self.capture
        item = self.items.setdefault(href, {"url": href})
        item[key] = f"{item.get(key, '')} {data}".strip()

    def handle_endtag(self, tag):
        if self.capture and self.capture[0] == tag:
            self.capture = None


def relative_cn_date(value: str) -> str:
    today = datetime.now().date()
    match = re.search(r"(\d+)\s*天前", value or "")
    if match:
        return (today - timedelta(days=int(match.group(1)))).isoformat()
    if "昨天" in (value or ""):
        return (today - timedelta(days=1)).isoformat()
    match = re.search(r"(\d{1,2})[-月](\d{1,2})", value or "")
    if match:
        return f"{today.year:04d}-{int(match.group(1)):02d}-{int(match.group(2)):02d}"
    return today.isoformat()


def collect_36kr_ai(limit: int) -> list[dict]:
    parser = KrAiParser()
    parser.feed(http_text("https://www.36kr.com/information/AI/", headers={"Accept": "text/html"}))
    candidates = []
    for item in parser.items.values():
        title = compact_text(item.get("title", ""), 100)
        if not title:
            continue
        source_name = compact_text(item.get("author", ""), 40) or "36氪 AI"
        summary = compact_text(item.get("summary", "") or title, 260)
        candidates.append(
            make_candidate(
                "news",
                source_name,
                title,
                summary,
                item["url"],
                kind="资讯",
                publishedAt=relative_cn_date(item.get("time", "")),
                score=84 if source_name in {"量子位", "机器之心", "新智元"} else 80,
                reason=f"来自 36氪 AI 频道收录的 {source_name} 内容，等待人工核对后发布。",
            )
        )
        if len(candidates) >= limit:
            break
    return candidates


def collect_github(limit: int) -> list[dict]:
    query = quote_plus("ai llm agent in:name,description,readme pushed:>=2026-01-01")
    url = f"https://api.github.com/search/repositories?q={query}&sort=updated&order=desc&per_page={limit}"
    data = http_json(url, headers={"Accept": "application/vnd.github+json"})
    candidates = []
    for item in data.get("items", [])[:limit]:
        stars = int(item.get("stargazers_count") or 0)
        summary = item.get("description") or "GitHub 上近期活跃的 AI 开源项目。"
        candidates.append(
            make_candidate(
                "tool",
                "GitHub",
                item.get("full_name") or item.get("name") or "GitHub AI project",
                summary,
                item.get("html_url") or "",
                logo="",
                score=min(95, 55 + stars // 500),
                reason=f"GitHub 近期活跃项目，当前约 {stars} stars。",
                category=classify(item.get("name", ""), summary),
                tags=["开源", *tags_for(item.get("name", ""), summary)][:4],
            )
        )
    return candidates


def collect_hacker_news(limit: int) -> list[dict]:
    query = quote_plus("AI OR LLM OR agent OR OpenAI OR Anthropic")
    url = f"https://hn.algolia.com/api/v1/search_by_date?query={query}&tags=story&hitsPerPage={limit}"
    data = http_json(url)
    candidates = []
    for item in data.get("hits", [])[:limit]:
        title = item.get("title") or item.get("story_title") or "AI discussion"
        link = item.get("url") or f"https://news.ycombinator.com/item?id={item.get('objectID')}"
        points = int(item.get("points") or 0)
        candidates.append(
            make_candidate(
                "news",
                "Hacker News",
                title,
                f"海外开发者社区热议：{title}",
                link,
                kind="资讯",
                score=min(92, 58 + points // 20),
                reason=f"Hacker News 新近讨论，约 {points} points。",
            )
        )
    return candidates


def collect_arxiv(limit: int) -> list[dict]:
    query = quote_plus("cat:cs.AI OR cat:cs.CL OR cat:cs.CV OR cat:cs.LG")
    url = f"http://export.arxiv.org/api/query?search_query={query}&sortBy=submittedDate&sortOrder=descending&max_results={limit}"
    root = ET.fromstring(http_text(url))
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    candidates = []
    for entry in root.findall("atom:entry", ns)[:limit]:
        title = compact_text(" ".join(entry.findtext("atom:title", default="", namespaces=ns).split()), 100)
        summary = compact_text(entry.findtext("atom:summary", default="", namespaces=ns), 260)
        link = entry.findtext("atom:id", default="", namespaces=ns)
        candidates.append(
            make_candidate(
                "news",
                "arXiv",
                title,
                summary,
                link,
                kind="论文",
                score=62,
                reason="arXiv 最新 AI 相关论文，可作为每日资讯候选。",
                category="model",
                tags=["论文", "模型"],
            )
        )
    return candidates


def collect_product_hunt(limit: int) -> list[dict]:
    token = os.environ.get("PRODUCT_HUNT_TOKEN", "").strip()
    if not token:
        return []
    query = """
    query($first: Int!) {
      posts(first: $first, order: NEWEST) {
        edges {
          node {
            id
            name
            tagline
            url
            website
            createdAt
          }
        }
      }
    }
    """
    req = Request(
        "https://api.producthunt.com/v2/api/graphql",
        data=json.dumps({"query": query, "variables": {"first": limit}}).encode("utf-8"),
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urlopen(req, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8", errors="replace"))
    candidates = []
    for edge in data.get("data", {}).get("posts", {}).get("edges", [])[:limit]:
        node = edge.get("node", {})
        title = node.get("name") or "Product Hunt launch"
        summary = node.get("tagline") or "Product Hunt 新发布产品。"
        link = node.get("website") or node.get("url") or ""
        if "ai" not in f"{title} {summary}".lower():
            continue
        candidates.append(
            make_candidate(
                "tool",
                "Product Hunt",
                title,
                summary,
                link,
                score=70,
                reason="Product Hunt 新发布的 AI 产品候选。",
            )
        )
    return candidates


def existing_fingerprints() -> set[str]:
    values = set()
    for item in [*STORE.tools(include_drafts=True), *STORE.news(include_drafts=True), *STORE.candidates()]:
        for key in ["url", "sourceUrl", "officialUrl"]:
            normalized = normalize_url(str(item.get(key) or ""))
            if normalized:
                values.add(f"url:{normalized.lower()}")
        title = str(item.get("title") or item.get("name") or "").strip().lower()
        if title:
            values.add(f"title:{title}")
    return values


def is_duplicate(candidate: dict, fingerprints: set[str]) -> bool:
    normalized = normalize_url(candidate.get("url") or candidate.get("sourceUrl") or "")
    title = str(candidate.get("title") or candidate.get("name") or "").strip().lower()
    return (normalized and f"url:{normalized.lower()}" in fingerprints) or (title and f"title:{title}" in fingerprints)


def collect_once(limit: int) -> int:
    collectors = [
        collect_domestic_feeds,
        collect_36kr_ai,
        collect_github,
        collect_hacker_news,
        collect_arxiv,
        collect_product_hunt,
    ]
    candidates = []
    for collector in collectors:
        try:
            found = collector(limit)
            print(f"{collector.__name__}: {len(found)} candidates")
            candidates.extend(found)
        except Exception as exc:
            print(f"{collector.__name__} failed: {exc}")

    fingerprints = existing_fingerprints()
    inserted = 0
    for candidate in sorted(candidates, key=lambda item: item.get("score", 0), reverse=True):
        if inserted >= limit:
            break
        if is_duplicate(candidate, fingerprints):
            continue
        STORE.create("candidates", candidate)
        inserted += 1
        normalized = normalize_url(candidate.get("url") or candidate.get("sourceUrl") or "")
        if normalized:
            fingerprints.add(f"url:{normalized.lower()}")
        fingerprints.add(f"title:{str(candidate.get('title') or candidate.get('name')).strip().lower()}")
    print(f"inserted {inserted} new candidates")
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Collect AI tool/news candidates for manual review.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=int(os.environ.get("COLLECT_INTERVAL_SECONDS", "3600")))
    args = parser.parse_args()

    while True:
        collect_once(args.limit)
        if not args.loop:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
