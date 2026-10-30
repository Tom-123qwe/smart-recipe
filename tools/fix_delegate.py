# -*- coding: utf-8 -*-
"""修复：全局数据变化触发重渲染后，视图里的事件委托失效。

做法：
1. main.js 重渲染时复用同一个容器节点（不再替换），事件委托才能留住；
2. 每个视图的 root 级监听只绑一次（用 JS 属性做标记），元素级监听每次渲染重绑。
"""
import os
import re

BASE = r"C:\Users\33155\Documents\deepseek-harness\default-workspace\smart-recipe"


def patch(path, pairs):
    p = os.path.join(BASE, path)
    s = open(p, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            print("  !! 未匹配 %s :: %s" % (path, old.split("\n")[0][:60]))
            continue
        s = s.replace(old, new, 1)
    open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("  patched", path)


# ---------- 1. main.js：原地重渲染 ----------
patch("assets/js/main.js", [
    ("""  onChange(() => {
    if (booting) return;
    const v = VIEWS[current];
    if (!v || !v.auto) return;
    const root = document.getElementById(current + 'Root');
    if (!root) return;
    try { v.mod.render(root); } catch (e) { console.error(e); }
  });""",
     """  // 原地重渲染：复用同一个容器节点，视图里的事件委托才不会失效
  onChange(() => {
    if (booting) return;
    const v = VIEWS[current];
    if (!v || !v.auto) return;
    const root = document.getElementById(current + 'Root');
    if (!root) return;
    // 二级页的容器里还有返回条和内层 wrapper，直接重渲染整个容器会丢结构，
    // 所以二级页交给它自己的模块重画内层
    const target = root.querySelector('.sub-inner') || root;
    try { v.mod.render(target); } catch (e) { console.error(e); }
  });"""),
])

# ---------- 2. 各视图：root 级监听只绑一次 ----------
DELEGATE = {
    "assets/js/views/home.js": [("root.addEventListener('click', async (e) => {", "click")],
    "assets/js/views/library.js": [("root.addEventListener('click', (e) => {", "click")],
    "assets/js/views/kitchen.js": [("root.addEventListener('click', (e) => {", "click")],
    "assets/js/views/random.js": [("root.addEventListener('click', (e) => {", "click")],
    "assets/js/views/plan.js": [("root.addEventListener('click', (e) => {", "click")],
    "assets/js/views/settings.js": [("root.addEventListener('click', async (e) => {", "click")],
    "assets/js/views/me.js": [("root.addEventListener('click', (e) => {", "click")],
    "assets/js/views/editor.js": [
        ("root.addEventListener('click', async (e) => {", "click"),
        ("root.addEventListener('input', (e) => {", "input"),
        ("root.addEventListener('change', () => preview(root));", "change"),
    ],
    "assets/js/views/collection.js": [
        ("root.addEventListener('click', async (e) => {", "click"),
        ("root.addEventListener('change', async (e) => {", "change"),
    ],
}

for path, items in DELEGATE.items():
    p = os.path.join(BASE, path)
    s = open(p, encoding="utf-8").read()
    for sig, kind in items:
        if sig not in s:
            print("  !! 未匹配 %s :: %s" % (path, sig[:50]))
            continue
        guard = "if (!root._%sBound) { root._%sBound = true; " % (kind, kind)
        # 在监听调用的结尾补上闭合大括号：定位该监听的作用域结束比较麻烦，
        # 改用包裹写法 —— 把 "root.addEventListener(...)" 换成 "if (!root._xBound) { root._xBound = true; root.addEventListener(...) }"
        idx = s.index(sig)
        # 找到这个 addEventListener 调用的结束（配平括号）
        start = idx + len("root.addEventListener")
        depth = 0
        i = start
        while i < len(s):
            ch = s[i]
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        end = i + 1
        if end < len(s) and s[end] == ";":
            end += 1
        block = s[idx:end]
        wrapped = "if (!root._%sBound) { root._%sBound = true; %s }" % (kind, kind, block)
        s = s[:idx] + wrapped + s[end:]
    open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("  patched", path)

print("完成")
