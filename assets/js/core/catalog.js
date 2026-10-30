/* ============================================================
 * core/catalog.js —— 数据装载 / 索引 / 匹配 / 替代
 * ------------------------------------------------------------
 * 数据来源优先级：
 *   1. data/*.json（相对路径，通过 fetch 读取，便于后续用 JSON 批量扩充）
 *   2. window.__RECIPE_DATA__（data/embedded.js，file:// 双击打开时的兜底）
 * 两者内容完全一致，且都在本地，绝不发起跨域网络请求。
 * ============================================================ */

import { computeRecipe, toGrams } from './nutrition.js';

/** 分类中文名与图标 */
export const CATS = {
  meat: { name: '荤菜', icon: 'fa-drumstick-bite' },
  veg: { name: '素菜', icon: 'fa-leaf' },
  egg: { name: '蛋豆', icon: 'fa-egg' },
  soup: { name: '汤羹', icon: 'fa-bowl-food' },
  staple: { name: '主食', icon: 'fa-bowl-rice' },
  breakfast: { name: '早餐', icon: 'fa-mug-hot' },
  cold: { name: '凉菜', icon: 'fa-snowflake' },
  snack: { name: '小吃', icon: 'fa-cookie-bite' },
  light: { name: '轻食', icon: 'fa-spa' },
  fitness: { name: '健身餐', icon: 'fa-dumbbell' },
};

/** 食材大类中文名（用于分组显示与兜底替代） */
export const ING_CATS = {
  meat: '肉禽', poultry: '肉禽', seafood: '水产', egg: '蛋类', soy: '豆制品',
  veg: '蔬菜', mushroom: '菌菇', staple: '主食', fruit: '水果', dairy: '奶类',
  nut: '坚果', dry: '干货',
};

/** 忌口选项：id 与食材库 avoid 字段对应 */
export const AVOIDS = [
  { id: 'spicy', label: '不吃辣', icon: 'fa-pepper-hot' },
  { id: 'seafood', label: '无海鲜', icon: 'fa-fish' },
  { id: 'pork', label: '无猪肉', icon: 'fa-bacon' },
  { id: 'beef', label: '无牛肉', icon: 'fa-cow' },
  { id: 'lamb', label: '无羊肉', icon: 'fa-cloud' },
  { id: 'egg', label: '无鸡蛋', icon: 'fa-egg' },
  { id: 'dairy', label: '无奶制品', icon: 'fa-cheese' },
  { id: 'peanut', label: '无花生', icon: 'fa-seedling' },
  { id: 'nut', label: '无坚果', icon: 'fa-tree' },
  { id: 'gluten', label: '无麸质', icon: 'fa-wheat-awn' },
  { id: 'soy', label: '无大豆', icon: 'fa-bowl-rice' },
  { id: 'cilantro', label: '不要香菜', icon: 'fa-leaf' },
  { id: 'mushroom', label: '不吃菌菇', icon: 'fa-tree-city' },
];

/** 需求筛选：在数据基础上按菜谱属性动态判定 */
export const DIET_FILTERS = [
  { id: 'anti', label: '抗炎', icon: 'fa-heart-pulse' },
  { id: 'muscle', label: '增肌', icon: 'fa-dumbbell' },
  { id: 'light', label: '减脂轻卡', icon: 'fa-feather' },
  { id: 'protein', label: '高蛋白', icon: 'fa-egg' },
  { id: 'lowgi', label: '控糖', icon: 'fa-chart-line' },
  { id: 'quick', label: '20 分钟快手', icon: 'fa-bolt' },
  { id: 'kids', label: '小孩爱吃', icon: 'fa-child-reaching' },
  { id: 'vegonly', label: '纯素', icon: 'fa-seedling' },
];

let rawCache = null;

/** 读取单个 JSON，失败时抛错以便回退 */
async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + path);
  return res.json();
}

/**
 * 按需加载内联数据（data/embedded.js）
 * 正常 HTTP 环境下不需要它，只有 fetch 拿不到 JSON 时才触发，省掉首屏 87KB。
 */
