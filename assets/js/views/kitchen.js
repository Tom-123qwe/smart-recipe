/* ============================================================
 * views/kitchen.js —— 厨房库存（食材 + 调料）
 * ------------------------------------------------------------
 * 功能：快捷录入、批量导入、保质期、临期高亮、存量不足徽章、
 *       JSON 导出 / 导入、一键导入常备调料。
 * ============================================================ */

import {
  state, upsertStock, bulkStock, removeStock, clearStock, bumpStock,
  expireStatus, isLowStock, markSeeded, isSeeded,
} from '../core/state.js';
import { ING_CATS } from '../core/catalog.js';
import { toGrams, n1 } from '../core/nutrition.js';
import {
  $, $$, esc, toast, openModal, confirmDialog, download, pickFile,
  todayISO, addDaysISO, emptyState, badge,
} from '../ui/dom.js';

let tab = 'inv';        // inv | pantry
let sortMode = 'expire'; // expire | name | qty

/** 视图入口 */
export async function render(root) {
  const inj = state.inv.length;
  const pan = state.pantry.length;
  const urgent = state.inv.filter((r) => ['urgent', 'expired'].includes(expireStatus(r).status)).length;
  const low = state.inv.filter(isLowStock).length;
  const seeded = await isSeeded();

  // 有数据才显示统计，空冰箱时不摆一排 0
  const statsHtml = inj
    ? statCard('食材', inj, 'fa-carrot', 'primary') + statCard('快过期', urgent, 'fa-clock', urgent ? 'amber' : 'green')
    : '';

  root.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title"><i class="fa-solid fa-boxes-stacked"></i>厨房库存</h1>' +
        '<p class="page-desc">录入食材与调料的克数和保质期，系统会优先推荐「先把临期的吃掉」的菜。</p>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<div class="row row-wrap">' +
        '<button class="btn btn-soft btn-sm" data-act="batch"><i class="fa-solid fa-list-check"></i>批量录入</button>' +
      '</div>' +
    '</div>' +
    // 统计卡
    (statsHtml ? '<div class="grid grid-cols-2 gap-3 mb-5 stagger" id="statGrid">' + statsHtml + '</div>' : '') +
    // 快捷录入
    '<div class="panel mb-5">' +
      '<div class="section-title"><i class="fa-solid fa-plus"></i>快捷录入<span class="hint">选名字会自动带出建议保质期</span></div>' +
      '<div class="quick-add">' +
        '<div class="field qa-name"><label>名称</label>' +
          '<input class="input" id="qName" list="qList" placeholder="如：五花肉 / 鸡蛋 / 生抽" autocomplete="off">' +
          '<datalist id="qList"></datalist>' +
        '</div>' +
        '<div class="field"><label>数量</label><input class="input" id="qQty" type="number" min="0" step="1" placeholder="500"></div>' +
        '<div class="field"><label>单位</label>' +
          '<select class="select" id="qUnit"><option>克</option><option>勺</option><option>个</option><option>袋</option><option>瓶</option></select>' +
        '</div>' +
        '<div class="field"><label>保质期</label><input class="input" id="qExp" type="date" min="' + todayISO() + '"></div>' +
        '<div class="field qa-add"><label class="qa-hide-label">&nbsp;</label><button class="btn btn-primary" data-act="add"><i class="fa-solid fa-plus"></i>加入</button></div>' +
      '</div>' +
      '<p class="hint-text" style="margin:8px 0 0">保质期可以不填，填了会提醒你快过期。</p>' +
    '</div>' +

    // 列表区
    '<div class="row row-wrap mb-3">' +
      '<div class="segmented" id="tabSeg">' +
        '<button data-tab="inv" class="' + (tab === 'inv' ? 'active' : '') + '"><i class="fa-solid fa-carrot"></i> 食材库存</button>' +
        '<button data-tab="pantry" class="' + (tab === 'pantry' ? 'active' : '') + '"><i class="fa-solid fa-flask-vial"></i> 调料库存</button>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<select class="select" id="sortSel" style="width:auto;min-width:132px">' +
        '<option value="expire">按保质期排序</option>' +
        '<option value="name">按名称排序</option>' +
        '<option value="qty">按数量排序</option>' +
      '</select>' +
      '<button class="btn btn-ghost btn-sm" data-act="urgent"><i class="fa-solid fa-bolt"></i>用临期食材做菜</button>' +
    '</div>' +
    '<div id="invList"></div>';

  root.querySelector('#sortSel').value = sortMode;

  if (tab === 'pantry' && pan === 0 && !seeded) {
    root.insertAdjacentHTML('beforeend',
      '<div class="panel mt-4" style="border-style:dashed">' +
        '<div class="row row-wrap"><i class="fa-solid fa-lightbulb" style="color:var(--primary)"></i>' +
        '<span class="t-sub" style="font-size:13px">第一次用？可以把 37 种常见调料一键加入调料库存。</span>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-soft btn-sm" data-act="seed"><i class="fa-solid fa-wand-magic-sparkles"></i>一键导入常备调料</button></div>' +
      '</div>');
  }

  initDatalist();
  bindEvents(root);
  renderList(root);
}

