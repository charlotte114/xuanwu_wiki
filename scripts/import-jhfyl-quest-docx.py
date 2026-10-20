# -*- coding: utf-8 -*-
"""从 江湖风云录原版攻略大全.docx 提取「主线以及支线剧情攻略」并生成 map-quest-data.js。"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path(r"D:\QQ\data\江湖风云录原版攻略大全.docx")
OUT_JS = ROOT / "js" / "map-quest-data.js"

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SECTION_RE = re.compile(r"^【江湖风云录】(.+)$")
SUB_QUEST_RE = re.compile(r"^(.+?)奇遇任务\s*$")
SUB_BRANCH_RE = re.compile(r"^(.+?)支线任务\s*$")
SUB_BRANCH_SHORT_RE = re.compile(r"^(.+?)支线\s*$")
SKILL_OBTAIN_RE = re.compile(r"^(.+?[SABC]获得)\s*$")
VERSION_CHAPTER_RE = re.compile(r"^(\d+\.\d+).*(主线|支线)")

MAP_REGIONS: list[tuple[str, list[str]]] = [
    (
        "地区",
        [
            "沧州",
            "汉阳",
            "洛阳",
            "嵩山",
            "泰山",
            "长白山",
            "襄阳",
            "苏州",
            "燕子坞",
            "临安",
            "福州",
            "成都",
            "大理",
        ],
    ),
    (
        "门派",
        [
            "少林",
            "华山",
            "武当",
            "峨眉",
            "太乙",
            "昆仑",
            "血刀门",
            "古墓派",
        ],
    ),
    (
        "副本",
        [
            "冥离地宫",
            "五龙塔",
            "罗汉洞",
            "白虎岭",
            "玄武岛",
            "凤鸣山",
            "无间地狱",
        ],
    ),
]

SKIP_PLACES = frozenset({"版本剧情", "奇遇"})

# 已有独立副本数据页，不再从剧情 docx 导入
SKIP_QUEST_SECTION_TITLES = frozenset(
    {
        "六扇门无间地狱和无间暗狱副本",
    }
)

PLACE_ALIASES = {
    "沧州篇": "沧州",
    "汉阳篇": "汉阳",
    "洛阳篇": "洛阳",
    "洛阳郊野刺绣任务": "洛阳",
    "洛阳郊野四小兵任务": "洛阳",
    "苏州篇": "苏州",
    "苏州游方和尚支线": "苏州",
    "襄阳篇": "襄阳",
    "临安篇1": "临安",
    "临安篇2": "临安",
    "成都篇支线任务": "成都",
    "福州篇支线任务": "福州",
    "昆仑山支线任务": "昆仑",
    "大理支线任务": "大理",
    "大理主线任务": "大理",
    "长白山支线任务": "长白山",
    "5.06版本灵石岛支线任务": "福州",
    "圣教天魔神功S获得": "昆仑",
    "圣教天魔神功S获得30": "昆仑",
    "4.12版本主线": "洛阳",
    "4.38主线任务": "洛阳",
    "4.58主线任务": "洛阳",
    "4.82主线任务": "昆仑",
    "4.92版本主线任务": "昆仑",
    "4.94版本主线任务": "昆仑",
    "5.10版本主线任务": "昆仑",
    "燕子坞": "燕子坞",
    "燕子坞支线任务": "燕子坞",
    "燕子坞玄武岛副本": "玄武岛",
}

# 目录行仅含页码、正文在后：去掉末尾纯数字再合并
TITLE_PAGE_SUFFIX_RE = re.compile(r"\d+$")

# docx 前半为杂项百科，仅保留像剧情/支线的章节；正文从「沧州篇」起
SKIP_SECTION_TITLE_RE = re.compile(
    r"bug|大全|方法|列表|配方|赚取|兑换码|铸炼|home|丹田|替补|"
    r"人生目标|门派简介|复制|武道令|材料用途|矿点|隐藏宝箱|叛出师门|"
    r"令牌介绍|等级经验|门派商店|武功内功|伙伴成长|男主福利|女主福利|"
    r"游戏开始|丹药配方|通缉榜|刷NPC|奇学"
)
QUESTLIKE_TITLE_RE = re.compile(r"篇|支线|获得|副本|奇遇|主线|任务|商店开启|唐诗")


def normalize_section_title(title: str) -> str:
    t = title.strip()
    t = TITLE_PAGE_SUFFIX_RE.sub("", t)
    return t or title.strip()


def read_paragraphs(docx: Path) -> list[str]:
    z = zipfile.ZipFile(docx)
    root = ET.fromstring(z.read("word/document.xml"))
    lines: list[str] = []
    for p in root.iter(W_NS + "p"):
        parts: list[str] = []
        for t in p.iter(W_NS + "t"):
            if t.text:
                parts.append(t.text)
            if t.tail:
                parts.append(t.tail)
        line = "".join(parts).strip()
        if line:
            lines.append(line)
    return lines


def all_map_places() -> list[str]:
    places = [p for _, names in MAP_REGIONS for p in names]
    places.sort(key=len, reverse=True)
    return places


def infer_place_from_text(text: str) -> str:
    t = text.strip()
    if not t:
        return ""
    if "燕子坞" in t and "玄武岛" not in t:
        return "燕子坞"
    if "圣教" in t or "大光明顶" in t or "光明顶" in t:
        return "昆仑"
    if "冥离地宫" in t or "冥离地狱" in t:
        return "冥离地宫"
    if "五龙塔" in t:
        return "五龙塔"
    if "凤鸣山" in t:
        return "凤鸣山"
    if "无间地狱" in t or "无间暗狱" in t:
        return "无间地狱"
    for city in all_map_places():
        if city in t:
            return city
    return ""


def slugify(title: str) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", title.strip())
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "section"


def infer_place(section_title: str) -> str:
    if section_title in PLACE_ALIASES:
        return PLACE_ALIASES[section_title]
    for city in [p for _, places in MAP_REGIONS for p in places]:
        if city in section_title:
            return city
    if "嵩山" in section_title:
        return "嵩山"
    if "华山" in section_title:
        return "华山"
    if "少林" in section_title:
        return "少林"
    if "武当" in section_title:
        return "武当"
    if "峨眉" in section_title:
        return "峨眉"
    if "太乙" in section_title:
        return "太乙"
    if "圣教" in section_title and "天魔神功" in section_title:
        return "昆仑"
    if "玄武岛" in section_title and "燕子坞" in section_title:
        return "玄武岛"
    if "燕子坞" in section_title:
        return "燕子坞"
    if "玄武岛" in section_title:
        return "玄武岛"
    if "冥离" in section_title or "冥离地宫" in section_title:
        return "冥离地宫"
    if "五龙塔" in section_title or "五龙" in section_title:
        return "五龙塔"
    if "无间地狱" in section_title or "无间" in section_title:
        return "无间地狱"
    if "凤鸣山" in section_title or "凤鸣" in section_title:
        return "凤鸣山"
    if "白虎岭" in section_title or "白虎" in section_title:
        return "白虎岭"
    if "罗汉洞" in section_title:
        return "罗汉洞"
    if "灵石岛" in section_title:
        return "福州"
    if VERSION_CHAPTER_RE.match(section_title):
        if section_title in PLACE_ALIASES:
            return PLACE_ALIASES[section_title]
        return infer_place_from_text(section_title)
    return ""


def split_encounter_section(title: str, body: list[str]) -> list[dict]:
    """奇遇任务：按「某某奇遇任务」拆到对应地点。"""
    chunks: list[tuple[str, list[str]]] = []
    current_place = ""
    current: list[str] = []
    for line in body:
        m = SUB_QUEST_RE.match(line)
        if m:
            if current:
                chunks.append((current_place, current))
            name = m.group(1).strip()
            current_place = infer_place(name) if name else ""
            current = []
            continue
        current.append(line)
    if current:
        chunks.append((current_place, current))
    if not chunks:
        return []
    out = []
    for place, paras in chunks:
        if not place or place in SKIP_PLACES:
            continue
        sub_title = f"{title} · {place}"
        out.append({"title": sub_title, "place": place, "paragraphs": paras})
    return out


def split_subchapter_section(parent_title: str, body: list[str]) -> list[dict]:
    """版本大章内的「某某支线任务」「某某S获得」等按地点拆开。"""
    chunks: list[tuple[str, str, list[str]]] = []
    sub_title = parent_title
    place = infer_place(parent_title) or ""
    current: list[str] = []

    def flush() -> None:
        nonlocal current, place, sub_title
        if not current:
            return
        chunks.append((place, sub_title, current))
        current = []

    for line in body:
        stripped = line.strip()
        matched = False
        for regex, mode in (
            (SUB_BRANCH_RE, "branch"),
            (SUB_BRANCH_SHORT_RE, "branch"),
            (SKILL_OBTAIN_RE, "skill"),
        ):
            m = regex.match(stripped)
            if not m:
                continue
            flush()
            if mode == "skill":
                label = stripped
                sub_title = f"{parent_title} · {label}"
                place = infer_place_from_text(label) or infer_place(label)
            else:
                name = m.group(1).strip()
                sub_title = f"{parent_title} · {name}"
                place = (
                    infer_place(name)
                    or infer_place_from_text(name)
                    or infer_place(name + "支线任务")
                )
            matched = True
            break
        if not matched:
            current.append(line)
    flush()

    if len(chunks) <= 1 and not chunks:
        return []
    out: list[dict] = []
    for pl, title, paras in chunks:
        if not paras:
            continue
        if not pl:
            pl = infer_place_from_text("\n".join(paras[:3])) or infer_place(parent_title)
        if not pl:
            continue
        out.append({"title": title, "place": pl, "paragraphs": paras})
    return out


def split_by_paragraph_places(parent_title: str, body: list[str]) -> list[dict]:
    """跨城版本主线：按段落中出现的主要地点分组。"""
    groups: list[tuple[str, list[str]]] = []
    cur_place = ""
    cur: list[str] = []
    for para in body:
        pl = infer_place_from_text(para)
        if pl and pl != cur_place and cur:
            groups.append((cur_place or pl, cur))
            cur = []
        if pl:
            cur_place = pl
        cur.append(para)
    if cur:
        groups.append((cur_place or infer_place(parent_title) or "洛阳", cur))

    if len(groups) <= 1:
        place = groups[0][0] if groups else (infer_place(parent_title) or "")
        paras = groups[0][1] if groups else body
        if not place:
            return []
        return [{"title": parent_title, "place": place, "paragraphs": paras}]

    out: list[dict] = []
    for pl, paras in groups:
        if not pl or not paras:
            continue
        out.append(
            {
                "title": f"{parent_title} · {pl}",
                "place": pl,
                "paragraphs": paras,
            }
        )
    return out


def expand_quest_parts(display_title: str, body: list[str]) -> list[dict]:
    if display_title == "奇遇任务":
        parts = split_encounter_section(display_title, body)
        if parts:
            return parts

    sub = split_subchapter_section(display_title, body)
    if len(sub) > 1:
        return sub
    if len(sub) == 1:
        return sub

    if VERSION_CHAPTER_RE.match(display_title) or "版本" in display_title:
        by_place = split_by_paragraph_places(display_title, body)
        if by_place:
            return by_place

    place = infer_place(display_title) or infer_place_from_text(display_title)
    if not place and body:
        place = infer_place_from_text("\n".join(body[:5]))
    if not place:
        return []
    return [{"title": display_title, "place": place, "paragraphs": body}]


def section_first_lines(lines: list[str]) -> dict[str, int]:
    first: dict[str, int] = {}
    for i, line in enumerate(lines):
        m = SECTION_RE.match(line)
        if not m:
            continue
        norm = normalize_section_title(m.group(1).strip())
        if norm not in first:
            first[norm] = i
    return first


def place_region(name: str) -> str:
    for region, names in MAP_REGIONS:
        if name in names:
            return region
    return ""


def is_redundant_dungeon_section(norm_title: str) -> bool:
    """副本入口/掉落概览只挂在「副本」分区；地区、门派下同名章节跳过。"""
    if "副本" not in norm_title:
        return False
    place = infer_place(norm_title) or infer_place_from_text(norm_title)
    if not place:
        return False
    return place_region(place) in ("地区", "门派")


def main_story_start_line(lines: list[str], first_lines: dict[str, int]) -> int:
    for key in ("沧州篇",):
        if key in first_lines:
            return first_lines[key]
    for i, line in enumerate(lines):
        if "江湖风云录主线以及支线剧情攻略" in line:
            return i + 1
    return 0


def should_import_section(
    norm_title: str, body: list[str], first_line: int, main_start: int
) -> bool:
    if not body and norm_title != "奇遇任务":
        return False
    if norm_title in SKIP_QUEST_SECTION_TITLES:
        return False
    if SKIP_SECTION_TITLE_RE.search(norm_title):
        return False
    if is_redundant_dungeon_section(norm_title):
        return False
    if first_line >= main_start:
        return True
    if not QUESTLIKE_TITLE_RE.search(norm_title):
        return False
    return bool(infer_place(norm_title) or infer_place_from_text(norm_title))


def merge_raw_sections(raw_sections: list[tuple[str, list[str]]]) -> list[tuple[str, list[str]]]:
    """合并目录页码标题与正文章节（保留段落更多的一侧，必要时拼接）。"""
    merged: dict[str, list[str]] = {}
    order: list[str] = []
    for title, body in raw_sections:
        norm = normalize_section_title(title)
        if norm not in merged:
            order.append(norm)
            merged[norm] = list(body)
            continue
        prev = merged[norm]
        if len(body) > len(prev):
            merged[norm] = list(body)
        elif body:
            seen = set(prev)
            for p in body:
                if p not in seen:
                    prev.append(p)
                    seen.add(p)
    return [(t, merged[t]) for t in order]


def parse_quest_sections(lines: list[str]) -> list[dict]:
    raw_sections: list[tuple[str, list[str]]] = []
    current_title = ""
    current_body: list[str] = []

    for line in lines:
        m = SECTION_RE.match(line)
        if m:
            if current_title:
                raw_sections.append((current_title, current_body))
            current_title = m.group(1).strip()
            current_body = []
            continue
        current_body.append(line)
    if current_title:
        raw_sections.append((current_title, current_body))

    if not raw_sections:
        raise SystemExit("未在 docx 中找到任何【江湖风云录】章节")

    raw_sections = merge_raw_sections(raw_sections)
    first_lines = section_first_lines(lines)
    main_start = main_story_start_line(lines, first_lines)

    sections: list[dict] = []
    used_ids: set[str] = set()
    for title, body in raw_sections:
        display_title = normalize_section_title(title)
        first_line = first_lines.get(display_title, 0)
        if not should_import_section(display_title, body, first_line, main_start):
            continue
        parts = expand_quest_parts(display_title, body)
        for part in parts:
            place = (part.get("place") or "").strip()
            if not place or place in SKIP_PLACES:
                continue
            part["place"] = place
            sid = slugify(part["title"])
            n = 2
            while sid in used_ids:
                sid = f"{slugify(part['title'])}-{n}"
                n += 1
            used_ids.add(sid)
            sections.append(
                {
                    "id": sid,
                    "title": part["title"],
                    "place": part["place"],
                    "paragraphs": part["paragraphs"],
                }
            )
    return sections


def build_place_index(sections: list[dict]) -> list[dict]:
    by_place: dict[str, list[str]] = {}
    for s in sections:
        by_place.setdefault(s["place"], []).append(s["id"])

    places: list[dict] = []
    for region, names in MAP_REGIONS:
        for name in names:
            places.append(
                {
                    "id": slugify(name),
                    "name": name,
                    "region": region,
                    "sectionIds": by_place.get(name, []),
                }
            )
    return places


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("docx", nargs="?", default=str(DEFAULT_DOCX))
    args = ap.parse_args()
    docx = Path(args.docx)
    if not docx.is_file():
        raise SystemExit(f"找不到文件: {docx}")

    lines = read_paragraphs(docx)
    sections = parse_quest_sections(lines)
    places = build_place_index(sections)

    payload = {
        "source": "江湖风云录原版攻略大全（主线以及支线剧情攻略）",
        "docx": str(docx),
        "places": places,
        "sections": sections,
    }

    OUT_JS.write_text(
        "// 由 scripts/import-jhfyl-quest-docx.py 生成，请勿手改。\n"
        "window.MAP_QUEST_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"地点: {len(places)} · 剧情块: {len(sections)}")
    print(f"已写入: {OUT_JS}")


if __name__ == "__main__":
    main()
