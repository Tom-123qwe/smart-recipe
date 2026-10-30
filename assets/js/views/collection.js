/* ============================================================
 * views/collection.js —— 收藏夹 + 自动购物清单
 * ============================================================ */

import {
  state, toggleFav, isFav, shoppingFromRecipes, addShopping, replaceShopping,
  toggleShopping, updateShoppingQty, removeShopping, clearShopping, invContext,
} from '../core/state.js';
import { ING_CATS, matchRecipe } from '../core/catalog.js';
import { recipeCard } from '../ui/cards.js';
import { openRecipe } from './recipe.js';
import { $, $$, esc, toast, emptyState, badge, confirmDialog, download, pickFile, todayISO, openModal } from '../ui/dom.js';
import { n0, n1, computeRecipe } from '../core/nutrition.js';

let tab = 'fav'; // fav | shop

/** 供外部（我的页 / 空状态按钮）切换标签 */
export function setTab(t) { tab = t === 'shop' ? 'shop' : 'fav'; }

export function render(root) {
  const favCount = state.favs.size;
  const pending = state.shopping.filter((s) => !s.checked).length;

  root.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title"><i class="fa-solid fa-heart"></i>收藏与清单</h1>' +
        '<p class="page-desc">收藏的菜可以一键汇总成购物清单，系统会自动扣掉库存里已有的量。</p>' +
      '</div>' +
    '</div>' +

    '<div class="row row-wrap mb-4" style="gap:10px">' +
      '<div class="segmented" id="segTabs">' +
        '<button data-tab="fav" class="' + (tab === 'fav' ? 'active' : '') + '"><i class="fa-solid fa-heart"></i> 收藏 ' + favCount + '</button>' +
        '<button data-tab="shop" class="' + (tab === 'shop' ? 'active' : '') + '"><i class="fa-solid fa-basket-shopping"></i> 购物清单 ' + pending + '</button>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<div class="row row-wrap" style="gap:8px" id="toolbar"></div>' +
    '</div>' +

    '<div id="collBody"></div>';

  $('#segTabs', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    render(root);
  });

  if (tab === 'fav') renderFav(root); else renderShop(root);
}

/* ------------------------------------------------------------
 * 收藏夹
 * ---------------------------------------------------------- */
function renderFav(root) {
  const toolbar = $('#toolbar', root);
  toolbar.innerHTML =
    '<button class="btn btn-soft btn-sm" data-act="favToShop"><i class="fa-solid fa-basket-shopping"></i>全部加入清单</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="favExport"><i class="fa-solid fa-download"></i>导出收藏</button>';

  const ctx = invContext();
  const list = state.cat.recipes
    .filter((r) => state.favs.has(r.id))
    .map((r) => ({ ...r, match: matchRecipe(r, ctx, 'loose') }));

  const body = $('#collBody', root);

  if (!list.length) {
    body.innerHTML = emptyState('fa-heart',
      '还没有收藏的菜',
      '在菜谱库或随机抽菜里点一下爱心，就会出现在这里。收藏的菜可以直接汇总成购物清单。',
      '<button class="btn btn-primary btn-sm" data-go="recipes"><i class="fa-solid fa-book-open"></i>去菜谱库逛逛</button>');
    bindCommon(root);
    return;
  }

  // 营养小结
  const avgKcal = list.reduce((s, r) => s + r.perServing.kcal, 0) / list.length;
  const doable = list.filter((r) => r.match.matched).length;

  body.innerHTML =
    '<div class="panel mb-4">' +
      '<div class="row row-wrap" style="gap:22px">' +
        '<div><div class="t-sub" style="font-size:12px;font-weight:700">收藏菜谱</div>' +
          '<div class="num" style="font-size:22px;font-weight:900;color:var(--primary)">' + list.length + '</div></div>' +
        '<div><div class="t-sub" style="font-size:12px;font-weight:700">现在能做</div>' +
          '<div class="num" style="font-size:22px;font-weight:900;color:var(--green-ink)">' + doable + '</div></div>' +
        '<div><div class="t-sub" style="font-size:12px;font-weight:700">平均每份热量</div>' +
          '<div class="num" style="font-size:22px;font-weight:900">' + n0(avgKcal) + ' <span style="font-size:11px;color:var(--text-3)">kcal</span></div></div>' +
      '</div>' +
    '</div>' +
    '<div class="recipe-grid">' + list.map((r) => recipeCard(r)).join('') + '</div>';

  bindCommon(root);
}

