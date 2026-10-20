# -*- coding: utf-8 -*-
"""将 玄武攻略整合.docx 转为 WIKI 文章 HTML 片段。"""
from __future__ import annotations

import argparse
import html
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path(r"D:\QQ\data\玄武攻略整合.docx")
OUT_ARTICLE = ROOT / "articles" / "xuanwu-integrated-guide.html"

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

H2_TITLES = frozenset(
    {
        "角色成长与天赋",
        "玄武版技能全解",
        "角色职业与开局选项（三选一角色与主角全属性及角色生活技能）",
        "武器来源与令牌",
    }
)

H3_HINTS = frozenset(
    {
        "拳劲",
        "剑意",
        "庖丁解牛",
        "音律",
        "棋艺",
        "书法",
        "绘画",
        "酒",
        "儒学",
        "道学",
        "自然之道",
        "厨艺",
        "女红",
        "制香化龙涎",
        "制香",
        "钓鱼",
        "炼丹",
        "制符",
        "弈棋戏",
        "斩鲸术",
        "佛法",
        "佛法内功",
        "五弊三缺",
        "垂钓术",
        "神行百变",
        "童子功",
        "六指琴魔",
        "霸王枪",
        "医术",
        "厨艺",
        "厨艺专精",
        "厨艺专精？",
        "厨艺专精",
        "厨艺专",
        "厨艺专精",
        "厨艺专精",
    }
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


def slugify(title: str) -> str:
    s = re.sub(r"\s+", "-", title.strip())
    s = re.sub(r"[^\w\u4e00-\u9fff\-（）()]+", "", s)
    return s[:48] or "section"


def classify_line(line: str, nxt: str | None) -> str:
    if line in H2_TITLES or line.startswith("角色职业与开局"):
        return "h2"
    if "武器来源" in line and "令牌" in line:
        return "h2"
    if line in ("经典资源：令牌", "结局线"):
        return "h2"
    if line in H3_HINTS:
        return "h3"
    if len(line) <= 8 and nxt and ("每" in nxt or "级" in nxt[:6]):
        if "，" not in line and "。" not in line:
            return "h3"
    if re.match(r"^\d+[、.．]", line) or (
        "角色" in line and ("生命" in line or "血量" in line) and "攻击" in line
    ):
        return "char"
    if line.endswith("：") and len(line) < 40 and "令" not in line:
        return "h3"
    return "p"


def lines_to_html_body(lines: list[str]) -> tuple[str, list[tuple[str, str]]]:
    toc: list[tuple[str, str]] = []
    parts: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        nxt = lines[i + 1] if i + 1 < len(lines) else None
        kind = classify_line(line, nxt)
        if kind == "h2":
            if line == "经典资源：令牌":
                line = "武器来源与令牌"
            elif line == "结局线":
                line = "结局线"
            elif "武器来源" in line:
                line = "武器来源与令牌"
            sid = slugify(line)
            toc.append((line, sid))
            parts.append(f'<h2 id="{html.escape(sid)}">{html.escape(line)}</h2>')
        elif kind == "h3":
            sid = slugify(line)
            parts.append(f'<h3 id="{html.escape(sid)}">{html.escape(line)}</h3>')
        elif kind == "char":
            parts.append(f'<p class="guide-char-entry">{html.escape(line)}</p>')
        else:
            parts.append(f"<p>{html.escape(line)}</p>")
        i += 1
    return "\n          ".join(parts), toc


def build_page(body: str, toc: list[tuple[str, str]]) -> str:
    toc_ul = "\n".join(
        f'            <li><a href="#{html.escape(sid)}">{html.escape(title)}</a></li>'
        for title, sid in toc
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>玄武攻略整合 · 玄武攻略 WIKI</title>
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
        <nav class="wiki-nav" id="wikiNav" data-active="integrated-guide"></nav>
      </aside>
      <main class="wiki-main">
        <div class="breadcrumb"><a href="../index.html">首页</a> / 攻略 / 玄武攻略整合</div>
        <header class="article-header">
          <h1>玄武攻略整合</h1>
          <p class="muted">作者：龙神之庭--魂之挽歌</p>
        </header>
        <div class="guide-related wiki-card">
          相关：<a href="full-guide-xuanwu.html">玄武版全攻略</a> ·
          <a href="weapons-xuanwu-206.html">武器获取</a> ·
          <a href="../pages/compendium/characters.html">角色图鉴</a> ·
          <a href="../pages/compendium/skills.html">武功图鉴</a> ·
          <a href="../pages/compendium/internal.html">内功图鉴</a> ·
          <a href="../pages/compendium/equipment.html">装备图鉴</a> ·
          <a href="../pages/compendium/arts.html">技艺图鉴</a>
        </div>
        <nav class="toc">
          <strong>目录</strong>
          <ul>
{toc_ul}
          </ul>
        </nav>
        <article class="article-body guide-prose searchable-article xuanwu-integrated-guide">
          {body}
        </article>
      </main>
    </div>
    <footer class="wiki-footer"><p>玄武攻略 WIKI</p></footer>
  </div>
  <script src="../js/search-index.js"></script>
  <script src="../js/wiki.js"></script>
  <script src="../js/site-nav.js"></script>
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
    body, toc = lines_to_html_body(lines)
    OUT_ARTICLE.parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(build_page(body, toc), encoding="utf-8")
    print(f"段落数: {len(lines)}")
    print(f"已写入: {args.output}")


if __name__ == "__main__":
    main()
