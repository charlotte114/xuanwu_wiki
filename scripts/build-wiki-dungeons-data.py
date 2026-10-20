# -*- coding: utf-8 -*-
"""生成五龙塔、白虎岭、凤鸣山、无间地狱副本表（含 doc.json 武功/攻击等，攻略表补全血量与掉落）。"""
from __future__ import annotations

import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DOC = Path(r"D:\QQ\data\doc.json")
if not DOC.is_file():
    DOC = ROOT / "game-data" / "doc.json"

# (层标题, [(序号, 显示名, person nick, 波次, [攻略血量], 宝箱掉落, 飘字掉落, 经验, 削弱条件)])
WULONG: list[tuple[str, list[tuple]]] = [
    (
        "第一层",
        [
            (
                1,
                "古天音",
                ["琴武双绝 古天音"],
                "4波20人",
                [74480],
                "无",
                "天音腕S 37%、玉箫剑法 50%",
                "143000",
                "音律 120 及以上",
            ),
            (
                2,
                "拘魂老祖",
                ["拘魂老祖"],
                "4波20人",
                [77980],
                "燃木残页 10%",
                "分筋错骨手 15%",
                "171600",
                "主角职业专属技能 300",
            ),
            (
                3,
                "中原大侠秦漠",
                ["中原大侠 秦漠"],
                "4波20人",
                [80794],
                "紫金戒指A 37%",
                "绿心石 37%、浩然正气诀 15%",
                "205400",
                "浩然之气 300",
            ),
            (
                4,
                "林豪 / 林东",
                ["酒仙 叶豪", "酒仙 林东"],
                "4波20人",
                [86100, 86093],
                "无",
                "酒葫芦 30%、醉梦神拳S整本 10%",
                "494000",
                "烧刀子、女儿红各 1 瓶放背包（不消耗）",
            ),
            (
                5,
                "刹帝利",
                ["佛陀转世 刹帝利"],
                "4波20人",
                [91000],
                "归元衫A 10%",
                "大智无定指 15%",
                "296400",
                "佛法 300",
            ),
        ],
    ),
    (
        "第二层",
        [
            (
                6,
                "徐舒明",
                ["儒圣 徐舒明"],
                "4波20人",
                [94920],
                "真武残页 10%",
                "蓝月石 37%、齐鲁五轮拳 20%",
                "354900",
                "文房四宝 1 个（会消耗）",
            ),
            (
                7,
                "葛无道",
                ["金刚不败 葛无道"],
                "4波20人",
                [99900],
                "玄铁护腕A 37%",
                "绝情 5%",
                "426920",
                "道法 300",
            ),
            (
                8,
                "苗青霜",
                ["南疆刀圣 苗青霜"],
                "4波20人",
                [104800],
                "修罗刀A 37%",
                "神霄 1%、修罗刀图纸 100%",
                "499920",
                "无",
            ),
            (
                9,
                "赢荒",
                ["始皇后人 嬴荒"],
                "4波20人",
                [110900],
                "降龙残页 10%",
                "赤血石 37%、定秦剑 100%",
                "549900",
                "无",
            ),
        ],
    ),
    (
        "第三层",
        [
            (
                10,
                "神龙教主",
                ["神龙教主"],
                "3波15人",
                [144180],
                "吹雪剑A 37%",
                "镇龙S 10%、青龙刀碎片 100%",
                "617760",
                "无",
            ),
        ],
    ),
]

WULONG_FOOTNOTES = [
    "凑齐绿心石、蓝月石、赤血石后，在击败赢荒处搜寻三次，镶嵌三石可开启第三层。",
    "A 级紫金装备（名称带 A 后缀）可无限掉落。",
    "获得定秦剑后，前往泰山东南找道士触发任务，完成后可得传国玉玺（+19% 气血、+19% 暴击率）。",
]

# (显示名, person nicks, 飘字掉落)
BAIHU: list[tuple[str, list[str], str]] = [
    ("鬼戏班班主", ["鬼戏班班主"], "灵猴棍法 15%"),
    ("天下商会 萧玄", ["天下商会 萧玄"], "龙虎丹 5%、野球拳 5%、风纹密信 50%"),
    ("拘魂阁 楼湖", ["拘魂阁 楼湖"], "天鹰令 1%、拘魂帖 10%"),
    (
        "摸金校尉 胡霸义",
        ["摸金校尉 胡霸义"],
        "青虹剑 5%、摸金符 30%、50 元宝 100%、化龙丹 30%、邀月丹 5%",
    ),
    ("西蜀毒后 吴闵", ["西蜀毒后 吴闵"], "龙腾令 5%"),
    ("独臂头陀", ["独臂头陀"], "天伤刀法 5%"),
    ("乾机阁 乐天机", ["乾机阁 乐天机"], "子午万寿丹 5%、聚宝阁银票 50%、游记残页 50%"),
    ("八剑先师 徐云", ["八剑先师 徐云"], "八转剑心诀 5%"),
    (
        "湘尸仙宫 尸娘娘",
        ["湘尸仙宫 尸娘娘"],
        "猩红鬼戒 5%、白虎护手 5%、白虎遗骸 100%",
    ),
]

