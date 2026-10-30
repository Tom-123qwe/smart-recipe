# -*- coding: utf-8 -*-
"""把 seed_ing / seed_r1~r3 的数据合并进 data/*.json，并做引用校验。"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
HERE = os.path.dirname(os.path.abspath(__file__))


def load_py(name):
    ns = {}
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        exec(compile(f.read(), name, "exec"), ns)
    return ns


def load_json(name):
    with open(os.path.join(DATA, name), encoding="utf-8-sig") as f:
        return json.load(f)


def parse_pairs(s):
    """'id:克 id:克' -> [[id, 克], ...]"""
    out = []
    for token in str(s or "").split():
        if ":" not in token:
            continue
        k, v = token.split(":", 1)
        out.append([k.strip(), int(float(v))])
    return out


def main():
    ing_doc = load_json("ingredients.json")
    sea_doc = load_json("seasonings.json")
    rec_doc = load_json("recipes.json")

    ing_ids = {x["id"] for x in ing_doc["items"]}
    sea_ids = {x["id"] for x in sea_doc["items"]}

    # ---------- 1. 合并食材 ----------
    ing_ns = load_py("seed_ing.py")
    added_i = 0
    for row in ing_ns["NEW_ING"]:
        (iid, name, alias, cat, kcal, p, f, c, spoon, shelf, avoid) = row
        if iid in ing_ids:
            continue
        ing_doc["items"].append({
            "id": iid, "name": name, "alias": alias, "cat": cat,
            "per100": {"kcal": kcal, "p": p, "f": f, "c": c},
            "spoon": spoon, "shelf": shelf, "avoid": avoid,
        })
        ing_ids.add(iid)
        added_i += 1

    added_s = 0
    for row in ing_ns["NEW_SEA"]:
        (sid, name, alias, cat, kcal, p, f, c, spoon, shelf, pantry, avoid) = row
        if sid in sea_ids:
            continue
        sea_doc["items"].append({
            "id": sid, "name": name, "alias": alias, "cat": cat,
            "per100": {"kcal": kcal, "p": p, "f": f, "c": c},
            "spoon": spoon, "shelf": shelf, "isPantry": pantry, "avoid": avoid,
        })
        sea_ids.add(sid)
        added_s += 1

    # ---------- 2. 合并菜谱 ----------
    existing = {x["id"] for x in rec_doc["items"]}
    added_r, skipped, bad = 0, 0, []
    all_ids = ing_ids | sea_ids

    for fname in ("seed_r1.py", "seed_r2.py", "seed_r3.py"):
        ns = load_py(fname)
        for row in ns["R"]:
            (rid, name, cat, tags, flavor, time, diff, servings,
             ings_s, seas_s, steps_s, tips) = row
            if rid in existing:
                skipped += 1
                continue
            ings = parse_pairs(ings_s)
            seas = parse_pairs(seas_s)
            # 校验引用
            missing = [p[0] for p in ings + seas if p[0] not in all_ids]
            if missing:
                bad.append("%s 引用了不存在的 id: %s" % (rid, ",".join(missing)))
                continue
            if not ings:
                bad.append("%s 没有食材" % rid)
                continue
            steps = [s.strip() for s in steps_s.split("|") if s.strip()]
            rec_doc["items"].append({
                "id": rid, "name": name, "cat": cat,
                "tags": [t for t in tags.split("|") if t],
                "flavor": flavor, "time": time, "diff": diff, "servings": servings,
                "ings": ings, "seas": seas, "steps": steps, "tips": tips,
            })
            existing.add(rid)
            added_r += 1

    # ---------- 3. 分类补充 ----------
    cat_meta = rec_doc["meta"].setdefault("categories", {})
    cat_meta.setdefault("light", "轻食")
    cat_meta.setdefault("fitness", "健身餐")

    # ---------- 4. 写回 ----------
    for name, doc in (("ingredients.json", ing_doc), ("seasonings.json", sea_doc), ("recipes.json", rec_doc)):
        with open(os.path.join(DATA, name), "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print("新增食材 %d 条，调料 %d 条，菜谱 %d 道（跳过已存在 %d）" % (added_i, added_s, added_r, skipped))
    if bad:
        print("\n[!] %d 条被跳过：" % len(bad))
        for b in bad:
            print("   -", b)
        return 1
    total_i = len(ing_doc["items"])
    total_s = len(sea_doc["items"])
    total_r = len(rec_doc["items"])
    print("现在共：食材 %d / 调料 %d / 菜谱 %d" % (total_i, total_s, total_r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
