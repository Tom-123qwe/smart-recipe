/* ============================================================
 * core/state.js —— 全局状态与业务动作
 * ------------------------------------------------------------
 * 集中管理：库存 / 调料 / 收藏 / 黑名单 / 抽菜历史 / 自定义菜谱 /
 * 购物清单 / 三餐计划 / 用户设置，并对外暴露「动作函数」。
 * 任何写操作完成后都会 emit('change')，当前视图据此重渲染。
 * ============================================================ */

import * as DB from './store.js';
import { loadCatalog, mergeUserRecipes, buildInvIndex, matchRecipe } from './catalog.js';
import { toGrams, computeRecipe } from './nutrition.js';

/* ---------- 极简事件总线 ---------- */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(type = 'change', payload) {
  listeners.forEach((fn) => { try { fn(type, payload); } catch (e) { console.error(e); } });
}

/** 默认设置 */
const DEFAULT_SETTINGS = {
  theme: 'auto',        // light | dark | auto
  unit: 'g',            // g | spoon   （默认用量单位）
  strictPantry: false,  // 调料是否严格按库存匹配
  strictMode: false,    // 菜谱默认匹配模式
  avoid: [],            // 忌口 id 列表
  diets: [],            // 需求筛选 id 列表
  goalKcal: 1800,       // 每日目标热量
  mealRatio: [25, 40, 35], // 早 / 午 / 晚 占比
};

export const state = {
  cat: null,            // 数据目录（含用户菜谱合并结果）
  baseCat: null,        // 原始目录（不含用户菜谱）
  inv: [],
  pantry: [],
  favs: new Set(),
  blacklist: new Map(), // id -> until(时间戳)
  history: [],
  userRecipes: [],
  shopping: [],
  plan: null,
  settings: { ...DEFAULT_SETTINGS },
  ready: false,
};

/* ------------------------------------------------------------
 * 初始化
 * ---------------------------------------------------------- */
export async function initState() {
  await DB.openDB();

  state.baseCat = await loadCatalog();

  const [inv, pantry, favs, blacklist, history, userRecipes, shopping, settings, plan] = await Promise.all([
    DB.all('inventory'),
    DB.all('pantry'),
    DB.all('favorites'),
    DB.all('blacklist'),
    DB.all('history'),
    DB.all('userRecipes'),
    DB.all('shopping'),
    DB.kvGet('settings', null),
    DB.kvGet('plan', null),
  ]);

  state.inv = inv || [];
  state.pantry = pantry || [];
  state.favs = new Set((favs || []).map((f) => f.id));
  state.blacklist = new Map((blacklist || []).map((b) => [b.id, b.until]));
  state.history = (history || []).sort((a, b) => b.ts - a.ts);
  state.userRecipes = userRecipes || [];
  state.shopping = shopping || [];
  state.settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  state.plan = plan;

  rebuildCatalog();
  pruneBlacklist();
  state.ready = true;
  return state;
}

/** 用户菜谱变动后重建目录（保持自定义菜谱可被搜索/匹配） */
export function rebuildCatalog() {
  state.cat = mergeUserRecipes(state.baseCat, state.userRecipes);
}

/** 库存是否已首次初始化过（用于「一键导入常备调料」提示） */
export async function markSeeded() {
  await DB.kvSet('seeded', true);
}
export async function isSeeded() {
  return !!(await DB.kvGet('seeded', false));
}

/* ------------------------------------------------------------
 * 设置
 * ---------------------------------------------------------- */
export async function saveSettings(patch) {
  state.settings = Object.assign({}, state.settings, patch || {});
  await DB.kvSet('settings', state.settings);
  emit('settings', state.settings);
  return state.settings;
}

/* ------------------------------------------------------------
 * 库存 / 调料库存
 * ---------------------------------------------------------- */
function storeOf(kind) { return kind === 'pantry' ? 'pantry' : 'inventory'; }
function listOf(kind) { return kind === 'pantry' ? state.pantry : state.inv; }
function setList(kind, arr) { if (kind === 'pantry') state.pantry = arr; else state.inv = arr; }

/** 新增或更新一条库存 */
export async function upsertStock(kind, row) {
  const record = Object.assign({ id: DB.uid('stock'), ts: Date.now() }, row);
  const list = listOf(kind);
  const idx = list.findIndex((x) => x.id === record.id);
  if (idx >= 0) list[idx] = record; else list.push(record);
  await DB.put(storeOf(kind), record);
  emit('change');
  return record;
}

