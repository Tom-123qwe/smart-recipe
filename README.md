# 家常菜谱 · 智能厨房

做饭最烦的是「今天吃什么」。这个网页只解决这一件事：打开、按一下、看做法和热量。
顺带能记冰箱、排三餐、生成购物清单。**不用注册，不用先填一堆表**，全部在你的浏览器里跑，也能离线用。

## 怎么用（三个入口）

| 页面 | 你能做什么 |
| --- | --- |
| **今天** | 打开就一个按钮「随便来一道」，抽到不想吃就「换一个」，看着顺眼点「就它了」看做法。下面还有今天三餐的建议和"快过期了"提醒。 |
| **菜谱** | 695 道菜：家常菜之外还有抗炎、健身增肌、减脂、控糖、儿童餐、一人食、便当、纯素。搜菜名或食材、按分类和场景筛。点开任意一道，拖份数滑块，克数和热量会跟着变。 |
| **我的** | 冰箱里记了啥、收藏了哪些、写自己的菜谱、导出备份。**不录冰箱也能用**，只是推荐不会考虑你现有材料。 |

三句话就能上手：**不用注册 → 不用先填表 → 直接抽一道**。

## 界面预览

| 今天 | 抽到一道 |
| --- | --- |
| ![今天](preview/prev-home.png) | ![抽菜](preview/prev-pick.png) |

| 菜谱 | 我的 |
| --- | --- |
| ![菜谱](preview/prev-recipes.png) | ![我的](preview/prev-me.png) |

> `preview/` 里是自动截图，删掉不影响使用。

---

## 一、快速开始

> 本项目使用原生 ES Module，**需要通过 HTTP 打开**（浏览器不允许 `file://` 加载模块）。
> 双击 `index.html` 会看到一行提示，照着做即可。

### 方式 1：本地起个静态服务

```bash
# 任选一种，然后在浏览器打开 http://localhost:8080
python -m http.server 8080
npx serve .
```

### 方式 2：临时分享给别人（本机当服务器）

```powershell
powershell -File tools\share.ps1
```

脚本会自动起本地静态服务 + Cloudflare 快速隧道，并打印一个
`https://xxx.trycloudflare.com` 链接，发给别人就能打开。

- 只要本机开着、能上网就行；关机或断网后链接失效，重跑脚本会得到新链接
- 停止分享：`Get-Process cloudflared | Stop-Process -Force`
- 每个访客的库存、收藏都存在**他自己的浏览器**里，互相看不到

### 方式 3：部署到 GitHub Pages（永久链接）

**A. 一条命令（推荐）** —— 在 GitHub 生成一个 Personal Access Token（只勾 `repo`），然后：

```powershell
powershell -File tools\deploy-github.ps1 -Token "ghp_你的token" -Repo smart-recipe
```

脚本会用 GitHub API 建仓库、上传全部文件、开 Pages，最后打印
`https://用户名.github.io/smart-recipe/`。不需要本地安装 git。

**B. 手动** —— 仓库页面 → Add file → Upload files，把整个目录拖进去（**不要拖 `tools/bin/`**，那里是 52MB 的隧道程序），
然后 Settings → Pages → Source 选 `main` / `(root)`。

---

## 二、功能清单

### 今天（首页）
- 一键随机抽菜，可按「30 分钟内 / 想吃肉 / 清淡点 / 冰箱里有什么」缩小范围
- 抽到后当场换一道、收藏、或直接看做法
- 今天三餐的建议（早 25% / 午 40% / 晚 35%，按目标热量自动配），每餐可单独「换」
- 冰箱里有临期食材时，提示并推荐**用得最多**的菜

### 菜谱
- 695 道菜，营养值按食材库每 100g 实时累加
- 搜索支持菜名、口味、食材名
- 分类 10 个（荤/素/蛋豆/汤/主食/早餐/凉菜/小吃/轻食/健身餐）
- 场景 8 个：抗炎、增肌、减脂、高蛋白、控糖、快手、小孩爱吃、纯素
- 忌口收在一个按钮里，选了就自动隐藏
- 详情页：份数滑块实时重算克数与热量、克/勺切换、点任意食材看它的营养贡献

### 695 道菜的构成

| 方向 | 道数 |
| --- | --- |
| 主食 | 102 |
| 早餐 | 98 |
| 控糖 | 94 |
| 增肌 | 104 |
| 减脂 | 155 |
| 抗炎 | 105 |
| 高蛋白 | 274 |
| 日常家常菜 | 70 |

（同一道菜可同时属于多个方向，比如「藜麦鸡胸饭」既是主食也是增肌、高蛋白。）

### 日常食材（第三批）

菜市场最常见的那一类，共 46 种：猪耳朵/猪肚/猪血/猪腰/蹄膀、鸡胗/鸡肝/鸡心、鸭血、鹌鹑、牛百叶、羊排、
鲤鱼/黑鱼/泥鳅/黄鳝/鲳鱼/蛏子/鱼丸、蒜苔/豇豆/菜心/娃娃菜/荠菜/茭白/荸荠/冬笋/芥菜/苋菜/豌豆尖/榨菜、
油豆腐/素鸡、红薯粉条/方便面/油条、笋干/梅干菜、淡奶油/炼乳、橘子/桃子/荔枝/柿子。