# (显示名, person nick, 宝箱掉落, 飘字掉落)
FENGMING: list[tuple[str, list[str], str, str]] = [
    (
        "白无常 谢必安",
        ["白无常 谢必安"],
        "太极剑谱残页 20%",
        "子午万寿丹 1%、哭丧棍法 10%",
    ),
    (
        "鬼面头陀 刘青",
        ["鬼面头陀 刘青"],
        "降龙掌法残页 10%",
        "乌缕衣 1%、鬼头刀 25%",
    ),
    (
        "明心先生 林秀成",
        ["明心先生 林秀成"],
        "无",
        "龙虎丹 1%、生锈的残刀 100%",
    ),
    (
        "紫阳真人",
        ["紫阳真人"],
        "无",
        "邀月丹 1%、太极神功 10%",
    ),
    (
        "蛇骨 珠儿",
        ["蛇骨 珠儿"],
        "燃木刀诀残页 30%",
        "青云戒 1%、千蛛万毒手 10%",
    ),
    (
        "混世魔王 柯天瑞",
        ["混世魔王 柯天瑞"],
        "吹雪剑 2%",
        "天鹰令 20%、邪魔之血 80%、天鹰令 0.47%、泼风混天刀 15%",
    ),
    (
        "神子 戴鸿飞",
        ["神子 戴鸿飞"],
        "寒冰神掌残页 30%",
        "太阿图纸 100%、赤血戒 1%",
    ),
    (
        "拜火教主 戴炎",
        ["拜火教主 戴炎"],
        "破锋八斩残页 30%、归元衫 2%",
        "风翔令 15%、风翔令 0.47%、饮火聚寿经 35%",
    ),
    (
        "玄天绝剑 谢无双",
        ["玄天绝剑 谢无双"],
        "青云护手 2%、冰蚕手套 2%",
        "玄天绝剑 0.47%、承影 5%",
    ),
    (
        "国师 李承风",
        ["国师 李承风"],
        "真武残章 30%、修罗刀 2%",
        "朱雀戒 0.47%、神农子午经 5%",
    ),
]

FENGMING_FOOTNOTES = [
    "邪魔之血需持有幽冥血爪 / 玄阴重剑 / 血魔禅刃之一，并在成都马铁匠处打听「喂血养兵」后才会掉落。",
    "击败蛇骨 珠儿后出现猴子：首次需累计喂食香蕉 100 根（可一次或多次），之后每次进入喂 1 根即可。"
    "（29，1）宝箱需紫金钥匙，可得破锋八斩残页 ×20、50 元宝；（24，1）搜寻可得 20 元宝、30000 银两。",
    "击败国师 李承风后继续上行至梧桐树，背包有祈凤录可祭祀获得朱雀羽，使用后可领悟朱雀之力。",
]

# (显示名, person nick 优先列表, 飘字掉落)
# (显示名, person nick, 飘字掉落, 机制详解)
HUALUNJIAN: list[tuple[str, list[str], str, str]] = [
    (
        "桃花岛主（东邪）",
        ["桃花岛主"],
        "玉竹箫 5%",
        "奇门遁甲：共 30 层护盾，每层护盾抵御最多 2000 点伤害。",
    ),
    (
        "白驼庄主（西毒）",
        ["白驼庄主"],
        "寒玉戒指 5%",
        "蟾压百雄：入场后彼方全体吸血效果削弱 30%。",
    ),
    (
        "大理皇僧（南帝）",
        ["大理皇僧"],
        "一阳指 5%",
        "梵天无证：每次受到伤害（包括 buff 损失的生命值）最多 2000 点。",
    ),
    (
        "九指奇丐（北丐）",
        ["九指奇丐"],
        "降龙掌法 5%",
        "逍遥游龙：每次出手必定附加一层横练护体功效果，将第 1 次受到的伤害减免为 0，但不减免多段的武学。",
    ),
    (
        "铁掌帮 裘铁（铁掌）",
        ["铁掌帮 裘铁"],
        "铁掌功 60%",
        "壁立千仞：免疫负面状态的同时，受到攻击有 10% 概率进行反击。",
    ),
    (
        "神通道人（中神通）",
        ["神通道人"],
        "先天功 5%",
        "天罡北斗：出手附带 40 破甲，可减去彼方 40 免伤，溢出则按 0 计算；第 5 波以单体形态进入天罡北斗七星体状态，该状态下以北斗七星进行 7 次入场，血量上限依次递增，且每场回复约 13 万血量。",
    ),
]

