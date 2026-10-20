# -*- coding: utf-8 -*-
"""从 doc.json equip + res_icon 图集生成装备图鉴。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow：py -3 -m pip install Pillow")
    sys.exit(1)

from atlas_utils import parse_plist_frames, save_icon_from_atlas

ROOT = Path(__file__).resolve().parents[1]
GAME_DATA = ROOT / "game-data"
DEFAULT_DOC = GAME_DATA / "doc.json"
ICON_RES = GAME_DATA / "res_icon"
OUT_IMG_DIR = ROOT / "assets" / "images" / "equipment"
OUT_JS = ROOT / "js" / "equipment-compendium-data.js"

# star 0=? 1=E 2=D 3=C 4=B 5=A 6=S
STAR_LABELS = ("?", "E", "D", "C", "B", "A", "S")

TYPE_LABELS = {
    1: "拳",
    2: "剑",
    3: "刀",
    5: "甲",
    6: "戒",
    7: "腕",
}

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
    134217729: "免晕",
    134217730: "免流",
    134217731: "免减攻",
    134217732: "免速",
    134217733: "复活",
    134217734: "武器万分比",
    134217735: "基础伤害万分比",
    134217736: "武功万分比",
    134217737: "每段万分比",
    134217738: "消耗万分比",
}

# 不入装备图鉴（测试/未实装等）
EXCLUDED_EQUIP_NAMES = frozenset({"青丝笔", "凌霜戒"})

WAN_BI_TYPES = frozenset(
    {
        134217734,
        134217735,
        134217736,
        134217737,
        134217738,
    }
)

# 装备图鉴：数值即百分比，展示时加 %
PERCENT_ATTR_TYPES = frozenset(
    {
        16,  # 闪避
        64,  # 格挡
        131072,  # 攻击%
        2097152,  # 吸血
        16777216,  # 暴伤
        33554432,  # 反伤
        134217728,  # 暴击
        524288,  # 免伤
    }
)


def star_label(star: int) -> str:
    if 0 <= star <= 6:
        return STAR_LABELS[star]
    return "?"


def _strip_flavor_prefix(text: str) -> str:
    s = (text or "").strip()
    while s.startswith("】") or s.startswith("【"):
        s = s[1:].strip()
    return s


def parse_desp(desp: str) -> dict:
    raw = (desp or "").strip()
    if not raw:
        return {"flavor": ""}

    # 【|5ED1FF|精致|】后面才是描述
    if raw.startswith("【|") or raw.startswith("|"):
        parts = raw.split("|")
        if len(parts) >= 4:
            color = parts[1].strip()
            quality = parts[2].strip()
            rest = "|".join(parts[3:]).strip()
            flavor = _strip_flavor_prefix(rest)
            return {
                "qualityIcon": "【",
                "qualityColor": color,
                "qualityName": quality,
                "flavor": flavor,
            }

    parts = raw.split("|")
    if len(parts) >= 4 and parts[0] != "【":
        flavor = "|".join(parts[3:]).strip()
        return {
            "qualityIcon": parts[0].strip(),
            "qualityColor": parts[1].strip(),
            "qualityName": parts[2].strip(),
            "flavor": _strip_flavor_prefix(flavor),
        }

    return {"flavor": _strip_flavor_prefix(raw)}


def fmt_attr(effect: dict | None) -> str | None:
    if not effect:
        return None
    t = int(effect.get("t") or 0)
    v = effect.get("v")
    if v is None:
        return None
    v = float(v)
    name = ATTR_NAMES.get(t, f"属性{t}")
    if t in WAN_BI_TYPES:
        return f"{name} {v / 100:g}%"
    if t == 1:
        if v == int(v):
            return f"血量 {int(v)}"
        return f"血量 {v:g}"
    if t == 2:
        if v == int(v):
            return f"血量 {int(v)}%"
        return f"血量 {v:g}%"
    if t in PERCENT_ATTR_TYPES:
        if v == int(v):
            return f"{name} {int(v)}%"
        return f"{name} {v:g}%"
    if v == int(v):
        return f"{name} {int(v)}"
    return f"{name} {v:g}"


def effect_obj(effect: dict | None) -> dict | None:
    text = fmt_attr(effect)
    if not text:
        return None
    t = int(effect.get("t") or 0)
    return {"text": text, "code": t, "value": effect.get("v")}


def dedupe_enhance_attrs(attrs: list[dict]) -> list[dict]:
    """强化词条按属性 code 去重，保留首次出现。"""
    seen: set[int] = set()
    out: list[dict] = []
    for o in attrs:
        code = int(o.get("code") or 0)
        if code in seen:
            continue
        seen.add(code)
        out.append(o)
    return out


def find_icon_res() -> Path:
    for candidate in (
        ICON_RES,
        Path(r"D:\QQ\data\玄武2\玄武2"),
        Path(r"D:\QQ\data\玄武2"),
    ):
        if (candidate / "res_icon.plist").is_file() and (
            candidate / "res_icon.png"
        ).is_file():
            return candidate
    raise FileNotFoundError(
        "未找到 res_icon.plist / res_icon.png，请运行 import-game-data.bat 导入图集。"
    )


def update_search_index(names: list[str]) -> None:
    path = ROOT / "js" / "search-index.js"
    if not path.is_file():
        return
    keys = " ".join(sorted(set(names))[:80])
    lines = path.read_text(encoding="utf-8").splitlines()
    out = []
    for line in lines:
        if 'title: "装备图鉴"' in line and "compendium/equipment.html" in line:
            out.append(
                '  { title: "装备图鉴", url: "pages/compendium/equipment.html", keys: '
                + json.dumps(keys, ensure_ascii=False)
                + " },"
            )
        else:
            out.append(line)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> None:
    doc_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DOC
    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    equips = doc.get("equip") or {}

    name_counts: dict[str, int] = {}
    for v in equips.values():
        n = (v.get("nick") or "").strip()
        name_counts[n] = name_counts.get(n, 0) + 1

    icon_res = find_icon_res()
    frames = parse_plist_frames(icon_res / "res_icon.plist")
    atlas = Image.open(icon_res / "res_icon.png").convert("RGBA")

    entries = []
    missing_icons: list[str] = []

    for key, eq in equips.items():
        eid = str(key)
        nick = (eq.get("nick") or eid).strip()
        if nick in EXCLUDED_EQUIP_NAMES:
            continue
        icon_id = int(eq.get("icon") or eq.get("id") or 0)
        star = int(eq.get("star") or 0)
        etype = int(eq.get("type") or 0)
        desp_info = parse_desp(eq.get("desp") or "")
        tx_list = []
        for tx in eq.get("tx") or []:
            o = effect_obj(tx)
            if o:
                tx_list.append(o)
        tx_list = dedupe_enhance_attrs(tx_list)

        img_path = OUT_IMG_DIR / f"{eid}.png"
        if not save_icon_from_atlas(atlas, frames, icon_id, img_path):
            missing_icons.append(f"{nick}({eid}) icon={icon_id}")
            Image.new("RGBA", (48, 48), (0, 0, 0, 0)).save(img_path)

        dup = name_counts.get(nick, 0) > 1

        entries.append(
            {
                "id": eid,
                "name": nick,
                "type": etype,
                "typeLabel": TYPE_LABELS.get(etype, f"类型{etype}"),
                "star": star,
                "starLabel": star_label(star),
                "money": int(eq.get("money") or 0),
                "mainAttr": effect_obj(eq.get("e1")),
                "subAttr": effect_obj(eq.get("e2")),
                "enhanceAttrs": tx_list,
                "qualityName": desp_info.get("qualityName", ""),
                "qualityColor": desp_info.get("qualityColor", ""),
                "qualityIcon": desp_info.get("qualityIcon", ""),
                "flavor": desp_info.get("flavor", ""),
                "duplicateName": dup,
                "image": f"assets/images/equipment/{eid}.png",
                "icon": icon_id,
            }
        )

    entries.sort(key=lambda e: (-e["star"], e["type"], e["name"], e["id"]))

    OUT_JS.write_text(
        "// 由 scripts/build-equipment-compendium.py 生成，请勿手改。\n"
        + "window.EQUIPMENT_COMPENDIUM = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    update_search_index([e["name"] for e in entries])

    print(f"装备数: {len(entries)}")
    print(f"图标目录: {OUT_IMG_DIR}")
    print(f"数据: {OUT_JS}")
    if missing_icons:
        print("缺少图标帧:")
        for m in missing_icons[:20]:
            print(" ", m)
        if len(missing_icons) > 20:
            print(f"  ... 共 {len(missing_icons)} 个")


if __name__ == "__main__":
    main()
