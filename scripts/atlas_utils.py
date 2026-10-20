# -*- coding: utf-8 -*-
"""Cocos plist 图集裁切（res_head / res_icon 等）。"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore


def _plist_bool(el: ET.Element | None) -> bool:
    """Cocos plist 用 <true/> / <false/> 标签，不是字符串。"""
    if el is None:
        return False
    tag = (el.tag or "").lower()
    if tag == "true":
        return True
    if tag == "false":
        return False
    return (el.text or "").strip().lower() == "true"


def _plist_dict_child(parent: ET.Element, key_name: str) -> ET.Element | None:
    children = list(parent)
    for i, el in enumerate(children):
        if el.tag == "key" and (el.text or "") == key_name:
            if i + 1 < len(children) and children[i + 1].tag == "dict":
                return children[i + 1]
    return None


def parse_plist_frames(plist_path: Path) -> dict[str, tuple[int, int, int, int, bool]]:
    tree = ET.parse(plist_path)
    root_dict = tree.getroot().find("dict")
    if root_dict is None:
        raise ValueError("plist 格式异常")
    frames_el = _plist_dict_child(root_dict, "frames")
    if frames_el is None:
        raise ValueError("plist 中未找到 frames")

    frames: dict[str, tuple[int, int, int, int, bool]] = {}
    children = list(frames_el)
    i = 0
    while i < len(children):
        if children[i].tag != "key":
            i += 1
            continue
        name = children[i].text or ""
        block = children[i + 1]
        i += 2
        if block.tag != "dict":
            continue
        frame_str = rotated = None
        sub = list(block)
        j = 0
        while j < len(sub):
            if sub[j].tag == "key" and sub[j].text == "frame":
                frame_str = sub[j + 1].text
                j += 2
            elif sub[j].tag == "key" and sub[j].text == "rotated":
                rotated = _plist_bool(sub[j + 1])
                j += 2
            else:
                j += 1
        if not frame_str:
            continue
        m = re.match(r"\{\{(\d+),(\d+)\},\{(\d+),(\d+)\}\}", frame_str.strip())
        if not m:
            continue
        x, y, w, h = map(int, m.groups())
        frames[name] = (x, y, w, h, bool(rotated))
    return frames


def crop_frame(
    atlas: Image.Image, frame: tuple[int, int, int, int, bool]
) -> Image.Image:
    x, y, w, h, rotated = frame
    if rotated:
        patch = atlas.crop((x, y, x + h, y + w))
        return patch.transpose(Image.Transpose.ROTATE_90)
    return atlas.crop((x, y, x + w, y + h))


def save_icon_from_atlas(
    atlas: Image.Image,
    frames: dict[str, tuple[int, int, int, int, bool]],
    icon_id: int,
    out_path: Path,
    prefix: str = "res_icon",
) -> bool:
    if Image is None:
        raise RuntimeError("需要 Pillow")
    key = f"{prefix}/{icon_id}.png"
    if key not in frames:
        return False
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop_frame(atlas, frames[key]).save(out_path)
    return True
