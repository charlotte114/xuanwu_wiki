# -*- coding: utf-8 -*-
"""生成冥离地宫 / 冥离地狱副本掉落表（含 doc.json 血量、攻击、武功）。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = Path(r"D:\QQ\data\doc.json")
if not DOC.is_file():
    DOC = ROOT / "game-data" / "doc.json"
OUT = ROOT / "js" / "map-dungeon-mingli.js"

# (显示名, person nick 列表, 宝箱掉落, 飘字掉落)
PALACE: list[tuple[str, list[str], str | None, str]] = [
    (
        "铁马双煞李青、成云",
        ["铁马双煞李青", "铁马双煞成云"],
        None,
        "铁背苍龙功 5%",
    ),
    ("火行者", ["火行者"], None, "火磷掌 10%"),
    ("血狼陆杀", ["血狼陆杀"], None, "血狼剑 15%"),
    ("媚骨妖女苏离儿", ["媚骨妖女苏离儿"], None, "素月玄阴经 15%"),
    ("嵩山派雷凌云", ["嵩山派雷凌云"], None, "神农百草图 20%"),
    (
        "日沉阁元老李密",
        ["日沉阁元老李密"],
        None,
        "航线图 33%、枯荣剑法 20%",
    ),
    ("华山弃徒严剑云", ["华山弃徒严剑云"], None, "大风剑歌 10%"),
    (
        "邪僧真贪、真淫、真色、真嗔、真杀",
        ["邪僧真贪", "邪僧真淫", "邪僧真色", "邪僧真嗔", "邪僧真杀"],
        None,
        "舍利袈裟 15%",
    ),
    ("魔刀赤心真人", ["魔刀赤心真人"], None, "太虚魔心刀 10%"),
    ("玄女素心", ["玄女素心"], "太极残页 20%", "佛喃邪典 5%"),
    ("杀手墨军", ["杀手墨军"], "真武残页 10%", "绝命图纸 100%"),
    (
        "龙门统领依天",
        ["龙门统领依天"],
        "降龙残页 10%",
        "英雄之血 80%、秘册 10%、白龙腕 30%",
    ),
]

HELL: list[tuple[str, list[str], str | None, str]] = [
    (
        "勾魂鬼使蔡刑、燕云",
        ["勾魂鬼使蔡邢", "勾魂鬼使燕云"],
        None,
        "鬼使腰牌 5%、幽冥刺客传残页 10%",
    ),
    (
        "万剑共主支离",
        ["百万剑共主支离"],
        None,
        "万剑鸣 10%、支离 10%",
    ),
    (
        "燕刺王赵蝎、胶东王赵狻",
        ["燕刺王赵螭", "胶东王赵狻"],
        "百胜残页 20%",
        "帝王之血 80%、战国策 30%、孽蛟铠 30%",
    ),
    (
        "麒麟真人",
        ["麒麟真人"],
        None,
        "聚宝阁银票 15%、麒麟云袍 30%、布阵心得 10%",
    ),
    (
        "天魔洛阳",
        ["天魔 落阳"],
        "燃木残页 10%",
        "邪魔之血 80%、邀月丹 30%、天魔琴 50%",
    ),
]


def skill_nick(skills: dict, sid: str | int | None) -> str:
    if sid is None:
        return "—"
    key = str(sid)
    s = skills.get(key)
    if not s and str(sid).isdigit():
        s = skills.get(int(key))
    if not s:
        return key
    return (s.get("nick") or key).strip()


def pick_person(person: dict, nick: str) -> dict:
    cands = [v for v in person.values() if isinstance(v, dict) and v.get("nick") == nick]
    if not cands:
        raise SystemExit(f"person 中未找到: {nick}")
    cands.sort(key=lambda o: (-(o.get("npcHp") or 0), o.get("id") or 0))
    return cands[0]


def build_boss(
    order: int,
    label: str,
    nicks: list[str],
    chest: str | None,
    text_drop: str,
    person: dict,
    skills: dict,
) -> dict:
    fighters = []
    for nick in nicks:
        p = pick_person(person, nick)
        fighters.append(
            {
                "name": nick,
                "npcId": p.get("id"),
                "hp": p.get("npcHp"),
                "power": p.get("npcPower"),
                "skill": skill_nick(skills, p.get("skill")),
                "skillId": p.get("skill"),
            }
        )
    return {
        "order": order,
        "boss": label,
        "fighters": fighters,
        "chestDrop": chest or "无",
        "textDrop": text_drop,
    }


def main() -> None:
    doc = json.loads(DOC.read_text(encoding="utf-8"))
    person = doc.get("person") or {}
    skills = doc.get("skill") or {}

    sections = [
        {
            "title": "冥离地宫掉落",
            "bosses": [
                build_boss(i, *row, person, skills)
                for i, row in enumerate(PALACE, start=1)
            ],
        },
        {
            "title": "冥离地狱掉落",
            "bosses": [
                build_boss(i, *row, person, skills)
                for i, row in enumerate(HELL, start=1)
            ],
        },
    ]

    payload = {
        "placeId": "冥离地宫",
        "title": "冥离地宫 · 冥离地狱",
        "note": "掉落率为攻略整理；血量、攻击、武功取自 doc.json person 数据。",
        "footnotes": [
            "幽冥刺客传残页、战国策、布阵心得需选择对应人生目标并满足攻略条件后才会掉落。",
            "英雄之血、帝王之血、邪魔之血需持有幽冥血爪 / 玄阴重剑 / 血魔禅刃之一，并在成都马铁匠处打听「喂血养兵」后才会掉落。",
        ],
        "sections": sections,
    }

    OUT.write_text(
        "// 由 scripts/build-mingli-dungeon-data.py 生成，请勿手改。\n"
        "window.MAP_DUNGEON_MINGLI = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"已写入: {OUT}")


if __name__ == "__main__":
    main()
