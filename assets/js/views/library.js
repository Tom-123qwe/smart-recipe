/* ============================================================
 * views/library.js —— 菜谱
 * ------------------------------------------------------------
 * 三行筛选就够用：
 *   1. 搜索（菜名 / 食材）
 *   2. 分类（荤菜、素菜、汤……）
 *   3. 场景（快手、想吃肉、清淡……）
 * 忌口收进一个按钮里的弹窗，不占版面。
 * 默认只有「宽松匹配」：缺一两样材料也正常展示，只在详情里给替代方案。
 * ============================================================ */

import { state, invContext, saveSettings, toggleFav } from '../core/state.js';
import { CATS, DIET_FILTERS, AVOIDS, filterRecipes } from '../core/catalog.js';
import { recipeCard } from '../ui/cards.js';
import { openRecipe } from './recipe.js';
import { $, esc, toast, emptyState, openModal } from '../ui/dom.js';

const F = {
  cat: 'all',
  q: '',
  avoids: [],
  diets: [],
  mode: 'loose',
  onlyMatch: false,
  sort: 'match',
};

let bound = false;
const PAGE = 60;   // 一次渲染多少张卡片，剩下的点「显示更多」
let shown = PAGE;

/** 从别处跳转过来时使用：只显示现在能做的 */
export function focusUrgent() {
  F.cat = 'all';
  F.diets = [];
  F.onlyMatch = true;
  bound = true;
}

export function render(root) {
  if (!bound) {
    F.avoids = (state.settings.avoid || []).slice();
    F.diets = (state.settings.diets || []).slice();
    if (state.pendingUrgent) { F.onlyMatch = true; state.pendingUrgent = false; }
    bound = true;
  }

  root.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title">菜谱</h1>' +
        '<p class="page-desc">' + state.cat.recipes.length + ' 道家常菜，点开就能看做法和热量</p>' +
      '</div>' +
    '</div>' +

    '<div class="search-row">' +
      '<div class="input-ico" style="flex:1;max-width:520px">' +
        '<i class="fa-solid fa-magnifying-glass"></i>' +
        '<input class="input" id="qInput" placeholder="搜菜名或食材，比如「番茄」「鸡蛋」" value="' + esc(F.q) + '">' +
      '</div>' +
      '<button class="btn btn-ghost" data-act="avoid" style="flex:none">' +
        '<i class="fa-solid fa-sliders"></i>忌口' +
        (F.avoids.length ? '<span class="pill-count">' + F.avoids.length + '</span>' : '') +
      '</button>' +
    '</div>' +

    '<div class="filter-bar scroller" id="catBar" style="margin-bottom:10px"></div>' +
    '<div class="filter-bar scroller" id="dietBar" style="margin-bottom:6px"></div>' +

    '<div class="row row-wrap" style="gap:8px;margin:14px 0 12px">' +
      '<span id="resMeta" class="t-sub" style="font-size:13px"></span>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-xs" data-act="reset" style="display:none" id="resetBtn">' +
        '<i class="fa-solid fa-rotate-left"></i>清空</button>' +
    '</div>' +
    '<div id="recipeGrid" class="recipe-grid"></div>';

  buildCatBar(root);
  buildDietBar(root);
  bind(root);
  paint(root);
}

function buildCatBar(root) {
  const counts = {};
  state.cat.recipes.forEach((r) => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
  const html = ['<button class="chip ' + (F.cat === 'all' ? 'active' : '') + '" data-cat="all">全部</button>']
    .concat(Object.keys(CATS).filter((k) => counts[k]).map((k) =>
      '<button class="chip ' + (F.cat === k ? 'active' : '') + '" data-cat="' + k + '">' +
        '<i class="fa-solid ' + CATS[k].icon + '"></i>' + CATS[k].name + '</button>'))
    .join('');
  $('#catBar', root).innerHTML = html;
}

function buildDietBar(root) {
  $('#dietBar', root).innerHTML = DIET_FILTERS.map((d) =>
    '<button class="chip chip-green ' + (F.diets.includes(d.id) ? 'active' : '') + '" data-diet="' + d.id + '">' +
      '<i class="fa-solid ' + d.icon + '"></i>' + shortLabel(d.label) + '</button>').join('');
}

function shortLabel(t) {
  return t.replace('减脂轻卡', '减脂').replace('20 分钟快手', '快手').replace('主食饱腹', '主食');
}

function bind(root) {
  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', (e) => {
    const chipCat = e.target.closest('[data-cat]');
    if (chipCat) { F.cat = chipCat.dataset.cat; shown = PAGE; buildCatBar(root); paint(root); return; }

    const diet = e.target.closest('[data-diet]');
    if (diet) {
      const id = diet.dataset.diet;
      F.diets = F.diets.includes(id) ? F.diets.filter((x) => x !== id) : F.diets.concat(id);
      saveSettings({ diets: F.diets });
      shown = PAGE; buildDietBar(root); paint(root); return;
    }

    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'more') { shown += PAGE; paint(root); return; }
      if (act.dataset.act === 'avoid') { openAvoid(root); return; }
      if (act.dataset.act === 'reset') {
        F.cat = 'all'; F.q = ''; F.avoids = []; F.diets = []; F.onlyMatch = false; shown = PAGE;
        saveSettings({ avoid: [], diets: [] });
        render(root); return;
      }
    }

    const like = e.target.closest('[data-like]');
    if (like) {
      e.stopPropagation();
      toggleFav(like.dataset.like).then((on) => {
        like.classList.toggle('on', on);
        like.innerHTML = '<i class="' + (on ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i>';
        toast(on ? '已收藏' : '已取消收藏', 'ok');
      });
      return;
    }

    const card = e.target.closest('[data-recipe]');
    if (card) openRecipe(card.dataset.recipe, { onChanged: () => paint(root) });
  }); }

  const q = $('#qInput', root);
  let timer = 0;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { F.q = q.value; shown = PAGE; paint(root); }, 180);
  });
}

