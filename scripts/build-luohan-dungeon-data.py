# -*- coding: utf-8 -*-
"""从 doc.json 生成罗汉洞（十八罗汉）副本表。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = Path(r"D:\QQ\data\doc.json")
if not DOC.is_file():
    DOC = ROOT / "game-data" / "doc.json"
OUT = ROOT / "js" / "map-dungeon-luohan.js"

FLOORS: list[tuple[str, str]] = [
    ("挖耳罗汉", "人参"),
    ("芭蕉罗汉", "荷叶"),
    ("托塔罗汉", "铁掌功残页"),
    ("开心罗汉", "千年灵芝丸"),
    ("过江罗汉", "过江葫芦（b 护腕）"),
    ("欢喜罗汉", "千年灵芝丸"),
    ("骑象罗汉", "雪参玉蟾丸"),
    ("沉思罗汉", "坐忘功"),
    ("摊手罗汉", "30 元宝"),
    ("看门罗汉", "铁指禅劲（a 内）"),
    ("布袋罗汉", "袈裟伏魔功（b 内）"),
    ("长眉罗汉", "百年灵芝"),
    ("静坐罗汉", "雪莲"),
    ("伏虎罗汉", "金刚伏虎刀（b 刀法）"),
    ("笑狮罗汉", "雪参玉蟾丸"),
    ("举钵罗汉", "紫金宝戒"),
    ("坐鹿罗汉", "达摩剑法（a 剑法）"),
    ("降龙罗汉", "化龙丹 / 青龙刀碎片"),
]


def skill_nick(skills: dict, sid: str | int | None) -> str:
    if sid is None:
        return "—"
    key = str(sid)
    s = skills.get(key) or skills.get(int(key)) if str(sid).isdigit() else None
    if not s:
        return key
    return (s.get("nick") or key).strip()


def pick_person(person: dict, nick: str) -> dict:
    cands = [v for v in person.values() if isinstance(v, dict) and v.get("nick") == nick]
    if not cands:
        raise SystemExit(f"person 中未找到: {nick}")
    cands.sort(key=lambda o: (-(o.get("npcHp") or 0), o.get("id") or 0))
    return cands[0]


def main() -> None:
    doc = json.loads(DOC.read_text(encoding="utf-8"))
    person = doc.get("person") or {}
    skills = doc.get("skill") or {}

    floors = []
    for i, (boss, drop) in enumerate(FLOORS, start=1):
        p = pick_person(person, boss)
        floors.append(
            {
                "floor": i,
                "boss": boss,
                "npcId": p.get("id"),
                "hp": p.get("npcHp"),
                "power": p.get("npcPower"),
                "skill": skill_nick(skills, p.get("skill")),
                "skillId": p.get("skill"),
                "drop": drop,
            }
        )

    payload = {
        "placeId": "罗汉洞",
        "title": "苏州十八罗汉副本",
        "note": "飘字掉落为攻略整理；血量、攻击、武功取自 doc.json person 数据。",
        "floors": floors,
    }

    OUT.write_text(
        "// 由 scripts/build-luohan-dungeon-data.py 生成，请勿手改。\n"
        "window.MAP_DUNGEON_LUOHAN = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"层数: {len(floors)} -> {OUT}")


if __name__ == "__main__":
    main()
