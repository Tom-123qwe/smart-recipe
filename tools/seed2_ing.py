# -*- coding: utf-8 -*-
"""第二批扩充：为 350 道新菜补充的食材与调料。"""

# id, 名称, 别名, 分类, kcal, 蛋白, 脂肪, 碳水, 每勺克, 保质天, avoid
NEW_ING = [
    # ---- 水产 ----
    ("sardine", "沙丁鱼", [], "seafood", 208, 24.6, 11.5, 0.0, None, 2, ["seafood"]),
    ("yellow_croaker", "黄花鱼", ["黄鱼"], "seafood", 97, 17.7, 2.5, 0.8, None, 2, ["seafood"]),
    ("pomfret", "鲳鱼", ["平鱼"], "seafood", 140, 18.5, 7.3, 0.0, None, 2, ["seafood"]),
    ("tilapia", "罗非鱼", [], "seafood", 98, 18.4, 1.5, 2.8, None, 2, ["seafood"]),
    ("crab", "螃蟹", ["梭子蟹"], "seafood", 95, 17.5, 2.6, 2.3, None, 1, ["seafood"]),
    ("mussel", "青口贝", ["贻贝"], "seafood", 86, 11.9, 2.2, 6.1, None, 1, ["seafood"]),
    ("oyster_meat", "生蚝", ["牡蛎"], "seafood", 73, 10.9, 1.5, 6.2, None, 1, ["seafood"]),
    ("eel", "鳗鱼", [], "seafood", 236, 18.6, 16.0, 2.3, None, 2, ["seafood"]),
    ("wakame", "裙带菜", [], "seafood", 45, 3.0, 0.6, 6.5, None, 240, ["seafood"]),

    # ---- 肉蛋 ----
    ("turkey_breast", "火鸡胸", [], "poultry", 135, 23.0, 3.5, 0.0, None, 3, []),
    ("beef_sirloin", "西冷牛排", [], "meat", 250, 21.0, 18.0, 0.0, None, 3, ["beef"]),
    ("ham", "火腿片", [], "meat", 175, 16.0, 10.0, 4.0, None, 30, ["pork"]),
    ("quail_egg", "鹌鹑蛋", [], "egg", 160, 12.8, 11.1, 2.1, None, 21, ["egg"]),

    # ---- 豆与植物蛋白 ----
    ("tempeh", "天贝", [], "soy", 193, 19.0, 11.0, 9.0, None, 7, ["soy"]),
    ("seitan", "面筋", ["烤麸"], "soy", 143, 25.0, 1.0, 6.0, None, 5, ["gluten"]),
    ("black_bean", "黑豆", [], "soy", 341, 36.0, 15.9, 33.6, None, 300, ["soy"]),
    ("red_bean", "红豆", ["赤小豆"], "staple", 324, 20.2, 0.6, 63.4, None, 300, []),
    ("mung_bean", "绿豆", [], "staple", 329, 21.6, 0.8, 62.0, None, 300, []),
    ("edamame", "毛豆", [], "veg", 131, 13.1, 5.0, 10.5, None, 3, ["soy"]),

    # ---- 蔬菜菌菇 ----
    ("water_spinach", "空心菜", [], "veg", 23, 2.2, 0.3, 3.6, None, 3, []),
    ("celtuce", "莴笋", [], "veg", 15, 1.0, 0.1, 2.8, None, 7, []),
    ("garland", "茼蒿", [], "veg", 21, 1.9, 0.3, 3.9, None, 3, []),
    ("leek", "大葱", [], "veg", 33, 1.7, 0.3, 6.5, 5, 10, []),
    ("shimeji", "蟹味菇", [], "mushroom", 22, 2.0, 0.2, 4.5, None, 5, ["mushroom"]),
    ("button_mushroom", "口蘑", ["白蘑菇"], "mushroom", 22, 3.1, 0.3, 3.3, None, 5, ["mushroom"]),
    ("oyster_mushroom", "平菇", [], "mushroom", 24, 1.9, 0.3, 4.6, None, 5, ["mushroom"]),
    ("lily_bulb", "百合", [], "veg", 166, 3.2, 0.1, 38.8, None, 20, []),
    ("lotus_seed", "莲子", [], "dry", 350, 17.2, 2.0, 67.2, None, 300, []),
    ("job_tears", "薏米", [], "staple", 361, 12.8, 3.3, 71.1, 16, 300, []),
    ("tomato_dried", "番茄干", ["油浸番茄干"], "veg", 213, 5.0, 14.0, 18.0, None, 180, []),
    ("olive_green", "橄榄", [], "fruit", 145, 0.8, 15.3, 3.8, None, 180, []),
    ("pickled_cucumber", "酸黄瓜", [], "veg", 16, 0.7, 0.2, 2.6, None, 180, []),
    ("basil", "罗勒", ["九层塔"], "veg", 23, 3.2, 0.4, 2.7, 3, 4, []),
    ("parsley", "欧芹", [], "veg", 36, 3.0, 0.8, 6.3, 3, 6, []),

    # ---- 谷物主食 ----
    ("rice_cake", "年糕", [], "staple", 156, 3.3, 0.6, 34.7, None, 30, []),
    ("mantou", "馒头", [], "staple", 223, 7.0, 1.1, 47.0, None, 3, ["gluten"]),
    ("whole_wheat_flour", "全麦面粉", [], "staple", 340, 13.2, 2.5, 71.0, 9, 240, ["gluten"]),
    ("cornmeal", "玉米面", [], "staple", 341, 8.0, 3.8, 73.1, 9, 240, []),
    ("bagel", "贝果", [], "staple", 257, 10.0, 1.6, 50.5, None, 5, ["gluten"]),
    ("oat_bran", "燕麦麸", [], "staple", 246, 17.3, 7.0, 66.0, 8, 240, ["gluten"]),
    ("barley", "大麦米", [], "staple", 354, 12.5, 2.3, 73.0, 18, 300, ["gluten"]),
    ("buckwheat", "荞麦米", [], "staple", 337, 13.3, 2.3, 71.0, 18, 300, []),
    ("rice_noodle_thick", "宽米粉", ["河粉"], "staple", 348, 7.3, 0.4, 80.0, None, 200, []),

    # ---- 水果 ----
    ("banana", "香蕉", [], "fruit", 93, 1.4, 0.2, 22.0, None, 6, []),
    ("grape", "葡萄", [], "fruit", 43, 0.5, 0.2, 10.3, None, 6, []),
    ("pear", "梨", [], "fruit", 51, 0.4, 0.2, 13.3, None, 15, []),
    ("mango", "芒果", [], "fruit", 60, 0.8, 0.4, 15.0, None, 7, []),
    ("watermelon", "西瓜", [], "fruit", 31, 0.5, 0.1, 7.9, None, 5, []),
    ("papaya", "木瓜", [], "fruit", 30, 0.4, 0.1, 7.2, None, 6, []),
    ("lime", "青柠", [], "fruit", 30, 0.7, 0.2, 10.5, None, 15, []),
    ("grapefruit", "西柚", [], "fruit", 33, 0.8, 0.1, 8.4, None, 15, []),
    ("dragon_fruit", "火龙果", [], "fruit", 55, 1.1, 0.2, 13.3, None, 7, []),

    # ---- 乳与坚果酱 ----
    ("cream_cheese", "奶油奶酪", [], "dairy", 342, 6.2, 34.4, 4.1, 15, 30, ["dairy"]),
    ("cottage_cheese", "乡村奶酪", [], "dairy", 98, 11.1, 4.3, 3.4, None, 14, ["dairy"]),
    ("peanut_butter", "花生酱", [], "nut", 588, 25.1, 50.4, 20.0, 16, 180, ["peanut"]),
]