function statCard(label, value, icon, tone) {
  const color = { primary: 'var(--primary)', green: 'var(--green-ink)', amber: 'var(--amber-ink)', red: 'var(--red-ink)' }[tone];
  return '<div class="card card-pad" style="padding:15px 16px">' +
    '<div class="row" style="gap:8px"><i class="fa-solid ' + icon + '" style="color:' + color + ';font-size:14px"></i>' +
    '<span class="t-sub" style="font-size:12.5px;font-weight:600">' + label + '</span></div>' +
    '<div class="num" style="font-size:26px;font-weight:900;color:' + color + ';line-height:1.25">' + value + '</div>' +
    '</div>';
}

/** 名称候选：食材 / 调料按当前标签给出 */
function initDatalist() {
  const dl = $('#qList');
  if (!dl) return;
  const list = tab === 'pantry' ? state.cat.seasonings : state.cat.ingredients;
  dl.innerHTML = list.map((x) => '<option value="' + esc(x.name) + '">' + esc((x.alias || []).join(' / ')) + '</option>').join('');
}

function findByName(name) {
  const n = (name || '').trim();
  if (!n) return null;
  const pool = tab === 'pantry' ? state.cat.seasonings : state.cat.ingredients;
  return pool.find((x) => x.name === n) || pool.find((x) => (x.alias || []).includes(n)) || null;
}

function bindEvents(root) {
  // 名称变化 → 自动单位 / 保质期
  const nameEl = $('#qName', root);
  nameEl.addEventListener('change', () => {
    const item = findByName(nameEl.value);
    if (!item) return;
    const unitSel = $('#qUnit', root);
    unitSel.value = item.kind === 'sea' ? '勺' : '克';
    if (item.shelf) $('#qExp', root).value = addDaysISO(item.shelf);
    if (!$('#qQty', root).value) $('#qQty', root).value = item.kind === 'sea' ? 1 : 500;
  });

  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(root); });
  $('#qQty', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(root); });

  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      const act = btn.dataset.act;
      if (act === 'add') doAdd(root);
      if (act === 'export') exportStock();
      if (act === 'import') importStock(root);
      if (act === 'batch') openBatch(root);
      if (act === 'urgent') {
        window.dispatchEvent(new CustomEvent('sr:goto', { detail: { view: 'recipes', urgent: true } }));
      }
      if (act === 'seed') seedPantry(root);
      return;
    }
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; render(root); return; }
    const row = e.target.closest('[data-row]');
    if (row) {
      const id = row.dataset.row;
      const action = e.target.closest('[data-op]');
      if (!action) return;
      const op = action.dataset.op;
      if (op === 'del') removeRow(id, root);
      if (op === 'edit') openEdit(id, root);
      const rowEl = (tab === 'pantry' ? state.pantry : state.inv).find((x) => x.id === id);
      const step = stepOf(rowEl);
      if (op === 'dec') bumpStock(tab === 'pantry' ? 'pantry' : 'inv', id, -step);
      if (op === 'inc') bumpStock(tab === 'pantry' ? 'pantry' : 'inv', id, step);
    }
  }); }

  $('#sortSel', root).addEventListener('change', (e) => { sortMode = e.target.value; renderList(root); });
}

