/* ============================================================
 * views/plan.js —— 三餐规划
 * ------------------------------------------------------------
 * 输入每日目标热量 → 按 早/午/晚 比例自动搭配，
 * 支持锁定某一餐（锁定后该餐不参与重算，热量从预算里扣除）。
 * ============================================================ */

import { state, saveSettings, savePlan, shoppingFromRecipes, addShopping, invContext } from '../core/state.js';
import { matchRecipe } from '../core/catalog.js';
import { recipeLine } from '../ui/cards.js';
import { openRecipe } from './recipe.js';
import { $, $$, esc, toast, badge, emptyState } from '../ui/dom.js';
import { n0, n1 } from '../core/nutrition.js';

const MEALS = [
  { key: 'breakfast', label: '早餐', icon: 'fa-mug-hot', hint: '清淡好消化' },
  { key: 'lunch', label: '午餐', icon: 'fa-bowl-rice', hint: '主食管饱' },
  { key: 'dinner', label: '晚餐', icon: 'fa-utensils', hint: '少油轻负担' },
];

/** 当前计划 */
let plan = null;

function blankPlan() {
  return {
    date: new Date().toISOString().slice(0, 10),
    goal: state.settings.goalKcal || 1800,
    ratio: (state.settings.mealRatio || [25, 40, 35]).slice(),
    meals: {
      breakfast: { ids: [], locked: false },
      lunch: { ids: [], locked: false },
      dinner: { ids: [], locked: false },
    },
  };
}

export function render(root) {
  plan = state.plan && state.plan.meals ? clone(state.plan) : blankPlan();
  if (!plan.goal) plan.goal = 1800;

  root.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title"><i class="fa-solid fa-calendar-days"></i>三餐规划</h1>' +
        '<p class="page-desc">填一个每日目标热量，系统按早 25% / 午 40% / 晚 35% 自动搭配，可以锁住不想换的那一餐。</p>' +
      '</div>' +
    '</div>' +

    '<div class="panel mb-5">' +
      '<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">' +
        '<div class="field">' +
          '<label>每日目标热量</label>' +
          '<div class="row" style="gap:10px">' +
            '<input class="input" id="goalInput" type="number" min="800" max="5000" step="50" value="' + plan.goal + '" style="max-width:120px">' +
            '<span class="t-sub" style="font-size:13px">kcal</span>' +
          '</div>' +
          '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:2px">' +
            [1400, 1600, 1800, 2000, 2200].map((v) =>
              '<button class="btn btn-ghost btn-xs" data-goal="' + v + '">' + v + '</button>').join('') +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>怎么分配</label>' +
          '<div class="hint-text" style="line-height:1.9;font-size:12.5px">' +
            '早餐 25% · 午餐 40% · 晚餐 35%<br>锁定某一餐后，另外两餐会自动补足' +
          '</div>' +
        '</div>' +
        '<div class="field" style="justify-content:flex-end">' +
          '<label>&nbsp;</label>' +
          '<div class="row row-wrap" style="gap:8px">' +
            '<button class="btn btn-primary" data-act="gen" style="flex:1"><i class="fa-solid fa-wand-magic-sparkles"></i>生成搭配</button>' +
            '<button class="btn btn-ghost" data-act="clear"><i class="fa-solid fa-rotate-left"></i>清空</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div id="planGrid" class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"></div>' +

    '<div id="planSummary" style="margin-top:16px"></div>';

  bind(root);
  paint(root);
  if (plan.meals.lunch.ids.length === 0) {
    // 首次进入自动给一份推荐，省得空着
    generate(root, true);
  }
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function bind(root) {
  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goal]');
    if (g) {
      plan.goal = Number(g.dataset.goal);
      $('#goalInput', root).value = plan.goal;
      paint(root); return;
    }

    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'gen') generate(root);
      if (a === 'clear') { plan = blankPlan(); plan.meals = blankPlan().meals; paint(root); }
      if (a === 'lock') {
        const k = act.dataset.meal;
        plan.meals[k].locked = !plan.meals[k].locked;
        paint(root);
        toast(plan.meals[k].locked ? MEALS.find((m) => m.key === k).label + '已锁定' : '已解锁', 'ok');
      }
      if (a === 'swap') {
        const k = act.dataset.meal;
        if (plan.meals[k].locked) { toast('先解锁再换', 'warn'); return; }
        swapMeal(k, root);
      }
      if (a === 'open') openRecipe(act.dataset.id);
      if (a === 'shop') {
        const entries = [];
        MEALS.forEach((m) => plan.meals[m.key].ids.forEach((id) => {
          const r = state.cat.recipesById.get(id);
          if (r) entries.push({ recipe: r, servings: r.servings });
        }));
        if (!entries.length) { toast('还没有搭配', 'warn'); return; }
        const items = shoppingFromRecipes(entries);
        addShopping(items).then(() => toast('已生成购物清单 ' + items.length + ' 项', 'ok'));
      }
      if (a === 'save') {
        savePlan(plan).then(() => toast('计划已保存到本地', 'ok'));
      }
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) openRecipe(open.dataset.open);
  }); }

  $('#goalInput', root).addEventListener('change', (e) => {
    plan.goal = Math.max(800, Math.min(5000, Number(e.target.value) || 1800));
    e.target.value = plan.goal;
    paint(root);
  });

}

