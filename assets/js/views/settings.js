/* ============================================================
 * views/settings.js —— 设置 / 备份 / 数据统计
 * ============================================================ */

import {
  state, saveSettings, backupAll, restoreAll, saveSettings as _s,
  clearStock, deleteUserRecipe, bulkSaveUserRecipes,
} from '../core/state.js';
import * as DB from '../core/store.js';
import { $, $$, esc, toast, confirmDialog, download, pickFile, badge, todayISO } from '../ui/dom.js';
import { n0 } from '../core/nutrition.js';

export function render(root) {
  const s = state.settings;
  const ing = state.cat.ingredients.length;
  const sea = state.cat.seasonings.length;
  const rec = state.cat.recipes.length;
  const userRec = state.userRecipes.length;
  const inv = state.inv.length;
  const pantry = state.pantry.length;

  root.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title"><i class="fa-solid fa-gear"></i>设置</h1>' +
        '<p class="page-desc">所有数据保存在这台设备的浏览器里，可以随时导出成 JSON 备份或换设备迁移。</p>' +
      '</div>' +
    '</div>' +

    '<div class="grid gap-5" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">' +

      // 外观
      '<div class="panel">' +
        '<div class="section-title"><i class="fa-solid fa-palette"></i>外观与单位</div>' +
        '<div class="field mb-3"><label>主题</label>' +
          '<div class="segmented" id="themeSeg">' +
            ['light', 'dark', 'auto'].map((t) =>
              '<button data-theme="' + t + '" class="' + (s.theme === t ? 'active' : '') + '">' +
              ({ light: '亮色', dark: '暗色', auto: '跟随系统' })[t] + '</button>').join('') +
          '</div>' +
        '</div>' +
        '<div class="field mb-3"><label>默认用量单位</label>' +
          '<div class="segmented" id="unitSeg">' +
            '<button data-unit="g" class="' + (s.unit === 'g' ? 'active' : '') + '">克</button>' +
            '<button data-unit="spoon" class="' + (s.unit === 'spoon' ? 'active' : '') + '">勺</button>' +
          '</div>' +
          '<span class="hint-text">只影响菜谱详情的默认显示，随时可以在详情里切换。</span>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="field"><label>匹配与推荐</label>' +
          '<label class="switch" style="margin-bottom:10px">' +
            '<input type="checkbox" id="spSwitch" ' + (s.strictPantry ? 'checked' : '') + '><span class="track"></span>' +
            '<span style="font-size:13px;color:var(--text-2)">调料也按库存严格校验</span>' +
          '</label><br>' +
          '<label class="switch">' +
            '<input type="checkbox" id="smSwitch" ' + (s.strictMode ? 'checked' : '') + '><span class="track"></span>' +
            '<span style="font-size:13px;color:var(--text-2)">默认使用严格匹配</span>' +
          '</label>' +
        '</div>' +
      '</div>' +

      // 统计
      '<div class="panel">' +
        '<div class="section-title"><i class="fa-solid fa-chart-pie"></i>数据统计</div>' +
        '<div class="grid grid-cols-2 gap-3">' +
          stat('菜谱总数', rec, 'fa-book-open') +
          stat('我的菜谱', userRec, 'fa-pen') +
          stat('食材库', ing, 'fa-carrot') +
          stat('调料库', sea, 'fa-flask-vial') +
          stat('食材库存', inv, 'fa-boxes-stacked') +
          stat('调料库存', pantry, 'fa-jar') +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="row row-wrap" style="gap:6px">' +
          badge('收藏 ' + state.favs.size, 'primary', 'fa-heart') +
          badge('黑名单 ' + state.blacklist.size, 'amber', 'fa-ban') +
          badge('抽菜记录 ' + state.history.length, '', 'fa-clock-rotate-left') +
          badge('清单 ' + state.shopping.length, 'green', 'fa-basket-shopping') +
        '</div>' +
      '</div>' +

      // 备份
      '<div class="panel">' +
        '<div class="section-title"><i class="fa-solid fa-database"></i>备份与迁移</div>' +
        '<p class="hint-text" style="margin:0 0 12px">导出的是完整 JSON（库存、收藏、自定义菜谱、清单、设置）。' +
          '换设备时导入即可恢复。</p>' +
        '<p class="hint-text" style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:var(--elev-2)">' +
          '<b style="color:var(--text)">抖音视频：</b>每道菜详情页都有「抖音找做法」，点击按菜名搜索。' +
          '想直接跳到某个视频，在菜谱 JSON 里给该菜加 <code>"video": "链接"</code> 即可。</p>' +
        '<div class="col" style="gap:8px">' +
          '<button class="btn btn-primary btn-block" data-act="backup"><i class="fa-solid fa-download"></i>导出完整备份</button>' +
          '<button class="btn btn-ghost btn-block" data-act="restore"><i class="fa-solid fa-upload"></i>从备份导入</button>' +
          '<button class="btn btn-ghost btn-block" data-act="importRecipes"><i class="fa-solid fa-book-medical"></i>导入菜谱 JSON 扩充菜谱库</button>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<button class="btn btn-ghost btn-block" data-act="wipe" style="color:var(--red-ink);border-color:var(--red-soft)">' +
          '<i class="fa-solid fa-trash-can"></i>清空本机所有数据</button>' +
      '</div>' +

      // 关于
      '<div class="panel">' +
        '<div class="section-title"><i class="fa-solid fa-circle-info"></i>关于这个工具</div>' +
        '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:2;color:var(--text-2)">' +
          '<li>纯静态页面：HTML + TailwindCSS + 原生 JS，零框架、零后端。</li>' +
          '<li>不调用任何外部 API，所有营养计算都在浏览器本地完成。</li>' +
          '<li>图标（FontAwesome）与占位图（SVG）全部打包在项目里，不发网络请求。</li>' +
          '<li>数据存在 IndexedDB；浏览器不支持时自动降级到 localStorage。</li>' +
          '<li>可以直接放到 GitHub Pages、对象存储，或本地起个静态服务使用。</li>' +
        '</ul>' +
        '<div class="divider"></div>' +
        '<div class="row row-wrap" style="gap:8px">' +
          badge('版本 1.0.0', 'line') +
          badge('离线可用', 'green', 'fa-wifi') +
          badge('无追踪', 'green', 'fa-shield-halved') +
        '</div>' +
      '</div>' +
    '</div>';

  bind(root);
}

