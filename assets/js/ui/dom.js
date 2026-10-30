/* ============================================================
 * ui/dom.js —— DOM 小工具：弹窗、提示、格式化、下载
 * ============================================================ */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** HTML 转义，所有用户输入进模板前必须过一遍 */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 轻提示 */
export function toast(msg, type = 'info', ms = 2600) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const map = { info: 'fa-circle-info', ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', err: 'fa-circle-xmark' };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<i class="fa-solid ' + (map[type] || map.info) + '"></i><span>' + esc(msg) + '</span>';
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, ms);
}

const ESC_STACK = [];
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ESC_STACK.length) {
    e.preventDefault();
    ESC_STACK[ESC_STACK.length - 1]();
  }
});

/**
 * 打开弹窗
 * @param {{title:string, body:string, foot?:string, size?:'sm'|'lg', icon?:string, onMount?:Function}} opts
 */
export function openModal(opts) {
  const root = document.getElementById('modalRoot');
  const wrap = document.createElement('div');
  const sizeClass = opts.size === 'sm' ? 'modal-sm' : (opts.size === 'lg' ? 'modal-lg' : '');
  wrap.className = 'modal-backdrop';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML =
    '<div class="modal ' + sizeClass + '">' +
      '<div class="modal-head">' +
        (opts.icon ? '<i class="fa-solid ' + opts.icon + '" style="color:var(--primary)"></i>' : '') +
        '<h3>' + esc(opts.title || '') + '</h3>' +
        '<button class="x-btn" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') +
    '</div>';
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add('closing');
    const idx = ESC_STACK.indexOf(close);
    if (idx >= 0) ESC_STACK.splice(idx, 1);
    setTimeout(() => {
      wrap.remove();
      if (!root.children.length) document.body.style.overflow = '';
    }, 170);
  };
  ESC_STACK.push(close);

  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));

  if (typeof opts.onMount === 'function') opts.onMount(wrap.querySelector('.modal'), close);
  return { el: wrap, close, body: wrap.querySelector('.modal-body') };
}

/** 确认对话框（Promise<boolean>） */
export function confirmDialog(msg, opts = {}) {
  return new Promise((resolve) => {
    const m = openModal({
      title: opts.title || '请确认',
      icon: 'fa-triangle-exclamation',
      size: 'sm',
      body: '<p style="margin:0;color:var(--text-2);line-height:1.8">' + esc(msg) + '</p>',
      foot:
        '<button class="btn btn-ghost" data-no>取消</button>' +
        '<button class="btn ' + (opts.danger ? 'btn-primary' : 'btn-primary') + '" data-yes>' +
        esc(opts.okText || '确定') + '</button>',
      onMount(el, close) {
        el.querySelector('[data-yes]').addEventListener('click', () => { close(); resolve(true); });
        el.querySelector('[data-no]').addEventListener('click', () => { close(); resolve(false); });
      },
    });
    m.el.addEventListener('click', (e) => { if (e.target === m.el) resolve(false); });
  });
}

/* ---------- 文件与下载 ---------- */

/** 触发浏览器下载（纯本地 Blob，无网络请求） */
export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
}

/** 选择本地文件并读取文本 */
export function pickFile(accept = '.json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { input.remove(); resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => { input.remove(); resolve({ name: file.name, text: String(reader.result || '') }); };
      reader.onerror = () => { input.remove(); resolve(null); };
      reader.readAsText(file, 'utf-8');
    });
    input.click();
  });
}

/* ---------- 日期与数字 ---------- */

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/** 防抖 */
export function debounce(fn, wait = 220) {
  let t = 0;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** 同步滑块已填充比例（CSS 变量 --p） */
export function syncRange(el) {
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const v = Number(el.value);
  const pct = max === min ? 0 : ((v - min) / (max - min)) * 100;
  el.style.setProperty('--p', pct.toFixed(2) + '%');
}

/** 批量初始化页面里的滑块 */
export function initRanges(root = document) {
  $$('input[type="range"].range', root).forEach((el) => {
    syncRange(el);
    el.addEventListener('input', () => syncRange(el));
  });
}

/** 空状态模板 */
export function emptyState(icon, title, desc, actionHtml = '') {
  return '<div class="empty">' +
    '<div class="empty-ico"><i class="fa-solid ' + icon + '"></i></div>' +
    '<h4>' + esc(title) + '</h4>' +
    '<p>' + desc + '</p>' +
    (actionHtml ? '<div class="row row-wrap" style="justify-content:center;gap:10px">' + actionHtml + '</div>' : '') +
    '</div>';
}

/** 徽章 */
export function badge(text, tone = '', icon = '') {
  return '<span class="badge ' + (tone ? 'badge-' + tone : '') + '">' +
    (icon ? '<i class="fa-solid ' + icon + '"></i>' : '') + esc(text) + '</span>';
}