# (层标题, [(显示名, person nick, 宝箱, 飘字)])
WUJIAN: list[tuple[str, list[tuple[str, list[str], str, str]]]] = [
    (
        "无间地狱",
        [
            (
                "鬼书生",
                ["鬼书生"],
                "蓝血戒 2%",
                "舞鬼秘录 50%",
            ),
            (
                "奔雷盟主 雷震",
                ["奔雷盟主 雷震"],
                "无",
                "奔雷掌谱 15%、奔雷 1.4%",
            ),
            (
                "墓王钟馗 & 盗圣何偷月",
                ["墓王 钟崇", "盗圣 何偷月"],
                "无",
                "龙虎尸袍 15%、盗圣集 4.5%",
            ),
            (
                "万花会 沈蝶衣",
                ["万花会 沈蝶衣"],
                "万花剑法残页 30%",
                "玉蝶剑法 10%",
            ),
            (
                "贺伊",
                ["贺伊"],
                "寒冰神掌残页 30%",
                "无惨鞭 30%",
            ),
            (
                "多情客",
                ["多情客"],
                "无",
                "金蛇剑 20%",
            ),
            (
                "鸳鸯神捕 白娘子 & 高懿",
                ["鸳鸯神捕 白娘子", "鸳鸯神捕 高懿"],
                "无",
                "玄铁剑法 30%、玉女素心剑 30%",
            ),
            (
                "日月盟凌霄",
                ["凌霄"],
                "无",
                "太白剑法 15%、凌霄戒 1.4%",
            ),
            (
                "年轻少主",
                ["年轻少主"],
                "百胜刀法残页 30%",
                "丹书铁券 10%",
            ),
        ],
    ),
    (
        "无间暗狱",
        [
            (
                "拘魂阁 裘无极",
                ["拘魂阁 裘无极"],
                "无",
                "狰龙撕天爪 5%",
            ),
            (
                "唐老太太",
                ["唐老太太"],
                "无",
                "神魔伞 5%",
            ),
            (
                "妙真师太（疯）",
                ["妙真师太（疯）"],
                "邀月残章 30%、紫金宝戒 2%",
                "风陵剑典 15%",
            ),
            (
                "转魄剑者 徐湘妃",
                ["转魄剑者 徐湘妃"],
                "真武残章 30%、紫青冥剑 2%",
                "故人归 5%、离合神功 0.47%",
            ),
            (
                "血衣神捕 闻人异",
                ["血衣神捕 闻人异"],
                "无",
                "神捕风云录 100%",
            ),
            (
                "头号玩家",
                ["头号玩家"],
                "无",
                "玄武宝玉 1%",
            ),
        ],
    ),
]

