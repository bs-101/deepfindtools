from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import hashlib
import json
import re
import ssl
import time


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://ai-bot.cn/"
SEED_PATH = ROOT / "data" / "seed.json"
LOGO_DIR = ROOT / "assets" / "logos"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

CATEGORIES = [
    {"id": "writing", "name": "AI\u5199\u4f5c\u5de5\u5177", "icon": "\u5199"},
    {"id": "image", "name": "AI\u56fe\u50cf\u5de5\u5177", "icon": "\u56fe"},
    {"id": "video", "name": "AI\u89c6\u9891\u5de5\u5177", "icon": "\u89c6"},
    {"id": "office", "name": "AI\u529e\u516c\u5de5\u5177", "icon": "\u529e"},
    {"id": "chat", "name": "AI\u804a\u5929\u52a9\u624b", "icon": "\u804a"},
    {"id": "agent", "name": "AI\u667a\u80fd\u4f53", "icon": "\u4f53"},
    {"id": "code", "name": "AI\u7f16\u7a0b\u5de5\u5177", "icon": "\u7801"},
    {"id": "platform", "name": "AI\u5f00\u53d1\u5e73\u53f0", "icon": "\u5f00"},
    {"id": "design", "name": "AI\u8bbe\u8ba1\u5de5\u5177", "icon": "\u8bbe"},
    {"id": "audio", "name": "AI\u97f3\u9891\u5de5\u5177", "icon": "\u97f3"},
    {"id": "search", "name": "AI\u641c\u7d22\u5f15\u64ce", "icon": "\u641c"},
    {"id": "learning", "name": "AI\u5b66\u4e60\u7f51\u7ad9", "icon": "\u5b66"},
    {"id": "model", "name": "AI\u8bad\u7ec3\u6a21\u578b", "icon": "\u6a21"},
    {"id": "detect", "name": "AI\u5185\u5bb9\u68c0\u6d4b", "icon": "\u68c0"},
    {"id": "prompt", "name": "AI\u63d0\u793a\u6307\u4ee4", "icon": "\u8bcd"},
]

CATEGORY_RULES = [
    ("audio", ["\u97f3\u9891", "\u97f3\u4e50", "\u914d\u97f3", "\u58f0\u97f3", "\u8f6c\u6587\u5b57", "MELO", "MeloLab", "UniScribe"]),
    ("video", ["\u89c6\u9891", "\u6570\u5b57\u4eba", "\u77ed\u89c6\u9891", "\u56fe\u751f\u89c6\u9891", "Runway", "LibTV", "Seedance", "Vidu"]),
    ("code", ["\u7f16\u7a0b", "\u4ee3\u7801", "\u5f00\u53d1", "IDE", "Cursor", "GitHub", "TRAE", "MiMo", "\u7801\u4e0a\u98de", "Vibe Coding"]),
    ("platform", ["\u5f00\u53d1\u5e73\u53f0", "API", "Hugging Face", "\u9b54\u642d", "\u98de\u6868", "\u706b\u5c71\u5f15\u64ce", "\u817e\u8baf\u4e91"]),
    ("agent", ["Agent", "\u667a\u80fd\u4f53", "\u5de5\u4f5c\u6d41", "Manus", "OpenClaw", "QoderWork", "TRAE Work", "\u6263\u5b50"]),
    ("design", ["\u8bbe\u8ba1", "\u6d77\u62a5", "\u5546\u54c1\u56fe", "\u7d20\u6750", "\u7a3f\u5b9a", "\u7f8e\u56fe", "\u5806\u53cb", "Lovart"]),
    ("image", ["\u56fe\u50cf", "\u56fe\u7247", "\u7ed8\u753b", "\u63d2\u753b", "\u62a0\u56fe", "\u6539\u56fe", "Midjourney", "\u5373\u68a6", "\u661f\u6d41", "Stable Diffusion", "Civitai"]),
    ("search", ["\u641c\u7d22", "\u68c0\u7d22", "\u7814\u7a76", "\u5f15\u7528", "\u79d8\u5854", "Perplexity"]),
    ("detect", ["\u68c0\u6d4b", "\u964dAI", "AIGC\u7387", "\u67e5\u91cd"]),
    ("model", ["\u6a21\u578b", "\u8bad\u7ec3", "LoRA", "ComfyUI", "\u5927\u6a21\u578b"]),
    ("prompt", ["\u63d0\u793a\u8bcd", "Prompt", "AIPRM", "LangGPT"]),
    ("office", ["PPT", "\u6587\u6863", "\u8868\u683c", "\u6570\u636e\u5206\u6790", "\u4f1a\u8bae", "\u601d\u7ef4\u5bfc\u56fe", "\u7ffb\u8bd1", "\u62db\u8058", "\u6cd5\u5f8b", "\u5c0f\u6d63\u718a", "\u529e\u516c"]),
    ("learning", ["\u6559\u7a0b", "\u5b66\u4e60", "\u8bfe\u7a0b", "\u95ee\u7b54", "\u767e\u79d1", "\u767d\u76ae\u4e66"]),
    ("writing", ["\u5199\u4f5c", "\u6587\u6848", "\u5c0f\u8bf4", "\u516c\u6587", "\u8bba\u6587", "\u603b\u7ed3", "Notion", "Gamma", "\u86d9\u86d9", "\u7b14\u7075", "\u8baf\u98de\u7ed8\u6587"]),
    ("chat", ["\u804a\u5929", "\u5bf9\u8bdd", "\u52a9\u624b", "ChatGPT", "Claude", "\u8c46\u5305", "Kimi", "\u901a\u7528"]),
]