# 调料：id, 名称, 别名, 分类, kcal, p, f, c, 每勺克, 保质天, 常备, avoid
NEW_SEA = [
    ("coconut_oil", "椰子油", [], "oil", 862, 0.0, 100.0, 0.0, 14, 365, False, []),
    ("chili_oil", "辣椒油", [], "oil", 900, 1.0, 99.0, 1.0, 12, 240, False, ["spicy"]),
    ("tomato_paste", "番茄膏", [], "sauce", 82, 4.3, 0.5, 18.9, 16, 240, False, []),
    ("curry_powder", "咖喱粉", [], "spice", 325, 12.7, 13.9, 55.8, 4, 300, False, []),
    ("oregano", "牛至", ["披萨草"], "spice", 265, 9.0, 4.3, 68.9, 3, 300, False, []),
    ("rosemary", "迷迭香", [], "spice", 131, 3.3, 5.9, 20.7, 3, 300, False, []),
    ("thyme", "百里香", [], "spice", 101, 5.6, 1.7, 24.5, 3, 300, False, []),
    ("balsamic", "黑醋", [], "vinegar", 88, 0.5, 0.0, 17.0, 15, 365, False, []),
    ("gochujang", "韩式辣酱", [], "paste", 219, 5.0, 3.0, 43.0, 18, 240, False, ["spicy", "soy"]),
    ("baking_powder", "泡打粉", [], "powder", 53, 0.0, 0.0, 27.7, 4, 365, False, []),
    ("maple_syrup", "枫糖浆", [], "basic", 260, 0.0, 0.1, 67.0, 20, 365, False, []),
    ("vanilla", "香草精", [], "powder", 288, 0.1, 0.1, 12.7, 5, 720, False, []),
    ("yeast_nutritional", "营养酵母", [], "powder", 385, 45.0, 5.0, 36.0, 5, 300, False, []),
]
