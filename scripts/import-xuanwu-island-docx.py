# -*- coding: utf-8 -*-
"""从《玄武岛流程及掉落》docx 生成地图用流程 + 掉落数据。"""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOCX = Path(r"D:\QQ\data\玄武岛流程及掉落(3).docx")
if not DOCX.is_file():
    DOCX = ROOT / "game-data" / "玄武岛流程及掉落(3).docx"
OUT = ROOT / "js" / "map-guide-xuanwu-island.js"
DOC = Path(r"D:\QQ\data\doc.json")
if not DOC.is_file():
    DOC = ROOT / "game-data" / "doc.json"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# 流程分段标题（按 docx 行首匹配）
FLOW_HEADS: list[tuple[str, str]] = [
    ("prep", r"^岛上八图解"),
    ("overview", r"^岛上4个随机"),
    ("xiaodie", r"^小蝶"),
    ("xuanwu_sage", r"^玄武尊者"),
    ("yaoseng", r"^邪僧"),
    ("pili", r"^霹雳堂主"),
    ("bailu", r"^白鹿谷主"),
    ("weihong", r"^魏鸿"),
    ("wushen", r"^武神"),
    ("daoshen", r"^盗神攻略"),
    ("tips", r"^※"),
]

FLOW_TITLES = {
    "prep": "入岛准备",
    "overview": "BOSS 概览",
    "xiaodie": "小蝶",
    "xuanwu_sage": "玄武尊者",
    "yaoseng": "邪僧（隐藏）",
    "pili": "霹雳堂主",
    "bailu": "白鹿谷主",
    "weihong": "魏鸿（隐藏）",
    "wushen": "武神（隐藏）",
    "daoshen": "盗神（隐藏）",
    "tips": "技巧说明",
}

# BOSS 掉落（攻略表顺序；黑色无限、红色唯一）
DROP_BOSSES: list[dict] = [
    {
        "order": 1,
        "boss": "盗神 袁冥幽",
        "tag": "隐藏 · 叠云山树洞",
        "chestDrop": "百胜刀法残页 30%、残月刀 2%",
        "textDrop": "飞龙探云手 5%",
        "fighters": ["盗神 袁冥幽"],
    },
    {
        "order": 2,
        "boss": "漕帮帮主 魏鸿",
        "tag": "隐藏 · 四方湖挖宝",
        "chestDrop": "太极剑法残页 30%、乌缕衣 2%",
        "textDrop": "霸海无量刀 25%",
        "fighters": ["漕帮帮主 魏鸿"],
    },
    {
        "order": 3,
        "boss": "武神 解锋",
        "tag": "隐藏 · 武神殿藏宝图",
        "chestDrop": "降龙掌法残页 30%、青云戒 2%",
        "textDrop": "神武宝甲 10%",
        "fighters": ["武神 解锋"],
    },
    {
        "order": 4,
        "boss": "妖僧 法逆",
        "tag": "隐藏 · 琉璃塔流程",
        "chestDrop": "真武七截剑残页 30%、归元衫 2%",
        "textDrop": "大自在天魔功 5%、虎啸令 20%",
        "fighters": ["妖僧 法逆"],
    },
    {
        "order": 5,
        "boss": "白鹿谷主 骆醉山",
        "tag": "游荡 BOSS",
        "chestDrop": "大嵩阳掌残页 30%、紫金护手 2%",
        "textDrop": "八卦图解-五 10%、青龙刀图纸 100%",
        "fighters": ["白鹿谷主 骆醉山"],
    },
    {
        "order": 6,
        "boss": "霹雳堂主 雷震天",
        "tag": "游荡 BOSS",
        "chestDrop": "寒冰掌法残页 30%、青云护手 2%",
        "textDrop": "八卦图解-六 10%、霹雳刀法 10%",
        "fighters": ["霹雳堂主 雷震天"],
    },
    {
        "order": 7,
        "boss": "彩蝶轩圣女 江小蝶",
        "tag": "游荡 BOSS",
        "chestDrop": "燃木刀法残页 30%、吹雪剑 2%",
        "textDrop": "八卦图解-七 10%、云蝶剑经 5%、狡豹令 15%、织锦亵裤 60%、潮湿的罗袜 70%",
        "fighters": ["彩蝶轩圣女 江小蝶"],
    },
    {
        "order": 8,
        "boss": "玄武尊者",
        "tag": "游荡 BOSS",
        "chestDrop": "未知残页 30%、冰蚕手套 2%",
        "textDrop": "八卦图解-捌 10%、玄武宝甲 2%、玄武纹甲 100%",
        "fighters": ["玄武尊者"],
    },
]