function loadEmbedded() {
  return new Promise((resolve) => {
    if (window.__RECIPE_DATA__) { resolve(window.__RECIPE_DATA__); return; }
    const s = document.createElement('script');
    s.src = 'data/embedded.js';
    s.onload = () => resolve(window.__RECIPE_DATA__ || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

/**
 * 装载全部数据并建立索引
 * @returns {Promise<object>} catalog
 */
export async function loadCatalog() {
  if (rawCache) return rawCache;

  let raw = null;
  try {
    const [ing, sea, rec, sub] = await Promise.all([
      fetchJSON('data/ingredients.json'),
      fetchJSON('data/seasonings.json'),
      fetchJSON('data/recipes.json'),
      fetchJSON('data/substitutes.json'),
    ]);
    raw = { ingredients: ing, seasonings: sea, recipes: rec, substitutes: sub };
  } catch (err) {
    // 兜底：动态加载 data/embedded.js（file://、离线或静态托管禁用了 JSON 的情形）
    raw = await loadEmbedded();
    if (raw) {
      console.info('[数据] fetch 不可用，已回退到内联数据');
    } else {
      throw err;
    }
  }

  rawCache = buildCatalog(raw);
  return rawCache;
}

/** 建立索引 + 预计算派生字段 */
function buildCatalog(raw) {
  const ingredients = raw.ingredients.items || [];
  const seasonings = raw.seasonings.items || [];
  const recipes = raw.recipes.items || [];
  const substitutes = raw.substitutes || { items: {}, byCategory: {} };
  const catMeta = (raw.recipes.meta && raw.recipes.meta.categories) || {};

  const byId = new Map();
  ingredients.forEach((x) => byId.set(x.id, { ...x, kind: 'ing' }));
  seasonings.forEach((x) => byId.set(x.id, { ...x, kind: 'sea' }));

  const recipesById = new Map();
  recipes.forEach((r) => {
    const ings = r.ings || [];
    const seas = r.seas || [];
    // 汇总忌口标签：食材 + 调料里出现的 avoid 项
    const avoid = new Set();
    ings.concat(seas).forEach((p) => {
      const it = byId.get(p[0]);
      if (it && it.avoid) it.avoid.forEach((a) => avoid.add(a));
    });
    const nut = computeRecipe(r, { byId }, r.servings);
    const enriched = {
      ...r,
      catName: catMeta[r.cat] || (CATS[r.cat] && CATS[r.cat].name) || '家常',
      img: r.img || 'assets/img/dish-' + (CATS[r.cat] ? r.cat : 'default') + '.svg',
      avoidSet: avoid,
      avoidArr: Array.from(avoid),
      nut,                       // 预计算：按菜谱基准份数
      perServing: nut.perServing, // 每份热量 / 营养
      light: nut.perServing.kcal <= 380 && nut.perServing.f <= 15,
      highProtein: nut.perServing.p >= 20,
      vegOnly: !ings.some((p) => {
        const it = byId.get(p[0]);
        return it && ['meat', 'poultry', 'seafood'].includes(it.cat);
      }),
      user: false,
    };
    recipesById.set(r.id, enriched);
  });

  return {
    ingredients,
    seasonings,
    recipes: Array.from(recipesById.values()),
    substitutes,
    byId,
    recipesById,
    catMeta,
  };
}

/** 合并用户自定义菜谱到目录（不写回原始数据） */
export function mergeUserRecipes(cat, userRecipes) {
  const merged = new Map(cat.recipesById);
  (userRecipes || []).forEach((r) => {
    const nut = computeRecipe(r, cat, r.servings);
    // 自定义菜谱的忌口标签同样由所用食材推导
    const avoid = new Set();
    (r.ings || []).concat(r.seas || []).forEach((p) => {
      const it = cat.byId.get(p[0]);
      if (it && it.avoid) it.avoid.forEach((a) => avoid.add(a));
    });
    merged.set(r.id, {
      ...r,
      catName: (CATS[r.cat] && CATS[r.cat].name) || '我的菜',
      img: r.img || 'assets/img/dish-' + (CATS[r.cat] ? r.cat : 'default') + '.svg',
      avoidSet: avoid,
      avoidArr: Array.from(avoid),
      nut,
      perServing: nut.perServing,
      light: nut.perServing.kcal <= 380 && nut.perServing.f <= 15,
      highProtein: nut.perServing.p >= 20,
      vegOnly: !(r.ings || []).some((p) => {
        const it = cat.byId.get(p[0]);
        return it && ['meat', 'poultry', 'seafood'].includes(it.cat);
      }),
      user: true,
    });
  });
  return { ...cat, recipes: Array.from(merged.values()), recipesById: merged };
}

/* ------------------------------------------------------------
 * 库存匹配
 * ---------------------------------------------------------- */

/**
 * 建立库存索引：id -> { qty, unit, grams, item }
 * grams 为 null 表示单位无法换算（个 / 袋），只判断「有没有」
 */
export function buildInvIndex(invList, cat) {
  const map = new Map();
  (invList || []).forEach((row) => {
    const item = row.key ? cat.byId.get(row.key) : null;
    const grams = toGrams(row.qty, row.unit, item);
    map.set(row.key || row.name, { ...row, item, grams });
  });
  return map;
}

/**
 * 菜谱匹配
 * @param {object} recipe 菜谱
 * @param {object} ctx    { inv: Map, pantry: Map, strictPantry: boolean }
 * @param {'strict'|'loose'} mode
 */
export function matchRecipe(recipe, ctx, mode = 'loose') {
  const inv = ctx.inv || new Map();
  const pantry = ctx.pantry || new Map();
  const ings = recipe.ings || [];
  const seas = recipe.seas || [];

  const missing = [];
  const partial = [];
  let ok = 0;

  ings.forEach((p) => {
    const id = p[0];
    const need = Number(p[1]) || 0;
    const have = inv.get(id);
    if (!have || !(Number(have.qty) > 0)) {
      missing.push({ id, need, have: 0, name: (recipe.nut.rows.find((r) => r.id === id) || {}).name || id });
      return;
    }
    const grams = have.grams;
    if (grams == null) { ok += 1; return; }      // 单位不可换算，视为有
    if (grams + 1e-6 >= need) { ok += 1; return; }
    partial.push({ id, need, have: grams, ratio: grams / (need || 1) });
    ok += Math.min(1, grams / (need || 1));
  });

  // 调料：默认视为常备；开启严格模式时按调料库存判断
  const missingSea = [];
  if (ctx.strictPantry) {
    seas.forEach((p) => {
      const id = p[0];
      const item = ctx.cat ? ctx.cat.byId.get(id) : null;
      const have = pantry.get(id);
      if (!have && !(item && item.isPantry)) {
        missingSea.push({ id, need: Number(p[1]) || 0, name: item ? item.name : id });
      }
    });
  }

  const total = ings.length || 1;
  const coverage = ok / total;
  const matched = mode === 'strict'
    ? missing.length === 0 && partial.length === 0 && missingSea.length === 0
    : missing.length <= 3 && coverage >= 0.6;

  return {
    mode,
    matched,
    coverage,
    okCount: Math.round(ok * 10) / 10,
    total,
    missing,
    partial,
    missingSea,
    missingCount: missing.length + missingSea.length,
  };
}

/**
 * 获取某食材的替代方案（含大类兜底）
 * @returns {Array<{name:string, ratio?:number, note?:string, id?:string}>}
 */
export function getSubstitutes(cat, ingId) {
  const sub = cat.substitutes || {};
  const direct = (sub.items && sub.items[ingId]) || [];
  if (direct.length) return direct;
  const item = cat.byId.get(ingId);
  if (!item) return [];
  if (item.kind === 'sea') {
    return [{ name: '同类调料互换', note: '按口味等量替换，注意咸度差异' }];
  }
  const byCat = (sub.byCategory && sub.byCategory[item.cat]) || [];
  return byCat.slice(0, 3);
}

/* ------------------------------------------------------------
 * 搜索与筛选
 * ---------------------------------------------------------- */

/** 关键词搜索：菜名、别名、食材名都能命中 */
export function searchRecipes(list, q, cat) {
  const kw = (q || '').trim().toLowerCase();
  if (!kw) return list;
  return list.filter((r) => {
    if (r.name.toLowerCase().includes(kw)) return true;
    if ((r.flavor || '').toLowerCase().includes(kw)) return true;
    if ((r.tags || []).some((t) => t.toLowerCase().includes(kw))) return true;
    // 用食材名反查
    return (r.ings || []).some((p) => {
      const it = cat.byId.get(p[0]);
      if (!it) return false;
      if (it.name.toLowerCase().includes(kw)) return true;
      return (it.alias || []).some((a) => a.toLowerCase().includes(kw));
    });
  });
}

/**
 * 组合筛选
 * @param {object} opts { catId, avoids, diets, q, maxTime, onlyMatch, mode, ctx }
 */
export function filterRecipes(list, opts, cat) {
  const { catId = 'all', avoids = [], diets = [], q = '', maxTime = 0, onlyMatch = false, mode = 'loose', ctx } = opts;

  let out = list.filter((r) => {
    if (catId !== 'all' && r.cat !== catId) return false;
    if (maxTime && r.time > maxTime) return false;
    if (avoids.length && avoids.some((a) => r.avoidSet.has(a))) return false;
    if (diets.includes('light') && !r.light) return false;
    if (diets.includes('protein') && !r.highProtein) return false;
    if (diets.includes('quick') && r.time > 20) return false;
    if (diets.includes('vegonly') && !r.vegOnly) return false;
    const tags = r.tags || [];
    if (diets.includes('anti') && !tags.includes('抗炎')) return false;
    if (diets.includes('muscle') && !tags.includes('增肌')) return false;
    if (diets.includes('lowgi') && !tags.includes('控糖')) return false;
    if (diets.includes('kids') && !tags.includes('儿童')) return false;
    return true;
  });

  out = searchRecipes(out, q, cat);

  if (ctx) {
    out = out.map((r) => ({ ...r, match: matchRecipe(r, ctx, mode) }));
    if (onlyMatch) out = out.filter((r) => r.match.matched);
    out.sort((a, b) => {
      // 匹配度优先，其次热量低的靠前
      if (b.match.coverage !== a.match.coverage) return b.match.coverage - a.match.coverage;
      return a.perServing.kcal - b.perServing.kcal;
    });
  }
  return out;
}

/** 分类统计（用于胶囊上显示数量） */
export function countByCat(list) {
  const m = { all: list.length };
  list.forEach((r) => { m[r.cat] = (m[r.cat] || 0) + 1; });
  return m;
}