WUJIAN_FOOTNOTES = [
    "唐老太太神魔伞注：需搭配才能破闪破挡，武功后续出。",
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


def fighter_from_person(
    person: dict,
    skills: dict,
    nick: str,
    hp_override: int | None = None,
) -> dict:
    p = pick_person(person, nick)
    hp = hp_override if hp_override is not None else p.get("npcHp")
    return {
        "name": nick,
        "npcId": p.get("id"),
        "hp": hp,
        "power": p.get("npcPower"),
        "skill": skill_nick(skills, p.get("skill")),
        "skillId": p.get("skill"),
    }


def build_section_bosses(
    rows: list[tuple[str, list[str], str]],
    person: dict,
    skills: dict,
) -> list[dict]:
    bosses = []
    for i, (label, nicks, drop) in enumerate(rows, start=1):
        fighters = [fighter_from_person(person, skills, n) for n in nicks]
        bosses.append(
            {
                "order": i,
                "boss": label,
                "fighters": fighters,
                "chestDrop": "无",
                "textDrop": drop,
            }
        )
    return bosses


def build_chest_text_bosses(
    rows: list[tuple[str, list[str], str, str]],
    person: dict,
    skills: dict,
) -> list[dict]:
    bosses = []
    for i, (label, nicks, chest, text_drop) in enumerate(rows, start=1):
        fighters = [fighter_from_person(person, skills, n) for n in nicks]
        bosses.append(
            {
                "order": i,
                "boss": label,
                "fighters": fighters,
                "chestDrop": chest,
                "textDrop": text_drop,
            }
        )
    return bosses


def write_js(path: Path, var_name: str, payload: dict) -> None:
    path.write_text(
        f"// 由 scripts/build-wiki-dungeons-data.py 生成，请勿手改。\n"
        f"window.{var_name} = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"已写入: {path}")


def build_wulong(person: dict, skills: dict) -> dict:
    sections = []
    for layer_title, rows in WULONG:
        bosses = []
        for row in rows:
            seq, label, nicks, waves, hps, chest, text_drop, exp, weaken = row
            fighters = []
            for j, nick in enumerate(nicks):
                hp_ov = hps[j] if j < len(hps) else hps[0] if hps else None
                fighters.append(fighter_from_person(person, skills, nick, hp_ov))
            bosses.append(
                {
                    "order": seq,
                    "boss": label,
                    "fighters": fighters,
                    "waves": waves,
                    "chestDrop": chest,
                    "textDrop": text_drop,
                    "exp": exp,
                    "weaken": weaken,
                }
            )
        sections.append({"title": layer_title, "bosses": bosses})
    return {
        "placeId": "五龙塔",
        "title": "五龙塔掉落大全",
        "note": "红色为唯一、蓝色为任务道具（攻略表）；武功、攻击取自 doc.json。总经验约 3,759,800。",
        "footnotes": WULONG_FOOTNOTES,
        "dungeonKind": "wulong",
        "sections": sections,
    }


def build_baihu(person: dict, skills: dict) -> dict:
    return {
        "placeId": "白虎岭",
        "title": "白虎岭掉落",
        "note": "红色为唯一掉落（攻略标注）；飘字概率为攻略整理，武功与攻击取自 doc.json。",
        "sections": [
            {
                "title": "BOSS 掉落",
                "bosses": build_section_bosses(BAIHU, person, skills),
            }
        ],
    }


def build_fengming(person: dict, skills: dict) -> dict:
    return {
        "placeId": "凤鸣山",
        "title": "凤鸣山掉落大全",
        "note": "黑色为无限、红色为唯一（攻略表）；武功与攻击取自 doc.json。",
        "footnotes": FENGMING_FOOTNOTES,
        "sections": [
            {
                "title": "BOSS 掉落",
                "bosses": build_chest_text_bosses(FENGMING, person, skills),
            }
        ],
    }


def build_hualunjian(person: dict, skills: dict) -> dict:
    bosses = []
    for i, (label, nicks, drop, mechanic) in enumerate(HUALUNJIAN, start=1):
        fighters = [fighter_from_person(person, skills, n) for n in nicks]
        bosses.append(
            {
                "order": i,
                "boss": label,
                "fighters": fighters,
                "textDrop": drop,
                "mechanic": mechanic,
                "hideChest": True,
            }
        )
    return {
        "placeId": "华山论剑",
        "title": "华山论剑掉落 · 机制详解",
        "note": "红色为唯一掉落（攻略标注）；飘字概率为攻略整理，武功与攻击取自 doc.json。",
        "dungeonKind": "hualunjian",
        "sections": [{"title": "五绝论剑", "bosses": bosses}],
    }


def build_wujian_bosses(
    rows: list[tuple[str, list[str], str, str]],
    person: dict,
    skills: dict,
) -> list[dict]:
    bosses = []
    for i, (label, nicks, chest, text_drop) in enumerate(rows, start=1):
        fighters = []
        for n in nicks:
            try:
                fighters.append(fighter_from_person(person, skills, n))
            except SystemExit:
                pass
        if not fighters:
            raise SystemExit(f"无间地狱 BOSS 未匹配 person: {label} {nicks}")
        bosses.append(
            {
                "order": i,
                "boss": label,
                "fighters": fighters,
                "chestDrop": chest,
                "textDrop": text_drop,
            }
        )
    return bosses


def build_wujian(person: dict, skills: dict) -> dict:
    sections = []
    for layer_title, rows in WUJIAN:
        sections.append(
            {
                "title": layer_title,
                "bosses": build_wujian_bosses(rows, person, skills),
            }
        )
    return {
        "placeId": "无间地狱",
        "title": "无间地狱掉落大全（附经验双倍）",
        "note": "红色为唯一、黑色为无限（攻略表）；武功、攻击取自 doc.json。",
        "footnotes": WUJIAN_FOOTNOTES,
        "sections": sections,
    }


def main() -> None:
    doc = json.loads(DOC.read_text(encoding="utf-8"))
    person = doc.get("person") or {}
    skills = doc.get("skill") or {}

    write_js(ROOT / "js" / "map-dungeon-wulong.js", "MAP_DUNGEON_WULONG", build_wulong(person, skills))
    write_js(ROOT / "js" / "map-dungeon-baihu.js", "MAP_DUNGEON_BAIHU", build_baihu(person, skills))
    write_js(ROOT / "js" / "map-dungeon-fengming.js", "MAP_DUNGEON_FENGMING", build_fengming(person, skills))
    write_js(ROOT / "js" / "map-dungeon-wujian.js", "MAP_DUNGEON_WUJIAN", build_wujian(person, skills))
    write_js(
        ROOT / "js" / "map-dungeon-hualunjian.js",
        "MAP_DUNGEON_HUALUNJIAN",
        build_hualunjian(person, skills),
    )


if __name__ == "__main__":
    main()
