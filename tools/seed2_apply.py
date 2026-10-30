# -*- coding: utf-8 -*-
"""把第二批（350 道 + 新食材）合并进 data/*.json，并校验引用。"""
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

    ns = load_py("seed2_ing.py")
    ai = as_ = 0
    for row in ns["NEW_ING"]:
        (iid, name, alias, cat, kcal, p, f, c, spoon, shelf, avoid) = row
        if iid in ing_ids:
            continue
        ing_doc["items"].append({
            "id": iid, "name": name, "alias": alias, "cat": cat,
            "per100": {"kcal": kcal, "p": p, "f": f, "c": c},
            "spoon": spoon, "shelf": shelf, "avoid": avoid,
        })
        ing_ids.add(iid); ai += 1

    for row in ns["NEW_SEA"]:
        (sid, name, alias, cat, kcal, p, f, c, spoon, shelf, pantry, avoid) = row
        if sid in sea_ids:
            continue
        sea_doc["items"].append({
            "id": sid, "name": name, "alias": alias, "cat": cat,
            "per100": {"kcal": kcal, "p": p, "f": f, "c": c},
            "spoon": spoon, "shelf": shelf, "isPantry": pantry, "avoid": avoid,
        })
        sea_ids.add(sid); as_ += 1

    existing = {x["id"] for x in rec_doc["items"]}
    all_ids = ing_ids | sea_ids
    added, dup, bad = 0, 0, []
    cat_count = {}

    for i in range(1, 8):
        ns2 = load_py("seed2_r%d.py" % i)
        for row in ns2["R"]:
            (rid, name, cat, tags, flavor, time, diff, servings,
             ings_s, seas_s, steps_s, tips) = row
            if rid in existing:
                dup += 1
                continue
            ings = parse_pairs(ings_s)
            seas = parse_pairs(seas_s)
            miss = [p[0] for p in ings + seas if p[0] not in all_ids]
            if miss:
                bad.append("%s -> %s" % (rid, ",".join(miss)))
                continue
            if not ings:
                bad.append("%s 没有食材" % rid)
                continue
            rec_doc["items"].append({
                "id": rid, "name": name, "cat": cat,
                "tags": [t for t in tags.split("|") if t],
                "flavor": flavor, "time": time, "diff": diff, "servings": servings,
                "ings": ings, "seas": seas,
                "steps": [s.strip() for s in steps_s.split("|") if s.strip()],
                "tips": tips,
                "video": "",
            })
            existing.add(rid)
            added += 1
            cat_count[cat] = cat_count.get(cat, 0) + 1

    for name, doc in (("ingredients.json", ing_doc), ("seasonings.json", sea_doc), ("recipes.json", rec_doc)):
        with open(os.path.join(DATA, name), "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print("新增食材 %d / 调料 %d / 菜谱 %d（重复跳过 %d）" % (ai, as_, added, dup))
    print("分类分布:", ", ".join("%s=%d" % (k, v) for k, v in sorted(cat_count.items(), key=lambda x: -x[1])))
    if bad:
        print("\n[!] %d 条引用有问题：" % len(bad))
        for b in bad[:20]:
            print("   -", b)
        return 1
    print("现在共：食材 %d / 调料 %d / 菜谱 %d" % (len(ing_doc["items"]), len(sea_doc["items"]), len(rec_doc["items"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
