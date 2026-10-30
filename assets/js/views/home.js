/* ============================================================
 * views/home.js —— 首页「今天」
 * ------------------------------------------------------------
 * 设计原则：打开就能用，不需要先录入任何东西。
 *   1. 一个巨大的「随便来一道」按钮 —— 最主要动作
 *   2. 抽到的菜就地问「换一个 / 就它了」
 *   3. 今天三餐的三张小便签，点「换」即可
 *   4. 只有冰箱里真有临期食材时，才出现「快过期了」提醒
 * ============================================================ */

import {
  state, invContext, recordDraw, toggleFav, isFav, expireStatus,
} from '../core/state.js';
import { matchRecipe } from '../core/catalog.js';
import { openRecipe } from './recipe.js';
import { $, $$, esc, toast, badge } from '../ui/dom.js';
import { n0 } from '../core/nutrition.js';
import { heroLayers } from '../ui/cards.js';

const MEALS = [
  { key: 'breakfast', label: '早餐', icon: 'fa-mug-hot', ratio: 0.25, cats: ['breakfast', 'staple'] },
  { key: 'lunch', label: '午餐', icon: 'fa-bowl-rice', ratio: 0.40, cats: ['meat', 'staple', 'egg', 'veg'] },
  { key: 'dinner', label: '晚餐', icon: 'fa-utensils', ratio: 0.35, cats: ['meat', 'veg', 'soup', 'egg'] },
];

let lastPick = null;
let quickFilter = '';   // '' | fast | meat | light | stock

export function render(root) {
  root.innerHTML =
    '<div id="heroSlot"></div>' +
    '<div id="threeMeals" style="margin-top:22px"></div>' +
    '<div id="urgentSlot" style="margin-top:18px"></div>' +
    '<div style="margin-top:22px;text-align:center">' +
      '<button class="btn btn-ghost btn-sm" data-nav="recipes"><i class="fa-solid fa-book-open"></i>去菜谱里慢慢挑</button>' +
    '</div>';

  paintHero(root);
  paintMeals(root);
  paintUrgent(root);
  bind(root);
}

/* ------------------------------------------------------------
 * 主按钮区
 * ---------------------------------------------------------- */
function paintHero(root) {
  $('#heroSlot', root).innerHTML =
    '<section class="hero">' +
      '<div class="hero-emoji"><i class="fa-solid fa-bowl-food"></i></div>' +
      '<h1 class="hero-title">今天吃什么？</h1>' +
      '<p class="hero-sub">不想纠结的话，让我们替你挑一道。</p>' +
      '<button class="btn-hero" data-act="draw">' +
        '<i class="fa-solid fa-shuffle"></i> 随便来一道' +
      '</button>' +
      '<div class="hero-chips">' +
        chip('fast', 'fa-bolt', '30 分钟内') +
        chip('meat', 'fa-drumstick-bite', '想吃肉') +
        chip('anti', 'fa-heart-pulse', '抗炎') +
        chip('muscle', 'fa-dumbbell', '健身餐') +
        chip('light', 'fa-leaf', '清淡点') +
        chip('stock', 'fa-boxes-stacked', '冰箱里有什么') +
      '</div>' +
    '</section>';
}

function chip(id, icon, label) {
  return '<button class="chip ' + (quickFilter === id ? 'active' : '') + '" data-quick="' + id + '">' +
    '<i class="fa-solid ' + icon + '"></i>' + label + '</button>';
}

/** 抽一道菜 */
function pickOne(filters) {
  const ctx = invContext();
  const all = state.cat.recipes;
  let pool = all;

  if (filters === 'fast') pool = all.filter((r) => r.time <= 30);
  if (filters === 'meat') pool = all.filter((r) => ['meat', 'cold'].includes(r.cat) || r.highProtein);
  if (filters === 'light') pool = all.filter((r) => r.light || r.cat === 'soup');
  if (filters === 'anti') pool = all.filter((r) => (r.tags || []).includes('抗炎'));
  if (filters === 'muscle') pool = all.filter((r) => (r.tags || []).includes('增肌'));
  if (filters === 'stock') {
    pool = all.filter((r) => matchRecipe(r, ctx, 'loose').matched);
    if (!pool.length) return null;
  }
  if (!pool.length) pool = all;

  return pool[Math.floor(Math.random() * pool.length)];
}

function draw(root) {
  const r = pickOne(quickFilter);
  if (!r) {
    toast('冰箱里还没有记食材，先去「我的 → 冰箱里有什么」加两样吧', 'warn', 3200);
    return;
  }
  lastPick = r;
  recordDraw(r.id);

  const ctx = invContext();
  const m = matchRecipe(r, ctx, 'loose');
  const hasStock = state.inv.length > 0;
  const ps = r.perServing;

  // 只在真有库存时才提「材料是否齐」，避免满屏红字吓人
  const stockLine = !hasStock ? ''
    : (m.matched
        ? '<span class="pill pill-green"><i class="fa-solid fa-check"></i>材料都有</span>'
        : '<span class="pill pill-amber">还差 ' + m.missingCount + ' 样材料</span>');

  $('#heroSlot', root).innerHTML =
    '<section class="pick-card">' +
      '<div class="pick-hero">' + heroLayers(r.img) +
        '<div class="pick-veil"></div>' +
        '<div class="pick-name">' + esc(r.name) + '</div>' +
      '</div>' +
      '<div class="pick-body">' +
        '<div class="pick-facts">' +
          '<div class="pick-kcal"><b>' + n0(ps.kcal) + '</b><span>千卡/份</span></div>' +
          '<div class="pick-meta">' + r.time + ' 分钟 · ' + esc(r.catName) +
            (r.flavor ? ' · ' + esc(r.flavor) : '') + '</div>' +
          stockLine +
        '</div>' +
        '<p class="pick-step">' + esc((r.steps && r.steps[0]) || '') + '</p>' +
        '<div class="pick-actions">' +
          '<button class="btn btn-primary" data-act="accept" style="flex:1"><i class="fa-solid fa-utensils"></i>就它了</button>' +
          '<button class="btn btn-ghost" data-act="again"><i class="fa-solid fa-rotate"></i>换一个</button>' +
          '<button class="icon-btn" data-act="fav" title="收藏"><i class="' +
            (isFav(r.id) ? 'fa-solid' : 'fa-regular') + ' fa-heart" style="color:' +
            (isFav(r.id) ? 'var(--red)' : 'inherit') + '"></i></button>' +
        '</div>' +
      '</div>' +
    '</section>';
}

