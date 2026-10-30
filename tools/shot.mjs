/**
 * tools/shot.mjs —— 无头 Chrome 截图 + 控制台错误收集（仅开发自检用，不参与部署）
 *
 * 用法：
 *   node tools/shot.mjs --w 1440 --h 1000 --wait 1200 \
 *        --url "http://127.0.0.1:8123/index.html#kitchen" --out shot-kitchen.png
 *   可重复多组 --url / --out。
 *
 * 依赖：Node 22+（内置 WebSocket / fetch），本机 Chrome。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = { w: 1440, h: 1000, wait: 1200, port: 9333, chrome: '', list: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--url') { opt.list.push({ url: args[++i], out: '', evals: [] }); }
  else if (a === '--out') { opt.list[opt.list.length - 1].out = args[++i]; }
  else if (a === '--eval') { opt.list[opt.list.length - 1].evals.push(args[++i]); }
  else if (a === '--w') opt.w = Number(args[++i]);
  else if (a === '--h') opt.h = Number(args[++i]);
  else if (a === '--wait') opt.wait = Number(args[++i]);
  else if (a === '--port') opt.port = Number(args[++i]);
  else if (a === '--chrome') opt.chrome = args[++i];
  else if (a === '--dark') opt.dark = true;
}

const CHROME = opt.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = process.env.TEMP + '/sr-shot-profile-' + Date.now();

const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--remote-debugging-port=' + opt.port,
  '--user-data-dir=' + profile,
  '--window-size=' + opt.w + ',' + opt.h,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(path) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + opt.port + path);
      if (res.ok) return await res.json();
    } catch (e) { /* 还没起来 */ }
    await sleep(150);
  }
  throw new Error('DevTools 未就绪');
}

const list = await getJSON('/json/list');
const page = list.find((t) => t.type === 'page');
if (!page) throw new Error('没有找到页面 target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve: res, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else res(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push('EXCEPTION: ' + (d.exception && d.exception.description || d.text));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    logs.push('CONSOLE.' + msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: opt.w, height: opt.h, deviceScaleFactor: 1, mobile: opt.w < 500,
});
if (opt.dark) {
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });
}

for (const item of opt.list) {
  await send('Page.navigate', { url: item.url });
  await sleep(opt.wait);
  for (const expr of item.evals) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) logs.push('EVAL 异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    else if (r.result && r.result.value !== undefined) console.log('EVAL 结果: ' + JSON.stringify(r.result.value));
    await sleep(700);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const out = resolve(item.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved ' + out);
}

if (logs.length) {
  console.log('--- 页面错误 ---');
  logs.slice(0, 20).forEach((l) => console.log(l));
} else {
  console.log('--- 无控制台错误 ---');
}

ws.close();
child.kill();
process.exit(0);
