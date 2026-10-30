/* ============================================================
 * views/random.js —— 随机抽菜（二级页）
 * ------------------------------------------------------------
 * 相比首页的一键抽菜，这里多一层「想吃哪类」的范围选择。
 * 只有一行胶囊，其余（黑名单、历史）都在下面。
 * ============================================================ */

import {
  state, invContext, addBlacklist, removeBlacklist, recordDraw, toggleFav, isFav, pruneBlacklist,
} from '../core/state.js';
import { CATS, matchRecipe } from '../core/catalog.js';
import { openRecipe } from './recipe.js';
import { $, esc, toast, confirmDialog } from '../ui/dom.js';
import { n0, n1 } from '../core/nutrition.js';
import { heroLayers } from '../ui/cards.js';

const R = { cat: 'all' };

let lastId = null;
let rolling = false;

export function render(root) {
  pruneBlacklist();

  root.innerHTML =
    '<div class="panel" style="margin-bottom:16px">' +
      '<div class="t-sub" style="font-size:12.5px;font-weight:700;margin-bottom:10px">想吃哪一类？</div>' +
      '<div class="filter-bar scroller" id="rCatBar"></div>' +
    '</div>' +

    '<div id="drawArea"></div>' +

    '<div class="panel" style="margin-top:18px">' +
      '<div class="section-title"><i class="fa-solid fa-ban"></i>不想再看到的' +
        '<span class="hint" id="blockHint"></span>' +
        (state.blacklist.size
          ? '<button class="btn btn-ghost btn-xs" data-act="clearBlock" style="margin-left:10px">全部恢复</button>'
          : '') + '</div>' +
      '<div id="blockList"></div>' +
    '</div>' +

    '<div class="panel" style="margin-top:14px">' +
      '<div class="section-title"><i class="fa-solid fa-clock-rotate-left"></i>最近抽到的</div>' +
      '<div id="histList"></div>' +
    '</div>';

  buildCatBar(root);
  bind(root);
  paintBlock(root);
  paintHistory(root);
  paintIdle(root);
}

function buildCatBar(root) {
  const counts = {};
  state.cat.recipes.forEach((r) => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
  $('#rCatBar', root).innerHTML =
    '<button class="chip ' + (R.cat === 'all' ? 'active' : '') + '" data-cat="all">都行</button>' +
    Object.keys(CATS).filter((k) => counts[k]).map((k) =>
      '<button class="chip ' + (R.cat === k ? 'active' : '') + '" data-cat="' + k + '">' +
        '<i class="fa-solid ' + CATS[k].icon + '"></i>' + CATS[k].name + '</button>').join('');
}

function bind(root) {
  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { R.cat = cat.dataset.cat; buildCatBar(root); paintIdle(root); return; }

    const act = e.target.closest('[data-act]');
    if (!act) {
      const open = e.target.closest('[data-open]');
      if (open) openRecipe(open.dataset.open);
      return;
    }

    const a = act.dataset.act;
    if (a === 'draw' || a === 'roll') doDraw(root);
    if (a === 'block') {
      if (!lastId) return;
      addBlacklist(lastId, 24).then(() => {
        toast('好，24 小时内不再抽到它', 'ok');
        paintBlock(root);
        doDraw(root);
      });
    }
    if (a === 'fav') {
      if (!lastId) return;
      toggleFav(lastId).then((on) => {
        toast(on ? '已收藏' : '已取消收藏', 'ok');
        refreshFavBtn(root, on);
        paintHistory(root);
      });
    }
    if (a === 'open') { if (lastId) openRecipe(lastId); }
    if (a === 'clearBlock') {
      confirmDialog('把屏蔽的菜全部放回来？', { okText: '全部恢复' }).then((ok) => {
        if (!ok) return;
        Array.from(state.blacklist.keys()).forEach((id) => removeBlacklist(id));
        paintBlock(root);
        toast('已恢复', 'ok');
      });
    }
    if (a === 'unblock') {
      removeBlacklist(act.dataset.id).then(() => paintBlock(root));
    }
  }); }
}

/* ---------- 候选 ---------- */
let fellBack = false;

function poolRaw() {
  const avoids = state.settings.avoid || [];
  return state.cat.recipes.filter((r) => {
    if (R.cat !== 'all' && r.cat !== R.cat) return false;
    if (avoids.length && avoids.some((a) => r.avoidSet.has(a))) return false;
    return true;
  });
}

/** 库存里有东西时，优先抽「现在能做」的；库存为空就纯随机 */
function candidates() {
  fellBack = false;
  const pool = poolRaw();
  if (!state.inv.length) return pool;
  const ctx = invContext();
  const doable = pool.filter((r) => matchRecipe(r, ctx, 'loose').matched);
  if (doable.length && doable.length < pool.length) {
    fellBack = true;
    return doable;
  }
  return pool;
}

function paintIdle(root) {
  const pool = candidates();
  $('#drawArea', root).innerHTML =
    '<div class="hero" style="padding:30px 20px 28px">' +
      '<div class="hero-emoji"><i class="fa-solid fa-dice"></i></div>' +
      '<h2 class="hero-title" style="font-size:24px">' + pool.length + ' 道菜等你抽</h2>' +
      '<p class="hero-sub">' + (fellBack ? '优先推荐冰箱里能做的' : '不想纠结就交给运气') + '</p>' +
      '<button class="btn-hero" data-act="draw"><i class="fa-solid fa-shuffle"></i> 抽一道</button>' +
    '</div>';
}