/* ------------------------------------------------------------
 * 今天三餐
 * ---------------------------------------------------------- */
function paintMeals(root) {
  const goal = state.settings.goalKcal || 1800;
  const saved = state.plan && state.plan.meals ? state.plan.meals : null;

  $('#threeMeals', root).innerHTML =
    '<div class="row" style="margin-bottom:10px">' +
      '<h2 class="h2"><i class="fa-solid fa-calendar-day"></i>今天吃什么好</h2>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-xs" data-nav="plan">调整 <i class="fa-solid fa-chevron-right"></i></button>' +
    '</div>' +
    '<div class="meal-list">' +
      MEALS.map((meal, i) => {
        const id = saved && saved[meal.key] && saved[meal.key].ids && saved[meal.key].ids[0];
        const r = id ? state.cat.recipesById.get(id) : suggestFor(meal, goal);
        if (!r) return '';
        return '<div class="meal-row" data-open="' + r.id + '">' +
          '<div class="meal-ico"><i class="fa-solid ' + meal.icon + '"></i></div>' +
          '<div class="meal-info">' +
            '<div class="meal-label">' + meal.label + '</div>' +
            '<div class="meal-name">' + esc(r.name) + '</div>' +
          '</div>' +
          '<div class="meal-kcal">' + n0(r.perServing.kcal) + '<i>千卡</i></div>' +
          '<button class="icon-btn meal-swap" data-swap="' + meal.key + '" title="换一道">' +
            '<i class="fa-solid fa-rotate"></i></button>' +
        '</div>';
      }).join('') +
    '</div>';
}

function suggestFor(meal, goal) {
  const budget = goal * meal.ratio;
  const pool = state.cat.recipes.filter((r) => meal.cats.includes(r.cat));
  if (!pool.length) return null;
  const sorted = pool.slice().sort((a, b) =>
    Math.abs(a.perServing.kcal - budget) - Math.abs(b.perServing.kcal - budget));
  return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
}

/* ------------------------------------------------------------
 * 临期提醒
 * ---------------------------------------------------------- */
function paintUrgent(root) {
  const urgent = state.inv.filter((r) => ['urgent', 'expired'].includes(expireStatus(r).status));
  const slot = $('#urgentSlot', root);
  if (!urgent.length) { slot.innerHTML = ''; return; }

  const names = urgent.slice(0, 3).map((r) => r.name).join('、');
  const ids = new Set(urgent.map((r) => r.key).filter(Boolean));
  // 用到越多临期食材的菜排越前
  const uses = state.cat.recipes
    .map((r) => ({ r, hits: (r.ings || []).filter((p) => ids.has(p[0])).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((x) => x.r);

  slot.innerHTML =
    '<div class="urgent-box">' +
      '<div class="urgent-head">' +
        '<i class="fa-solid fa-clock"></i>' +
        '<b>' + esc(names) + '</b> 快过期了' +
      '</div>' +
      (uses.length
        ? '<div class="urgent-list">' + uses.map((r) =>
            '<button class="urgent-item" data-open="' + r.id + '">' + esc(r.name) +
            '<span>' + n0(r.perServing.kcal) + '</span></button>').join('') + '</div>'
        : '<div class="urgent-list"><span class="hint-text">菜谱里暂时没有用到它们的做法</span></div>') +
    '</div>';
}

/* ------------------------------------------------------------
 * 事件
 * ---------------------------------------------------------- */
function bind(root) {
  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-quick]');
    if (q) {
      quickFilter = quickFilter === q.dataset.quick ? '' : q.dataset.quick;
      paintHero(root);
      if (quickFilter) draw(root);
      return;
    }

    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'draw' || a === 'again') { draw(root); return; }
      if (a === 'accept' && lastPick) { openRecipe(lastPick.id); return; }
      if (a === 'fav' && lastPick) {
        const on = await toggleFav(lastPick.id);
        act.innerHTML = '<i class="' + (on ? 'fa-solid' : 'fa-regular') + ' fa-heart" style="color:' +
          (on ? 'var(--red)' : 'inherit') + '"></i>';
        toast(on ? '已收藏' : '已取消收藏', 'ok');
        return;
      }
    }

    const swap = e.target.closest('[data-swap]');
    if (swap) {
      e.stopPropagation();
      const meal = MEALS.find((m) => m.key === swap.dataset.swap);
      const cur = swap.closest('.meal-row');
      const curName = cur ? cur.querySelector('.meal-name').textContent : '';
      const goal = state.settings.goalKcal || 1800;
      let next = suggestFor(meal, goal);
      let guard = 0;
      while (next && next.name === curName && guard++ < 8) next = suggestFor(meal, goal);
      if (next && cur) {
        cur.dataset.open = next.id;
        cur.querySelector('.meal-name').textContent = next.name;
        cur.querySelector('.meal-kcal').textContent = n0(next.perServing.kcal);
      }
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) { openRecipe(open.dataset.open); return; }
  }); }
}