/** 批量写入（导入用） */
export async function bulkStock(kind, rows) {
  const list = listOf(kind);
  for (const row of rows) {
    const record = Object.assign({ id: DB.uid('stock'), ts: Date.now() }, row);
    list.push(record);
    await DB.put(storeOf(kind), record);
  }
  emit('change');
  return rows.length;
}

export async function removeStock(kind, id) {
  setList(kind, listOf(kind).filter((x) => x.id !== id));
  await DB.del(storeOf(kind), id);
  emit('change');
}

export async function clearStock(kind) {
  setList(kind, []);
  await DB.clear(storeOf(kind));
  emit('change');
}

/** 数量增减（+/- 按钮用） */
export async function bumpStock(kind, id, delta) {
  const list = listOf(kind);
  const row = list.find((x) => x.id === id);
  if (!row) return;
  row.qty = Math.max(0, Number((Number(row.qty) + delta).toFixed(1)));
  await DB.put(storeOf(kind), row);
  emit('change');
}

/** 库存匹配上下文 */
export function invContext() {
  return {
    cat: state.cat,
    inv: buildInvIndex(state.inv, state.cat),
    pantry: buildInvIndex(state.pantry, state.cat),
    strictPantry: !!state.settings.strictPantry,
  };
}

/** 某食材当前库存克数（用于购物清单抵扣） */
export function stockGrams(key) {
  const row = state.inv.find((x) => x.key === key);
  if (!row) return 0;
  const item = state.cat.byId.get(key);
  const g = toGrams(row.qty, row.unit, item);
  return g == null ? 0 : g;
}