/* ------------------------------------------------------------
 * 搭配算法
 * ---------------------------------------------------------- */

function mealPool(mealKey) {
  const all = state.cat.recipes;
  if (mealKey === 'breakfast') {
    return all.filter((r) => ['breakfast', 'staple'].includes(r.cat));
  }
  if (mealKey === 'lunch') {
    return all.filter((r) => ['meat', 'veg', 'egg', 'staple', 'cold'].includes(r.cat));
  }
  return all.filter((r) => ['meat', 'veg', 'egg', 'soup'].includes(r.cat) && r.perServing.kcal <= 600);
}

/** 在候选中挑一道最接近预算的（在前 4 名里随机，避免每次一样） */
function nearKcal(pool, budget, used) {
  const free = pool.filter((r) => !used.has(r.id));
  const src = free.length ? free : pool;
  const sorted = src.slice().sort((a, b) => Math.abs(a.perServing.kcal - budget) - Math.abs(b.perServing.kcal - budget));
  const top = sorted.slice(0, Math.min(4, sorted.length));
  return top[Math.floor(Math.random() * top.length)];
}

function generate(root, silent = false) {
  const goal = plan.goal;
  const used = new Set();

  MEALS.forEach((m, i) => {
    const slot = plan.meals[m.key];
    if (slot.locked && slot.ids.length) {
      slot.ids.forEach((id) => used.add(id));
      return;
    }
    const budget = (goal * plan.ratio[i]) / 100;
    const pool = mealPool(m.key);
    if (!pool.length) return;
    const main = nearKcal(pool, budget * 0.82, used);
    if (!main) return;
    used.add(main.id);
    let ids = [main.id];
    let rest = budget - main.perServing.kcal;

    // 午餐 / 晚餐还差得多时，补一道汤或素菜
    if ((m.key === 'lunch' || m.key === 'dinner') && rest > 130) {
      const sidePool = state.cat.recipes.filter((r) =>
        ['soup', 'veg', 'cold'].includes(r.cat) && !used.has(r.id));
      const side = nearKcal(sidePool, Math.min(rest, 260), used);
      if (side && Math.abs(rest - side.perServing.kcal) < rest) {
        ids.push(side.id);
        used.add(side.id);
      }
    }
    slot.ids = ids;
  });

  paint(root);
  saveSettings({ goalKcal: goal, mealRatio: plan.ratio });
  if (!silent) toast('搭配好了，不合适就单餐换一道', 'ok');
}

function swapMeal(key, root) {
  const idx = MEALS.findIndex((m) => m.key === key);
  const slot = plan.meals[key];
  const budget = (plan.goal * plan.ratio[idx]) / 100;
  const used = new Set();
  MEALS.forEach((m) => { if (m.key !== key) plan.meals[m.key].ids.forEach((id) => used.add(id)); });

  const pool = mealPool(key).filter((r) => !slot.ids.includes(r.id));
  const next = nearKcal(pool, budget * 0.82, used);
  if (!next) { toast('没有别的候选了', 'warn'); return; }
  slot.ids = [next.id];
  paint(root);
}

/** 统计 */
function mealKcal(slot) {
  return slot.ids.reduce((s, id) => {
    const r = state.cat.recipesById.get(id);
    return s + (r ? r.perServing.kcal : 0);
  }, 0);
}

