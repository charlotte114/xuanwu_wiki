# -*- coding: utf-8 -*-
"""Copy doc.json, strings.xml, res_head / res_icon atlas into project game-data/."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "game-data"
DEST_HEAD = DEST / "res_head"
DEST_ICON = DEST / "res_icon"

# 最新资源：D:\QQ\data\玄武2（图集常在子目录 玄武2\玄武2）
DEFAULT_SRC = Path(r"D:\QQ\data\玄武2")
FALLBACK_DOC_ROOT = Path(r"D:\QQ\data")


def resolve_bundle_dir(src: Path) -> Path | None:
    """含 res_head.plist / res_icon.plist 的目录。"""
    candidates = [src, src / "玄武2"]
    for folder in candidates:
        if (folder / "res_head.plist").is_file() and (folder / "res_head.png").is_file():
            return folder
    for plist in src.rglob("res_head.plist"):
        folder = plist.parent
        if (folder / "res_head.png").is_file():
            return folder
    return None


def resolve_doc_dir(src: Path, bundle: Path) -> Path:
    """含 doc.json / strings.xml 的目录（图集包内没有时回退到 D:\\QQ\\data）。"""
    for folder in (src, bundle, bundle.parent, FALLBACK_DOC_ROOT):
        if folder.is_dir() and (folder / "doc.json").is_file():
            return folder
    return src


def wipe_dir_keep_gitkeep(folder: Path) -> None:
    if not folder.is_dir():
        return
    for child in folder.iterdir():
        if child.name == ".gitkeep":
            continue
        if child.is_file():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.is_dir():
        print(f"Source folder not found: {src}")
        sys.exit(1)

    bundle = resolve_bundle_dir(src)
    if bundle is None:
        print(f"res_head.plist / res_head.png not found under: {src}")
        sys.exit(1)

    doc_dir = resolve_doc_dir(src, bundle)

    DEST.mkdir(parents=True, exist_ok=True)
    DEST_HEAD.mkdir(parents=True, exist_ok=True)
    DEST_ICON.mkdir(parents=True, exist_ok=True)

    wipe_dir_keep_gitkeep(DEST_HEAD)
    wipe_dir_keep_gitkeep(DEST_ICON)
    for name in ("doc.json", "strings.xml"):
        f = DEST / name
        if f.is_file():
            f.unlink()

    copied = []
    print(f"Atlas bundle: {bundle}")
    print(f"doc.json from: {doc_dir}")

    for name in ("doc.json", "strings.xml"):
        f = doc_dir / name
        if f.is_file():
            shutil.copy2(f, DEST / name)
            copied.append(str(DEST / name))
        else:
            print(f"Skip (missing): {f}")

    for name in ("res_head.plist", "res_head.png"):
        shutil.copy2(bundle / name, DEST_HEAD / name)
        copied.append(str(DEST_HEAD / name))

    if (bundle / "res_icon.plist").is_file() and (bundle / "res_icon.png").is_file():
        for name in ("res_icon.plist", "res_icon.png"):
            shutil.copy2(bundle / name, DEST_ICON / name)
            copied.append(str(DEST_ICON / name))
    else:
        print("Skip (missing): res_icon atlas")

    print("Imported into game-data:")
    for p in copied:
        print(" ", p)


if __name__ == "__main__":
    main()