async function doAdd(root) {
  const name = $('#qName', root).value.trim();
  const qty = Number($('#qQty', root).value);
  const unit = $('#qUnit', root).value;
  const exp = $('#qExp', root).value || null;
  if (!name) { toast('先写个名字吧', 'warn'); return; }
  if (!(qty > 0)) { toast('数量要大于 0', 'warn'); return; }

  const item = findByName(name);
  await upsertStock(tab === 'pantry' ? 'pantry' : 'inv', {
    key: item ? item.id : null,
    name: item ? item.name : name,
    qty,
    unit,
    expire: exp,
    min: 0,
    cat: item ? item.cat : 'veg',
  });
  $('#qName', root).value = '';
  $('#qQty', root).value = '';
  $('#qExp', root).value = '';
  toast('已加入' + (tab === 'pantry' ? '调料库存' : '食材库存'), 'ok');
}

async function removeRow(id, root) {
  const ok = await confirmDialog('删除这条库存记录？', { okText: '删除' });
  if (!ok) return;
  await removeStock(tab === 'pantry' ? 'pantry' : 'inv', id);
  toast('已删除', 'ok');
}

function openEdit(id, root) {
  const kind = tab === 'pantry' ? 'pantry' : 'inv';
  const row = (kind === 'pantry' ? state.pantry : state.inv).find((x) => x.id === id);
  if (!row) return;
  const item = row.key ? state.cat.byId.get(row.key) : null;
  openModal({
    title: '编辑库存',
    icon: 'fa-pen',
    body:
      '<div class="grid gap-3" style="grid-template-columns:1fr 1fr">' +
        '<div class="field" style="grid-column:1/-1"><label>名称</label><input class="input" id="eName" value="' + esc(row.name) + '"></div>' +
        '<div class="field"><label>数量</label><input class="input" id="eQty" type="number" min="0" step="1" value="' + row.qty + '"></div>' +
        '<div class="field"><label>单位</label><select class="select" id="eUnit">' +
          ['克', '勺', '个', '袋', '瓶', '毫升'].map((u) => '<option ' + (u === row.unit ? 'selected' : '') + '>' + u + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>保质期</label><input class="input" id="eExp" type="date" value="' + (row.expire || '') + '"></div>' +
        '<div class="field"><label>最低存量提醒（克）</label><input class="input" id="eMin" type="number" min="0" step="10" value="' + (row.min || 0) + '"></div>' +
      '</div>' +
      '<p class="hint-text" style="margin-top:10px">低于最低存量时会显示「存量不足」徽章，抽菜与推荐会把这类食材排到后面。</p>',
    foot: '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="eSave">保存</button>',
    onMount(el, close) {
      el.querySelector('#eSave').addEventListener('click', async () => {
        const name = el.querySelector('#eName').value.trim() || row.name;
        const item2 = findByName(name) || item;
        await upsertStock(kind, {
          id: row.id,
          key: item2 ? item2.id : null,
          name: item2 ? item2.name : name,
          qty: Number(el.querySelector('#eQty').value) || 0,
          unit: el.querySelector('#eUnit').value,
          expire: el.querySelector('#eExp').value || null,
          min: Number(el.querySelector('#eMin').value) || 0,
          cat: item2 ? item2.cat : row.cat,
        });
        close();
        toast('已更新', 'ok');
      });
    },
  });
}

function renderList(root) {
  const host = $('#invList', root);
  if (!host) return;
  const kind = tab === 'pantry' ? 'pantry' : 'inv';
  const rows = (kind === 'pantry' ? state.pantry : state.inv).slice();

  if (!rows.length) {
    host.innerHTML = emptyState(
      kind === 'pantry' ? 'fa-flask-vial' : 'fa-carrot',
      kind === 'pantry' ? '调料库存还是空的' : '还没有食材库存',
      kind === 'pantry'
        ? '把常备调料记下来，做菜时就不用重复买。'
        : '记两样常用的就行，比如鸡蛋、番茄。买菜回来用「批量录入」一次记完更快。',
      '<button class="btn btn-primary btn-sm" data-act="batch"><i class="fa-solid fa-list-check"></i>批量录入</button>'
    );
    return;
  }

  rows.sort((a, b) => {
    if (sortMode === 'name') return a.name.localeCompare(b.name, 'zh');
    if (sortMode === 'qty') return Number(b.qty) - Number(a.qty);
    const ea = expireStatus(a), eb = expireStatus(b);
    const wa = ea.days == null ? 1e9 : ea.days;
    const wb = eb.days == null ? 1e9 : eb.days;
    return wa - wb;
  });

  // 按分类分组展示，视觉更有秩序
  const groups = new Map();
  rows.forEach((r) => {
    const catName = kind === 'pantry' ? '调料' : (ING_CATS[r.cat] || '其他');
    if (!groups.has(catName)) groups.set(catName, []);
    groups.get(catName).push(r);
  });

  let html = '';
  groups.forEach((list, name) => {
    html += '<div class="mb-4">' +
      '<div class="row mb-2"><span class="badge badge-line">' + esc(name) + ' · ' + list.length + '</span>' +
      '<span class="divider" style="flex:1;margin:0"></span></div>' +
      '<div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">';
    list.forEach((r) => { html += rowTpl(r, kind); });
    html += '</div></div>';
  });
  host.innerHTML = html;
}

/** 加减按钮的步长：克按 50，个数/瓶/袋按 1 */
function stepOf(row) {
  if (!row) return 1;
  const u = row.unit || '克';
  return (u === '克' || u === '毫升') ? 50 : 1;
}

/** 同年份省略年份，卡片里更紧凑 */
function shortDate(iso) {
  if (!iso) return '';
  const y = String(new Date().getFullYear());
  return iso.startsWith(y + '-') ? iso.slice(5) + ' 到期' : iso + ' 到期';
}

function rowTpl(r, kind) {
  const ex = expireStatus(r);
  const low = isLowStock(r);
  const cls = ex.status === 'expired' ? 'expired' : (ex.status === 'urgent' ? 'urgent' : '');
  const item = r.key ? state.cat.byId.get(r.key) : null;
  const grams = toGrams(r.qty, r.unit, item);
  // 单位本身是克时不重复显示换算值
  const gramTxt = (grams == null || r.unit === '克' || !r.unit) ? '' : '（约 ' + n1(grams) + ' 克）';

  const badges = [];
  if (ex.status === 'expired') badges.push(badge(ex.text, 'red', 'fa-circle-xmark'));
  else if (ex.status === 'urgent') badges.push(badge(ex.text, 'amber', 'fa-clock'));
  if (low) badges.push(badge('存量不足', 'red', 'fa-triangle-exclamation'));

  return '<div class="inv-row ' + cls + '" data-row="' + r.id + '">' +
    '<div style="min-width:0;flex:1">' +
      '<div class="inv-name">' + esc(r.name) + '</div>' +
      '<div class="inv-sub num">' + n1(r.qty) + ' ' + esc(r.unit) + gramTxt +
        (r.expire ? ' · ' + shortDate(r.expire) : '') + '</div>' +
      (badges.length ? '<div class="row row-wrap" style="gap:5px;margin-top:6px">' + badges.join('') + '</div>' : '') +
    '</div>' +
    '<div class="row" style="gap:4px">' +
      '<button class="icon-btn" style="width:32px;height:32px;border-radius:10px" data-op="dec" title="减少"><i class="fa-solid fa-minus" style="font-size:11px"></i></button>' +
      '<button class="icon-btn" style="width:32px;height:32px;border-radius:10px" data-op="inc" title="增加"><i class="fa-solid fa-plus" style="font-size:11px"></i></button>' +
      '<button class="icon-btn" style="width:32px;height:32px;border-radius:10px" data-op="edit" title="编辑"><i class="fa-solid fa-pen" style="font-size:11px"></i></button>' +
      '<button class="icon-btn" style="width:32px;height:32px;border-radius:10px" data-op="del" title="删除"><i class="fa-solid fa-trash-can" style="font-size:11px"></i></button>' +
    '</div>' +
  '</div>';
}

/* ---------- 批量录入 ---------- */
function openBatch(root) {
  const isPantry = tab === 'pantry';
  openModal({
    title: isPantry ? '批量录入调料' : '批量录入食材',
    icon: 'fa-list-check',
    body:
      '<p class="hint-text" style="margin:0 0 10px">每行一条，格式：<b>名称 数量 单位 保质期</b>（后两项可省略）。支持空格、逗号、制表符分隔。</p>' +
      '<textarea class="textarea" id="batchTxt" style="min-height:180px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px" ' +
      'placeholder="五花肉 500 克 2026-11-02&#10;鸡蛋 6 个&#10;生抽 1 瓶&#10;西红柿,800,克&#10;土豆 1000 克 2026-12-01"></textarea>' +
      '<div class="row row-wrap" style="margin-top:10px;gap:8px">' +
        '<button class="btn btn-ghost btn-xs" data-demo="meat">填入示例</button>' +
        '<span class="hint-text">数量默认按「克」，保质期默认按食材库建议天数自动推算。</span>' +
      '</div>',
    foot: '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="batchSave"><i class="fa-solid fa-check"></i>导入</button>',
    onMount(el, close) {
      el.querySelector('[data-demo="meat"]').addEventListener('click', () => {
        el.querySelector('#batchTxt').value =
          '五花肉 500 克\n鸡蛋 6 个\n番茄 500 克\n土豆 1000 克\n生抽 1 瓶\n小葱 100 克\n大蒜 200 克';
      });
      el.querySelector('#batchSave').addEventListener('click', async () => {
        const text = el.querySelector('#batchTxt').value;
        const rows = parseBatch(text, isPantry ? 'pantry' : 'inv');
        if (!rows.length) { toast('没有解析到有效行', 'warn'); return; }
        await bulkStock(isPantry ? 'pantry' : 'inv', rows);
        close();
        toast('已导入 ' + rows.length + ' 条', 'ok');
      });
    },
  });
}

/** 解析批量文本 */
export function parseBatch(text, kind) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach((line) => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    const parts = s.split(/[\s,，\t]+/).filter(Boolean);
    const name = parts[0];
    if (!name) return;
    let qty = 0, unit = '克', expire = null;

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const num = Number(p.replace(/[^\d.]/g, ''));
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(p)) { expire = p; continue; }
      if (!Number.isNaN(num) && num > 0 && !qty) { qty = num; continue; }
      if (/^(克|g|勺|个|袋|瓶|毫升|ml|斤)$/i.test(p)) { unit = p.replace(/g/i, '克').replace(/ml/i, '毫升'); continue; }
    }
    if (unit === '斤') { qty = qty * 500; unit = '克'; }
    if (!qty) qty = 1;

    const item = findByName(name) || state.cat.byId.get(name);
    if (!item && kind === 'inv') {
      // 名字没匹配上食材库也允许录入，只是无法参与营养计算
    }
    if (!expire && item && item.shelf) expire = addDaysISO(item.shelf);

    out.push({
      key: item ? item.id : null,
      name: item ? item.name : name,
      qty,
      unit,
      expire,
      min: 0,
      cat: item ? item.cat : 'veg',
    });
  });
  return out;
}

