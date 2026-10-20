# -*- coding: utf-8 -*-
"""将《玄武版前期内功推荐》docx 转为 WIKI 攻略页。"""
from __future__ import annotations

import argparse
import html
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path(r"D:\QQ\data\玄武版前期内功推荐2.06版  (1).docx")
OUT_ARTICLE = ROOT / "articles" / "early-internal-guide-206.html"

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

H2_EXACT = frozenset(
    {
        "过渡b内功",
        "各种A内功获取方法",
        "门派a推荐",
        "玄武版新加内功大任督",
        "原版任督",
        "s内功获取方法（含？级）",
        "门派和不推荐内功",
    }
)

ENTRY_HEAD = re.compile(r"^([?？]|[sabc])[\u4e00-\u9fffA-Za-z·]+[：:]")


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
    s = re.sub(r"[^\w\u4e00-\u9fff\-（）()?？]+", "", s)
    return s[:56] or "section"


def classify_line(line: str) -> str:
    if line in H2_EXACT:
        return "h2"
    if line in ("※切换词条详解※",) or line.startswith("词条解释"):
        return "h3"
    if line.startswith("获取：") or line.startswith("刷新方法："):
        return "p"
    if ENTRY_HEAD.match(line) and len(line) <= 96:
        return "h3"
    return "p"


def lines_to_html_body(lines: list[str]) -> tuple[str, list[tuple[str, str]], str]:
    """跳过首行标题，从版本说明起排正文。"""
    toc: list[tuple[str, str]] = []
    parts: list[str] = []
    author = "ETERNAL"
    if lines:
        m = re.search(r"[—\-－]+\s*(\S+)\s*$", lines[0])
        if m:
            author = m.group(1).strip()
    body_lines = lines[1:] if lines else lines
    for line in body_lines:
        kind = classify_line(line)
        if kind == "h2":
            sid = slugify(line)
            toc.append((line, sid))
            parts.append(f'<h2 id="{html.escape(sid)}">{html.escape(line)}</h2>')
        elif kind == "h3":
            sid = slugify(line.split("：")[0].split(":")[0])
            parts.append(f'<h3 id="{html.escape(sid)}">{html.escape(line)}</h3>')
        else:
            parts.append(f"<p>{html.escape(line)}</p>")
    return "\n          ".join(parts), toc, author


def build_page(body: str, toc: list[tuple[str, str]], author: str) -> str:
    toc_ul = "\n".join(
        f'            <li><a href="#{html.escape(sid)}">{html.escape(title)}</a></li>'
        for title, sid in toc
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>玄武版前期内功推荐（2.06） · 玄武攻略 WIKI</title>
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
        <nav class="wiki-nav" id="wikiNav" data-active="early-internal"></nav>
      </aside>
      <main class="wiki-main">
        <div class="breadcrumb"><a href="../index.html">首页</a> / 攻略 / 前期内功推荐</div>
        <header class="article-header">
          <h1>玄武版前期内功推荐（2.06）</h1>
          <p class="muted">作者：{html.escape(author)} · 适用玄武江湖 2.06</p>
        </header>
        <div class="guide-related wiki-card">
          相关：<a href="beginner-master.html">开局从入门到精通</a> ·
          <a href="full-guide-xuanwu.html">玄武版全攻略</a> ·
          <a href="weapons-xuanwu-206.html">武器获取</a> ·
          <a href="../pages/compendium/internal.html">内功图鉴</a> ·
          <a href="../pages/compendium/skills.html">武功图鉴</a>
        </div>
        <nav class="toc">
          <strong>目录</strong>
          <ul>
{toc_ul}
          </ul>
        </nav>
        <article class="article-body guide-prose searchable-article early-internal-guide">
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
    body, toc, author = lines_to_html_body(lines)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_page(body, toc, author), encoding="utf-8")
    print(f"段落数: {len(lines)}")
    print(f"作者: {author}")
    print(f"已写入: {out}")


if __name__ == "__main__":
    main()