async function doDraw(root) {
  if (rolling) return;
  let pool = candidates().filter((r) => !state.blacklist.has(r.id));
  if (pool.length > 1 && lastId) pool = pool.filter((r) => r.id !== lastId);

  if (!pool.length) {
    toast('这个范围里的菜都被屏蔽了，先把它们放回来吧', 'warn', 3200);
    return;
  }

  rolling = true;
  $('#drawArea', root).innerHTML =
    '<div class="panel" style="padding:34px 20px;text-align:center">' +
      '<div class="empty-ico" style="margin:0 auto 16px"><i class="fa-solid fa-dice"></i></div>' +
      '<div id="rollName" style="font-size:20px;font-weight:800;color:var(--primary);min-height:30px">…</div>' +
    '</div>';

  let i = 0;
  const names = pool.slice(0, 12);
  const timer = setInterval(() => {
    const el = $('#rollName', root);
    if (el) el.textContent = names[i % names.length].name;
    i += 1;
  }, 70);

  setTimeout(async () => {
    clearInterval(timer);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    lastId = chosen.id;
    await recordDraw(chosen.id);
    rolling = false;
    paintResult(root, chosen);
    paintHistory(root);
  }, 620);
}

function paintResult(root, r) {
  const m = matchRecipe(r, invContext(), 'loose');
  const ps = r.perServing;
  const fav = isFav(r.id);
  const hasStock = state.inv.length > 0;

  $('#drawArea', root).innerHTML =
    '<div class="pick-card">' +
      '<div class="pick-hero">' + heroLayers(r.img) +
        '<div class="pick-veil"></div>' +
        '<div class="pick-name">' + esc(r.name) + '</div>' +
      '</div>' +
      '<div class="pick-body">' +
        '<div class="pick-facts">' +
          '<div class="pick-kcal"><b>' + n0(ps.kcal) + '</b><span>千卡/份</span></div>' +
          '<div class="pick-meta">蛋白 ' + n1(ps.p) + 'g · 脂肪 ' + n1(ps.f) + 'g<br>' +
            r.time + ' 分钟 · ' + esc(r.catName) + '</div>' +
          (hasStock
            ? (m.matched
                ? '<span class="pill pill-green"><i class="fa-solid fa-check"></i>材料都有</span>'
                : '<span class="pill pill-amber">还差 ' + m.missingCount + ' 样材料</span>')
            : '') +
        '</div>' +
        '<p class="pick-step">' + esc((r.steps && r.steps[0]) || '') + '</p>' +
        '<div class="pick-actions">' +
          '<button class="btn btn-primary" data-act="open" style="flex:1"><i class="fa-solid fa-utensils"></i>看做法</button>' +
          '<button class="btn btn-ghost" data-act="roll"><i class="fa-solid fa-rotate"></i>换一个</button>' +
          '<button class="icon-btn" data-act="fav" id="favBtn" title="收藏">' +
            '<i class="' + (fav ? 'fa-solid' : 'fa-regular') + ' fa-heart" style="color:' +
            (fav ? 'var(--red)' : 'inherit') + '"></i></button>' +
          '<button class="icon-btn" data-act="block" title="24 小时不再抽到"><i class="fa-solid fa-ban"></i></button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function refreshFavBtn(root, on) {
  const btn = $('#favBtn', root);
  if (!btn) return;
  btn.innerHTML = '<i class="' + (on ? 'fa-solid' : 'fa-regular') + ' fa-heart" style="color:' +
    (on ? 'var(--red)' : 'inherit') + '"></i>';
}

function paintBlock(root) {
  const host = $('#blockList', root);
  if (!host) return;
  const hint = $('#blockHint', root);
  if (hint) hint.textContent = state.blacklist.size ? state.blacklist.size + ' 道菜暂时不再抽' : '（暂无）';

  if (!state.blacklist.size) {
    host.innerHTML = '<p class="hint-text" style="margin:0">抽到不想吃的，点结果卡上的禁止按钮就行。</p>';
    return;
  }
  host.innerHTML = '<div class="row row-wrap" style="gap:8px">' +
    Array.from(state.blacklist.entries()).map(([id, until]) => {
      const r = state.cat.recipesById.get(id);
      const h = Math.max(1, Math.ceil((until - Date.now()) / 3600000));
      return '<span class="badge badge-amber" style="padding:6px 10px;font-size:12px">' +
        '<i class="fa-solid fa-ban"></i>' + esc(r ? r.name : id) + ' · ' + h + ' 小时' +
        '<button data-act="unblock" data-id="' + id + '" style="border:0;background:transparent;cursor:pointer;color:inherit;padding:0 0 0 4px">' +
        '<i class="fa-solid fa-xmark" style="font-size:10px"></i></button></span>';
    }).join('') + '</div>';
}

function paintHistory(root) {
  const host = $('#histList', root);
  if (!host) return;
  const seen = new Set();
  const rows = state.history.filter((h) => {
    if (seen.has(h.recipeId)) return false;
    seen.add(h.recipeId);
    return true;
  }).slice(0, 10);

  if (!rows.length) {
    host.innerHTML = '<p class="hint-text" style="margin:0">还没抽过。</p>';
    return;
  }
  host.innerHTML = '<div class="row row-wrap" style="gap:8px">' +
    rows.map((h) => {
      const r = state.cat.recipesById.get(h.recipeId);
      if (!r) return '';
      return '<button class="chip" data-open="' + r.id + '">' + esc(r.name) + '</button>';
    }).join('') + '</div>';
}