TAG_RULES = [
    ("\u514d\u8d39", "\u514d\u8d39"),
    ("\u751f\u6210", "\u751f\u6210"),
    ("\u5e73\u53f0", "\u5e73\u53f0"),
    ("\u5f00\u6e90", "\u5f00\u6e90"),
    ("Agent", "Agent"),
    ("PPT", "PPT"),
]


class ToolParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tools = []
        self.current = None
        self.in_card = False
        self.in_strong = False
        self.in_p = False
        self.strong_text = []
        self.p_text = []
        self.seen = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "")
        if tag == "a" and "card" in classes.split() and "site-" in classes:
            self.current = {
                "id": attrs.get("data-id", ""),
                "detailUrl": attrs.get("href", ""),
                "url": unescape(attrs.get("data-url", "")),
                "summary": unescape(attrs.get("title", "")).strip(),
                "name": "",
                "logo": "",
                "logoRemote": "",
                "category": "chat",
                "tags": [],
                "status": "published",
                "featured": False,
                "isNew": False,
            }
            self.in_card = True
        elif self.in_card and tag == "img" and self.current and not self.current["logoRemote"]:
            logo = attrs.get("data-src") or attrs.get("src") or ""
            alt = attrs.get("alt") or ""
            self.current["logoRemote"] = urljoin(SOURCE_URL, unescape(logo))
            self.current["logo"] = self.current["logoRemote"]
            if alt and not self.current["name"]:
                self.current["name"] = unescape(alt).strip()
        elif self.in_card and tag == "strong":
            self.in_strong = True
            self.strong_text = []
        elif self.in_card and tag == "p":
            self.in_p = True
            self.p_text = []

    def handle_endtag(self, tag):
        if self.in_card and tag == "strong":
            text = "".join(self.strong_text).strip()
            if text and self.current:
                self.current["name"] = unescape(text)
            self.in_strong = False
        elif self.in_card and tag == "p":
            text = "".join(self.p_text).strip()
            if text and self.current:
                self.current["summary"] = unescape(text)
            self.in_p = False
        elif self.in_card and tag == "a":
            if self.current and self.current["name"]:
                key = (self.current["name"], self.current["url"] or self.current["detailUrl"])
                if key not in self.seen:
                    self.tools.append(self.current)
                    self.seen.add(key)
            self.current = None
            self.in_card = False

    def handle_data(self, data):
        if self.in_strong:
            self.strong_text.append(data)
        if self.in_p:
            self.p_text.append(data)


def fetch_text(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    context = ssl._create_unverified_context()
    with urlopen(request, timeout=25, context=context) as response:
        return response.read().decode("utf-8", errors="ignore")


def infer_category(tool):
    blob = f"{tool['name']} {tool['summary']}"
    blob_lower = blob.lower()
    for category_id, keywords in CATEGORY_RULES:
        if any(keyword.lower() in blob_lower for keyword in keywords):
            return category_id
    return "chat"


def infer_tags(tool, category_id):
    category_name = next((item["name"] for item in CATEGORIES if item["id"] == category_id), "\u5de5\u5177")
    tags = [category_name]
    blob = f"{tool['name']} {tool['summary']}"
    for keyword, label in TAG_RULES:
        if keyword.lower() in blob.lower() and label not in tags:
            tags.append(label)
    return tags[:4]


def logo_filename(tool):
    remote = tool.get("logoRemote") or ""
    suffix = Path(urlparse(remote).path).suffix.lower()
    if suffix not in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]:
        suffix = ".png"
    digest = hashlib.sha1(remote.encode("utf-8")).hexdigest()[:12]
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "-", tool["name"]).strip("-") or "logo"
    return f"{safe_name[:32]}-{digest}{suffix}"