function stat(label, value, icon) {
  return '<div style="padding:11px 12px;border-radius:14px;background:var(--elev-2)">' +
    '<div class="row" style="gap:6px"><i class="fa-solid ' + icon + '" style="font-size:11px;color:var(--primary)"></i>' +
    '<span class="t-mute" style="font-size:11.5px;font-weight:600">' + label + '</span></div>' +
    '<div class="num" style="font-size:20px;font-weight:900">' + value + '</div></div>';
}

function bind(root) {
  if (!root._clickBound) { root._clickBound = true; root.addEventListener('click', async (e) => {
    const th = e.target.closest('[data-theme]');
    if (th) {
      await saveSettings({ theme: th.dataset.theme });
      window.dispatchEvent(new CustomEvent('sr:theme', { detail: th.dataset.theme }));
      $$('#themeSeg button', root).forEach((b) => b.classList.toggle('active', b === th));
      return;
    }

    const un = e.target.closest('[data-unit]');
    if (un) {
      await saveSettings({ unit: un.dataset.unit });
      $$('#unitSeg button', root).forEach((b) => b.classList.toggle('active', b === un));
      toast('默认单位已切换', 'ok');
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;

    if (a === 'backup') {
      const data = await backupAll();
      download('smart-recipe-backup-' + todayISO() + '.json', JSON.stringify(data, null, 2));
      toast('备份已导出', 'ok');
    }

    if (a === 'restore') {
      const file = await pickFile('.json');
      if (!file) return;
      let payload;
      try { payload = JSON.parse(file.text); } catch (err) { toast('文件不是合法 JSON', 'err'); return; }
      const ok = await confirmDialog('导入会覆盖当前所有数据，确定继续？', { okText: '覆盖导入' });
      if (!ok) return;
      const done = await restoreAll(payload);
      if (done) { toast('已恢复', 'ok'); render(root); }
      else toast('没识别出备份格式', 'err');
    }

    if (a === 'importRecipes') {
      const file = await pickFile('.json');
      if (!file) return;
      let payload;
      try { payload = JSON.parse(file.text); } catch (err) { toast('文件不是合法 JSON', 'err'); return; }
      const list = Array.isArray(payload) ? payload : (payload.items || payload.recipes || []);
      if (!Array.isArray(list) || !list.length) { toast('没找到菜谱数组（items / recipes）', 'warn'); return; }

      let ok = 0, bad = 0;
      const rows = [];
      list.forEach((r) => {
        if (!r || !r.name || !Array.isArray(r.ings) || !r.ings.length) { bad += 1; return; }
        rows.push({
          id: r.id && String(r.id).startsWith('user_') ? r.id : 'user_' + Math.random().toString(36).slice(2, 9),
          name: String(r.name).slice(0, 24),
          cat: r.cat || 'meat',
          servings: Number(r.servings) || 2,
          time: Number(r.time) || 30,
          diff: Number(r.diff) || 2,
          flavor: r.flavor || '',
          tags: Array.isArray(r.tags) ? r.tags : [],
          ings: r.ings.filter((p) => Array.isArray(p) && p[0] && Number(p[1]) > 0),
          seas: (r.seas || []).filter((p) => Array.isArray(p) && p[0] && Number(p[1]) > 0),
          steps: Array.isArray(r.steps) ? r.steps : [],
          tips: r.tips || '',
          custom: true,
        });
        ok += 1;
      });

      if (!rows.length) { toast('没有可导入的菜谱（需要 name 与 ings）', 'err'); return; }
      await bulkSaveUserRecipes(rows);
      toast('导入成功 ' + ok + ' 道' + (bad ? '，跳过 ' + bad + ' 条' : ''), 'ok');
      render(root);
    }

    if (a === 'wipe') {
      const ok = await confirmDialog('清空本机所有数据？包括库存、收藏、清单和自定义菜谱，操作不可撤销。', { okText: '全部清空' });
      if (!ok) return;
      for (const name of ['inventory', 'pantry', 'favorites', 'blacklist', 'history', 'userRecipes', 'plans', 'shopping', 'kv']) {
        await DB.clear(name);
      }
      location.reload();
    }
  }); }

  $('#spSwitch', root).addEventListener('change', (e) => saveSettings({ strictPantry: e.target.checked }));
  $('#smSwitch', root).addEventListener('change', (e) => saveSettings({ strictMode: e.target.checked }));
}
