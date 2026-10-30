/* ============================================================
 * views/editor.js —— 自定义菜谱编辑器
 * ------------------------------------------------------------
 * 用户填写食材与调料克数，系统按食材库自动算出热量与三大营养素，
 * 保存后立即出现在菜谱库里，并可参与匹配、抽菜与三餐规划。
 * ============================================================ */

import { state, saveUserRecipe, deleteUserRecipe } from '../core/state.js';
import { CATS } from '../core/catalog.js';
import { computeRecipe, n0, n1, macroRatio } from '../core/nutrition.js';
import { $, $$, esc, toast, openModal, confirmDialog, download, badge, emptyState, todayISO } from '../ui/dom.js';
import { openRecipe } from './recipe.js';

let editingId = null;

export function render(root) {
  editingId = null;
  const mine = state.userRecipes || [];

  root.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title"><i class="fa-solid fa-pen-to-square"></i>写菜谱</h1>' +
        '<p class="page-desc">选食材、填克数、写步骤，热量和营养会自动算好。数据只存在你自己的浏览器里。</p>' +
      '</div>' +
    '</div>' +

    '<div class="split-main">' +
      '<div>' +
        '<div class="panel">' +
          '<div class="section-title"><i class="fa-solid fa-circle-info"></i>基本信息</div>' +
          '<div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">' +
            '<div class="field" style="grid-column:1/-1"><label>菜名 *</label>' +
              '<input class="input" id="edName" placeholder="比如：我家的番茄牛腩" maxlength="20"></div>' +
            '<div class="field"><label>分类</label><select class="select" id="edCat">' +
              Object.keys(CATS).map((k) => '<option value="' + k + '">' + CATS[k].name + '</option>').join('') +
            '</select></div>' +
            '<div class="field"><label>份数</label><input class="input" id="edServ" type="number" min="1" max="12" value="2"></div>' +
            '<div class="field"><label>用时（分钟）</label><input class="input" id="edTime" type="number" min="1" max="600" value="30"></div>' +
            '<div class="field"><label>难度</label><select class="select" id="edDiff">' +
              '<option value="1">简单</option><option value="2" selected>适中</option><option value="3">有点挑战</option>' +
            '</select></div>' +
            '<div class="field"><label>口味</label><input class="input" id="edFlavor" placeholder="咸鲜 / 酸甜 / 麻辣"></div>' +
            '<div class="field"><label>标签（逗号分隔）</label><input class="input" id="edTags" placeholder="下饭菜, 快手"></div>' +
          '</div>' +
        '</div>' +

        '<div class="panel" style="margin-top:16px">' +
          '<div class="section-title"><i class="fa-solid fa-carrot"></i>食材' +
            '<button class="btn btn-soft btn-xs" data-act="addIng" style="margin-left:auto"><i class="fa-solid fa-plus"></i>加一行</button></div>' +
          '<div id="ingRows" style="display:flex;flex-direction:column;gap:8px"></div>' +
        '</div>' +

        '<div class="panel" style="margin-top:16px">' +
          '<div class="section-title"><i class="fa-solid fa-flask-vial"></i>调料' +
            '<button class="btn btn-soft btn-xs" data-act="addSea" style="margin-left:auto"><i class="fa-solid fa-plus"></i>加一行</button></div>' +
          '<div id="seaRows" style="display:flex;flex-direction:column;gap:8px"></div>' +
        '</div>' +

        '<div class="panel" style="margin-top:16px">' +
          '<div class="section-title"><i class="fa-solid fa-fire-burner"></i>做法步骤</div>' +
          '<textarea class="textarea" id="edSteps" style="min-height:150px" ' +
            'placeholder="一行写一步，例如：&#10;五花肉切块冷水下锅焯水&#10;小火炒糖色后下肉翻炒上色&#10;加热水没过，小火炖 45 分钟"></textarea>' +
          '<div class="field" style="margin-top:12px"><label>小贴士（可选）</label>' +
            '<input class="input" id="edTips" placeholder="比如：收汁前再补盐，肉才不柴"></div>' +
        '</div>' +

        '<div class="row row-wrap" style="gap:10px;margin-top:16px">' +
          '<button class="btn btn-primary" data-act="save"><i class="fa-solid fa-check"></i>保存到我的菜谱</button>' +
          '<button class="btn btn-ghost" data-act="reset"><i class="fa-solid fa-rotate-left"></i>重新填写</button>' +
          '<button class="btn btn-ghost" data-act="export" style="margin-left:auto"><i class="fa-solid fa-download"></i>导出我的菜谱</button>' +
        '</div>' +
      '</div>' +

      // 实时营养预览
      '<div>' +
        '<div class="card card-pad side-sticky" style="position:sticky;top:calc(var(--nav-h) + 16px)">' +
          '<div class="section-title"><i class="fa-solid fa-chart-pie"></i>实时营养' +
            '<span class="hint" id="edPreviewHint">按 2 份</span></div>' +
          '<div id="edPreview"></div>' +
          '<div class="divider"></div>' +
          '<div class="section-title"><i class="fa-solid fa-list-check"></i>我的菜谱 <span class="hint">' + mine.length + ' 道</span></div>' +
          '<div id="mineList"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  addRow(root, 'ing');
  addRow(root, 'ing');
  addRow(root, 'sea');
  preview(root);
  paintMine(root);
  bind(root);
}