/** 忌口选择弹窗 */
function openAvoid(root) {
  openModal({
    title: '我不吃什么',
    icon: 'fa-sliders',
    size: 'sm',
    body:
      '<p class="hint-text" style="margin:0 0 12px">选中后，含这些的菜会自动隐藏。</p>' +
      '<div class="filter-bar">' +
        AVOIDS.map((a) =>
          '<button class="chip ' + (F.avoids.includes(a.id) ? 'active' : '') + '" data-pick="' + a.id + '">' +
            '<i class="fa-solid ' + a.icon + '"></i>' + a.label + '</button>').join('') +
      '</div>',
    foot: '<button class="btn btn-ghost" data-close>取消</button>' +
          '<button class="btn btn-primary" id="avoidSave">就这些</button>',
    onMount(el, close) {
      const picked = new Set(F.avoids);
      el.querySelectorAll('[data-pick]').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.pick;
          if (picked.has(id)) { picked.delete(id); b.classList.remove('active'); }
          else { picked.add(id); b.classList.add('active'); }
        });
      });
      el.querySelector('#avoidSave').addEventListener('click', () => {
        F.avoids = Array.from(picked);
        saveSettings({ avoid: F.avoids });
        close();
        render(root);
      });
    },
  });
}

function paint(root) {
  const ctx = invContext();
  let list = filterRecipes(state.cat.recipes, {
    catId: F.cat,
    avoids: F.avoids,
    diets: F.diets,
    q: F.q,
    maxTime: 0,
    onlyMatch: F.onlyMatch,
    mode: 'loose',
    ctx,
  }, state.cat);

  if (F.sort === 'kcal') list = list.slice().sort((a, b) => a.perServing.kcal - b.perServing.kcal);

  const grid = $('#recipeGrid', root);
  const meta = $('#resMeta', root);

  const hasFilter = F.cat !== 'all' || F.q || F.avoids.length || F.diets.length || F.onlyMatch;
  const resetBtn = $('#resetBtn', root);
  if (resetBtn) resetBtn.style.display = hasFilter ? 'inline-flex' : 'none';

  // 只有真的录入过库存，才谈「能做几道」，否则不制造焦虑
  if (state.inv.length) {
    const canDo = list.filter((r) => r.match && r.match.matched).length;
    meta.innerHTML = '<b>' + list.length + '</b> 道 · 冰箱里能做的 <b style="color:var(--green-ink)">' + canDo + '</b> 道';
  } else {
    meta.innerHTML = '<b>' + list.length + '</b> 道菜';
  }

  if (!list.length) {
    grid.innerHTML = emptyState('fa-bowl-food', '没找到符合条件的菜',
      '换个说法搜搜看，或者点「清空」恢复全部菜谱。',
      '<button class="btn btn-soft btn-sm" data-act="reset"><i class="fa-solid fa-rotate-left"></i>清空筛选</button>');
    return;
  }

  // 一次只画一屏多的卡片，625 道全画会卡住首屏
  const page = list.slice(0, shown);
  grid.innerHTML = page.map((r) => recipeCard(r, { showMatch: state.inv.length > 0 })).join('');
  if (list.length > shown) {
    grid.insertAdjacentHTML('beforeend',
      '<div style="grid-column:1/-1;text-align:center;padding:16px 0">' +
        '<button class="btn btn-ghost" data-act="more">' +
          '<i class="fa-solid fa-arrow-down"></i>显示更多（还有 ' + (list.length - shown) + ' 道）' +
        '</button>' +
      '</div>');
  }
}
