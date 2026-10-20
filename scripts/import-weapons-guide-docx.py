# -*- coding: utf-8 -*-
"""将《玄武版武器获取方法》docx 转为 WIKI 攻略页。"""
from __future__ import annotations

import argparse
import html
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path(r"D:\QQ\data\玄武版武器获取方法2.13版(1).docx")
OUT_ARTICLE = ROOT / "articles" / "weapons-xuanwu-206.html"

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

CONTINUATION_PREFIXES = (
    "获取",
    "获取方法",
    "获取方式",
    "或虎",
    "或虎牌",
    "满锻造",
    "破闪避",
    "蓝青冥",
    "龙牌可",
    "80级后",
    "黑市",
    "鹰牌",
)


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


def is_continuation(line: str) -> bool:
    if line.startswith("※"):
        return True
    return any(line.startswith(p) for p in CONTINUATION_PREFIXES)


def entry_title(first_line: str) -> str:
    if "：" in first_line:
        head = first_line.split("：", 1)[0].strip()
        if len(head) <= 24:
            return head
    if ":" in first_line and first_line.index(":") < 24:
        return first_line.split(":", 1)[0].strip()
    m = re.match(r"^(\S+)\s", first_line)
    if m:
        return m.group(1).strip()
    return first_line[:32].strip()


def is_new_weapon_line(line: str) -> bool:
    if line.startswith("※"):
        return False
    if "天铸系列" in line:
        return True
    if is_continuation(line):
        return False
    if re.search(r"[bBsSaA?\?][刀剑杖]|拳套|S剑|A剑|s拳|a拳|b剑|b刀|a刀|s刀", line):
        return True
    return False


def section_for_line(line: str, current: str) -> str:
    if "天铸系列" in line or line.startswith("※"):
        return "forge"
    if line.startswith("玄蛇拳套"):
        return "fist"
    if line.startswith("真武"):
        return "sword"
    return current


SECTION_META = {
    "blade": ("sec-blade", "刀 / 杖"),
    "sword": ("sec-sword", "剑"),
    "fist": ("sec-fist", "拳套"),
    "forge": ("sec-forge", "天铸与洗练"),
}


def group_entries(lines: list[str]) -> list[tuple[str, str, list[str]]]:
    """返回 [(section_key, title, paragraphs), ...]"""
    body = lines[2:] if len(lines) > 2 else lines
    if body and body[0] == "武器篇":
        body = body[1:]

    entries: list[tuple[str, str, list[str]]] = []
    section = "blade"
    current_title = ""
    current_paras: list[str] = []

    def flush() -> None:
        nonlocal current_title, current_paras
        if not current_paras and not current_title:
            return
        title = current_title or entry_title(current_paras[0])
        entries.append((section, title, list(current_paras)))
        current_title = ""
        current_paras = []

    for line in body:
        if line.startswith("※"):
            if current_paras:
                current_paras.append(line)
            else:
                flush()
                entries.append((section, "洗练说明", [line]))
            continue
        if is_new_weapon_line(line):
            flush()
            section = section_for_line(line, section)
            current_title = entry_title(line)
            current_paras = [line]
            continue
        if current_paras:
            current_paras.append(line)
        else:
            current_title = entry_title(line)
            current_paras = [line]

    flush()
    return entries


def entries_to_html(entries: list[tuple[str, str, list[str]]]) -> str:
    parts: list[str] = []
    last_section = ""
    for section, title, paras in entries:
        if section != last_section:
            sid, label = SECTION_META[section]
            parts.append(f'<h2 id="{sid}">{html.escape(label)}</h2>')
            last_section = section
        parts.append('<div class="weapon-entry">')
        parts.append(f"<h3>{html.escape(title)}</h3>")
        for p in paras:
            parts.append(f"<p>{html.escape(p)}</p>")
        parts.append("</div>")
    return "\n          ".join(parts)


def parse_version(lines: list[str]) -> str:
    if not lines:
        return "2.13"
    m = re.search(r"2\.(\d+)", lines[0])
    return m.group(0) if m else "2.13"


def parse_author(lines: list[str]) -> str:
    if not lines:
        return "ETERNA"
    m = re.search(r"[—\-－]+\s*(\S+)\s*$", lines[0])
    return m.group(1).strip() if m else "ETERNA"


def build_page(body: str, version: str, author: str) -> str:
    ver_label = version.replace(".", "_")
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>玄武版武器获取（{html.escape(version)}） · 玄武攻略 WIKI</title>
  <link rel="stylesheet" href="../css/wiki.css" />
</head>
<body data-wiki-depth="1">
  <div class="wiki-shell">
    <header class="wiki-header">
      <button type="button" class="nav-toggle" id="navToggle" aria-label="打开菜单">☰</button>
      <a class="wiki-brand" href="../index.html"><span class="wiki-brand-icon">武</span><span class="wiki-brand-text">玄武攻略 WIKI</span></a>
      <div class="wiki-search"><input type="search" id="globalSearch" placeholder="搜索…" /></div>
    </header>
    <div class="wiki-body">
      <aside class="wiki-sidebar" id="sidebar">
        <nav class="wiki-nav" id="wikiNav" data-active="weapons"></nav>
      </aside>
      <main class="wiki-main">
        <div class="breadcrumb"><a href="../index.html">首页</a> / 攻略 / 武器获取</div>
        <header class="article-header">
          <h1>玄武版武器获取方法（{html.escape(version)} 版）</h1>
          <p class="muted">作者：{html.escape(author)}</p>
        </header>
        <div class="guide-related wiki-card">
          相关：<a href="full-guide-xuanwu.html#装备介绍">全攻略 · 装备章</a> ·
          <a href="beginner-master.html">开局装备路线</a> ·
          <a href="../pages/compendium/equipment.html">装备图鉴速查</a>
        </div>
        <nav class="toc">
          <strong>目录</strong>
          <ul>
            <li><a href="#sec-blade">刀 / 杖</a></li>
            <li><a href="#sec-sword">剑</a></li>
            <li><a href="#sec-fist">拳套</a></li>
            <li><a href="#sec-forge">天铸与洗练</a></li>
          </ul>
        </nav>
        <article class="article-body searchable-article">
          {body}
        </article>
      </main>
    </div>
    <footer class="wiki-footer"><p>玄武攻略 WIKI</p></footer>
  </div>
  <script src="../js/search-index.js"></script>
  <script src="../js/wiki.js"></script>
  <script src="../js/site-nav.js"></script>
  <script src="../js/article-tools.js"></script>
</body>
</html>
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("docx", nargs="?", default=str(DEFAULT_DOCX))
    ap.add_argument("-o", "--output", default=str(OUT_ARTICLE))
    args = ap.parse_args()
    docx = Path(args.docx)
    if not docx.is_file():
        raise SystemExit(f"找不到文件: {docx}")

    lines = read_paragraphs(docx)
    entries = group_entries(lines)
    body = entries_to_html(entries)
    version = parse_version(lines)
    author = parse_author(lines)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_page(body, version, author), encoding="utf-8")
    print(f"段落数: {len(lines)}")
    print(f"武器条目: {len(entries)}")
    print(f"版本: {version}")
    print(f"已写入: {out}")


if __name__ == "__main__":
    main()