# 支线任务宝箱（低阶 / 高阶）
SIDE_QUEST_CHESTS: list[dict] = [
    {
        "order": 1,
        "boss": "盗圣 · 左边宝箱",
        "chestDrop": "低阶：百胜刀法、大阴阳手、大嵩阳掌、太极剑法、寒冰神掌、八仙剑法残页",
        "textDrop": "高阶：燃木刀法、真武七截剑、降龙掌法残页；1.6% 擒龙功",
        "fighters": [],
    },
    {
        "order": 2,
        "boss": "盗圣 · 中间宝箱",
        "chestDrop": "低阶：雪银、通经丸、熊胆丸、养精丸",
        "textDrop": "高阶：紫金、化龙丹、聚宝阁银票；25% 八卦图解-贰",
        "fighters": [],
    },
    {
        "order": 3,
        "boss": "盗圣 · 右边宝箱",
        "chestDrop": "低阶：玄铁指套、吹雪剑、残月刀、冰蚕手套、青冥剑、修罗刀（蓝）",
        "textDrop": "高阶：玄铁指套、吹雪剑、残月刀、冰蚕手套、青冥剑（紫）；修罗刀（金）",
        "fighters": [],
    },
    {
        "order": 4,
        "boss": "魏鸿宝箱",
        "chestDrop": "低阶：青云戒、紫金戒、玄铁护手、紫金护手、青云护手、赤血戒（蓝）",
        "textDrop": "高阶：青云戒、玄铁护手、青云护手（紫）；紫金戒、紫金护手（金）；16.7% 八卦图解-叁",
        "fighters": [],
    },
    {
        "order": 5,
        "boss": "武神宝箱（第一箱）",
        "chestDrop": "紫金护手、玄铁护手、青云护手、雪银（蓝）",
        "textDrop": "无",
        "fighters": [],
    },
    {
        "order": 6,
        "boss": "武神宝箱（第二箱 / 精英）",
        "chestDrop": "玄铁护手、青云护手（紫）；紫金护手、紫金、化龙丹（金）",
        "textDrop": "30% 八卦图解-壹、70% 紫金",
        "fighters": [],
    },
    {
        "order": 7,
        "boss": "妖僧宝箱",
        "chestDrop": "低阶：归元衫、乌缕衣、金蚕宝甲、雪银（蓝）",
        "textDrop": "高阶：归元衫、乌缕衣、金蚕宝甲、紫金（金）；20% 八卦图解-肆",
        "fighters": [],
    },
]


def read_docx_paragraphs(path: Path) -> list[str]:
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("word/document.xml"))
    paras: list[str] = []
    for para in root.iter(W + "p"):
        texts = [t.text for t in para.iter(W + "t") if t.text]
        if texts:
            line = "".join(texts).replace("\xa0", " ").strip()
            if line:
                paras.append(line)
    return paras


def split_flow(paras: list[str]) -> tuple[list[str], list[dict]]:
    """跳过首行总标题，按章节归类段落。"""
    if paras and "流程" in paras[0]:
        paras = paras[1:]
    tips: list[str] = []
    sections: dict[str, list[str]] = {}
    current = "prep"
    for line in paras:
        matched = False
        for key, pat in FLOW_HEADS:
            if re.search(pat, line):
                current = key
                matched = True
                if key == "tips":
                    tips.append(line)
                else:
                    sections.setdefault(current, []).append(line)
                break
        if not matched:
            if current == "tips":
                tips.append(line)
            else:
                sections.setdefault(current, []).append(line)

    flow = []
    for key in [
        "prep",
        "overview",
        "xiaodie",
        "xuanwu_sage",
        "yaoseng",
        "pili",
        "bailu",
        "weihong",
        "wushen",
        "daoshen",
    ]:
        lines = sections.get(key)
        if not lines:
            continue
        flow.append(
            {
                "id": key,
                "title": FLOW_TITLES[key],
                "paragraphs": lines,
            }
        )
    return tips, flow


