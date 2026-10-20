# -*- coding: utf-8 -*-
"""从图鉴数据生成 search-index 关键词与 compendium-autolink.js（分离大索引）。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js"

DATA_FILES = [
    (JS / "characters-compendium-data.js", "CHARACTER_COMPENDIUM", "pages/compendium/characters.html"),
    (JS / "martial-compendium-data.js", "MARTIAL_COMPENDIUM", "pages/compendium/skills.html"),
    (JS / "internal-compendium-data.js", "INTERNAL_COMPENDIUM", "pages/compendium/internal.html"),
    (JS / "equipment-compendium-data.js", "EQUIPMENT_COMPENDIUM", "pages/compendium/equipment.html"),
    (JS / "skills-guide-data.js", "SKILLS_GUIDE_DATA", "pages/compendium/arts.html"),
]

TOKEN_NAMES = (
    "瑞麟令",
    "云蝠令",
    "玄武令",
    "天鹰令",
    "疾豹令",
    "虎啸令",
    "凤翔令",
    "龙腾令",
)

SEARCH_ENTRIES = {
    "pages/compendium/characters.html": "角色图鉴",
    "pages/compendium/skills.html": "武功图鉴",
    "pages/compendium/internal.html": "内功图鉴",
    "pages/compendium/equipment.html": "装备图鉴",
    "pages/compendium/arts.html": "技艺图鉴",
}

# search-index 保留导航词 + 部分图鉴名；完整名称列表见 compendium-autolink.js
SEARCH_KEYS_LITE = {
    "pages/compendium/characters.html": "角色图鉴 伙伴 天赋 入队 成长",
    "pages/compendium/skills.html": "武功图鉴 拳 剑 刀 招式 秘籍 品阶",
    "pages/compendium/internal.html": "内功图鉴 心法 词条 cbas",
    "pages/compendium/equipment.html": "装备图鉴 武器 护甲 戒指 品阶",
    "pages/compendium/arts.html": "技艺图鉴 生活技能 拳劲 剑意 刀主 伙伴增幅",
}

SEARCH_KEYS_NAME_LIMIT = 80
AUTOLINK_TAIL = "/** 图鉴名称见 js/compendium-autolink.js（搜索聚焦时懒加载） */\n"


def load_compendium_entries(path: Path, var_name: str) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    m = re.search(rf"window\.{var_name}\s*=\s*(\[.*\])\s*;", text, re.DOTALL)
    if not m:
        raise SystemExit(f"无法解析 {path} 中的 {var_name}")
    chunk = m.group(1)
    try:
        data = json.loads(chunk)
    except json.JSONDecodeError:
        if var_name != "SKILLS_GUIDE_DATA":
            raise
        data = []
        for line in chunk.splitlines():
            nm = re.search(r'name:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', line)
            if nm:
                data.append({"name": nm.group(1)})
    if not isinstance(data, list):
        raise SystemExit(f"{path} 中 {var_name} 不是数组")
    return data


def autolink_names_for_entries(var_name: str, entries: list[dict]) -> list[str]:
    """仅收录图鉴条目主名称，避免招式/词条等嵌套 name 污染全局搜索。"""
    names: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None) -> None:
        n = (raw or "").strip()
        if not n or n in seen:
            return
        seen.add(n)
        names.append(n)

    for e in entries:
        if not isinstance(e, dict):
            continue
        add(e.get("name"))
        if var_name == "CHARACTER_COMPENDIUM":
            add(e.get("gameName"))
        elif var_name == "MARTIAL_COMPENDIUM":
            add(e.get("itemName"))
        elif var_name in ("INTERNAL_COMPENDIUM", "EQUIPMENT_COMPENDIUM"):
            pass
    return names


def build_page_keys(url: str, names: list[str]) -> str:
    lite = SEARCH_KEYS_LITE.get(url, "")
    sample = " ".join(sorted(set(names))[:SEARCH_KEYS_NAME_LIMIT])
    return f"{lite} {sample}".strip()


def strip_autolink_from_index(raw: str) -> str:
    if "window.COMPENDIUM_AUTOLINK" in raw:
        raw = raw.split("window.COMPENDIUM_AUTOLINK")[0]
    marker = "/** 攻略内链"
    if marker in raw:
        raw = raw.split(marker)[0]
    autolink_note = "/** 图鉴名称见 js/compendium-autolink.js"
    if autolink_note in raw:
        raw = raw.split(autolink_note)[0]
    return raw.rstrip() + "\n"


def main() -> None:
    autolink: list[dict] = []
    name_counts: dict[str, int] = {}

    names_by_url: dict[str, list[str]] = {}

    for path, var, url in DATA_FILES:
        if not path.is_file():
            print("跳过（不存在）:", path.name)
            continue
        entries = load_compendium_entries(path, var)
        names = autolink_names_for_entries(var, entries)
        names_by_url[url] = names
        name_counts[url] = len(names)
        for n in names:
            autolink.append({"name": n, "url": url, "q": n})

    for t in TOKEN_NAMES:
        autolink.append(
            {
                "name": t,
                "url": "articles/weapons-xuanwu-206.html",
                "q": t,
            }
        )

    autolink.sort(key=lambda e: (-len(e["name"]), e["name"]))

    autolink_path = JS / "compendium-autolink.js"
    autolink_path.write_text(
        "/** 图鉴/武器名称索引（build-wiki-search-links.py，按需加载） */\n"
        "window.COMPENDIUM_AUTOLINK="
        + json.dumps(autolink, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    index_path = JS / "search-index.js"
    raw_index = strip_autolink_from_index(index_path.read_text(encoding="utf-8"))
    lines = raw_index.splitlines()
    new_lines: list[str] = []
    for line in lines:
        replaced = False
        for url, title in SEARCH_ENTRIES.items():
            if f'url: "{url}"' in line and "keys:" in line:
                keys = build_page_keys(url, names_by_url.get(url, []))
                new_lines.append(
                    f'  {{ title: "{title}", url: "{url}", keys: '
                    + json.dumps(keys, ensure_ascii=False)
                    + " },"
                )
                replaced = True
                break
        if not replaced and 'url: "articles/weapons-xuanwu-206.html"' in line and "keys:" in line:
            keys = " ".join(sorted(set(list(TOKEN_NAMES) + ["武器", "令牌", "获取"])))
            new_lines.append(
                '  { title: "武器获取", url: "articles/weapons-xuanwu-206.html", keys: '
                + json.dumps(keys, ensure_ascii=False)
                + " },"
            )
            replaced = True
        if not replaced:
            new_lines.append(line)

    if not new_lines[0].startswith("/**"):
        pass
    index_path.write_text("\n".join(new_lines) + "\n" + AUTOLINK_TAIL, encoding="utf-8")

    print("已写入:", autolink_path, f"({autolink_path.stat().st_size // 1024} KB)")
    print("已更新:", index_path, f"({index_path.stat().st_size // 1024} KB)")
    for url, title in SEARCH_ENTRIES.items():
        print(f"  {title}: autolink {name_counts.get(url, 0)} 条 · index keys 精简")


if __name__ == "__main__":
    main()
