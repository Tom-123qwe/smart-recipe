/* ============================================================
 * views/recipe.js —— 菜谱详情弹窗 + 份数实时重算 + 打印
 * ------------------------------------------------------------
 * 核心交互：
 *   · 份数滑块拖动 → 克数、营养、整锅热量全部实时重算
 *   · 克 / 勺 一键切换
 *   · 点开任意一行食材 → 查看这道菜里「这一样食材」贡献了多少营养
 *   · 浏览器打印（生成独立打印版式，不影响屏幕布局）
 * ============================================================ */

import {
  state, isFav, toggleFav, invContext, addShopping,
} from '../core/state.js';
import { matchRecipe, getSubstitutes } from '../core/catalog.js';
import { computeRecipe, formatAmount, n0, n1, macroRatio } from '../core/nutrition.js';
import { esc, toast, openModal, badge, $, $$ } from '../ui/dom.js';
import { heroLayers } from '../ui/cards.js';

/**
 * 打开菜谱详情
 * @param {string} id
 * @param {{onChanged?:Function, extraFoot?:string}} opts
 */
export function openRecipe(id, opts = {}) {
  const r = state.cat.recipesById.get(id);
  if (!r) { toast('菜谱不存在', 'err'); return; }

  let servings = Number(r.servings) || 2;
  let unit = state.settings.unit === 'spoon' ? 'spoon' : 'g';

  const ctx = invContext();
  const mode = state.settings.strictMode ? 'strict' : 'loose';
  const match = matchRecipe(r, ctx, mode);

  const body =
    // 头图
    '<div style="position:relative;margin:-20px -20px 16px;height:190px;overflow:hidden;background:var(--elev-2)">' +
      heroLayers(r.img) +
      '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 32%,rgba(20,10,4,.76))"></div>' +
      '<div style="position:absolute;left:18px;right:18px;bottom:14px;color:#fff">' +
        '<div style="font-size:22px;font-weight:900;letter-spacing:-.02em;text-shadow:0 2px 12px rgba(0,0,0,.35)">' + esc(r.name) + '</div>' +
        '<div class="row row-wrap" style="gap:6px;margin-top:7px">' +
          '<span class="badge" style="background:rgba(255,255,255,.92);color:#3a2a1c">' + esc(r.catName) + '</span>' +
          '<span class="badge" style="background:rgba(255,255,255,.92);color:#3a2a1c"><i class="fa-solid fa-clock"></i>' + r.time + ' 分钟</span>' +
          '<span class="badge" style="background:rgba(255,255,255,.92);color:#3a2a1c"><i class="fa-solid fa-gauge-high"></i>' + difficultyText(r.diff) + '</span>' +
          (r.user ? '<span class="badge" style="background:rgba(255,255,255,.92);color:#3a2a1c">我的菜谱</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +

    // 规格控制
    '<div class="row row-wrap" style="gap:14px;align-items:flex-end">' +
      '<div style="flex:1;min-width:210px">' +
        '<div class="label" style="margin-bottom:6px">份数 <span class="t-mute" id="rdServMeta"></span></div>' +
        '<div class="range-wrap">' +
          '<input type="range" class="range" id="rdServ" min="1" max="8" step="1" value="' + servings + '">' +
          '<span class="range-val" id="rdServVal">' + servings + ' 份</span>' +
        '</div>' +
      '</div>' +
      '<div class="field" style="width:auto">' +
        '<label>用量单位</label>' +
        '<div class="segmented" id="rdUnit">' +
          '<button data-u="g" class="' + (unit === 'g' ? 'active' : '') + '">克</button>' +
          '<button data-u="spoon" class="' + (unit === 'spoon' ? 'active' : '') + '">勺</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // 营养概览
    '<div id="rdSummary" style="margin-top:16px"></div>' +

    // 食材 / 调料
    '<div class="grid gap-4" style="grid-template-columns:1fr;margin-top:16px">' +
      '<div>' +
        '<div class="section-title"><i class="fa-solid fa-carrot"></i>食材用量' +
          '<span class="hint">点一行看单个食材的营养贡献</span></div>' +
        '<div id="rdIngList"></div>' +
      '</div>' +
      '<div>' +
        '<div class="section-title"><i class="fa-solid fa-flask-vial"></i>调料用量</div>' +
        '<div id="rdSeaList"></div>' +
      '</div>' +
    '</div>' +

    // 缺料与替代
    '<div id="rdMissing" style="margin-top:4px"></div>' +

    // 做法
    '<div style="margin-top:18px">' +
      '<div class="section-title"><i class="fa-solid fa-fire-burner"></i>做法</div>' +
      '<ol class="steps" style="margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:10px">' +
        (r.steps || []).map((s, i) =>
          '<li class="row" style="gap:12px;align-items:flex-start">' +
            '<span style="flex:none;width:26px;height:26px;border-radius:50%;background:var(--primary-soft);color:var(--primary-ink);display:grid;place-items:center;font-size:12px;font-weight:800" class="num">' + (i + 1) + '</span>' +
            '<span style="font-size:13.5px;line-height:1.75;color:var(--text)">' + esc(s) + '</span>' +
          '</li>').join('') +
      '</ol>' +
    '</div>' +

    (r.tips ? '<div class="panel" style="margin-top:16px;background:var(--amber-soft);border:0">' +
      '<div class="row" style="gap:9px;align-items:flex-start"><i class="fa-solid fa-lightbulb" style="color:var(--amber-ink);margin-top:2px"></i>' +
      '<div style="font-size:13px;line-height:1.75;color:var(--amber-ink)"><b>小贴士：</b>' + esc(r.tips) + '</div></div></div>' : '') +

    '<div class="row row-wrap" style="gap:6px;margin-top:16px">' +
      (r.tags || []).map((t) => badge(t, 'line')).join('') +
    '</div>';

  // 视频入口：数据里填了 video 就直达，否则按菜名去抖音搜做法
  const videoUrl = (r.video && /^https?:\/\//.test(r.video))
    ? r.video
    : 'https://www.douyin.com/search/' + encodeURIComponent(r.name + ' 做法');
  const videoLabel = (r.video && /^https?:\/\//.test(r.video)) ? '看视频' : '抖音找做法';

  const favNow = isFav(r.id);
  const foot =
    '<a class="btn btn-ghost" href="' + videoUrl + '" target="_blank" rel="noopener noreferrer" ' +
      'title="在抖音搜索这道菜的做法视频">' +
      '<i class="fa-solid fa-circle-play"></i>' + videoLabel + '</a>' +
    '<button class="btn btn-ghost" data-act="fav">' +
      '<i class="' + (favNow ? 'fa-solid' : 'fa-regular') + ' fa-heart" style="color:' + (favNow ? 'var(--red)' : 'inherit') + '"></i>' +
      (favNow ? '已收藏' : '收藏') + '</button>' +
    '<button class="btn btn-ghost" data-act="shop"><i class="fa-solid fa-basket-shopping"></i>加入购物清单</button>' +
    (opts.extraFoot || '') +
    '<button class="btn btn-primary" data-close><i class="fa-solid fa-check"></i>知道了</button>';

  const modal = openModal({
    title: '菜谱详情',
    body,
    foot,
    size: 'lg',
    onMount(el, close) {
      const servEl = $('#rdServ', el);
      const servVal = $('#rdServVal', el);
      const servMeta = $('#rdServMeta', el);

      const paint = () => {
        const nut = computeRecipe(r, state.cat, servings);
        const ratio = macroRatio(nut.totals);
        const totalGrams = nut.rows.filter((x) => x.kind === 'ing').reduce((s, x) => s + x.grams, 0);

        $('#rdSummary', el).innerHTML = summaryTpl(nut, ratio);
        $('#rdIngList', el).innerHTML = nut.rows.filter((x) => x.kind === 'ing').map((x) => rowTpl(x, unit, ctx)).join('') ||
          '<p class="hint-text">这道菜没有需要额外准备的食材。</p>';
        $('#rdSeaList', el).innerHTML = nut.rows.filter((x) => x.kind === 'sea').map((x) => rowTpl(x, unit, ctx)).join('') ||
          '<p class="hint-text">这道菜不需要额外调料。</p>';
        servMeta.textContent = '约 ' + n0(totalGrams) + ' 克食材 · ' + n0(nut.totals.kcal) + ' kcal 整锅';
        servVal.textContent = servings + ' 份';
      };

      paint();
      $('#rdMissing', el).innerHTML = missingTpl(match, r);

      servEl.addEventListener('input', () => {
        servings = Number(servEl.value);
        paint();
      });

      $$('#rdUnit button', el).forEach((b) => {
        b.addEventListener('click', () => {
          unit = b.dataset.u;
          $$('#rdUnit button', el).forEach((x) => x.classList.toggle('active', x === b));
          paint();
        });
      });

      // 点食材行展开「单食材营养贡献」
      el.addEventListener('click', (e) => {
        const row = e.target.closest('[data-contrib]');
        if (row) {
          const box = row.nextElementSibling;
          if (box && box.classList.contains('contrib')) {
            const show = box.style.display === 'none' || !box.style.display;
            box.style.display = show ? 'block' : 'none';
            const ico = row.querySelector('.chev');
            if (ico) ico.style.transform = show ? 'rotate(180deg)' : 'none';
          }
          return;
        }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'fav') {
          toggleFav(r.id).then((on) => {
            btn.innerHTML = '<i class="' + (on ? 'fa-solid' : 'fa-regular') + ' fa-heart" style="color:' +
              (on ? 'var(--red)' : 'inherit') + '"></i>' + (on ? '已收藏' : '收藏');
            toast(on ? '已加入收藏' : '已取消收藏', 'ok');
            if (opts.onChanged) opts.onChanged();
          });
        }
        if (act === 'shop') {
          const nut = computeRecipe(r, state.cat, servings);
          const items = nut.rows.filter((x) => x.kind === 'ing').map((x) => ({
            key: x.id, name: x.name, grams: Math.round(x.grams), cat: x.item.cat, source: 'recipe',
          }));
          addShopping(items).then(() => toast('已加入购物清单（' + items.length + ' 项）', 'ok'));
        }
      });
    },
  });

  return modal;
}

/* ---------- 片段模板 ---------- */

function difficultyText(d) {
  return ({ 1: '简单', 2: '适中', 3: '有点挑战' })[d] || '适中';
}

function summaryTpl(nut, ratio) {
  const ps = nut.perServing;
  const pct = Math.min(100, Math.round((ps.kcal / 700) * 100));
  return '<div class="panel" style="background:var(--elev-2);border:0">' +
    '<div class="row" style="gap:16px;align-items:center;flex-wrap:wrap">' +
      '<div class="nutri-ring" style="--pct:' + pct + '">' +
        '<div style="display:grid;place-items:center">' +
          '<div class="num" style="font-size:20px;font-weight:900;color:var(--primary);line-height:1">' + n0(ps.kcal) + '</div>' +
          '<div style="font-size:9.5px;color:var(--text-3);font-weight:700;margin-top:2px">kcal / 份</div>' +
        '</div>' +
      '</div>' +
      '<div class="macro" style="flex:1;min-width:180px">' +
        macroRow('蛋白', ps.p, ratio.p, 'm-p') +
        macroRow('脂肪', ps.f, ratio.f, 'm-f') +
        macroRow('碳水', ps.c, ratio.c, 'm-c') +
      '</div>' +
    '</div>' +
    '<div class="divider" style="margin:12px 0"></div>' +
    '<div class="row row-wrap" style="gap:14px;font-size:12px;color:var(--text-2)">' +
      '<span>整锅 <b class="num-hi num">' + n0(nut.totals.kcal) + '</b> kcal</span>' +
      '<span>共 <b class="num">' + nut.servings + '</b> 份</span>' +
      '<span>蛋白 <b class="num">' + n1(nut.totals.p) + '</b> 克</span>' +
      '<span>脂肪 <b class="num">' + n1(nut.totals.f) + '</b> 克</span>' +
      '<span>碳水 <b class="num">' + n1(nut.totals.c) + '</b> 克</span>' +
    '</div>' +
  '</div>';
}

function macroRow(label, grams, pct, cls) {
  return '<div class="macro-row">' +
    '<span class="t-sub">' + label + '</span>' +
    '<div class="macro-track"><i class="' + cls + '" style="width:' + pct + '%"></i></div>' +
    '<span class="num" style="text-align:right;color:var(--text)"><b>' + n1(grams) + '</b>g · ' + pct + '%</span>' +
  '</div>';
}

function rowTpl(x, unit, ctx) {
  const amt = formatAmount(x.grams, x.item, unit);
  // 调料看调料库存，食材看食材库存
  const bag = x.kind === 'sea' ? (ctx.pantry || new Map()) : (ctx.inv || new Map());
  const inv = bag.get(x.id);
  let invTxt = '';
  let invTone = 'var(--text-3)';

  if (inv && inv.grams != null) {
    const has = inv.grams >= x.grams * 0.999;
    invTone = has ? 'var(--green-ink)' : 'var(--amber-ink)';
    invTxt = has ? '库存充足 ' + n0(inv.grams) + ' 克' : '库存仅 ' + n0(inv.grams) + ' 克';
  } else if (inv) {
    invTone = 'var(--green-ink)';
    invTxt = '库存有（' + inv.qty + ' ' + inv.unit + '）';
  } else if (x.kind === 'sea' && x.item.isPantry) {
    invTone = 'var(--green-ink)';
    invTxt = '常备调料';
  } else {
    invTone = 'var(--red-ink)';
    invTxt = x.kind === 'sea' ? '调料库存没有' : '库存没有';
  }

  const fryNote = x.factor < 1 ? '（油炸用油，按 ' + Math.round(x.factor * 100) + '% 吸油计入）' : '';

  return '<div class="rd-row" data-contrib style="cursor:pointer">' +
      '<div class="row" style="gap:8px;align-items:center">' +
        '<span style="font-weight:600;font-size:13.5px">' + esc(x.name) + fryNote + '</span>' +
        '<span class="spacer"></span>' +
        '<span class="num" style="font-weight:800;font-size:13.5px"><b class="num-hi">' + amt.value + '</b> ' + amt.unit + '</span>' +
        '<i class="fa-solid fa-chevron-down chev" style="font-size:9px;color:var(--text-3);transition:transform .2s"></i>' +
      '</div>' +
      '<div class="row" style="gap:8px;margin-top:3px">' +
        '<span class="num" style="font-size:11.5px;color:var(--text-2)">' + n0(x.kcal) + ' kcal</span>' +
        '<span style="font-size:11px;color:' + invTone + '">· ' + invTxt + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="contrib" style="display:none;margin:2px 0 8px;padding:10px 12px;border-radius:12px;background:var(--elev-2);font-size:12px;line-height:1.8;color:var(--text-2)">' +
      '<div><b style="color:var(--text)">这一份量（' + n1(x.grams) + ' 克）贡献：</b>' +
        '热量 <b class="num-hi num">' + n0(x.kcal) + '</b> kcal · 蛋白 <b class="num">' + n1(x.p) + '</b> g · ' +
        '脂肪 <b class="num">' + n1(x.f) + '</b> g · 碳水 <b class="num">' + n1(x.c) + '</b> g</div>' +
      '<div>每 100 克基准：' + x.item.per100.kcal + ' kcal · 蛋白 ' + x.item.per100.p + ' g · 脂肪 ' + x.item.per100.f + ' g · 碳水 ' + x.item.per100.c + ' g</div>' +
      (x.item.shelf ? '<div>建议保存：约 ' + x.item.shelf + ' 天' + (x.item.unit ? '' : '') + '</div>' : '') +
    '</div>';
}

function missingTpl(match, r) {
  // 冰箱是空的就没什么好"缺"的，别拿红字吓人
  if (!state.inv.length) {
    return '<div style="margin-top:14px;padding:11px 14px;border-radius:14px;background:var(--elev-2);color:var(--text-2);font-size:12.5px">' +
      '<i class="fa-solid fa-circle-info"></i> 还没记冰箱里的食材。记几样常用的，就能自动提示这道菜缺什么、能拿什么替代。' +
    '</div>';
  }
  const items = [];
  (match.missing || []).forEach((m) => {
    const subs = getSubstitutes(state.cat, m.id);
    items.push('<div style="padding:10px 12px;border-radius:12px;background:var(--red-soft)">' +
      '<div class="row" style="gap:8px"><i class="fa-solid fa-circle-xmark" style="color:var(--red-ink)"></i>' +
      '<b style="font-size:13px;color:var(--red-ink)">缺 ' + esc(m.name) + ' ' + n0(m.need) + ' 克</b></div>' +
      (subs.length
        ? '<div style="margin-top:7px;font-size:12px;line-height:1.9;color:var(--text-2)">离线替代：' +
          subs.slice(0, 3).map((s) => '<b style="color:var(--text)">' + esc(s.name) + '</b>' +
            (s.ratio && s.ratio !== 1 ? '（×' + s.ratio + '）' : '') +
            (s.note ? '　' + esc(s.note) : '')).join('<br>') + '</div>'
        : '<div style="margin-top:6px;font-size:12px;color:var(--text-2)">食材库里暂时没有收录它的替代方案，可以按口味自行处理。</div>') +
    '</div>');
  });
  (match.partial || []).forEach((m) => {
    const nm = (r.nut.rows.find((x) => x.id === m.id) || {}).name || m.id;
    items.push('<div style="padding:10px 12px;border-radius:12px;background:var(--amber-soft)">' +
      '<div class="row" style="gap:8px"><i class="fa-solid fa-triangle-exclamation" style="color:var(--amber-ink)"></i>' +
      '<b style="font-size:13px;color:var(--amber-ink)">' + esc(nm) + ' 只有 ' + n0(m.have) + ' 克，需要 ' + n0(m.need) + ' 克</b></div>' +
      '</div>');
  });

  if (!items.length) {
    return '<div style="margin-top:14px;padding:11px 14px;border-radius:14px;background:var(--green-soft);color:var(--green-ink);font-size:13px">' +
      '<i class="fa-solid fa-circle-check"></i> 食材齐全，可以直接开火。</div>';
  }
  return '<div style="margin-top:14px"><div class="section-title"><i class="fa-solid fa-triangle-exclamation"></i>还差点什么' +
    '<span class="hint">宽松匹配会自动给出替代方案</span></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' + items.join('') + '</div></div>';
}