def skill_nick(skills: dict, sid) -> str:
    if sid is None:
        return "—"
    key = str(sid)
    s = skills.get(key) or (skills.get(int(key)) if key.isdigit() else None)
    if not s:
        return key
    return (s.get("nick") or key).strip()


def pick_person(person: dict, nick: str) -> dict | None:
    cands = [v for v in person.values() if isinstance(v, dict) and v.get("nick") == nick]
    if not cands:
        return None
    cands.sort(key=lambda o: (-(o.get("npcHp") or 0), o.get("id") or 0))
    return cands[0]


def load_previous_payload(path: Path) -> dict:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    marker = "window.MAP_GUIDE_XUANWU_ISLAND = "
    start = text.find(marker)
    if start < 0:
        return {}
    start += len(marker)
    end = text.rfind("};")
    if end < start:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def build_boss_entries(
    rows: list[dict],
    person: dict,
    skills: dict,
) -> list[dict]:
    bosses = []
    for row in rows:
        fighters = build_fighters(person, skills, row.get("fighters") or [])
        bosses.append(
            {
                "order": row["order"],
                "boss": row["boss"],
                "tag": row.get("tag"),
                "fighters": fighters,
                "chestDrop": row["chestDrop"],
                "textDrop": row["textDrop"],
            }
        )
    return bosses


def build_fighters(person: dict, skills: dict, nicks: list[str]) -> list[dict]:
    out = []
    for nick in nicks:
        p = pick_person(person, nick)
        if not p:
            continue
        out.append(
            {
                "name": nick,
                "npcId": p.get("id"),
                "hp": p.get("npcHp"),
                "power": p.get("npcPower"),
                "skill": skill_nick(skills, p.get("skill")),
                "skillId": p.get("skill"),
            }
        )
    return out


def main() -> None:
    prev = load_previous_payload(OUT)
    if DOCX.is_file():
        paras = read_docx_paragraphs(DOCX)
        tips, flow = split_flow(paras)
        source = str(DOCX.name)
    else:
        print(f"未找到 docx，保留现有流程: {DOCX}")
        tips = prev.get("footnotes") or []
        flow = prev.get("flow") or []
        source = prev.get("source") or "攻略表 + 既有流程"

    person: dict = {}
    skills: dict = {}
    if DOC.is_file():
        doc = json.loads(DOC.read_text(encoding="utf-8"))
        person = doc.get("person") or {}
        skills = doc.get("skill") or {}

    payload = {
        "placeId": "玄武岛",
        "title": "玄武岛流程与掉落",
        "source": source,
        "flowTitle": "流程攻略",
        "flowNote": "以下正文由攻略 docx 导入；坐标与概率以游戏/版本为准。",
        "flow": flow,
        "dropTitle": "玄武岛掉落大全",
        "dropNote": "黑色为无限、红色为唯一（攻略表）；BOSS 附 doc.json 血量、攻击、武功。",
        "footnotes": tips,
        "sections": [
            {
                "title": "BOSS 掉落",
                "bosses": build_boss_entries(DROP_BOSSES, person, skills),
            },
            {
                "title": "支线任务宝箱奖励",
                "bosses": build_boss_entries(SIDE_QUEST_CHESTS, person, skills),
            },
        ],
    }

    OUT.write_text(
        "// 由 scripts/import-xuanwu-island-docx.py 生成，请勿手改。\n"
        "window.MAP_GUIDE_XUANWU_ISLAND = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    n_boss = len(payload["sections"][0]["bosses"])
    n_chest = len(payload["sections"][1]["bosses"])
    print(f"已写入: {OUT}（流程 {len(flow)} 节，BOSS {n_boss} 条，支线宝箱 {n_chest} 条，技巧 {len(tips)} 条）")


if __name__ == "__main__":
    main()
