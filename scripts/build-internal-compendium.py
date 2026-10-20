# -*- coding: utf-8 -*-
"""从 game-data/doc.json neiGong 生成内功图鉴。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOC = ROOT / "game-data" / "doc.json"
OUT_JS = ROOT / "js" / "internal-compendium-data.js"
SUPPLEMENT_JSON = ROOT / "game-data" / "internal-wiki-supplement.json"

# neiGong star：0 为 ?；3–6 为 C B A S（无 E/D）
NEI_STAR_MAP = {0: "?", 3: "C", 4: "B", 5: "A", 6: "S"}

ATTR_NAMES: dict[int, str] = {
    1: "血量",
    2: "血量",
    4: "速度",
    16: "闪避",
    64: "格挡",
    512: "拳威力",
    2048: "刀威力",
    8192: "剑威力",
    65536: "攻击",
    131072: "攻击",
    524288: "免伤",
    2097152: "吸血",
    8388608: "回血",
    16777216: "暴伤",
    33554432: "反伤",
    134217728: "暴击",
    134217729: "免暴",
    134217730: "免流",
    134217731: "免减攻",
    134217732: "免连",
    134217733: "复活",
    134217734: "武器威力",
    134217735: "基础伤害",
    134217736: "武功威力",
    134217737: "每段伤害",
    134217738: "消耗",
    67108864: "特殊",
}

WAN_BI_TYPES = frozenset({134217734, 134217735, 134217736, 134217737, 134217738})
IMMUNITY_FLAG_TYPES = frozenset({134217729, 134217730, 134217731, 134217732})


def item_block(doc: dict, eid: str) -> dict | None:
    for key in ("prop", "goods"):
        block = doc.get(key) or {}
        if eid in block:
            return block[eid]
    return None


def item_nick(doc: dict, eid: str) -> str:
    o = item_block(doc, eid)
    return (o.get("nick") or "").strip() if o else ""


def item_desp(doc: dict, eid: str) -> str:
    o = item_block(doc, eid)
    return (o.get("desp") or "").strip() if o else ""


def nei_nick(nei: dict, eid: str) -> str:
    o = nei.get(eid) or nei.get(str(eid))
    if not o:
        return str(eid)
    return (o.get("nick") or str(eid)).strip()


def skill_nick(skills: dict, sid: str) -> str:
    s = skills.get(sid) or skills.get(str(sid))
    if not s:
        return str(sid)
    return (s.get("nick") or str(sid)).strip()


def star_info(raw_star) -> tuple[int, str]:
    if raw_star is None:
        return -1, "?"
    star = int(raw_star)
    if star in NEI_STAR_MAP:
        return star, NEI_STAR_MAP[star]
    if star < 0:
        return star, "?"
    return star, "?"


def fmt_attr_value(t: int, v: float) -> str | None:
    if v is None:
        return None
    v = float(v)
    name = ATTR_NAMES.get(t, f"属性{t}")
    if t in WAN_BI_TYPES:
        return f"{name} +{v / 100:g}%"
    if t in IMMUNITY_FLAG_TYPES and v >= 100:
        return name
    if t == 134217733 and v >= 100:
        return name
    if t == 1:
        iv = int(v) if v == int(v) else v
        return f"血量 +{iv}"
    if t == 2:
        iv = int(v) if v == int(v) else v
        return f"血量 +{iv}%"
    if v == int(v):
        return f"{name} +{int(v)}"
    return f"{name} +{v:g}"


def polish_speed_desp(text: str) -> str:
    """速度（t=4）为点数；模板里 %d%% 会多出一个 %，格式化后去掉。"""
    if not text:
        return text
    text = re.sub(r"(\d+)%点", r"\1点", text)
    text = re.sub(r"速度(\d+)%", r"速度\1", text)
    text = re.sub(r"(\d+)%([的]?)速度", r"\1\2速度", text)
    text = re.sub(r"(\d+)%迅捷", r"\1迅捷", text)
    return text


def format_eff_desp(desp: str, total_v: int, t: int) -> str:
    text = (desp or "").replace("%%", "%")
    if "%d" in text:
        text = text.replace("%d", str(int(total_v)))
    if t == 4:
        text = polish_speed_desp(text)
    return text


def rep_value_for_desp(by_t: dict[int, int]) -> int:
    """描述里单个 %d 时，气血%/攻击常各一档同值，取气血%或攻击档，勿把两档相加。"""
    if 2 in by_t:
        return int(by_t[2])
    if 131072 in by_t:
        return int(by_t[131072])
    for v in by_t.values():
        return int(v)
    return 0


def eff_desp_key(t: int, desp: str) -> str:
    text = (desp or "").replace("%%", "%")
    return f"{t}\0{re.sub(r'%d', '?', text)}"


def attack_attach_nick(by_nick: dict[str, dict], nick_order: list[str]) -> str | None:
    """末段 nick 为「攻击」时，并入前文已写气血+攻击的主词条。"""
    for prev in reversed(nick_order):
        rec = by_nick[prev]
        d = rec.get("desp") or ""
        if 2 in rec["by_t"] and "攻击" in d:
            return prev
    return nick_order[0] if nick_order else None


def aggregate_eff(eff_list: list) -> list[dict]:
    """按 nick 一条词条；同名下不同 t 分别累加后拼 valueText。"""
    nick_order: list[str] = []
    by_nick: dict[str, dict] = {}
    desp_groups: dict[str, str] = {}

    for e in eff_list or []:
        nick = (e.get("nick") or "").strip() or "—"
        t = int(e.get("t") or 0)
        v = int(e.get("v") or 0)
        desp = (e.get("desp") or "").strip()

        if nick == "攻击" and t == 131072:
            attach = attack_attach_nick(by_nick, nick_order)
            if attach:
                nick = attach
        else:
            dk = eff_desp_key(t, desp)
            if dk in desp_groups:
                nick = desp_groups[dk]
            else:
                desp_groups[dk] = nick

        if nick not in by_nick:
            nick_order.append(nick)
            by_nick[nick] = {"desp": desp, "by_t": {}, "t_order": []}
        rec = by_nick[nick]
        if t not in rec["by_t"]:
            rec["t_order"].append(t)
            rec["by_t"][t] = 0
        rec["by_t"][t] += v
        if not rec["desp"] and desp:
            rec["desp"] = desp

    terms: list[dict] = []
    for nick in nick_order:
        rec = by_nick[nick]
        by_t = rec["by_t"]
        t_order = rec["t_order"]

        value_parts: list[str] = []
        for t in t_order:
            total = int(by_t[t])
            line = fmt_attr_value(t, total) if total or t not in (67108864,) else None
            if line:
                value_parts.append(line)
        value_line = "、".join(value_parts)

        desp = rec["desp"]
        fmt_t = 4 if by_t.keys() == {4} else (t_order[0] if t_order else 0)
        desp_v = int(by_t[4]) if fmt_t == 4 else rep_value_for_desp(by_t)
        if "%d" in desp:
            desc = format_eff_desp(desp, desp_v, fmt_t)
        else:
            desc = format_eff_desp(desp, desp_v, fmt_t) if fmt_t == 4 else (desp or "").replace("%%", "%")

        primary_t = t_order[0] if t_order else 0
        terms.append(
            {
                "name": nick,
                "desc": desc,
                "valueText": value_line,
                "total": int(by_t.get(primary_t, 0)),
                "code": primary_t,
            }
        )
    return terms


def good_skill_pairs(skills: dict, raw: dict) -> list[dict]:
    out = []
    for sid, eff in (raw or {}).items():
        sid = str(sid)
        text = fmt_attr_value(int(eff.get("t") or 0), eff.get("v") or 0)
        if not text:
            continue
        out.append(
            {
                "skillId": sid,
                "skillName": skill_nick(skills, sid),
                "text": text,
            }
        )
    out.sort(key=lambda x: x["skillName"])
    return out


def load_wiki_supplement() -> list[dict]:
    if not SUPPLEMENT_JSON.is_file():
        return []
    data = json.loads(SUPPLEMENT_JSON.read_text(encoding="utf-8"))
    return list(data.get("entries") or [])


def supplement_for_name(name: str, supplements: list[dict]) -> dict | None:
    name = (name or "").strip()
    for sup in supplements:
        for key in ("match", "name"):
            targets = sup.get(key)
            if isinstance(targets, str):
                targets = [targets]
            if not targets:
                continue
            if name in targets:
                return sup
    return None


def update_search_index(names: list[str]) -> None:
    path = ROOT / "js" / "search-index.js"
    if not path.is_file():
        return
    keys = " ".join(sorted(set(names))[:80])
    lines = path.read_text(encoding="utf-8").splitlines()
    out = []
    replaced = False
    for line in lines:
        if 'title: "内功图鉴"' in line and "compendium/internal.html" in line:
            out.append(
                '  { title: "内功图鉴", url: "pages/compendium/internal.html", keys: '
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
    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    nei = doc.get("neiGong") or {}
    skills = doc.get("skill") or {}

    supplements = load_wiki_supplement()
    entries = []
    for key, ng in nei.items():
        eid = str(key)
        star, star_label = star_info(ng.get("star"))
        pre = ng.get("preSkill") or ng.get("preskill") or []
        pre_list = [{"id": str(pid), "name": nei_nick(nei, str(pid))} for pid in pre]

        manual_desp = item_desp(doc, eid)
        summary = (ng.get("desp") or "").strip()

        nick = (ng.get("nick") or eid).strip()
        row = {
            "id": eid,
            "name": nick,
            "itemName": item_nick(doc, eid) or "",
            "itemDesp": manual_desp,
            "summary": summary,
            "star": star,
            "starLabel": star_label,
            "xiuWei": ng.get("xiuWei"),
            "terms": aggregate_eff(ng.get("eff") or []),
            "goodSkills": good_skill_pairs(skills, ng.get("goodSkills") or {}),
            "preSkills": pre_list,
            "icon": int(ng.get("icon") or 0),
        }
        sup = supplement_for_name(nick, supplements)
        if sup and sup.get("specialNote"):
            row["specialNote"] = str(sup["specialNote"]).strip()
        entries.append(row)

    entries.sort(key=lambda e: (-(e["star"] if e["star"] >= 0 else -1), e["name"]))

    OUT_JS.write_text(
        "// 由 scripts/build-internal-compendium.py 生成，请勿手改。\n"
        + "window.INTERNAL_COMPENDIUM = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    update_search_index([e["name"] for e in entries])

    print(f"内功数: {len(entries)}")
    print(f"数据: {OUT_JS}")


if __name__ == "__main__":
    main()