/* ---------- 导入导出 ---------- */
function exportStock() {
  const payload = {
    app: 'smart-recipe',
    type: 'stock',
    exportedAt: new Date().toISOString(),
    inventory: state.inv,
    pantry: state.pantry,
  };
  download('kitchen-stock-' + todayISO() + '.json', JSON.stringify(payload, null, 2));
  toast('已导出库存 JSON', 'ok');
}

async function importStock(root) {
  const file = await pickFile('.json');
  if (!file) return;
  let data;
  try { data = JSON.parse(file.text); } catch (e) { toast('JSON 解析失败，请检查文件', 'err'); return; }

  const inv = Array.isArray(data) ? data : (data.inventory || []);
  const pant = Array.isArray(data) ? [] : (data.pantry || []);
  if (!inv.length && !pant.length) { toast('文件里没有找到 inventory / pantry 字段', 'warn'); return; }

  const ok = await confirmDialog('导入 ' + (inv.length + pant.length) + ' 条记录？将追加到现有库存（同 id 会覆盖）。', { okText: '导入' });
  if (!ok) return;

  for (const r of inv) {
    await upsertStock('inv', { id: r.id, key: r.key || null, name: r.name, qty: Number(r.qty) || 0, unit: r.unit || '克', expire: r.expire || null, min: Number(r.min) || 0, cat: r.cat || 'veg' });
  }
  for (const r of pant) {
    await upsertStock('pantry', { id: r.id, key: r.key || null, name: r.name, qty: Number(r.qty) || 0, unit: r.unit || '勺', expire: r.expire || null, min: Number(r.min) || 0, cat: r.cat || 'basic' });
  }
  toast('导入完成', 'ok');
  render(root);
}

async function seedPantry(root) {
  const rows = state.cat.seasonings
    .filter((s) => s.isPantry)
    .map((s) => ({ key: s.id, name: s.name, qty: 1, unit: '瓶', expire: null, min: 0, cat: s.cat }));
  await bulkStock('pantry', rows);
  await markSeeded();
  toast('已加入 ' + rows.length + ' 种常备调料', 'ok');
  tab = 'pantry';
  render(root);
}