/* ---------- 行渲染 ---------- */

function optionHtml(list, selected) {
  return list.map((x) =>
    '<option value="' + x.id + '" ' + (selected === x.id ? 'selected' : '') + '>' + esc(x.name) + '</option>').join('');
}

function addRow(root, kind, data) {
  const host = kind === 'ing' ? $('#ingRows', root) : $('#seaRows', root);
  if (!host) return;
  const list = kind === 'ing' ? state.cat.ingredients : state.cat.seasonings;
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.kind = kind;
  row.style.gap = '8px';
  row.innerHTML =
    '<select class="select" data-id style="flex:1">' +
      '<option value="">选择' + (kind === 'ing' ? '食材' : '调料') + '</option>' +
      optionHtml(list, data ? data[0] : '') +
    '</select>' +
    '<input class="input" data-g type="number" min="0" step="1" placeholder="克数" style="width:96px" value="' + (data ? data[1] : '') + '">' +
    '<button class="icon-btn" data-del-row style="width:40px;height:40px;border-radius:12px;flex:none">' +
      '<i class="fa-solid fa-xmark" style="font-size:12px"></i></button>';
  host.appendChild(row);
  if (data && data[0]) preview(root);
}

function collect(root, kind) {
  const host = kind === 'ing' ? $('#ingRows', root) : $('#seaRows', root);
  const out = [];
  $$('[data-kind="' + kind + '"]', host).forEach((row) => {
    const id = row.querySelector('[data-id]').value;
    const g = Number(row.querySelector('[data-g]').value);
    if (id && g > 0) out.push([id, g]);
  });
  return out;
}

function draft(root) {
  return {
    id: editingId || 'user_' + Date.now().toString(36),
    name: $('#edName', root).value.trim(),
    cat: $('#edCat', root).value,
    servings: Number($('#edServ', root).value) || 2,
    time: Number($('#edTime', root).value) || 30,
    diff: Number($('#edDiff', root).value) || 2,
    flavor: $('#edFlavor', root).value.trim(),
    tags: $('#edTags', root).value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    ings: collect(root, 'ing'),
    seas: collect(root, 'sea'),
    steps: $('#edSteps', root).value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    tips: $('#edTips', root).value.trim(),
    custom: true,
  };
}

/* ---------- 实时营养 ---------- */

