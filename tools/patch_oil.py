# -*- coding: utf-8 -*-
"""为油炸类菜谱的用油标注「计入营养比例」（第三个数组元素）。

油炸时大部分油会被倒掉，只有约 12% 被食材吸收，直接按 200g 油计算会让热量虚高。
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "data", "recipes.json")

s = open(P, encoding="utf-8").read()
pairs = [
    # 糖醋里脊：200g 油复炸
    ('["salt", 2], ["oil", 200]]', '["salt", 2], ["oil", 200, 0.12]]'),
    # 蒜香排骨：200g 油复炸
    ('["starch", 20], ["oil", 200]]', '["starch", 20], ["oil", 200, 0.12]]'),
    # 辣子鸡：250g 油复炸
    ('["sugar", 5], ["oil", 250]]', '["sugar", 5], ["oil", 250, 0.12]]'),
    # 地三鲜：60g 油滑炸
    ('["salt", 3], ["oil", 60]]', '["salt", 3], ["oil", 60, 0.3]]'),
    # 鱼香茄子：60g 油宽油炸
    ('["starch", 12], ["oil", 60]]', '["starch", 12], ["oil", 60, 0.3]]'),
]
for a, b in pairs:
    if a not in s:
        print("!! 未找到片段:", a)
    s = s.replace(a, b)

json.loads(s)  # 语法自检
open(P, "w", encoding="utf-8", newline="\n").write(s)
print("已更新油炸用油折算")
