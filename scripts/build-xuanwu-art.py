# -*- coding: utf-8 -*-
"""
从 assets/images/xuanwu.png（白底整幅插画）产出两个网页用素材：

  xuanwu-hero.png  去底 + 裁掉四周空白，用于首页卷首
  xuanwu-mark.png  去底 + 方形取景，用于页头品牌那枚「印」

背景用「从四边泛洪填充」的方式识别，而不是全图颜色键控 ——
龟甲里本身就有接近底色的米白，全图键控会把它一起抠掉。
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "xuanwu.png")
OUT_DIR = os.path.join(ROOT, "assets", "images")


def keyed_image(thresh=42):
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    sentinel = (255, 0, 255)

    work = im.copy()
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(work, seed, sentinel, thresh=thresh)

    # 背景 = 被填充成 sentinel 的像素
    bg = Image.new("L", (w, h), 0)
    src_px = work.load()
    bg_px = bg.load()
    for y in range(h):
        for x in range(w):
            if src_px[x, y] == sentinel:
                bg_px[x, y] = 255

    alpha = Image.eval(bg, lambda v: 255 - v)
    # 泛洪停在色差边界上，会留下一圈比纸还浅的毛边：
    # 先向内收 1px 把毛边削掉，再轻微羽化补回抗锯齿。
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.55))

    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out


def content_bbox(im, alpha_cut=12):
    alpha = im.getchannel("A")
    mask = alpha.point(lambda v: 255 if v > alpha_cut else 0)
    return mask.getbbox()


def main():
    im = keyed_image()
    bbox = content_bbox(im)
    art = im.crop(bbox)

    # —— 卷首：限宽 520，等比重采样，另存 WebP（比 PNG 小一个数量级）——
    hero = art.copy()
    if hero.width > 520:
        hero = hero.resize((520, round(hero.height * 520 / hero.width)), Image.LANCZOS)
    hero_path = os.path.join(OUT_DIR, "xuanwu-hero.webp")
    hero.save(hero_path, "WEBP", quality=86, method=6)

    # —— 品牌印：方形取景压向「龟首 + 龟甲 + 前爪」，避开右侧的「玄武」题字。
    #    36px 大小下只有这一块能看清，蛇身与题字在这个尺度上只会糊成一团。 ——
    w, h = art.size
    side = int(h * 0.70)
    cx, cy = int(w * 0.34), int(h * 0.50)
    left = max(0, min(w - side, cx - side // 2))
    top = max(0, min(h - side, cy - side // 2))
    mark = art.crop((left, top, left + side, top + side)).resize((128, 128), Image.LANCZOS)
    mark_path = os.path.join(OUT_DIR, "xuanwu-mark.webp")
    mark.save(mark_path, "WEBP", quality=90, method=6)

    for p in (SRC, hero_path, mark_path):
        print(f"{os.path.relpath(p, ROOT):40s} {os.path.getsize(p) / 1024:8.1f} KB")
    print("原图尺寸:", Image.open(SRC).size, "→ 内容框:", bbox, "→ 成品:", art.size)


if __name__ == "__main__":
    main()
