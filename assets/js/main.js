/* ============================================================
 * main.js —— 应用入口：路由、主题、导航
 * ------------------------------------------------------------
 * 只有三个一级页面：今天 / 菜谱 / 我的
 * 其余（抽菜、三餐、库存、收藏、写菜谱、设置）都是二级页，
 * 顶部带一个「返回」，用户不会在大菜单里迷路。
 * ============================================================ */

import { initState, state, onChange, saveSettings } from './core/state.js';
import * as home from './views/home.js';
import * as library from './views/library.js';
import * as me from './views/me.js';
import * as kitchen from './views/kitchen.js';
import * as random from './views/random.js';
import * as plan from './views/plan.js';
import * as collection from './views/collection.js';
import * as editor from './views/editor.js';
import * as settingsView from './views/settings.js';
import { $$, esc } from './ui/dom.js';

/**
 * 视图注册表
 *  - auto: 数据变化时是否自动重渲染
 *  - back: 二级页的返回目标（有值就是二级页）
 *  - nav:  顶部导航高亮哪一项
 */
const VIEWS = {
  today:    { mod: home,          auto: true,  nav: 'today',   title: '' },
  recipes:  { mod: library,       auto: true,  nav: 'recipes', title: '' },
  me:       { mod: me,            auto: true,  nav: 'me',      title: '' },

  draw:     { mod: random,        auto: false, nav: 'today',   title: '随机抽菜', back: 'today' },
  plan:     { mod: plan,          auto: false, nav: 'today',   title: '三餐安排', back: 'today' },
  stock:    { mod: kitchen,       auto: true,  nav: 'me',      title: '冰箱里有什么', back: 'me' },
  fav:      { mod: collection,    auto: true,  nav: 'me',      title: '收藏与清单', back: 'me' },
  mine:     { mod: editor,        auto: false, nav: 'me',      title: '写菜谱', back: 'me' },
  settings: { mod: settingsView,  auto: false, nav: 'me',      title: '设置与备份', back: 'me' },
};

let current = 'today';
let booting = true;

/* ------------------------------------------------------------
 * 主题
 * ---------------------------------------------------------- */
const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(mode) {
  if (mode === 'auto') return media.matches ? 'dark' : 'light';
  return mode === 'dark' ? 'dark' : 'light';
}

function applyTheme(mode, persist = true) {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = resolved === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#171210' : '#f2751b');
  if (persist) {
    try { localStorage.setItem('sr-theme', mode); } catch (e) { /* 忽略 */ }
  }
}

media.addEventListener('change', () => {
  if (state.settings.theme === 'auto') applyTheme('auto', false);
});

/* ------------------------------------------------------------
 * 路由
 * ---------------------------------------------------------- */

/** 每次渲染都换一个干净容器，避免事件监听重复叠加 */
function freshRoot(sectionId) {
  const section = document.getElementById('view-' + sectionId);
  if (!section) return null;
  const old = section.firstElementChild;
  const node = document.createElement('div');
  node.id = old ? old.id : sectionId + 'Root';
  if (old) section.replaceChild(node, old); else section.appendChild(node);
  return node;
}

function subBar(title, backTo) {
  const label = { today: '今天', me: '我的', recipes: '菜谱' }[backTo] || '返回';
  return '<div class="subbar">' +
    '<button class="subbar-back" data-nav="' + backTo + '">' +
      '<i class="fa-solid fa-chevron-left"></i>' + label +
    '</button>' +
    (title ? '<span class="subbar-title">' + esc(title) + '</span>' : '') +
  '</div>';
}

function route(name, opts = {}) {
  const key = VIEWS[name] ? name : 'today';
  current = key;
  const view = VIEWS[key];

  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + key));
  $$('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === view.nav));

  const root = freshRoot(key);
  if (!root) return;

  // 二级页：先放返回条，再把内容渲染进内层
  let target = root;
  if (view.back) {
    root.innerHTML = subBar(view.title, view.back) + '<div class="sub-inner"></div>';
    target = root.querySelector('.sub-inner');
  }

  try {
    const ret = view.mod.render(target, opts);
    if (ret && typeof ret.catch === 'function') ret.catch((err) => renderError(target, err));
  } catch (err) {
    renderError(target, err);
  }

  if (location.hash !== '#' + key) history.replaceState(null, '', '#' + key);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMobileMenu();
}

function renderError(root, err) {
  console.error(err);
  root.innerHTML =
    '<div class="empty" style="margin-top:40px">' +
      '<div class="empty-ico" style="background:var(--red-soft);color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
      '<h4>页面出错了</h4>' +
      '<p>' + esc(String(err && err.message ? err.message : err)) + '</p>' +
      '<button class="btn btn-primary btn-sm" onclick="location.reload()">重新加载</button>' +
    '</div>';
}

/* ------------------------------------------------------------
 * 导航
 * ---------------------------------------------------------- */
function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('menuBtn');
  if (!menu) return;
  menu.classList.remove('open');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    const ico = document.getElementById('menuIcon');
    if (ico) ico.className = 'fa-solid fa-bars';
  }
}

function bindNav() {
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      route(nav.dataset.nav);
      return;
    }
    const menu = document.getElementById('mobileMenu');
    if (menu && menu.classList.contains('open') &&
        !e.target.closest('#mobileMenu') && !e.target.closest('#menuBtn')) {
      closeMobileMenu();
    }
  });

  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const menu = document.getElementById('mobileMenu');
      const open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      const ico = document.getElementById('menuIcon');
      if (ico) ico.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
  }

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const now = document.documentElement.getAttribute('data-theme');
      const next = now === 'dark' ? 'light' : 'dark';
      state.settings.theme = next;
      applyTheme(next);
      saveSettings({ theme: next });
    });
  }

  window.addEventListener('hashchange', () => {
    const name = location.hash.replace('#', '');
    if (name && name !== current && VIEWS[name]) route(name);
  });

  window.addEventListener('sr:goto', (e) => {
    const d = e.detail || {};
    if (d.urgent) library.focusUrgent();
    route(d.view || 'today');
  });

  window.addEventListener('sr:theme', (e) => applyTheme(e.detail || 'auto'));

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1080) closeMobileMenu();
  });
}

/* ------------------------------------------------------------
 * 启动
 * ---------------------------------------------------------- */
async function boot() {
  applyTheme((() => {
    try { return localStorage.getItem('sr-theme') || 'auto'; } catch (e) { return 'auto'; }
  })(), false);

  bindNav();

  try {
    await initState();
  } catch (err) {
    renderError(document.getElementById('todayRoot'), err);
    booting = false;
    return;
  }

  applyTheme(state.settings.theme || 'auto', false);

  // 原地重渲染：复用同一个容器节点，视图里的事件委托才不会失效
  onChange(() => {
    if (booting) return;
    const v = VIEWS[current];
    if (!v || !v.auto) return;
    const root = document.getElementById(current + 'Root');
    if (!root) return;
    // 二级页的容器里还有返回条和内层 wrapper，直接重渲染整个容器会丢结构，
    // 所以二级页交给它自己的模块重画内层
    const target = root.querySelector('.sub-inner') || root;
    try { v.mod.render(target); } catch (e) { console.error(e); }
  });

  booting = false;

  const hash = location.hash.replace('#', '');
  route(VIEWS[hash] ? hash : 'today');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
