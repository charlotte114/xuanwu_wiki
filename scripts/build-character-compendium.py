# -*- coding: utf-8 -*-
"""从 doc.json / strings.xml / res_head 生成角色图鉴数据与头像 PNG。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow：py -3 -m pip install Pillow")
    sys.exit(1)

from atlas_utils import crop_frame, parse_plist_frames

ROOT = Path(__file__).resolve().parents[1]
GAME_DATA = ROOT / "game-data"
DEFAULT_DOC = GAME_DATA / "doc.json"
DEFAULT_STRINGS = GAME_DATA / "strings.xml"
DEFAULT_GAME_RES = GAME_DATA / "res_head"
SUPPLEMENT_JSON = GAME_DATA / "character-wiki-supplement.json"

OUT_IMG_DIR = ROOT / "assets" / "images" / "characters"
OUT_JS = ROOT / "js" / "characters-compendium-data.js"

# 不计入图鉴的 person id（创角模板、重复条目等）
EXCLUDED_PERSON_IDS = frozenset(
    {
        "102",
        "103",
        "104",
        "105",
        "121",
        "122",
        "123",
        "124",
        "125",
        "2000008",  # 与 12607 莫声谷重复
        "200010",  # 与 12421 店小二（图鉴名徐小虎）同角色
        "101",  # 血刀少主（作者彩蛋，不入图鉴）
    }
)


def find_game_res(base: Path) -> Path:
    if (base / "res_head.plist").is_file() and (base / "res_head.png").is_file():
        return base
    raise FileNotFoundError(
        f"未找到 res_head.plist / res_head.png：{base}\n"
        f"请将图集放到项目 game-data/res_head/，或运行 import-game-data.bat 导入。"
    )


def parse_strings_xingge(strings_path: Path) -> dict[int, tuple[str, str]]:
    """xingGe 编号 -> (性格名, 描述)"""
    text = strings_path.read_text(encoding="utf-8")
    out: dict[int, tuple[str, str]] = {}
    for m in re.finditer(
        r"<key>xingge_desp_(\d+)</key>\s*<string>([^<]*)</string>", text
    ):
        num = int(m.group(1))
        raw = m.group(2).strip()
        if "|" in raw:
            name, desp = raw.split("|", 1)
        else:
            name, desp = raw, ""
        out[num] = (name.strip(), desp.strip())
    return out


def frame_key_for_head(head_id: int) -> str:
    return f"res_head/head{head_id}.png"


def fmt_growth(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s if s else "0"


def load_wiki_supplement() -> list[dict]:
    if not SUPPLEMENT_JSON.is_file():
        return []
    data = json.loads(SUPPLEMENT_JSON.read_text(encoding="utf-8"))
    return list(data.get("entries") or [])


def supplement_by_game_name(supplements: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for sup in supplements:
        for nick in sup.get("match") or []:
            out[str(nick).strip()] = sup
    return out


def apply_wiki_supplement(entry: dict, sup: dict) -> None:
    wiki_name = (sup.get("name") or "").strip()
    if wiki_name:
        entry["gameName"] = entry.get("gameName") or entry["name"]
        entry["name"] = wiki_name
    entry["martialType"] = (sup.get("martialType") or "").strip()
    entry["talentWiki"] = (sup.get("talentWiki") or "").strip()
    entry["obtain"] = (sup.get("obtain") or "").strip()
    if sup.get("tier") is not None:
        entry["tier"] = int(sup["tier"])


def wiki_only_entry(sup: dict) -> dict:
    hp = float(sup.get("hpXZ") or 1)
    pw = float(sup.get("powerXZ") or 1)
    name = (sup.get("name") or "—").strip()
    return {
        "id": f"wiki-{name}",
        "name": name,
        "growth": f"血 {fmt_growth(hp)} / 攻 {fmt_growth(pw)}",
        "hpXZ": hp,
        "powerXZ": pw,
        "growthTotal": round(hp + pw, 4),
        "xingGe": 0,
        "personality": "",
        "personalityName": "",
        "personalityDesc": "",
        "image": "",
        "head": 0,
        "wikiOnly": True,
        "martialType": (sup.get("martialType") or "").strip(),
        "talentWiki": (sup.get("talentWiki") or "").strip(),
        "obtain": (sup.get("obtain") or "").strip(),
        "tier": int(sup.get("tier") or 9999),
    }


def js_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def update_search_index(names: list[str]) -> None:
    path = ROOT / "js" / "search-index.js"
    if not path.is_file():
        return
    keys = " ".join(sorted(set(names)))
    lines = path.read_text(encoding="utf-8").splitlines()
    out = []
    replaced = False
    for line in lines:
        if 'title: "角色图鉴"' in line and "compendium/characters.html" in line:
            out.append(
                '  { title: "角色图鉴", url: "pages/compendium/characters.html", keys: '
                + json.dumps(keys, ensure_ascii=False)
                + " },"
            )
            replaced = True
        else:
            out.append(line)
    if replaced:
        path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> None:
    doc_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DOC
    strings_path = (
        Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_STRINGS
    )
    game_res = (
        Path(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_GAME_RES
    )
    game_res = find_game_res(game_res)

    plist_path = game_res / "res_head.plist"
    png_path = game_res / "res_head.png"

    xingge = parse_strings_xingge(strings_path)
    frames = parse_plist_frames(plist_path)
    atlas = Image.open(png_path).convert("RGBA")

    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    persons = doc.get("person") or {}
    supplements = load_wiki_supplement()
    sup_by_nick = supplement_by_game_name(supplements)

    entries = []
    missing_heads: list[str] = []

    for key, p in persons.items():
        hp = float(p.get("hpXZ") or 0)
        pw = float(p.get("powerXZ") or 0)
        if hp == 0 or pw == 0:
            continue
        pid = str(key)
        if pid in EXCLUDED_PERSON_IDS:
            continue
        head = int(p.get("head") or 0)
        nick = (p.get("nick") or pid).strip()
        xg_id = int(p.get("xingGe") or 0)
        xg_name, xg_desp = xingge.get(xg_id, ("", ""))

        img_name = f"{pid}.png"
        img_rel = f"assets/images/characters/{img_name}"
        out_path = OUT_IMG_DIR / img_name

        fk = frame_key_for_head(head)
        if fk not in frames:
            missing_heads.append(f"{nick}({pid}) head={head}")
            # 占位：透明 1x1
            out_path.parent.mkdir(parents=True, exist_ok=True)
            Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(out_path)
        else:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            crop_frame(atlas, frames[fk]).save(out_path)

        growth = f"血 {fmt_growth(hp)} / 攻 {fmt_growth(pw)}"
        personality = xg_name
        if xg_desp:
            personality = f"{xg_name}：{xg_desp}" if xg_name else xg_desp

        row = {
            "id": pid,
            "name": nick,
            "gameName": nick,
            "growth": growth,
            "hpXZ": hp,
            "powerXZ": pw,
            "growthTotal": round(hp + pw, 4),
            "xingGe": xg_id,
            "personality": personality,
            "personalityName": xg_name,
            "personalityDesc": xg_desp,
            "image": img_rel,
            "head": head,
        }
        sup = sup_by_nick.get(nick)
        if sup and not sup.get("wikiOnly"):
            apply_wiki_supplement(row, sup)
        entries.append(row)

    for sup in supplements:
        if sup.get("wikiOnly"):
            entries.append(wiki_only_entry(sup))

    def sort_key(e: dict) -> tuple:
        tier = e.get("tier")
        if tier is None:
            tier = 9999
        return (tier, e.get("name") or "")

    entries.sort(key=sort_key)

    for tid in EXCLUDED_PERSON_IDS:
        stale = OUT_IMG_DIR / f"{tid}.png"
        if stale.is_file():
            stale.unlink()

    lines = [
        "// 由 scripts/build-character-compendium.py 生成，请勿手改。",
        "window.CHARACTER_COMPENDIUM = " + json.dumps(entries, ensure_ascii=False, indent=2) + ";",
        "",
    ]
    OUT_JS.write_text("\n".join(lines), encoding="utf-8")

    update_search_index([e["name"] for e in entries])

    print(f"角色数: {len(entries)}")
    print(f"头像目录: {OUT_IMG_DIR}")
    print(f"数据文件: {OUT_JS}")
    if missing_heads:
        print("缺少 plist 帧的头像:")
        for m in missing_heads:
            print("  -", m)


if __name__ == "__main__":
    main()
