/* ============================================================
 * ui/cards.js —— 菜谱卡片等可复用模板
 * ============================================================ */

import { esc, badge } from './dom.js';
import { n0, n1 } from '../core/nutrition.js';
import { isFav, state } from '../core/state.js';

/**
 * 宽幅头图：底层是同一张图的模糊放大版，上层是完整插画，
 * 用径向遮罩把上层边缘柔化，避免 4:3 插画被硬裁成 5:1。
 */
const HERO_MASK =
  '-webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 64%,transparent 100%);' +
  'mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 64%,transparent 100%)';

export function heroLayers(src) {
  return '<img src="' + src + '" alt="" aria-hidden="true" ' +
      'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'filter:blur(26px) saturate(1.15) brightness(.72);transform:scale(1.3)">' +
    '<img src="' + src + '" alt="" ' +
      'style="position:absolute;top:50%;left:50%;height:94%;width:auto;' +
      'transform:translate(-50%,-50%);' + HERO_MASK + '">';
}

/**
 * 菜谱卡片
 * @param {object} r    菜谱（enriched，含 perServing / match）
 * @param {{showMatch?:boolean, footerHtml?:string}} opts
 */
export function recipeCard(r, opts = {}) {
  const ps = r.perServing || { kcal: 0, p: 0, f: 0, c: 0 };
  const m = r.match;
  // 文案刻意中性：不显示刺眼的红字，也不在没录库存时显示
  const showMatch = opts.showMatch !== false && m && state.inv.length > 0;
  const matchTxt = showMatch ? (m.matched ? '材料都有' : '还差 ' + m.missingCount + ' 样') : '';
  const matchTone = showMatch ? (m.matched ? 'green' : 'amber') : '';

  const tops = [];
  if (showMatch) tops.push(badge(matchTxt, matchTone, m.matched ? 'fa-circle-check' : 'fa-basket-shopping'));
  if (r.user) tops.push(badge('我的菜谱', 'blue', 'fa-pen'));

  return '<article class="card card-hover recipe-card" data-recipe="' + r.id + '">' +
    '<div class="recipe-thumb">' +
      '<img src="' + r.img + '" alt="' + esc(r.name) + '" loading="lazy" width="800" height="600">' +
      '<div class="thumb-top">' + tops.join('') +
        '<button class="like-btn ' + (isFav(r.id) ? 'on' : '') + '" data-like="' + r.id + '" title="收藏" aria-label="收藏">' +
          '<i class="' + (isFav(r.id) ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i></button>' +
      '</div>' +
      '<div class="thumb-bot">' +
        badge(r.catName, 'primary', 'fa-utensils') +
        badge(r.time + ' 分钟', '', 'fa-clock') +
      '</div>' +
    '</div>' +
    '<div class="recipe-body">' +
      '<h3 class="recipe-name">' + esc(r.name) + '</h3>' +
      '<div class="recipe-meta">' +
        (r.flavor ? badge(r.flavor, 'line') : '') +
        (r.light ? badge('减脂', 'green', 'fa-feather') : '') +
        (r.highProtein ? badge('高蛋白', 'green', 'fa-dumbbell') : '') +
        (r.time <= 20 ? badge('快手', 'amber', 'fa-bolt') : '') +
      '</div>' +
      (showMatch ? '<div class="match-bar" title="材料齐备度 ' + Math.round(m.coverage * 100) + '%"><span style="width:' +
        Math.round(m.coverage * 100) + '%"></span></div>' : '') +
      '<div class="recipe-foot">' +
        '<div>' +
          '<div class="kcal-big num">' + n0(ps.kcal) + '</div>' +
          '<div class="kcal-unit">kcal / 份</div>' +
        '</div>' +
        '<div class="card-macros num" style="margin-left:auto;text-align:right;font-size:11px;line-height:1.6;color:var(--text-2)">' +
          '蛋白 ' + n1(ps.p) + 'g<br>脂肪 ' + n1(ps.f) + 'g · 碳水 ' + n1(ps.c) + 'g' +
        '</div>' +
      '</div>' +
      (opts.footerHtml ? '<div class="row row-wrap" style="gap:6px">' + opts.footerHtml + '</div>' : '') +
    '</div>' +
  '</article>';
}

/** 小号菜谱行（三餐规划用） */
export function recipeLine(r, extraHtml = '') {
  const ps = r.perServing || { kcal: 0 };
  return '<div class="row" style="gap:12px;padding:10px;border-radius:14px;background:var(--elev-2)" data-recipe="' + r.id + '">' +
    '<img src="' + r.img + '" alt="" width="52" height="52" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex:none">' +
    '<div style="min-width:0;flex:1">' +
      '<div style="font-weight:700;font-size:13.5px">' + esc(r.name) + '</div>' +
      '<div class="t-sub num" style="font-size:11.5px">' + n0(ps.kcal) + ' kcal · ' + r.time + ' 分钟 · ' + esc(r.catName) + '</div>' +
    '</div>' + extraHtml + '</div>';
}