function preview(root) {
  const d = draft(root);
  const host = $('#edPreview', root);
  const hint = $('#edPreviewHint', root);
  if (!host) return;
  hint.textContent = '按 ' + d.servings + ' 份';

  if (!d.ings.length) {
    host.innerHTML = '<p class="hint-text" style="margin:0">选择食材并填写克数后，这里会实时算出热量与营养。</p>';
    return;
  }
  const nut = computeRecipe(d, state.cat, d.servings);
  const ratio = macroRatio(nut.totals);
  const ps = nut.perServing;
  const pct = Math.min(100, Math.round((ps.kcal / 700) * 100));

  host.innerHTML =
    '<div class="row" style="gap:14px;align-items:center">' +
      '<div class="nutri-ring" style="--pct:' + pct + '">' +
        '<div style="display:grid;place-items:center">' +
          '<div class="num" style="font-size:19px;font-weight:900;color:var(--primary);line-height:1">' + n0(ps.kcal) + '</div>' +
          '<div style="font-size:9px;color:var(--text-3);font-weight:700">kcal/份</div>' +
        '</div></div>' +
      '<div class="macro" style="flex:1;min-width:150px">' +
        macroRow('蛋白', ps.p, ratio.p, 'm-p') +
        macroRow('脂肪', ps.f, ratio.f, 'm-f') +
        macroRow('碳水', ps.c, ratio.c, 'm-c') +
      '</div>' +
    '</div>' +
    '<div class="row row-wrap" style="gap:10px;font-size:12px;color:var(--text-2);margin-top:12px">' +
      '<span>整锅 <b class="num-hi num">' + n0(nut.totals.kcal) + '</b> kcal</span>' +
      '<span>食材 <b class="num">' + d.ings.length + '</b> 样</span>' +
      '<span>调料 <b class="num">' + d.seas.length + '</b> 样</span>' +
    '</div>' +
    '<div style="margin-top:12px;font-size:11.5px;color:var(--text-3);line-height:1.8">' +
      nut.rows.slice(0, 6).map((x) =>
        '<div class="row" style="gap:6px"><span style="flex:1">' + esc(x.name) + '</span>' +
        '<span class="num">' + n0(x.kcal) + ' kcal</span></div>').join('') +
      (nut.rows.length > 6 ? '<div>…</div>' : '') +
    '</div>';
}

function macroRow(label, grams, pct, cls) {
  return '<div class="macro-row">' +
    '<span class="t-sub">' + label + '</span>' +
    '<div class="macro-track"><i class="' + cls + '" style="width:' + pct + '%"></i></div>' +
    '<span class="num" style="text-align:right"><b>' + n1(grams) + '</b>g</span>' +
  '</div>';
}

/* ---------- 我的菜谱列表 ---------- */

function paintMine(root) {
  const host = $('#mineList', root);
  if (!host) return;
  const mine = state.userRecipes || [];
  if (!mine.length) {
    host.innerHTML = '<p class="hint-text" style="margin:0">还没有自己写的菜谱。</p>';
    return;
  }
  host.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">' +
    mine.map((r) => {
      const nut = computeRecipe(r, state.cat, r.servings);
      return '<div class="row" style="gap:8px;padding:8px 10px;background:var(--elev-2);border-radius:12px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:700">' + esc(r.name) + '</div>' +
          '<div class="t-mute num" style="font-size:11px">' + n0(nut.perServing.kcal) + ' kcal/份 · ' + r.time + ' 分钟</div>' +
        '</div>' +
        '<button class="icon-btn" style="width:30px;height:30px;border-radius:9px" data-view="' + r.id + '" title="查看">' +
          '<i class="fa-solid fa-eye" style="font-size:11px"></i></button>' +
        '<button class="icon-btn" style="width:30px;height:30px;border-radius:9px" data-edit="' + r.id + '" title="编辑">' +
          '<i class="fa-solid fa-pen" style="font-size:11px"></i></button>' +
        '<button class="icon-btn" style="width:30px;height:30px;border-radius:9px" data-delmine="' + r.id + '" title="删除">' +
          '<i class="fa-solid fa-trash-can" style="font-size:11px"></i></button>' +
      '</div>';
    }).join('') + '</div>';
}

