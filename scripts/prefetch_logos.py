from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import argparse
import mimetypes
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import LOGO_CACHE_DIR, STORE, is_remote_url  # noqa: E402


USER_AGENT = "DeepFindToolsLogoCache/1.0 (+https://ai.deepfindtools.com)"
MAX_BYTES = 2 * 1024 * 1024


def cache_path_for(tool_id: str, source: str) -> Path:
    suffix = Path(urlparse(source).path).suffix.lower()
    if suffix not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
        suffix = ".img"
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "_", str(tool_id))
    return LOGO_CACHE_DIR / f"{safe_id}{suffix}"


def prefetch_one(tool: dict, force: bool = False) -> tuple[str, str]:
    tool_id = str(tool.get("id") or "")
    source = str(tool.get("logoRemote") or tool.get("logo") or "")
    if not tool_id or not is_remote_url(source):
        return "skip", tool_id

    target = cache_path_for(tool_id, source)
    if target.exists() and not force:
        return "cached", tool_id

    request = Request(source, headers={"User-Agent": USER_AGENT, "Accept": "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8"})
    with urlopen(request, timeout=15) as response:
        content_type = response.headers.get("Content-Type", "")
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return "too_large", tool_id
    if not content_type.startswith("image/") and not mimetypes.guess_type(str(target))[0]:
        return "not_image", tool_id

    LOGO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return "downloaded", tool_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Prefetch remote tool logos into the local logo cache.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of tools to scan. 0 means all.")
    parser.add_argument("--force", action="store_true", help="Refresh existing cached logos.")
    args = parser.parse_args()

    counts = {"downloaded": 0, "cached": 0, "skip": 0, "failed": 0, "too_large": 0, "not_image": 0}
    tools = STORE.tools(include_drafts=True)
    if args.limit:
        tools = tools[: args.limit]

    for tool in tools:
        try:
            status, tool_id = prefetch_one(tool, force=args.force)
            counts[status] = counts.get(status, 0) + 1
            print(f"{status}: {tool_id or tool.get('name')}")
        except Exception as exc:
            counts["failed"] += 1
            print(f"failed: {tool.get('id') or tool.get('name')} - {exc}")

    print("summary:", counts)


if __name__ == "__main__":
    main()