/* ------------------------------------------------------------
 * 购物清单
 * ---------------------------------------------------------- */
function renderShop(root) {
  const toolbar = $('#toolbar', root);
  const empty = state.shopping.length === 0;
  // 空清单时不摆一排用不上的按钮
  toolbar.innerHTML = empty
    ? '<button class="btn btn-soft btn-sm" data-act="shopAdd"><i class="fa-solid fa-plus"></i>手动添加</button>'
    : '<button class="btn btn-soft btn-sm" data-act="shopAdd"><i class="fa-solid fa-plus"></i>手动添加</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="shopExport"><i class="fa-solid fa-download"></i>导出</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="shopClearDone"><i class="fa-solid fa-check-double"></i>清掉已买</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="shopClear"><i class="fa-solid fa-trash-can"></i>清空</button>';

  const body = $('#collBody', root);
  const items = state.shopping.slice();

  if (!items.length) {
    body.innerHTML = emptyState('fa-basket-shopping',
      '购物清单是空的',
      '在菜谱详情点「加入购物清单」，或者到收藏页一键汇总。清单还会自动扣掉库存里已有的食材。',
      '<button class="btn btn-soft btn-sm" data-act="gotoFav"><i class="fa-solid fa-heart"></i>去收藏页汇总</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="shopAdd"><i class="fa-solid fa-plus"></i>手动添加</button>');
    bindCommon(root);
    return;
  }

  // 按大类分组
  const groups = new Map();
  items.forEach((it) => {
    const name = ING_CATS[it.cat] || '其他';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(it);
  });

  const done = items.filter((i) => i.checked).length;

  body.innerHTML =
    '<div class="panel mb-4">' +
      '<div class="row row-wrap" style="gap:20px;align-items:center">' +
        '<div><div class="t-sub" style="font-size:12px;font-weight:700">待买</div>' +
          '<div class="num" style="font-size:22px;font-weight:900;color:var(--primary)">' + (items.length - done) + '</div></div>' +
        '<div><div class="t-sub" style="font-size:12px;font-weight:700">已买</div>' +
          '<div class="num" style="font-size:22px;font-weight:900;color:var(--green-ink)">' + done + '</div></div>' +
        '<div class="spacer"></div>' +
        '<div style="min-width:180px">' +
          '<div class="match-bar"><span style="width:' + Math.round((done / items.length) * 100) + '%"></span></div>' +
          '<div class="hint-text" style="text-align:right;margin-top:5px">完成 ' + Math.round((done / items.length) * 100) + '%</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    Array.from(groups.entries()).map(([name, list]) =>
      '<div class="panel mb-3">' +
        '<div class="section-title"><i class="fa-solid fa-tag"></i>' + esc(name) +
          '<span class="hint">' + list.length + ' 项</span></div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          list.map(shopRow).join('') +
        '</div>' +
      '</div>').join('');

  bindCommon(root);
}

function shopRow(it) {
  return '<div class="inv-row" data-shop="' + it.id + '" style="' + (it.checked ? 'opacity:.55' : '') + '">' +
    '<label class="check"><input type="checkbox" ' + (it.checked ? 'checked' : '') + ' data-check="' + it.id + '"></label>' +
    '<div style="flex:1;min-width:0">' +
      '<div class="inv-name" style="' + (it.checked ? 'text-decoration:line-through' : '') + '">' + esc(it.name) + '</div>' +
      '<div class="inv-sub num">需买 <b class="num-hi">' + n0(it.grams) + '</b> 克</div>' +
    '</div>' +
    '<input class="input" type="number" min="0" step="10" value="' + n0(it.grams) + '" data-qty="' + it.id + '" ' +
      'style="width:86px;height:34px;text-align:center;font-size:13px">' +
    '<span class="t-mute" style="font-size:11px">克</span>' +
    '<button class="icon-btn" style="width:32px;height:32px;border-radius:10px" data-del="' + it.id + '" title="删除">' +
      '<i class="fa-solid fa-xmark" style="font-size:11px"></i></button>' +
  '</div>';
}

/* ------------------------------------------------------------
 * 公共事件
 * ---------------------------------------------------------- */