def download_logo(tool):
    remote = tool.get("logoRemote")
    if not remote:
        return
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    filename = logo_filename(tool)
    target = LOGO_DIR / filename
    if target.exists() and target.stat().st_size > 0:
        tool["logo"] = f"./assets/logos/{filename}"
        return
    try:
        request = Request(remote, headers={"User-Agent": USER_AGENT})
        context = ssl._create_unverified_context()
        with urlopen(request, timeout=12, context=context) as response:
            content_type = response.headers.get("content-type", "")
            if "image" not in content_type and not remote.endswith(".svg"):
                return
            target.write_bytes(response.read())
        tool["logo"] = f"./assets/logos/{filename}"
        time.sleep(0.04)
    except Exception:
        tool["logo"] = remote


def parse_news(html):
    news = []
    pattern = re.compile(r'<span class="overflowClip_2 text-sm">(.*?)</span>', re.S)
    for match in pattern.finditer(html):
        title = unescape(re.sub(r"<.*?>", "", match.group(1))).strip()
        if not title or title in {item["title"] for item in news}:
            continue
        if any(word in title for word in ["AI", "\u5feb\u8baf", "\u9879\u76ee", "\u6559\u7a0b"]):
            news.append(
                {
                    "id": f"news-{len(news) + 1}",
                    "title": title,
                    "kind": "\u8d44\u8baf",
                    "summary": "\u8ffd\u8e2a AI \u5de5\u5177\u3001\u4ea7\u54c1\u66f4\u65b0\u3001\u6559\u7a0b\u8d44\u6599\u548c\u884c\u4e1a\u8d8b\u52bf\uff0c\u4fbf\u4e8e\u7528\u6237\u5feb\u901f\u5224\u65ad\u662f\u5426\u503c\u5f97\u5173\u6ce8\u3002",
                    "sourceUrl": SOURCE_URL,
                    "publishedAt": "2026-06-16",
                    "status": "published",
                }
            )
    fallback = [
        ("\u6bcf\u65e5AI\u5feb\u8baf\u70ed\u95fb", "\u8d44\u8baf"),
        ("\u6700\u65b0AI\u9879\u76ee", "\u9879\u76ee"),
        ("AI \u5de5\u5177\u4f7f\u7528\u6559\u7a0b", "\u6559\u7a0b"),
    ]
    while len(news) < 3:
        title, kind = fallback[len(news)]
        news.append(
            {
                "id": f"news-{len(news) + 1}",
                "title": title,
                "kind": kind,
                "summary": "\u6c47\u603b\u8fd1\u671f\u503c\u5f97\u5173\u6ce8\u7684 AI \u4ea7\u54c1\u52a8\u6001\u3001\u5f00\u6e90\u9879\u76ee\u548c\u5b9e\u7528\u6559\u7a0b\u3002",
                "sourceUrl": SOURCE_URL,
                "publishedAt": "2026-06-16",
                "status": "published",
            }
        )
    return news[:12]


def build_seed(html, limit=240, download_logos=True):
    parser = ToolParser()
    parser.feed(html)
    tools = parser.tools[:limit]
    for index, tool in enumerate(tools):
        tool["category"] = infer_category(tool)
        tool["tags"] = infer_tags(tool, tool["category"])
        tool["featured"] = index < 18
        tool["isNew"] = 18 <= index < 36
        if download_logos:
            download_logo(tool)
    return {
        "source": {
            "name": "AI\u5de5\u5177\u96c6\u516c\u5f00\u9996\u9875",
            "url": SOURCE_URL,
            "capturedAt": "2026-06-16",
            "note": "\u4ec5\u4f5c\u672c\u5730\u539f\u578b\u79cd\u5b50\u6570\u636e\uff0c\u4e0a\u7ebf\u524d\u8bf7\u786e\u8ba4\u6388\u6743\u3001\u6765\u6e90\u6807\u6ce8\u4e0e\u76ee\u6807\u7ad9\u6761\u6b3e\u3002",
        },
        "categories": CATEGORIES,
        "tools": tools,
        "news": parse_news(html),
    }


def main():
    html_path = ROOT / "ai-bot-home.html"
    html = html_path.read_text(encoding="utf-8", errors="ignore") if html_path.exists() else fetch_text(SOURCE_URL)
    seed = build_seed(html)
    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"tools": len(seed["tools"]), "categories": len(seed["categories"]), "news": len(seed["news"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