/* ---------- 事件 ---------- */

function bind(root) {
  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', async (e) => {
    const delRow = e.target.closest('[data-del-row]');
    if (delRow) {
      const row = delRow.closest('[data-kind]');
      const kind = row.dataset.kind;
      const host = kind === 'ing' ? $('#ingRows', root) : $('#seaRows', root);
      row.remove();
      if (!$$('[data-kind="' + kind + '"]', host).length) addRow(root, kind);
      preview(root);
      return;
    }

    const view = e.target.closest('[data-view]');
    if (view) { openRecipe(view.dataset.view); return; }

    const edit = e.target.closest('[data-edit]');
    if (edit) { loadRecipe(edit.dataset.edit, root); return; }

    const del = e.target.closest('[data-delmine]');
    if (del) {
      const ok = await confirmDialog('删除这道自定义菜谱？', { okText: '删除' });
      if (!ok) return;
      await deleteUserRecipe(del.dataset.delmine);
      if (editingId === del.dataset.delmine) editingId = null;
      paintMine(root);
      toast('已删除', 'ok');
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;

    if (a === 'addIng') { addRow(root, 'ing'); return; }
    if (a === 'addSea') { addRow(root, 'sea'); return; }

    if (a === 'reset') {
      editingId = null;
      render(root);
      return;
    }

    if (a === 'save') {
      const d = draft(root);
      if (!d.name) { toast('先给菜起个名字', 'warn'); $('#edName', root).focus(); return; }
      if (!d.ings.length) { toast('至少要有一样食材', 'warn'); return; }
      if (!d.steps.length) { toast('写一步做法吧', 'warn'); return; }
      await saveUserRecipe(d);
      toast(editingId ? '已更新' : '已保存到我的菜谱', 'ok');
      editingId = d.id;
      paintMine(root);
      render(root);
      return;
    }

    if (a === 'export') {
      if (!state.userRecipes.length) { toast('还没有自己写的菜谱', 'warn'); return; }
      download('my-recipes-' + todayISO() + '.json',
        JSON.stringify({ app: 'smart-recipe', type: 'userRecipes', items: state.userRecipes }, null, 2));
      toast('已导出', 'ok');
    }
  }); }

  // 输入时实时更新营养
  if (!root._inputBound) { root._inputBound = true; root.addEventListener('input', (e) => {
    if (e.target.closest('#edPreview') || e.target.closest('#mineList')) return;
    preview(root);
  }); }
  if (!root._changeBound) { root._changeBound = true; root.addEventListener('change', () => preview(root)); }
}

function loadRecipe(id, root) {
  const r = state.userRecipes.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  $('#edName', root).value = r.name || '';
  $('#edCat', root).value = r.cat || 'meat';
  $('#edServ', root).value = r.servings || 2;
  $('#edTime', root).value = r.time || 30;
  $('#edDiff', root).value = r.diff || 2;
  $('#edFlavor', root).value = r.flavor || '';
  $('#edTags', root).value = (r.tags || []).join(', ');
  $('#edSteps', root).value = (r.steps || []).join('\n');
  $('#edTips', root).value = r.tips || '';

  $('#ingRows', root).innerHTML = '';
  $('#seaRows', root).innerHTML = '';
  (r.ings || []).forEach((p) => addRow(root, 'ing', p));
  (r.seas || []).forEach((p) => addRow(root, 'sea', p));
  if (!(r.ings || []).length) addRow(root, 'ing');
  if (!(r.seas || []).length) addRow(root, 'sea');

  preview(root);
  toast('已载入「' + r.name + '」，改完保存即可', 'ok');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
