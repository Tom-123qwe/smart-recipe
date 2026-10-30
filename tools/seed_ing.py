# -*- coding: utf-8 -*-
"""新增食材与调料（抗炎 / 健身 / 控糖 / 儿童方向需要）。

字段顺序与 data/ingredients.json 保持一致：
id, 名称, 别名, 分类, kcal, 蛋白, 脂肪, 碳水, 每勺克数, 保质天数, avoid
"""

# 食材：id, name, alias, cat, kcal, p, f, c, spoon, shelf, avoid
NEW_ING = [
    # ---- 水产（omega-3 主力）----
    ("salmon", "三文鱼", [], "seafood", 208, 20.0, 13.0, 0.0, None, 2, ["seafood"]),
    ("cod", "鳕鱼", ["银鳕鱼"], "seafood", 88, 20.4, 0.5, 0.5, None, 2, ["seafood"]),
    ("mackerel", "鲭鱼", ["青花鱼"], "seafood", 205, 19.0, 13.9, 0.0, None, 2, ["seafood"]),
    ("tuna_can", "水浸金枪鱼罐头", ["金枪鱼罐头"], "seafood", 116, 26.0, 1.0, 0.0, None, 240, ["seafood"]),
    ("scallop", "扇贝", ["带子"], "seafood", 60, 11.1, 0.6, 2.6, None, 2, ["seafood"]),
    ("nori", "海苔", ["紫菜片"], "seafood", 177, 29.4, 4.8, 33.4, 2, 300, ["seafood"]),

    # ---- 蛋奶蛋白 ----
    ("egg_white", "蛋清", ["蛋白液"], "egg", 52, 10.9, 0.2, 0.7, None, 3, ["egg"]),
    ("greek_yogurt", "希腊酸奶", ["无糖希腊酸奶"], "dairy", 59, 10.0, 0.4, 3.6, None, 14, ["dairy"]),
    ("yogurt", "无糖酸奶", [], "dairy", 62, 3.5, 3.3, 4.7, None, 14, ["dairy"]),
    ("cheese", "马苏里拉奶酪", ["芝士"], "dairy", 300, 22.0, 22.0, 2.5, None, 60, ["dairy"]),
    ("skim_milk", "低脂牛奶", [], "dairy", 42, 3.4, 1.0, 5.0, 15, 7, ["dairy"]),
    ("soy_milk", "无糖豆浆", [], "soy", 31, 3.0, 1.6, 1.2, 15, 3, ["soy"]),
    ("protein_powder", "乳清蛋白粉", ["蛋白粉"], "dairy", 380, 75.0, 5.0, 8.0, 10, 365, ["dairy"]),

    # ---- 水果（多酚 / 抗氧化）----
    ("avocado", "牛油果", ["鳄梨"], "fruit", 160, 2.0, 15.0, 9.0, None, 5, []),
    ("blueberry", "蓝莓", [], "fruit", 57, 0.7, 0.3, 14.5, None, 6, []),
    ("strawberry", "草莓", [], "fruit", 32, 0.7, 0.3, 7.7, None, 4, []),
    ("kiwi", "猕猴桃", ["奇异果"], "fruit", 61, 1.1, 0.5, 14.7, None, 10, []),
    ("orange", "橙子", [], "fruit", 48, 0.8, 0.2, 11.0, None, 12, []),
    ("pomegranate", "石榴", [], "fruit", 83, 1.7, 1.2, 18.7, None, 15, []),

    # ---- 深色蔬菜 ----
    ("kale", "羽衣甘蓝", [], "veg", 50, 3.3, 0.9, 8.8, None, 5, []),
    ("purple_cabbage", "紫甘蓝", [], "veg", 25, 1.4, 0.2, 6.1, None, 12, []),
    ("beetroot", "甜菜根", [], "veg", 43, 1.6, 0.2, 9.6, None, 14, []),
    ("zucchini", "西葫芦", [], "veg", 19, 0.8, 0.2, 3.8, None, 6, []),
    ("konjac", "魔芋", ["魔芋丝"], "veg", 12, 0.1, 0.0, 3.0, None, 30, []),

    # ---- 全谷物 / 豆类 ----
    ("quinoa", "藜麦", [], "staple", 368, 14.1, 6.1, 64.2, 15, 240, []),
    ("chickpea", "鹰嘴豆", [], "staple", 340, 21.2, 4.2, 60.9, None, 240, []),
    ("lentil", "扁豆", ["小扁豆"], "staple", 353, 24.6, 1.1, 60.0, None, 240, []),
    ("black_rice", "黑米", [], "staple", 341, 9.4, 2.5, 72.2, 18, 240, []),
    ("brown_rice", "糙米", [], "staple", 348, 7.7, 2.7, 77.2, 18, 240, []),
    ("soba", "荞麦面", [], "staple", 340, 13.0, 2.3, 71.0, None, 200, ["gluten"]),
    ("whole_wheat_bread", "全麦面包", [], "staple", 247, 13.0, 3.4, 41.0, None, 5, ["gluten"]),
    ("whole_wheat_pasta", "全麦意面", [], "staple", 348, 13.0, 2.5, 70.0, None, 240, ["gluten"]),
    ("pasta", "意大利面", [], "staple", 371, 13.0, 1.5, 74.7, None, 240, ["gluten"]),
    ("canned_tomato", "番茄罐头", ["去皮番茄"], "veg", 32, 1.6, 0.3, 6.4, None, 300, []),
    ("purple_sweet_potato", "紫薯", [], "staple", 82, 1.6, 0.2, 18.8, None, 20, []),
    ("taro", "芋头", [], "veg", 79, 2.2, 0.2, 17.1, None, 15, []),
    ("white_fungus", "银耳", [], "mushroom", 200, 10.0, 1.4, 67.3, None, 300, ["mushroom"]),

    # ---- 坚果 / 种子 ----
    ("almond", "巴旦木", ["杏仁"], "nut", 579, 21.2, 49.9, 21.6, 8, 180, ["nut"]),
    ("cashew", "腰果", [], "nut", 553, 18.2, 43.8, 30.2, 8, 180, ["nut"]),
    ("pine_nut", "松子", [], "nut", 673, 13.7, 68.4, 13.1, 8, 180, ["nut"]),
    ("pumpkin_seed", "南瓜籽", [], "nut", 559, 30.2, 49.0, 10.7, 8, 180, ["nut"]),
    ("chia", "奇亚籽", [], "nut", 486, 16.5, 30.7, 42.1, 8, 365, []),
    ("flaxseed", "亚麻籽", ["亚麻籽粉"], "nut", 534, 18.3, 42.2, 28.9, 8, 240, []),
]

# 调料：id, name, alias, cat, kcal, p, f, c, spoon, shelf, isPantry, avoid
NEW_SEA = [
    ("olive_oil", "橄榄油", [], "oil", 884, 0.0, 100.0, 0.0, 14, 365, True, []),
    ("turmeric", "姜黄粉", [], "spice", 312, 9.7, 3.3, 67.1, 4, 300, False, []),
    ("cinnamon_powder", "肉桂粉", [], "spice", 247, 4.0, 1.2, 80.6, 4, 300, False, []),
    ("erythritol", "代糖", ["赤藓糖醇"], "basic", 0, 0.0, 0.0, 0.0, 10, 720, False, []),
    ("miso", "味噌", ["白味噌"], "paste", 199, 12.8, 6.0, 26.5, 18, 240, False, ["soy"]),
    ("cocoa", "无糖可可粉", [], "powder", 228, 19.6, 13.7, 57.9, 5, 365, False, []),
    ("mustard", "黄芥末酱", [], "sauce", 66, 4.0, 3.3, 5.8, 15, 240, False, ["gluten"]),
    ("apple_cider", "苹果醋", [], "vinegar", 22, 0.0, 0.0, 0.9, 15, 365, False, []),
]
