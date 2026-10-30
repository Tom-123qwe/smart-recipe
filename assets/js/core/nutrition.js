/* ============================================================
 * core/nutrition.js —— 营养与用量计算（全部在浏览器本地完成）
 * ------------------------------------------------------------
 * 设计要点：
 *   1. 菜谱只记录「食材 id + 克数」，营养值全部由食材库的每 100g 数据推算，
 *      所以拖动份数滑块时只是把克数按比例缩放，营养实时同步。
 *   2. 支持「单食材营养贡献」：每一行都保留自己的 kcal / 蛋白 / 脂肪 / 碳水。
 *   3. 油炸类菜谱的用油可以带第三个元素（计入营养的比例），
 *      例如 ["oil", 200, 0.12] 表示 200g 油只按 24g 计入热量（吸油率）。
 * ============================================================ */

/** 三大营养素供能系数 */
export const ENERGY = { p: 4, f: 9, c: 4 };

/** 取食材/调料定义 */
function lookup(cat, id) {
  return (cat && cat.byId && cat.byId.get(id)) || null;
}

/**
 * 计算菜谱营养
 * @param {object} recipe   菜谱对象
 * @param {object} cat      数据目录（含 byId）
 * @param {number} servings 目标份数，默认用菜谱自身份数
 * @returns {{servings:number, base:number, mul:number, rows:Array, totals:object, perServing:object}}
 */
export function computeRecipe(recipe, cat, servings) {
  const base = Number(recipe.servings) || 2;
  const target = Number(servings) || base;
  const mul = target / base;

  const rows = [];
  const totals = { kcal: 0, p: 0, f: 0, c: 0 };

  const eat = (pair, kind) => {
    const id = pair[0];
    const g = Number(pair[1]) || 0;
    const factor = pair.length > 2 ? Number(pair[2]) : 1;
    const item = lookup(cat, id);
    if (!item) return;
    const grams = g * mul;           // 展示用量
    const effG = grams * factor;     // 实际计入营养的用量
    const k = effG / 100;
    const p100 = item.per100;
    const row = {
      id,
      name: item.name,
      kind,
      item,
      grams,
      effG,
      factor,
      kcal: p100.kcal * k,
      p: p100.p * k,
      f: p100.f * k,
      c: p100.c * k,
    };
    rows.push(row);
    totals.kcal += row.kcal;
    totals.p += row.p;
    totals.f += row.f;
    totals.c += row.c;
  };

  (recipe.ings || []).forEach((p) => eat(p, 'ing'));
  (recipe.seas || []).forEach((p) => eat(p, 'sea'));

  // 每份营养（用于卡片、对比）
  const perServing = {
    kcal: totals.kcal / target,
    p: totals.p / target,
    f: totals.f / target,
    c: totals.c / target,
  };

  return { servings: target, base, mul, rows, totals, perServing };
}

/** 只取每份热量，列表中大量调用时更轻量 */
export function kcalPerServing(recipe, cat) {
  return computeRecipe(recipe, cat, recipe.servings).perServing.kcal;
}

/** 数字格式化：整数不带小数，其余保留一位 */
export function n1(v) {
  const x = Math.round(v * 10) / 10;
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

/** 整份营养展示用的取整 */
export function n0(v) {
  return Math.round(v);
}

/**
 * 用量文案：克 / 勺 一键切换
 * @param {number} grams  克数
 * @param {object} item   食材定义（可能带 spoon：1 勺 ≈ 多少克）
 * @param {'g'|'spoon'} mode
 */
export function formatAmount(grams, item, mode) {
  if (mode === 'spoon' && item && item.spoon) {
    const spoons = grams / item.spoon;
    if (spoons >= 0.2) return { value: n1(spoons), unit: '勺' };
  }
  if (grams >= 1000) return { value: n1(grams / 1000), unit: '千克' };
  return { value: n1(grams), unit: '克' };
}

/**
 * 库存换算：把任意单位的库存折算成克，用于匹配
 * 无法换算的单位（个 / 袋 / 瓶）返回 null，表示「只知道有，不知道多少」
 */
export function toGrams(qty, unit, item) {
  const q = Number(qty) || 0;
  if (unit === '克' || unit === 'g' || !unit) return q;
  if (unit === '勺') return q * ((item && item.spoon) || 10);
  if (unit === '毫升' || unit === 'ml') return q;
  return null;
}

/** 三大营养素供能占比（用于营养条） */
export function macroRatio(totals) {
  const eP = totals.p * ENERGY.p;
  const eF = totals.f * ENERGY.f;
  const eC = totals.c * ENERGY.c;
  const sum = eP + eF + eC || 1;
  return {
    p: Math.round((eP / sum) * 100),
    f: Math.round((eF / sum) * 100),
    c: Math.round((eC / sum) * 100),
  };
}

/** 一天中的热量评价（粗略参考值，仅本地提示） */
export function kcalAdvice(perServing) {
  if (perServing < 250) return { text: '清淡低卡', tone: 'green' };
  if (perServing < 450) return { text: '热量适中', tone: 'primary' };
  if (perServing < 700) return { text: '热量偏高', tone: 'amber' };
  return { text: '高热量', tone: 'red' };
}
