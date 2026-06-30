from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import STORE  # noqa: E402


def matches(news: dict, candidate: dict) -> bool:
    source_url = news.get("sourceUrl")
    url_match = bool(source_url and source_url in {candidate.get("sourceUrl"), candidate.get("url")})
    title = news.get("title")
    title_match = bool(title and title in {candidate.get("title"), candidate.get("name")})
    return url_match or title_match


def migrate() -> list[str]:
    candidates = [
        item
        for item in STORE.candidates()
        if (item.get("status") or "pending") == "pending"
    ]
    drafts = [
        item
        for item in STORE.news(include_drafts=True)
        if item.get("status") == "draft"
    ]
    updated = []

    for news in drafts:
        candidate = next((item for item in candidates if matches(news, item)), None)
        if not candidate:
            continue
        published = STORE.update(
            "news",
            news["id"],
            {
                "status": "published",
                "sourceCandidateId": candidate.get("id", ""),
            },
        )
        STORE.update(
            "candidates",
            candidate["id"],
            {
                "status": "accepted",
                "acceptedAs": "news",
                "acceptedItemId": published["id"],
                "acceptedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            },
        )
        updated.append(news.get("title", ""))

    return updated


if __name__ == "__main__":
    migrated = migrate()
    print(f"updated={len(migrated)}")
    for title in migrated:
        print(title)
