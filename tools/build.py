#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建辅助脚本（仅开发时使用，部署到 GitHub Pages 不需要运行）

1. 去掉 JSON 文件的 UTF-8 BOM，确保浏览器 fetch + JSON.parse 正常
2. 校验菜谱引用的食材 / 调料 id 是否都存在
3. 统计每道菜的营养，输出异常值警告
4. 生成 data/embedded.js（把 JSON 打包成 JS，双击 index.html 也能离线运行）
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def load(name):
    """只读解析（utf-8-sig 兼容 BOM），不回写源文件，避免编码意外。"""
    path = os.path.join(DATA, name)
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def main():
    ing = load("ingredients.json")["items"]
    sea = load("seasonings.json")["items"]
    rec = load("recipes.json")["items"]
    subs = load("substitutes.json") if os.path.exists(os.path.join(DATA, "substitutes.json")) else {"items": []}

    ing_map = {i["id"]: i for i in ing}
    sea_map = {i["id"]: i for i in sea}
    id_map = {}
    id_map.update(ing_map)
    id_map.update(sea_map)

    print("食材 %d 条 / 调料 %d 条 / 菜谱 %d 条" % (len(ing), len(sea), len(rec)))

    errors = []
    ids = set()
    for r in rec:
        if r["id"] in ids:
            errors.append("菜谱 id 重复: %s" % r["id"])
        ids.add(r["id"])
        for pair in r.get("ings", []) + r.get("seas", []):
            if pair[0] not in id_map:
                errors.append("%s 引用未知 id: %s" % (r["id"], pair[0]))
                continue
            base = id_map[pair[0]]
            # 只做粗粒度范围检查：真实食物含膳食纤维、水分，4/9/4 换算会天然有偏差
            p = base["per100"]
            if p["kcal"] < 0 or p["p"] < 0 or p["f"] < 0 or p["c"] < 0:
                errors.append("营养数据为负: %s" % base["id"])
            # 蛋白粉的蛋白可到 80%，阈值放宽到 85
            if p["p"] > 85 or p["f"] > 100 or p["c"] > 100:
                errors.append("营养数据超出合理范围: %s" % base["id"])

    # 菜谱营养概览
    print("\n%-24s %6s %6s %6s %6s %6s" % ("菜谱", "份", "kcal", "蛋白", "脂肪", "碳水"))
    for r in rec:
        tot = {"kcal": 0.0, "p": 0.0, "f": 0.0, "c": 0.0}
        for pair in r.get("ings", []) + r.get("seas", []):
            base = id_map.get(pair[0])
            if not base:
                continue
            factor = pair[2] if len(pair) > 2 else 1
            k = (pair[1] * factor) / 100.0
            for key in tot:
                tot[key] += base["per100"][key] * k
        s = r.get("servings", 2)
        print("%-24s %6d %6.0f %6.1f %6.1f %6.1f" % (
            r["name"], s, tot["kcal"] / s, tot["p"] / s, tot["f"] / s, tot["c"] / s))
        if tot["kcal"] / s > 1200:
            errors.append("%s 单份热量过高 %.0f" % (r["name"], tot["kcal"] / s))

    # 替代方案引用检查
    for key, arr in subs.get("items", {}).items():
        if key not in id_map:
            errors.append("替代方案主 id 未知: %s" % key)
        for alt in arr:
            if alt.get("id") and alt["id"] not in id_map:
                errors.append("替代方案子 id 未知: %s -> %s" % (key, alt["id"]))

    if errors:
        print("\n[!] 发现问题 %d 条:" % len(errors))
        for e in errors:
            print("   -", e)
    else:
        print("\n[OK] 数据校验全部通过")

    # 生成 embedded.js
    payload = {
        "ingredients": json.load(open(os.path.join(DATA, "ingredients.json"), encoding="utf-8")),
        "seasonings": json.load(open(os.path.join(DATA, "seasonings.json"), encoding="utf-8")),
        "recipes": json.load(open(os.path.join(DATA, "recipes.json"), encoding="utf-8")),
        "substitutes": json.load(open(os.path.join(DATA, "substitutes.json"), encoding="utf-8")),
    }
    out = os.path.join(DATA, "embedded.js")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* 由 tools/build.py 自动生成，请勿手改；数据源见 data/*.json */\n")
        f.write("window.__RECIPE_DATA__ = ")
        f.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    print("已生成 data/embedded.js (%.1f KB)" % (os.path.getsize(out) / 1024.0))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
