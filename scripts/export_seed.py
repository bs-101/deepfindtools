from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import STORE, SEED_PATH, write_json


def main():
    payload = {
        "source": {
            "name": f"DeepFind Tools {STORE.name} export",
            "capturedAt": __import__("datetime").date.today().isoformat(),
            "note": "Exported from the current local database for first-run Docker database seeding.",
        },
        "categories": STORE.categories(),
        "tools": STORE.tools(include_drafts=True),
        "news": STORE.news(include_drafts=True),
    }
    write_json(SEED_PATH, payload)
    print(
        json.dumps(
            {
                "output": str(Path(SEED_PATH).resolve()),
                "store": STORE.name,
                "categories": len(payload["categories"]),
                "tools": len(payload["tools"]),
                "news": len(payload["news"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
