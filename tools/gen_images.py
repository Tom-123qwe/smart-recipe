# -*- coding: utf-8 -*-
"""生成内置占位图（纯 SVG，本地打包，无任何网络请求）。

每类菜品一张插画式占位图，风格统一：暖色渐变底 + 白瓷盘 + 抽象食材色块。
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")
os.makedirs(OUT, exist_ok=True)

W, H = 800, 600

# 每类：底色渐变、盘子色、主色块、点缀色
PALETTE = {
    "meat":      {"bg": ("#FFF3E6", "#FFD9B0"), "warm": "#F6A24B", "main": ["#B4502A", "#8E3A1E", "#D2691E"], "dot": ["#7FB77E", "#FFE0A3"]},
    "veg":       {"bg": ("#F2FBEF", "#D9F0CE"), "warm": "#8CC47F", "main": ["#5C9E52", "#7FBF6A", "#3F7C3A"], "dot": ["#FFB347", "#FFFFFF"]},
    "egg":       {"bg": ("#FFFAE8", "#FFE7B3"), "warm": "#F5C645", "main": ["#F4D35E", "#E9A83B", "#C8102E"], "dot": ["#7FB77E", "#FFFFFF"]},
    "soup":      {"bg": ("#FFF6E9", "#FFDCC0"), "warm": "#E9A178", "main": ["#D98E5F", "#F3C08B", "#A9542F"], "dot": ["#8CBF7A", "#FFF7E6"]},
    "staple":    {"bg": ("#FFF9EF", "#FFE9C7"), "warm": "#E0A458", "main": ["#F2DFB8", "#D2A45E", "#8C6239"], "dot": ["#7FB77E", "#C8102E"]},
    "breakfast": {"bg": ("#FFF7EC", "#FFE1BC"), "warm": "#F0B062", "main": ["#F6D186", "#E9A83B", "#C9803A"], "dot": ["#FFFFFF", "#8CBF7A"]},
    "cold":      {"bg": ("#F4FBF6", "#DFF0E4"), "warm": "#93C8A0", "main": ["#7FBF87", "#CBE7C6", "#4E8F5C"], "dot": ["#F4D35E", "#FFFFFF"]},
    "snack":     {"bg": ("#FFF6E6", "#FFDCA8"), "warm": "#EFA94A", "main": ["#E7A64B", "#C9803A", "#F5D08A"], "dot": ["#C8102E", "#7FB77E"]},
    "light":     {"bg": ("#F3FBF4", "#DFF1DE"), "warm": "#7FC08A", "main": ["#6DB37A", "#A8D8A8", "#3F7C4E"], "dot": ["#FFD166", "#FFFFFF"]},
    "fitness":   {"bg": ("#F2F6FA", "#DCE8F2"), "warm": "#6C9BBF", "main": ["#4E8AB0", "#8FB9D4", "#2F6480"], "dot": ["#F2C14E", "#FFFFFF"]},
}


def blobs(rng, colors, count=7, cx=400, cy=310, rx=170, ry=150):
    out = []
    for i in range(count):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0, 1) ** 0.6
        x = cx + math.cos(a) * rx * r
        y = cy + math.sin(a) * ry * r
        s = rng.uniform(34, 70)
        c = colors[i % len(colors)]
        rot = rng.uniform(-25, 25)
        out.append(
            '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s" opacity="%.2f" '
            'transform="rotate(%.1f %.1f %.1f)"/>' % (x, y, s, s * rng.uniform(0.7, 1.0), c, rng.uniform(0.85, 1.0), rot, x, y)
        )
    return "".join(out)


def steam(cx, cy, opacity=0.5):
    return (
        '<g fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity="%.2f">'
        '<path d="M%.0f %.0f c -14 -26 14 -40 0 -66"/>'
        '<path d="M%.0f %.0f c -14 -30 14 -44 0 -74"/>'
        '<path d="M%.0f %.0f c -14 -26 14 -40 0 -66"/>'
        "</g>" % (opacity, cx - 46, cy, cx, cy - 10, cx + 46, cy)
    )


STYLE_MAP = {"light": "cold", "fitness": "meat"}


def build(cat):
    p = PALETTE[cat]
    style = STYLE_MAP.get(cat, cat)
    rng = random.Random(hash(cat) & 0xFFFF)
    gid = "g_" + cat
    parts = []
    parts.append(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img" aria-label="菜品占位图">'
        % (W, H, W, H)
    )
    parts.append(
        "<defs>"
        '<linearGradient id="%s" x1="0" y1="0" x2="0.4" y2="1">'
        '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>'
        '<radialGradient id="%s_p" cx="0.4" cy="0.35" r="0.8">'
        '<stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="%s"/></radialGradient>'
        '<filter id="%s_s" x="-30%%" y="-30%%" width="160%%" height="160%%">'
        '<feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#8A5A2B" flood-opacity="0.22"/></filter>'
        "</defs>" % (gid, p["bg"][0], p["bg"][1], gid, p["warm"], gid)
    )
    parts.append('<rect width="%d" height="%d" fill="url(#%s)"/>' % (W, H, gid))
    # 背景装饰圆
    parts.append('<circle cx="640" cy="120" r="120" fill="#FFFFFF" opacity="0.22"/>')
    parts.append('<circle cx="150" cy="500" r="90" fill="#FFFFFF" opacity="0.18"/>')

    if style == "soup":
        # 汤碗
        parts.append('<ellipse cx="400" cy="330" rx="250" ry="120" fill="#FFFFFF" opacity="0.55"/>')
        parts.append('<path d="M170 300 q0 170 230 170 q230 0 230 -170 z" fill="#FFFFFF" filter="url(#%s_s)"/>' % gid)
        parts.append('<ellipse cx="400" cy="300" rx="230" ry="104" fill="url(#%s_p)"/>' % gid)
        parts.append(blobs(rng, p["main"], 8, cy=310, rx=170, ry=78))
        parts.append('<ellipse cx="400" cy="300" rx="230" ry="104" fill="none" stroke="#FFFFFF" stroke-width="10"/>')
        parts.append(steam(330, 210, 0.55) + steam(470, 215, 0.4))
    elif style == "staple":
        parts.append('<ellipse cx="400" cy="345" rx="255" ry="125" fill="#FFFFFF" opacity="0.6"/>')
        parts.append('<path d="M165 300 q0 185 235 185 q235 0 235 -185 z" fill="#FFFFFF" filter="url(#%s_s)"/>' % gid)
        parts.append('<ellipse cx="400" cy="295" rx="235" ry="108" fill="url(#%s_p)"/>' % gid)
        # 米饭/面条团
        parts.append('<path d="M250 300 q0 -95 150 -95 q150 0 150 95 q0 60 -150 60 q-150 0 -150 -60 z" fill="%s"/>' % p["main"][0])
        parts.append('<path d="M255 292 q0 -80 145 -80 q145 0 145 80" fill="none" stroke="%s" stroke-width="6" opacity="0.35"/>' % p["main"][1])
        parts.append(blobs(rng, p["dot"], 5, cy=285, rx=120, ry=50))
        parts.append('<ellipse cx="400" cy="295" rx="235" ry="108" fill="none" stroke="#FFFFFF" stroke-width="10"/>')
        parts.append(steam(400, 200, 0.45))
    elif style == "breakfast":
        rng2 = rng
        for i in range(3):
            cx = 300 + i * 100
            cy = 300 + (i % 2) * 26
            parts.append('<ellipse cx="%d" cy="%d" rx="112" ry="86" fill="url(#%s_p)" filter="url(#%s_s)"/>' % (cx, cy, gid, gid))
            parts.append('<ellipse cx="%d" cy="%d" rx="80" ry="58" fill="%s" opacity="0.95"/>' % (cx, cy, p["main"][0]))
            parts.append('<ellipse cx="%d" cy="%d" rx="46" ry="30" fill="#FFFFFF" opacity="0.65"/>' % (cx - 10, cy - 8))
            parts.append('<circle cx="%d" cy="%d" r="10" fill="%s" opacity="0.85"/>' % (cx + 34, cy + 18, p["dot"][0]))
        parts.append(steam(400, 190, 0.4))
    elif style == "cold":
        parts.append('<ellipse cx="400" cy="330" rx="250" ry="120" fill="#FFFFFF" opacity="0.6"/>')
        parts.append('<ellipse cx="400" cy="320" rx="240" ry="150" fill="url(#%s_p)" filter="url(#%s_s)"/>' % (gid, gid))
        parts.append(blobs(rng, p["main"], 9, cy=315, rx=165, ry=105))
        # 筷子
        parts.append('<g stroke="%s" stroke-width="12" stroke-linecap="round" opacity="0.9">'
                     '<path d="M540 150 L660 90"/><path d="M560 190 L690 130"/></g>' % "#C98B4B")
        parts.append('<ellipse cx="400" cy="320" rx="240" ry="150" fill="none" stroke="#FFFFFF" stroke-width="12"/>')
    elif style == "veg":
        parts.append('<ellipse cx="400" cy="335" rx="248" ry="118" fill="#FFFFFF" opacity="0.6"/>')
        parts.append('<ellipse cx="400" cy="320" rx="238" ry="148" fill="url(#%s_p)" filter="url(#%s_s)"/>' % (gid, gid))
        # 叶菜
        for i in range(5):
            a = -0.6 + i * 0.35
            x = 400 + math.cos(a) * 70
            y = 300 + math.sin(a) * 40
            parts.append('<path d="M%.0f %.0f q 52 -70 104 -30 q -46 76 -104 30 z" fill="%s" opacity="0.95" transform="rotate(%d %.0f %.0f)"/>'
                         % (x, y, p["main"][i % 3], i * 26 - 60, x, y))
        parts.append(blobs(rng, p["dot"], 6, cy=320, rx=150, ry=90))
        parts.append('<ellipse cx="400" cy="320" rx="238" ry="148" fill="none" stroke="#FFFFFF" stroke-width="10"/>')
    elif style == "egg":
        parts.append('<ellipse cx="400" cy="335" rx="248" ry="118" fill="#FFFFFF" opacity="0.6"/>')
        parts.append('<ellipse cx="400" cy="320" rx="238" ry="150" fill="url(#%s_p)" filter="url(#%s_s)"/>' % (gid, gid))
        # 炒蛋块 + 番茄
        parts.append(blobs(rng, ["#F7D65A", "#F2C14E", "#E9B742"], 6, cy=310, rx=140, ry=80))
        parts.append('<circle cx="330" cy="330" r="46" fill="#D9453A" opacity="0.92"/>')
        parts.append('<circle cx="470" cy="300" r="54" fill="#E05A4A" opacity="0.9"/>')
        parts.append('<circle cx="416" cy="368" r="34" fill="#C8102E" opacity="0.85"/>')
        parts.append(blobs(rng, ["#7FB77E"], 3, cy=330, rx=150, ry=80))
        parts.append('<ellipse cx="400" cy="320" rx="238" ry="150" fill="none" stroke="#FFFFFF" stroke-width="10"/>')
        parts.append(steam(400, 205, 0.4))
    elif style == "snack":
        parts.append('<ellipse cx="400" cy="340" rx="240" ry="112" fill="#FFFFFF" opacity="0.6"/>')
        parts.append('<ellipse cx="400" cy="325" rx="230" ry="142" fill="url(#%s_p)" filter="url(#%s_s)"/>' % (gid, gid))
        for i in range(7):
            x = 280 + (i % 4) * 78 + rng.uniform(-10, 10)
            y = 300 + (i // 4) * 62 + rng.uniform(-8, 8)
            parts.append('<rect x="%.0f" y="%.0f" width="72" height="52" rx="18" fill="%s" opacity="0.95" '
                         'transform="rotate(%d %.0f %.0f)"/>' % (x, y, p["main"][i % 3], rng.uniform(-18, 18), x + 36, y + 26))
        parts.append(blobs(rng, p["dot"], 4, cy=330, rx=150, ry=80))
        parts.append('<ellipse cx="400" cy="325" rx="230" ry="142" fill="none" stroke="#FFFFFF" stroke-width="10"/>')
    else:  # meat
        parts.append('<ellipse cx="400" cy="335" rx="248" ry="118" fill="#FFFFFF" opacity="0.6"/>')
        parts.append('<ellipse cx="400" cy="320" rx="238" ry="150" fill="url(#%s_p)" filter="url(#%s_s)"/>' % (gid, gid))
        parts.append(blobs(rng, p["main"], 8, cy=315, rx=150, ry=88))
        # 酱汁光泽
        parts.append('<ellipse cx="356" cy="292" rx="52" ry="26" fill="#FFFFFF" opacity="0.28"/>')
        parts.append(blobs(rng, p["dot"], 4, cy=330, rx=170, ry=90))
        parts.append('<ellipse cx="400" cy="320" rx="238" ry="150" fill="none" stroke="#FFFFFF" stroke-width="10"/>')
        parts.append(steam(400, 205, 0.42))

    parts.append("</svg>")
    return "".join(parts)


def logo():
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        "<defs><linearGradient id=\"lg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">"
        '<stop offset="0" stop-color="#FF9A4D"/><stop offset="1" stop-color="#F26419"/></linearGradient></defs>'
        '<rect width="64" height="64" rx="18" fill="url(#lg)"/>'
        '<path d="M14 34h36a18 18 0 0 1-36 0z" fill="#FFFFFF" opacity="0.95"/>'
        '<path d="M12 31h40" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.95"/>'
        '<path d="M26 22c-3-4 3-6 0-10M38 22c-3-4 3-6 0-10" stroke="#FFFFFF" stroke-width="3.4" '
        'stroke-linecap="round" fill="none" opacity="0.9"/>'
        "</svg>"
    )


if __name__ == "__main__":
    for cat in PALETTE:
        path = os.path.join(OUT, "dish-%s.svg" % cat)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(build(cat))
        print("生成", os.path.basename(path))
    with open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(logo())
    # 通用默认占位图（菜谱没有分类时使用）
    with open(os.path.join(OUT, "dish-default.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(build("meat"))
    print("生成 logo.svg / dish-default.svg")