function paint(root) {
  const grid = $('#planGrid', root);
  const ctx = invContext();
  let total = 0;

  grid.innerHTML = MEALS.map((m, i) => {
    const slot = plan.meals[m.key];
    const kcal = mealKcal(slot);
    total += kcal;
    const target = (plan.goal * plan.ratio[i]) / 100;
    const diff = kcal - target;
    const diffTone = Math.abs(diff) <= 80 ? 'green' : (Math.abs(diff) <= 200 ? 'amber' : 'red');

    const body = slot.ids.length
      ? slot.ids.map((id) => {
          const r = state.cat.recipesById.get(id);
          if (!r) return '';
          return '<div data-open="' + r.id + '" style="cursor:pointer">' +
            recipeLine(r, '') + '</div>';
        }).join('')
      : '<div class="hint-text" style="padding:12px 0">还没安排，点「生成搭配」或单餐换一道</div>';

    return '<div class="card card-pad">' +
      '<div class="row" style="gap:9px;margin-bottom:12px">' +
        '<span style="width:36px;height:36px;border-radius:12px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center">' +
          '<i class="fa-solid ' + m.icon + '"></i></span>' +
        '<div><div style="font-weight:800;font-size:15px">' + m.label + '</div>' +
          '<div class="t-mute" style="font-size:11px">' + m.hint + '</div></div>' +
        '<div class="spacer"></div>' +
        (slot.locked ? badge('已锁定', 'primary', 'fa-lock') : '') +
        '<button class="icon-btn" style="width:34px;height:34px;border-radius:11px" data-act="lock" data-meal="' + m.key + '" title="锁定这一餐">' +
          '<i class="fa-solid ' + (slot.locked ? 'fa-lock' : 'fa-lock-open') + '" style="font-size:12px"></i></button>' +
      '</div>' +
      '<div class="row" style="gap:10px;align-items:baseline;margin-bottom:10px">' +
        '<span class="num" style="font-size:24px;font-weight:900;color:var(--primary)">' + n0(kcal) + '</span>' +
        '<span class="t-mute" style="font-size:11px">/ 目标 ' + n0(target) + ' kcal</span>' +
        '<span class="badge badge-' + diffTone + '" style="margin-left:auto">' +
          (diff > 0 ? '+' : '') + n0(diff) + ' kcal</span>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' + body + '</div>' +
      '<div class="row" style="gap:8px;margin-top:12px">' +
        '<button class="btn btn-ghost btn-sm" data-act="swap" data-meal="' + m.key + '"><i class="fa-solid fa-rotate"></i>换一道</button>' +
      '</div>' +
    '</div>';
  }).join('');

  const remain = plan.goal - total;
  $('#planSummary', root).innerHTML = '<div class="panel">' +
    '<div class="row row-wrap" style="gap:20px;align-items:center">' +
      '<div><div class="t-sub" style="font-size:12px;font-weight:700">全天合计</div>' +
        '<div class="num" style="font-size:26px;font-weight:900;color:var(--primary)">' + n0(total) + ' <span style="font-size:12px;color:var(--text-3)">kcal</span></div></div>' +
      '<div><div class="t-sub" style="font-size:12px;font-weight:700">目标</div>' +
        '<div class="num" style="font-size:20px;font-weight:800">' + n0(plan.goal) + '</div></div>' +
      '<div><div class="t-sub" style="font-size:12px;font-weight:700">' + (remain >= 0 ? '还剩' : '超出') + '</div>' +
        '<div class="num" style="font-size:20px;font-weight:800;color:' + (Math.abs(remain) <= 120 ? 'var(--green-ink)' : 'var(--amber-ink)') + '">' +
          n0(Math.abs(remain)) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div class="row row-wrap" style="gap:8px">' +
        '<button class="btn btn-ghost btn-sm" data-act="save"><i class="fa-solid fa-bookmark"></i>保存计划</button>' +
        '<button class="btn btn-primary btn-sm" data-act="shop"><i class="fa-solid fa-basket-shopping"></i>生成购物清单</button>' +
      '</div>' +
    '</div>' +
    '<p class="hint-text" style="margin:12px 0 0">提示：营养值按每道菜的「每份」计算，一餐吃两份请点开菜谱调整份数后再看。</p>' +
  '</div>';
}
