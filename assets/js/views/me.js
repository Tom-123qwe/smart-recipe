/* ============================================================
 * views/me.js —— 「我的」
 * ------------------------------------------------------------
 * 把库存、收藏、写菜谱、设置这些"管理类"功能收进一个入口，
 * 顶部只留三个数字，下面是一列大按钮，点进去才是二级页面。
 * ============================================================ */

import { state } from '../core/state.js';
import { esc } from '../ui/dom.js';
import { setTab as setShopTab } from './collection.js';

export function render(root) {
  const fav = state.favs.size;
  const stock = state.inv.length;
  const shop = state.shopping.filter((s) => !s.checked).length;
  const mine = state.userRecipes.length;

  root.innerHTML =
    '<div class="me-head">' +
      '<div class="me-face"><i class="fa-solid fa-user"></i></div>' +
      '<div>' +
        '<h1 class="me-title">我的厨房</h1>' +
        '<p class="me-sub">数据只存在这台设备上，别人看不到</p>' +
      '</div>' +
    '</div>' +

    '<div class="me-stats">' +
      stat(fav, '收藏', 'fav') +
      stat(stock, '冰箱', 'stock') +
      stat(shop, '待买', 'shop') +
    '</div>' +

    '<div class="me-list">' +
      row('stock', 'fa-boxes-stacked', '冰箱里有什么', stock ? stock + ' 样食材' : '记两样，就能推荐能做啥') +
      row('fav', 'fa-heart', '我的收藏', fav ? fav + ' 道菜' : '还没有收藏的菜') +
      row('plan', 'fa-calendar-days', '三餐安排', '按热量自动搭配') +
      row('mine', 'fa-pen', '写自己的菜谱', mine ? mine + ' 道' : '把家里的做法记下来') +
      row('settings', 'fa-gear', '设置与备份', '换手机、导出数据') +
    '</div>' +

    '<p class="me-foot">家常菜谱 · 离线版 v1.0 · 共 ' + state.cat.recipes.length + ' 道菜</p>';

  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', (e) => {
    const item = e.target.closest('[data-go]');
    if (item) {
      location.hash = '#' + item.dataset.go;
      return;
    }
    const s = e.target.closest('[data-stat]');
    if (s) {
      const v = s.dataset.stat;
      if (v === 'stock') { location.hash = '#stock'; return; }
      setShopTab(v === 'shop' ? 'shop' : 'fav');
      location.hash = '#fav';
    }
  }); }
}

function stat(n, label, go) {
  return '<button class="me-stat" data-stat="' + go + '">' +
    '<b>' + n + '</b><span>' + label + '</span></button>';
}

function row(go, icon, title, sub) {
  return '<button class="me-row" data-go="' + go + '">' +
    '<span class="me-row-ico"><i class="fa-solid ' + icon + '"></i></span>' +
    '<span class="me-row-text"><b>' + esc(title) + '</b><i>' + esc(sub) + '</i></span>' +
    '<i class="fa-solid fa-chevron-right me-chev"></i>' +
  '</button>';
}