对应 70 道家常菜：卤猪耳、爆炒腰花、猪肚鸡、鸭血粉丝汤、响油鳝丝、蒜苔炒肉、干煸豇豆、
油焖茭白、冬笋炒腊肉、油豆腐烧肉、猪肉炖粉条、梅干菜扣肉、荠菜馄饨……

### 早期 200 道新增菜的方向

| 方向 | 道数 | 特点 |
| --- | --- | --- |
| 抗炎健康 | 40 | 三文鱼/鲭鱼补 omega-3，蓝莓、甜菜根、姜黄、橄榄油抗炎组合 |
| 健身增肌 | 36 | 高蛋白低脂，水煮/蒸/煎为主，蛋白粉、希腊酸奶、鸡胸牛肉 |
| 减脂轻卡 | 30 | 魔芋、西葫芦、清蒸，主打低热量高饱腹 |
| 控糖低 GI | 27 | 藜麦、糙米、黑米、鹰嘴豆、扁豆替换精制主食 |
| 儿童餐 | 30 | 少刺少辣、软烂好嚼、带一点甜口 |
| 一人食快手 | 25 | 15 分钟内、一锅出 |
| 便当带饭 | 10 | 隔夜不变味、微波不塌 |
| 纯素 | 10 | 豆腐、菌菇、鹰嘴豆 |

### 抖音视频

每道菜详情页底部都有 **「▶ 抖音找做法」**，点击按菜名跳到抖音搜索结果（新标签打开）。

- 这是**搜索跳转**，不是预先绑定某个视频——所以不会失效、也不会指向无关内容
- 想直接跳到指定视频：在 `data/recipes.json` 里给该菜加 `"video": "https://..."`，按钮会自动变成「看视频」直达
- 页面本身仍然不请求抖音，只有你点按钮才会跳出去

### 我的
- **冰箱里有什么**：快捷录入（输入名字自动补全 + 带出建议保质期）、批量粘贴导入、临期高亮、加减按钮按单位步进
- **我的收藏**：汇总成购物清单时自动扣掉库存里已有的量
- **三餐安排**：目标热量 + 生成搭配，可锁定某一餐
- **写自己的菜谱**：选食材填克数，右侧实时出热量与三大营养素
- **设置与备份**：亮/暗/跟随系统、完整 JSON 导出导入、导入菜谱 JSON 扩充菜库

### 其他
- 亮色 / 暗色 / 跟随系统，首屏无闪烁
- 手机自适应：3 个入口直接显示，不需要点汉堡菜单
- 全部离线：图标、字体、占位图、数据都在本地

---
## 三、目录结构

```
smart-recipe/
├── index.html                  # 单页面外壳（导航 + 7 个视图容器）
├── .nojekyll                   # 关闭 GitHub Pages 的 Jekyll 处理
├── package.json                # 仅用于本地脚本（ESM 语法检查），不影响部署
├── assets/
│   ├── css/
│   │   ├── tailwind.min.css    # TailwindCSS 2.2.19 预构建（本地）
│   │   └── app.css             # 设计层：变量 / 组件 / 动效 / 打印样式
│   ├── fa/                     # FontAwesome 6.5.2 本地字体包（css + webfonts）
│   ├── img/                    # 内置占位图（SVG 插画，10 张）+ logo
│   └── js/
│       ├── main.js             # 入口：3 个一级页 + 二级页路由、主题
│       ├── core/
│       │   ├── store.js        # IndexedDB 封装（含 localStorage 兜底）
│       │   ├── catalog.js      # 数据装载、索引、匹配、替代、筛选
│       │   ├── nutrition.js    # 营养计算、单位换算
│       │   └── state.js        # 全局状态与业务动作
│       ├── ui/
│       │   ├── dom.js          # 弹窗 / 提示 / 下载 / 日期工具
│       │   └── cards.js        # 菜谱卡片模板
│       └── views/
│           ├── home.js         # 今天（首页：抽菜 + 三餐 + 临期）
│           ├── me.js           # 我的（入口列表）
│           ├── kitchen.js      # 冰箱库存
│           ├── library.js      # 菜谱库
│           ├── recipe.js       # 菜谱详情 + 打印
│           ├── random.js       # 随机抽菜
│           ├── plan.js         # 三餐规划
│           ├── collection.js   # 收藏 + 购物清单
│           ├── editor.js       # 自定义菜谱
│           └── settings.js     # 设置 / 备份 / 统计
├── data/
│   ├── ingredients.json        # 食材库（105 条，每 100g 营养）
│   ├── seasonings.json         # 调料库（37 条，含勺→克换算）
│   ├── recipes.json            # 菜谱库（84 道）
│   ├── substitutes.json        # 食材替代方案（含大类兜底）
│   └── embedded.js             # 由上面 4 个 JSON 打包生成（离线兜底）
└── tools/                      # 仅开发用，不参与部署
    ├── build.py                # 校验数据 + 生成 embedded.js
    ├── check_imports.py        # 检查 ESM import/export 是否对得上
    ├── gen_images.py           # 生成占位图 SVG
    ├── patch_oil.py            # 给油炸类菜谱标注吸油比例（一次性脚本）
    ├── seed_ing.py / seed_r1~r3.py  # 新增 200 道菜与 43 种食材的数据源
    ├── seed_apply.py           # 把上面的数据合并进 data/*.json
    ├── build-css.ps1           # 重新生成精简版 Tailwind（2.9MB → 4.4KB）
    ├── share.ps1               # 一键分享到公网（本地服务 + 隧道）
    ├── deploy-github.ps1       # 一条命令发布到 GitHub Pages（不用装 git）
    ├── bin/                    # cloudflared 隧道程序（52MB，不要提交到仓库）
    └── shot.mjs                # 无头浏览器截图自检
```