function bindCommon(root) {
  if (root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { window.dispatchEvent(new CustomEvent('sr:goto', { detail: { view: go.dataset.go } })); return; }

    const like = e.target.closest('[data-like]');
    if (like) {
      const on = await toggleFav(like.dataset.like);
      like.classList.toggle('on', on);
      like.innerHTML = '<i class="' + (on ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i>';
      toast(on ? '已收藏' : '已取消收藏', 'ok');
      if (!on) render(root);
      return;
    }

    const card = e.target.closest('[data-recipe]');
    if (card && !e.target.closest('[data-action]')) {
      openRecipe(card.dataset.recipe, { onChanged: () => render(root) });
      return;
    }

    // 删除 / 勾选购物项
    const del = e.target.closest('[data-del]');
    if (del) { await removeShopping(del.dataset.del); render(root); return; }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;

    if (a === 'favToShop') {
      const favs = state.cat.recipes.filter((r) => state.favs.has(r.id));
      if (!favs.length) { toast('还没有收藏', 'warn'); return; }
      const items = shoppingFromRecipes(favs.map((r) => ({ recipe: r, servings: r.servings })));
      if (!items.length) { toast('库存已经把食材覆盖了，不用买', 'ok'); return; }
      await replaceShopping(items.map((x) => Object.assign({}, x, { checked: false })));
      toast('已生成 ' + items.length + ' 项，已扣减库存', 'ok');
      tab = 'shop';
      render(root);
    }

    if (a === 'favExport') {
      const rows = state.cat.recipes.filter((r) => state.favs.has(r.id));
      download('favorites-' + todayISO() + '.json', JSON.stringify({ app: 'smart-recipe', type: 'favorites', items: rows.map((r) => ({ id: r.id, name: r.name, cat: r.cat, kcal: Math.round(r.perServing.kcal) })) }, null, 2));
      toast('已导出', 'ok');
    }

    if (a === 'gotoFav') { setTab('fav'); location.hash = '#fav'; return; }
    if (a === 'shopAdd') openAddShop(root);
    if (a === 'shopExport') {
      download('shopping-' + todayISO() + '.json', JSON.stringify({ app: 'smart-recipe', type: 'shopping', items: state.shopping }, null, 2));
      toast('已导出', 'ok');
    }
    if (a === 'shopClearDone') {
      const left = state.shopping.filter((s) => !s.checked);
      await replaceShopping(left);
      render(root); toast('已清理', 'ok');
    }
    if (a === 'shopClear') {
      const ok = await confirmDialog('清空整个购物清单？', { okText: '清空' });
      if (!ok) return;
      await clearShopping();
      render(root); toast('已清空', 'ok');
    }
  }); }

  // 勾选
  if (!root._changeBound) { root._changeBound = true; root.addEventListener('change', async (e) => {
    const cb = e.target.closest('[data-check]');
    if (cb) { await toggleShopping(cb.dataset.check, cb.checked); render(root); return; }
    const q = e.target.closest('[data-qty]');
    if (q) { await updateShoppingQty(q.dataset.qty, Number(q.value)); toast('已更新数量', 'ok'); }
  }); }
}

function openAddShop(root) {
  openModal({
    title: '手动添加购物项',
    icon: 'fa-plus',
    size: 'sm',
    body:
      '<div class="grid gap-3" style="grid-template-columns:1fr 110px">' +
        '<div class="field"><label>名称</label><input class="input" id="msName" placeholder="如：香菜"></div>' +
        '<div class="field"><label>数量（克）</label><input class="input" id="msQty" type="number" min="1" value="200"></div>' +
      '</div>',
    foot: '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="msSave">添加</button>',
    onMount(el, close) {
      el.querySelector('#msSave').addEventListener('click', async () => {
        const name = el.querySelector('#msName').value.trim();
        const grams = Number(el.querySelector('#msQty').value) || 0;
        if (!name || grams <= 0) { toast('名称和数量都要填', 'warn'); return; }
        const item = state.cat.ingredients.find((x) => x.name === name);
        await addShopping([{ key: item ? item.id : null, name: item ? item.name : name, grams, cat: item ? item.cat : 'veg', source: 'manual' }]);
        close();
        toast('已添加', 'ok');
        render(root);
      });
    },
  });
}
