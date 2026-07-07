from __future__ import annotations

from pathlib import Path
import argparse
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import STORE  # noqa: E402


def split_tags(tool: dict, category_name: str) -> list[str]:
    tags = tool.get("tags") or []
    if isinstance(tags, str):
        tags = [item.strip() for item in tags.replace("，", ",").split(",") if item.strip()]
    return [*tags[:4], category_name][:5]


def build_detail(tool: dict, category_name: str) -> dict:
    name = tool.get("name") or "这款工具"
    summary = tool.get("summary") or f"{name} 是 DeepFind Tools 收录的 {category_name}。"
    tags = split_tags(tool, category_name)
    features = [
        f"围绕 {category_name} 场景提供 AI 辅助，帮助用户更快完成信息处理、内容生成或工作流搭建。",
        f"{summary}",
        f"覆盖 {', '.join(tags[:3])} 等关键词，适合和同类工具做横向比较。",
    ]
    use_cases = [
        f"个人用户：用 {name} 快速验证 {category_name} 相关需求，减少工具试错时间。",
        f"团队协作：把 {name} 作为项目流程中的候选工具，用于提升交付效率。",
        "运营选型：结合标签、简介、官网说明和相似工具，判断是否适合当前业务场景。",
    ]
    faq = [
        {"question": f"{name} 是否免费？", "answer": "免费额度、订阅价格和商用限制以官网最新说明为准。"},
        {"question": f"{name} 适合什么人使用？", "answer": f"适合正在寻找 {category_name} 的创作者、运营、开发者、学生或团队用户。"},
        {"question": f"为什么收录 {name}？", "answer": "DeepFind Tools 会整理工具定位、分类、标签、官网入口和同类推荐，帮助用户快速完成初步判断。"},
    ]
    markdown = "\n\n".join(
        [
            f"## {name} 是什么？\n{summary}",
            "## 核心能力\n" + "\n".join(f"- {item}" for item in features),
            "## 适合的使用场景\n" + "\n".join(f"- {item}" for item in use_cases),
            "## 使用建议\n建议先确认官网定价、数据隐私、模型能力和团队协作方式，再结合本站同类工具进行比较。",
        ]
    )
    return {
        "detailMarkdown": markdown,
        "features": features,
        "useCases": use_cases,
        "faq": faq,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize structured detail content for tools with thin pages.")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    categories = {item.get("id"): item.get("name") for item in STORE.categories()}
    tools = sorted(
        STORE.tools(include_drafts=True),
        key=lambda item: (bool(item.get("featured")), bool(item.get("isNew")), str(item.get("id") or "")),
        reverse=True,
    )
    changed = 0
    for tool in tools:
        if changed >= args.limit:
            break
        has_detail = any(tool.get(key) for key in ["detailMarkdown", "features", "useCases", "faq"])
        if has_detail and not args.overwrite:
            continue
        category_name = categories.get(tool.get("category")) or "AI 工具"
        patch = build_detail(tool, category_name)
        changed += 1
        print(f"{'would update' if args.dry_run else 'update'}: {tool.get('id')} {tool.get('name')}")
        if not args.dry_run:
            STORE.update("tools", tool.get("id"), patch)

    print(f"initialized {changed} tool detail pages")


if __name__ == "__main__":
    main()