---

## 四、如何用 JSON 扩充菜谱库

### 1. 直接往 `data/recipes.json` 里加

```json
{
  "id": "wojia_de_niurou",
  "name": "我家的番茄牛腩",
  "cat": "meat",
  "tags": ["炖菜", "下饭菜"],
  "flavor": "酸甜",
  "time": 90,
  "diff": 2,
  "servings": 2,
  "ings": [["beef_brisket", 500], ["tomato", 400]],
  "seas": [["light_soy", 20], ["salt", 3], ["oil", 15, 0.5]],
  "steps": ["第一步……", "第二步……"],
  "tips": "小贴士"
}
```

- `ings` / `seas` 是 `[食材 id, 克数]`，克数对应 `servings` 份
- 可选第三个元素是**计入营养的比例**：油炸用油写 `0.12`，表示只算 12% 的吸油量
- 营养不用自己算，程序按 `ingredients.json` 的每 100g 数据自动累加

改完运行一次打包脚本，`embedded.js` 会同步更新：

```bash
python tools/build.py      # 校验 id 引用 + 生成 data/embedded.js
```

### 2. 导入外部菜谱 JSON（不改代码）

设置页 →「导入菜谱 JSON 扩充菜谱库」，选一个文件即可。支持两种格式：

```json
[ { "name": "...", "cat": "veg", "ings": [["tomato", 300]], "seas": [], "steps": ["..."] } ]
```

或 `{ "items": [ ... ] }` / `{ "recipes": [ ... ] }`。
导入的菜谱会存进 IndexedDB（标记为「我的菜谱」），可以在编辑器里继续修改。

### 3. 新增食材

在 `ingredients.json` 里补一条，字段含义见文件开头 `meta.desc`：

```json
{ "id": "lettuce", "name": "生菜", "alias": [], "cat": "veg",
  "per100": { "kcal": 15, "p": 1.3, "f": 0.3, "c": 2 },
  "spoon": null, "shelf": 4, "avoid": [] }
```

`avoid` 用于忌口筛选，可选值：`spicy` `seafood` `pork` `beef` `lamb` `egg` `dairy` `peanut` `nut` `gluten` `soy` `cilantro` `mushroom`。

---

## 五、技术说明

| 关注点 | 做法 |
| --- | --- |
| 数据存储 | IndexedDB（9 个对象仓库）；不支持时自动降级 localStorage |
| 营养计算 | 食材库每 100g 基准值 × 实际克数，份数变化只做线性缩放 |
| 匹配算法 | 覆盖率 + 缺料数量双阈值；调料默认视为常备，可切换严格校验 |
| 离线资源 | Tailwind（purge 后 4.4KB）、FontAwesome 字体、SVG 占位图全部本地打包，零 CDN |
| 主题 | CSS 变量 + `[data-theme]`，首屏由内联脚本恢复，避免闪烁 |
| 打印 | 独立 `#print-area` + `@media print`，只输出菜谱正文 |
| 兼容 | 现代浏览器（Chrome / Edge / Safari / Firefox 近两年版本）；移动端自适应 |

项目自身不发任何外部请求，可在浏览器 DevTools 的 Network 面板验证：除了本站的 CSS/JS/JSON/字体，没有第三方域名。

---

## 六、开发脚本

```bash
python tools/build.py          # 校验 data/*.json 并重新生成 embedded.js
python tools/check_imports.py  # 检查 ES Module 的 import/export 是否匹配
python tools/gen_images.py     # 重新生成 assets/img/*.svg 占位图
node tools/shot.mjs --w 1440 --h 1000 --wait 2500 \
     --url "http://127.0.0.1:8080/#kitchen" --out shot.png   # 无头截图自检
```

---

## 七、第三方资源许可

- **TailwindCSS** 2.2.19 — MIT
- **Font Awesome Free** 6.5.2 — 图标 CC BY 4.0、字体 SIL OFL 1.1、代码 MIT
- 菜谱文字、营养数据与 SVG 占位图为本项目自行编写/生成，可自由使用。
