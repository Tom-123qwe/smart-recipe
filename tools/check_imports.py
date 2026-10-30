# -*- coding: utf-8 -*-
"""静态检查 ES Module 的 import / export 是否对得上（避免运行时缺导出）。"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, "assets", "js")

DEF_FN = re.compile(r"export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)")
DEF_VAR = re.compile(r"export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)")
DEF_CLASS = re.compile(r"export\s+class\s+([A-Za-z0-9_$]+)")
DEF_LIST = re.compile(r"export\s*\{([^}]*)\}")
IMP = re.compile(r"import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"]")


def exports_of(path):
    src = open(path, encoding="utf-8").read()
    names = set()
    for rx in (DEF_FN, DEF_VAR, DEF_CLASS):
        names.update(rx.findall(src))
    for group in DEF_LIST.findall(src):
        for part in group.split(","):
            part = part.strip()
            if not part:
                continue
            names.add(part.split(" as ")[-1].strip())
    return names


def main():
    problems = []
    cache = {}
    for dirpath, _, files in os.walk(JS):
        for f in files:
            if not f.endswith(".js"):
                continue
            path = os.path.join(dirpath, f)
            src = open(path, encoding="utf-8").read()
            for group, rel in IMP.findall(src):
                if not rel.startswith("."):
                    continue
                target = os.path.normpath(os.path.join(dirpath, rel))
                if target not in cache:
                    if not os.path.exists(target):
                        problems.append("%s: 找不到模块 %s" % (f, rel))
                        cache[target] = set()
                        continue
                    cache[target] = exports_of(target)
                avail = cache[target]
                for raw in group.split(","):
                    name = raw.strip()
                    if not name:
                        continue
                    name = name.split(" as ")[0].strip()
                    if name not in avail:
                        problems.append("%s: 从 %s 导入的 `%s` 不存在" % (f, rel, name))
    if problems:
        print("发现 %d 个问题：" % len(problems))
        for p in problems:
            print("  -", p)
    else:
        print("[OK] import / export 全部匹配")
    return len(problems)


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
