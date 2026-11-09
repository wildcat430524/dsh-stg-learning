// Minimal Chrome DevTools Protocol driver for isolated, headless preview
// acceptance. It deliberately has no third-party dependency: Node's global
// WebSocket talks to a local Chrome started with a temporary profile, so the
// user's desktop, browser profile and installed DSH are never touched.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  process.env.STG_CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function pickChrome(explicit) {
  return (explicit && existsSync(explicit))
    ? explicit
    : CHROME_CANDIDATES.find(candidate => existsSync(candidate));
}

export async function launchChrome({ executable, width = 1440, height = 960 } = {}) {
  const chrome = pickChrome(executable);
  if (!chrome) throw Error('No local Chrome/Edge executable found for isolated preview acceptance.');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'stg-reader-chrome-'));
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let exited = false;
  child.once('exit', () => { exited = true; });
  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = '';
  for (let attempt = 0; attempt < 200 && !port; attempt++) {
    if (exited) throw Error(`Chrome exited before exposing DevTools (${chrome}).`);
    try { port = (await readFile(portFile, 'utf8')).split(/\r?\n/)[0].trim(); } catch { /* still starting */ }
    if (!port) await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!port) { child.kill(); throw Error('Chrome did not expose a DevTools port.'); }
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const target = targets.find(item => item.type === 'page');
  if (!target) { child.kill(); throw Error('Chrome exposed no page target.'); }
  return {
    child, profile, port, target,
    async close() {
      try { child.kill(); } catch { /* already stopped */ }
      await new Promise(resolve => { if (exited) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 2000).unref?.(); } });
      await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 120 }).catch(() => {});
    },
  };
}

export async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(Error('CDP WebSocket failed')), { once: true });
  });
  let id = 0;
  const pending = new Map(), listeners = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) || []) listener(message.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  const once = (method, timeout = 15000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(Error(`Timed out waiting for ${method}`)); }, timeout);
    const listener = params => { clearTimeout(timer); off(); resolve(params); };
    const off = () => { const list = listeners.get(method) || []; listeners.set(method, list.filter(item => item !== listener)); };
    listeners.set(method, [...(listeners.get(method) || []), listener]);
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Evaluation failed');
    return result.result.value;
  }
  async function waitFor(expression, { timeout = 15000, interval = 80 } = {}) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
      try { if (await evaluate(expression)) return; } catch (error) { last = error; }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw Error(`UI condition failed: ${expression}${last ? ` (${last.message})` : ''}`);
  }
  async function viewport(width, height, { dark = false } = {}) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(dark ? 'dark' : 'light')}`);
  }
  async function screenshot(file) {
    const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(file, Buffer.from(result.data, 'base64'));
  }
  return { send, once, evaluate, waitFor, viewport, screenshot, close: () => socket.close() };
}
