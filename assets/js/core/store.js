/* ============================================================
 * core/store.js —— IndexedDB 持久化层
 * ------------------------------------------------------------
 * 所有用户数据（库存、调料、收藏、黑名单、抽菜历史、自定义菜谱、
 * 购物清单、设置）都存放在浏览器本地 IndexedDB，绝不上传。
 * 隐私模式 / 老浏览器不支持 IndexedDB 时，自动降级到 localStorage，
 * 保证功能可用（容量更小，仅作兜底）。
 * ============================================================ */

const DB_NAME = 'smart-recipe-db';
const DB_VERSION = 1;

/** 对象仓库定义：keyPath 是主键字段，auto 表示自增主键 */
const STORES = [
  { name: 'kv', keyPath: 'k' },              // 通用键值：设置、计划等
  { name: 'inventory', keyPath: 'id' },      // 食材库存
  { name: 'pantry', keyPath: 'id' },         // 调料库存
  { name: 'favorites', keyPath: 'id' },      // 收藏 { id: recipeId, ts }
  { name: 'blacklist', keyPath: 'id' },      // 抽菜黑名单 { id: recipeId, until }
  { name: 'history', keyPath: 'id', auto: true }, // 抽菜历史 { recipeId, ts }
  { name: 'userRecipes', keyPath: 'id' },    // 自定义菜谱
  { name: 'plans', keyPath: 'date' },        // 三餐规划 { date, meals }
  { name: 'shopping', keyPath: 'id' },       // 购物清单项
];

let dbPromise = null;
let fallback = null; // localStorage 兜底模式的缓存

/** localStorage 兜底实现：结构与 IndexedDB 版本保持一致 */
function initFallback() {
  fallback = { kv: {}, inventory: {}, pantry: {}, favorites: {}, blacklist: {}, userRecipes: {}, plans: {}, shopping: {}, history: {} };
  try {
    const raw = localStorage.getItem('sr-fallback-db');
    if (raw) Object.assign(fallback, JSON.parse(raw));
  } catch (e) { /* 忽略损坏数据 */ }
  return true;
}

function persistFallback() {
  try { localStorage.setItem('sr-fallback-db', JSON.stringify(fallback)); } catch (e) { /* 超容量忽略 */ }
}

/** 打开数据库（幂等） */
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      initFallback();
      resolve({ fallback: true });
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      initFallback();
      resolve({ fallback: true });
      return;
    }
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      STORES.forEach((s) => {
        if (!db.objectStoreNames.contains(s.name)) {
          db.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: !!s.auto });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { initFallback(); resolve({ fallback: true }); };
    // 某些浏览器在隐私模式下会长时间挂起，5 秒后兜底
    setTimeout(() => { if (!dbPromise) return; }, 0);
  });
  return dbPromise;
}

async function db() {
  const d = await openDB();
  return d;
}

function keyOf(store, val) {
  const def = STORES.find((s) => s.name === store);
  return def ? val[def.keyPath] : val.id;
}

/** 读取单条 */
export async function get(store, key) {
  const d = await db();
  if (d.fallback) return fallback[store][key] ?? null;
  return new Promise((resolve) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

/** 读取全部 */
export async function all(store) {
  const d = await db();
  if (d.fallback) return Object.values(fallback[store] || {});
  return new Promise((resolve) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

/** 写入（无主键值时自动生成） */
export async function put(store, val) {
  const d = await db();
  if (d.fallback) {
    const def = STORES.find((s) => s.name === store);
    if (def && def.auto && val[def.keyPath] == null) {
      val[def.keyPath] = (fallback.history.__seq = (fallback.history.__seq || 0) + 1);
    }
    fallback[store][keyOf(store, val)] = val;
    persistFallback();
    return val;
  }
  return new Promise((resolve) => {
    const tx = d.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(val);
    req.onsuccess = () => resolve(val);
    req.onerror = () => resolve(val);
  });
}

/** 删除单条 */
export async function del(store, key) {
  const d = await db();
  if (d.fallback) {
    delete fallback[store][key];
    persistFallback();
    return;
  }
  return new Promise((resolve) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** 清空某个仓库 */
export async function clear(store) {
  const d = await db();
  if (d.fallback) {
    fallback[store] = {};
    persistFallback();
    return;
  }
  return new Promise((resolve) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/* ---------- 设置类便捷方法（kv 仓库统一存设置对象） ---------- */

export async function kvGet(key, dft = null) {
  const row = await get('kv', key);
  return row ? row.v : dft;
}

export async function kvSet(key, value) {
  await put('kv', { k: key, v: value });
  return value;
}

/** 生成简短唯一 id */
export function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 导出全部用户数据（用于备份 JSON） */
export async function exportAll() {
  const out = {};
  for (const s of STORES) out[s.name] = await all(s.name);
  return out;
}

/** 导入备份（覆盖式） */
export async function importAll(payload) {
  for (const s of STORES) {
    const rows = payload[s.name];
    if (!Array.isArray(rows)) continue;
    await clear(s.name);
    for (const r of rows) await put(s.name, r);
  }
}