/** 保质期状态：expired / urgent(<=3 天) / ok / none */
export function expireStatus(row) {
  if (!row.expire) return { status: 'none', days: null, text: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(row.expire + 'T00:00:00');
  const days = Math.round((d - today) / 86400000);
  if (Number.isNaN(days)) return { status: 'none', days: null, text: '' };
  if (days < 0) return { status: 'expired', days, text: '已过期 ' + Math.abs(days) + ' 天' };
  if (days === 0) return { status: 'urgent', days, text: '今天到期' };
  if (days <= 3) return { status: 'urgent', days, text: '剩 ' + days + ' 天' };
  return { status: 'ok', days, text: '剩 ' + days + ' 天' };
}

/** 存量不足判定 */
export function isLowStock(row) {
  const min = Number(row.min) || 0;
  if (min <= 0) return false;
  const g = toGrams(row.qty, row.unit, state.cat.byId.get(row.key));
  if (g == null) return Number(row.qty) <= min;
  return g <= min;
}

/* ------------------------------------------------------------
 * 收藏 / 黑名单 / 抽菜历史
 * ---------------------------------------------------------- */
export function isFav(id) { return state.favs.has(id); }

export async function toggleFav(id) {
  if (state.favs.has(id)) {
    state.favs.delete(id);
    await DB.del('favorites', id);
    emit('change', { fav: false, id });
    return false;
  }
  state.favs.add(id);
  await DB.put('favorites', { id, ts: Date.now() });
  emit('change', { fav: true, id });
  return true;
}

/** 拉黑 24 小时（抽菜防重复） */
export async function addBlacklist(id, hours = 24) {
  const until = Date.now() + hours * 3600 * 1000;
  state.blacklist.set(id, until);
  await DB.put('blacklist', { id, until });
  emit('change');
}

export async function removeBlacklist(id) {
  state.blacklist.delete(id);
  await DB.del('blacklist', id);
  emit('change');
}

/** 清理过期黑名单 */
export function pruneBlacklist() {
  const now = Date.now();
  let changed = false;
  state.blacklist.forEach((until, id) => {
    if (until <= now) { state.blacklist.delete(id); DB.del('blacklist', id); changed = true; }
  });
  return changed;
}

export function isBlacklisted(id) {
  const until = state.blacklist.get(id);
  return !!until && until > Date.now();
}

/** 剩余屏蔽时间文案 */
export function blacklistLeft(id) {
  const until = state.blacklist.get(id);
  if (!until || until <= Date.now()) return '';
  const h = Math.ceil((until - Date.now()) / 3600000);
  return h + ' 小时后可再抽';
}

export async function recordDraw(recipeId) {
  const row = { recipeId, ts: Date.now() };
  await DB.put('history', row);
  state.history.unshift(row);
  state.history = state.history.slice(0, 60);
}

/* ------------------------------------------------------------
 * 自定义菜谱
 * ---------------------------------------------------------- */
export async function saveUserRecipe(recipe) {
  const row = Object.assign({}, recipe, { updated: Date.now() });
  const idx = state.userRecipes.findIndex((r) => r.id === row.id);
  if (idx >= 0) state.userRecipes[idx] = row; else state.userRecipes.push(row);
  await DB.put('userRecipes', row);
  rebuildCatalog();
  emit('change');
  return row;
}

export async function deleteUserRecipe(id) {
  state.userRecipes = state.userRecipes.filter((r) => r.id !== id);
  await DB.del('userRecipes', id);
  rebuildCatalog();
  emit('change');
}

/** 批量导入自定义菜谱（扩充菜谱库 / 从备份恢复） */
export async function bulkSaveUserRecipes(list) {
  for (const r of list) {
    const row = Object.assign({}, r, { updated: Date.now() });
    const idx = state.userRecipes.findIndex((x) => x.id === row.id);
    if (idx >= 0) state.userRecipes[idx] = row; else state.userRecipes.push(row);
    await DB.put('userRecipes', row);
  }
  rebuildCatalog();
  emit('change');
}

/* ------------------------------------------------------------
 * 购物清单
 * ---------------------------------------------------------- */
export async function replaceShopping(items) {
  await DB.clear('shopping');
  state.shopping = [];
  for (const it of items) {
    const row = Object.assign({ id: DB.uid('shop'), checked: false }, it);
    state.shopping.push(row);
    await DB.put('shopping', row);
  }
  emit('change');
}

export async function addShopping(items) {
  for (const it of items) {
    const exist = state.shopping.find((x) => x.key === it.key && !x.checked);
    if (exist) {
      exist.grams = Number((exist.grams + it.grams).toFixed(0));
      await DB.put('shopping', exist);
    } else {
      const row = Object.assign({ id: DB.uid('shop'), checked: false }, it);
      state.shopping.push(row);
      await DB.put('shopping', row);
    }
  }
  emit('change');
}

export async function toggleShopping(id, checked) {
  const row = state.shopping.find((x) => x.id === id);
  if (!row) return;
  row.checked = checked;
  await DB.put('shopping', row);
  emit('change');
}

export async function updateShoppingQty(id, grams) {
  const row = state.shopping.find((x) => x.id === id);
  if (!row) return;
  row.grams = Math.max(0, Number(grams) || 0);
  await DB.put('shopping', row);
  emit('change');
}

export async function removeShopping(id) {
  state.shopping = state.shopping.filter((x) => x.id !== id);
  await DB.del('shopping', id);
  emit('change');
}

export async function clearShopping() {
  state.shopping = [];
  await DB.clear('shopping');
  emit('change');
}

/**
 * 由菜谱生成购物清单：按食材聚合克数，并扣除现有库存
 * @param {Array<object>} recipes 菜谱数组（可带 servings 覆盖值）
 */
export function shoppingFromRecipes(recipes) {
  const agg = new Map();
  recipes.forEach((entry) => {
    const r = entry.recipe || entry;
    const servings = entry.servings || r.servings;
    const nut = computeRecipe(r, state.cat, servings);
    (r.ings || []).forEach((p) => {
      const id = p[0];
      const row = nut.rows.find((x) => x.id === id);
      const grams = row ? row.grams : 0;
      const item = state.cat.byId.get(id);
      const prev = agg.get(id) || { key: id, name: item ? item.name : id, grams: 0, cat: item ? item.cat : 'veg' };
      prev.grams += grams;
      agg.set(id, prev);
    });
  });

  const items = [];
  agg.forEach((v) => {
    const have = stockGrams(v.key);
    const need = Math.max(0, Math.round(v.grams - have));
    if (need <= 0) return; // 库存足够就不买
    items.push({ key: v.key, name: v.name, grams: need, cat: v.cat, source: 'recipe' });
  });
  return items;
}

/* ------------------------------------------------------------
 * 三餐计划
 * ---------------------------------------------------------- */
export async function savePlan(plan) {
  state.plan = plan;
  await DB.kvSet('plan', plan);
  await DB.put('plans', plan);
  emit('change');
}

/* ------------------------------------------------------------
 * 备份还原
 * ---------------------------------------------------------- */
export async function backupAll() {
  const data = await DB.exportAll();
  return {
    app: 'smart-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    data,
  };
}

export async function restoreAll(payload) {
  if (payload && payload.data) {
    await DB.importAll(payload.data);
    if (payload.settings) await DB.kvSet('settings', payload.settings);
    await initState();
    emit('change');
    return true;
  }
  if (payload && payload.inventory) {
    // 兼容「只导入库存」的简化格式
    const rows = (payload.inventory || []).map((r) => Object.assign({ id: DB.uid('stock') }, r));
    state.inv = rows;
    await DB.clear('inventory');
    for (const r of rows) await DB.put('inventory', r);
    emit('change');
    return true;
  }
  return false;
}
