# -*- coding: utf-8 -*-
"""从 game-data/doc.json 生成武功图鉴数据。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME_DATA = ROOT / "game-data"
DEFAULT_DOC = GAME_DATA / "doc.json"
OUT_JS = ROOT / "js" / "martial-compendium-data.js"

MODE_LABELS = {
    21: "随机 1 个",
    22: "随机 2 个",
    23: "随机 3 个",
    24: "相邻 2 个",
    25: "相邻 3 个",
}

SB_GD_LABELS = {
    0: "不可破闪 / 破招架",
    1: "破招架",
    2: "破闪避",
    3: "双破",
}

TYPE_LABELS = {1: "拳", 2: "剑", 3: "刀"}

# star 0–6 与装备一致：0=? 1=E 2=D 3=C 4=B 5=A 6=S
STAR_LABELS = ("?", "E", "D", "C", "B", "A", "S")

# 图鉴展示威力 = 数据 power × 系数后舍弃小数
POWER_DISPLAY_SCALE = 1.02


def display_power(raw) -> int:
    return int(float(raw or 0) * POWER_DISPLAY_SCALE)


EXCLUDED_SKILL_IDS = frozenset(
    {
        "3080",  # 测试武功
        "3901",
        "3902",
        "3903",
        "3904",
        "3905",  # 撕咬 / 猛拍 / 扑击 / 撕咬(狼) / 毒雾 — 野怪招式，不入图鉴
    }
)

# doc.json 中与武功 id 同键、type=15 的 prop/goods 为可学习武功秘籍
SKILL_MANUAL_ITEM_TYPE = 15


def type_label(raw: int) -> str:
    return TYPE_LABELS.get(raw, TYPE_LABELS[1])


def type_category(raw: int) -> int:
    return raw if raw in (1, 2, 3) else 1


def item_block(doc: dict, sid: str) -> dict | None:
    for key in ("prop", "goods"):
        block = doc.get(key) or {}
        if sid in block:
            o = block[sid]
            return o if isinstance(o, dict) else None
    return None


def skill_manual_item(doc: dict, sid: str) -> dict | None:
    """武功图鉴仅收录有对应秘籍（同 id、type=15）的招式。"""
    o = item_block(doc, sid)
    if not o:
        return None
    if int(o.get("type") or 0) != SKILL_MANUAL_ITEM_TYPE:
        return None
    return o


def item_nick(doc: dict, sid: str) -> str:
    o = skill_manual_item(doc, sid)
    return (o.get("nick") or "").strip() if o else ""


def item_desp(doc: dict, sid: str) -> str:
    o = skill_manual_item(doc, sid)
    return (o.get("desp") or "").strip() if o else ""


def skill_nick(skills: dict, sid: str) -> str:
    s = skills.get(sid) or skills.get(str(sid))
    if not s:
        return str(sid)
    return (s.get("nick") or str(sid)).strip()


def unlock_for_slot(s: dict, slot: int) -> int | None:
    if slot == 1:
        return 1
    if slot == 2:
        if s.get("effName2") or s.get("effDesp2"):
            return int(s.get("buffLevel") or 0) or None
        return None
    if slot == 3:
        if s.get("effName3") or s.get("effDesp3"):
            lev = int(s.get("levelEffectLev") or 0)
            return lev if lev else None
        return None
    if slot == 4:
        if not (s.get("effName4") or s.get("effDesp4")):
            return None
        if s.get("adMode") is not None or s.get("adModeLevel"):
            lev = int(s.get("adModeLevel") or 0)
            return lev if lev else None
        if not (s.get("effName3") or s.get("effDesp3")):
            lev = int(s.get("levelEffectLev") or 0)
            if lev:
                return lev
        lev = int(s.get("adModeLevel") or s.get("levelEffectLev") or 0)
        return lev if lev else None
    return None


def star_info(s: dict) -> tuple[int, str]:
    raw = s.get("star")
    if raw is None:
        return -1, "?"
    star = int(raw)
    if star < 0 or star > 6:
        return star, "?"
    return star, STAR_LABELS[star]


def effect_block(s: dict, slot: int) -> dict | None:
    name = (s.get(f"effName{slot}") or "").strip()
    desc = (s.get(f"effDesp{slot}") or "").strip()
    if not name and not desc:
        return None
    return {
        "slot": slot,
        "name": name,
        "desc": desc,
        "unlock": unlock_for_slot(s, slot),
    }


def collect_moves(s: dict) -> list[dict]:
    """招式 = 词条：仅列出存在的 eff1–eff4（eff1 为 Lv.1），有几个写几个。"""
    moves: list[dict] = []
    for slot in (1, 2, 3, 4):
        block = effect_block(s, slot)
        if block:
            if slot == 1:
                block["unlock"] = 1
            moves.append(block)
    moves.sort(
        key=lambda e: (e["unlock"] if e["unlock"] is not None else 99, e["slot"])
    )
    return moves


def main() -> None:
    doc_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DOC
    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    skills = doc.get("skill") or {}

    entries = []
    for key, s in skills.items():
        sid = str(key)
        if sid in EXCLUDED_SKILL_IDS:
            continue
        if not skill_manual_item(doc, sid):
            continue
        raw_type = int(s.get("type") or 1)
        cat = type_category(raw_type)
        pre = s.get("preSkill") or s.get("preskill") or []
        pre_list = []
        for pid in pre:
            pid_str = str(pid)
            pre_list.append({"id": pid_str, "name": skill_nick(skills, pid_str)})

        mode = int(s.get("mode") or 0)
        sb = int(s.get("sb_gd") if s.get("sb_gd") is not None else 0)
        star, star_label = star_info(s)
        moves = collect_moves(s)

        entries.append(
            {
                "id": sid,
                "name": (s.get("nick") or sid).strip(),
                "itemName": item_nick(doc, sid),
                "type": cat,
                "typeLabel": type_label(raw_type),
                "power": display_power(s.get("power")),
                "speed": int(s.get("speed") or 0),
                "mode": mode,
                "modeLabel": MODE_LABELS.get(mode, f"模式 {mode}"),
                "sbGd": sb,
                "sbGdLabel": SB_GD_LABELS.get(sb, str(sb)),
                "baoji": s.get("baoji"),
                "baojiEffect": s.get("baojiEffect"),
                "preSkills": pre_list,
                "summary": (s.get("desp") or "").strip(),
                "itemDesp": item_desp(doc, sid),
                "moves": moves,
                "star": star,
                "starLabel": star_label,
                "yueLi": s.get("yueLi"),
            }
        )

    entries.sort(key=lambda e: (-e["power"], e["name"]))

    lines = [
        "// 由 scripts/build-martial-compendium.py 生成，请勿手改。",
        "window.MARTIAL_COMPENDIUM = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";",
        "",
    ]
    OUT_JS.write_text("\n".join(lines), encoding="utf-8")

    print(f"武功数: {len(entries)}")
    print("提示: 运行 scripts/build-wiki-search-links.py 更新搜索与 autolink")
    print(f"数据文件: {OUT_JS}")


if __name__ == "__main__":
    main()
