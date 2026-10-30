# -*- coding: utf-8 -*-
"""第三批：日常食材（菜市场常见、天天吃得着的）"""

# id, 名称, 别名, 分类, kcal, 蛋白, 脂肪, 碳水, 每勺克, 保质天, avoid
NEW_ING = [
    # ---- 猪肉部位 ----
    ("pork_ear", "猪耳朵", [], "meat", 190, 22.5, 11.0, 1.0, None, 3, ["pork"]),
    ("pork_tripe", "猪肚", [], "meat", 110, 15.2, 5.1, 0.7, None, 3, ["pork"]),
    ("pork_blood", "猪血", ["血豆腐"], "meat", 55, 12.2, 0.3, 0.9, None, 2, ["pork"]),
    ("pork_kidney", "猪腰", ["猪腰子"], "meat", 96, 15.4, 3.2, 1.4, None, 2, ["pork"]),
    ("pork_hock", "猪肘", ["蹄膀"], "meat", 320, 17.0, 28.0, 0.0, None, 3, ["pork"]),

    # ---- 禽类杂件 ----
    ("chicken_gizzard", "鸡胗", [], "poultry", 118, 19.2, 2.8, 4.0, None, 3, []),
    ("chicken_liver", "鸡肝", [], "poultry", 121, 16.6, 4.8, 2.8, None, 3, []),
    ("chicken_heart", "鸡心", [], "poultry", 172, 15.9, 11.8, 1.0, None, 3, []),
    ("duck_blood", "鸭血", [], "poultry", 108, 13.6, 0.4, 12.4, None, 3, []),
    ("quail", "鹌鹑", [], "poultry", 170, 20.2, 8.3, 0.0, None, 2, []),

    # ---- 牛羊 ----
    ("beef_tripe", "牛百叶", [], "meat", 72, 14.5, 1.6, 0.0, None, 2, ["beef"]),
    ("lamb_chop", "羊排", [], "meat", 230, 18.0, 17.0, 0.0, None, 3, ["lamb"]),

    # ---- 水产 ----
    ("carp", "鲤鱼", [], "seafood", 109, 17.6, 4.1, 0.5, None, 2, ["seafood"]),
    ("snakehead", "黑鱼", ["乌鱼"], "seafood", 85, 18.5, 1.2, 0.0, None, 2, ["seafood"]),
    ("loach", "泥鳅", [], "seafood", 96, 17.9, 2.0, 0.0, None, 2, ["seafood"]),
    ("river_eel", "黄鳝", ["鳝鱼"], "seafood", 89, 18.0, 1.4, 0.1, None, 2, ["seafood"]),
    ("fish_ball", "鱼丸", [], "seafood", 120, 12.0, 3.5, 9.0, None, 30, ["seafood", "gluten"]),
    ("crab_stick", "蟹棒", [], "seafood", 130, 8.0, 1.0, 20.0, None, 180, ["seafood"]),
    ("dried_scallop", "干贝", ["瑶柱"], "seafood", 264, 55.6, 2.4, 5.3, None, 300, ["seafood"]),
    ("razor_clam", "蛏子", [], "seafood", 40, 7.3, 0.3, 2.1, None, 1, ["seafood"]),
    ("dried_squid", "鱿鱼干", [], "seafood", 313, 60.0, 4.0, 8.0, None, 300, ["seafood"]),

    # ---- 蔬菜 ----
    ("garlic_bolt", "蒜苔", ["蒜薹"], "veg", 61, 2.0, 0.1, 15.4, None, 7, []),
    ("cowpea", "豇豆", ["长豆角"], "veg", 34, 2.9, 0.3, 5.8, None, 5, []),
    ("choy_sum", "菜心", ["广东菜心"], "veg", 20, 2.8, 0.4, 2.0, None, 4, []),
    ("baby_cabbage", "娃娃菜", [], "veg", 13, 1.4, 0.1, 2.4, None, 10, []),
    ("shepherd_purse", "荠菜", [], "veg", 31, 2.9, 0.4, 4.7, None, 3, []),
    ("water_bamboo", "茭白", [], "veg", 23, 1.2, 0.2, 5.9, None, 6, []),
    ("water_chestnut", "荸荠", ["马蹄"], "veg", 61, 1.2, 0.2, 14.2, None, 15, []),
    ("winter_shoot", "冬笋", [], "veg", 40, 4.1, 0.1, 6.5, None, 10, []),
    ("mustard_green", "芥菜", [], "veg", 24, 2.0, 0.4, 3.6, None, 5, []),
    ("amaranth", "苋菜", [], "veg", 25, 2.8, 0.3, 3.2, None, 3, []),
    ("pea_shoot", "豌豆尖", ["豆苗"], "veg", 34, 4.9, 0.4, 4.3, None, 3, []),
    ("mustard_tuber", "榨菜", ["榨菜丝"], "veg", 29, 2.2, 0.3, 6.5, None, 180, []),

    # ---- 豆制品 ----
    ("tofu_puff", "油豆腐", ["豆泡"], "soy", 245, 17.0, 17.6, 4.9, None, 5, ["soy"]),
    ("suji", "素鸡", [], "soy", 194, 16.5, 12.5, 4.2, None, 5, ["soy"]),

    # ---- 主食 / 干货 ----
    ("sweet_potato_noodle", "红薯粉条", [], "staple", 337, 0.5, 0.1, 84.2, None, 300, []),
    ("instant_noodle", "方便面", [], "staple", 472, 9.5, 21.1, 61.6, None, 180, ["gluten"]),
    ("youtiao", "油条", [], "staple", 388, 6.9, 17.6, 51.0, None, 2, ["gluten"]),
    ("dried_bamboo", "笋干", [], "dry", 253, 26.0, 1.1, 53.4, None, 300, []),
    ("meigancai", "梅干菜", [], "dry", 259, 13.4, 1.3, 47.0, None, 300, []),

    # ---- 蛋奶 ----
    ("cream", "淡奶油", [], "dairy", 345, 2.1, 37.0, 2.8, 15, 14, ["dairy"]),
    ("condensed_milk", "炼乳", [], "dairy", 321, 7.9, 8.7, 55.4, 20, 180, ["dairy"]),

    # ---- 水果 ----
    ("tangerine", "橘子", ["桔子"], "fruit", 44, 0.8, 0.1, 11.5, None, 15, []),
    ("peach", "桃子", [], "fruit", 42, 0.9, 0.1, 10.9, None, 7, []),
    ("lychee", "荔枝", [], "fruit", 71, 0.9, 0.2, 16.6, None, 5, []),
    ("persimmon", "柿子", [], "fruit", 71, 0.4, 0.1, 18.5, None, 10, []),
]

# 日常调料补充
NEW_SEA = [
    ("braising_pack", "卤料包", ["卤料"], "spice", 250, 8.0, 5.0, 40.0, 8, 300, False, []),
    ("sichuan_pepper_oil", "花椒油", [], "oil", 884, 0.0, 100.0, 0.0, 12, 365, False, []),
    ("zhajiang", "炸酱", [], "paste", 180, 10.0, 8.0, 18.0, 18, 180, False, ["soy", "gluten"]),
]
