import { createWorkbenchService } from './host/service.js';
import { createLearningSpacesService } from './host/learning-spaces.js';

export const API_BASE = '/api/stg-learning';

function problem(code, status, message) { return Object.assign(new Error(message), { code, status }); }

/** Browser input names an identity in DSH's registry, never a filesystem root. */
export function createWorkspaceResolver(registry) {
  if (typeof registry?.get !== 'function') throw Error('STG requires DSH workspaceRegistry.get().');
  return async workspaceId => {
    if (typeof workspaceId !== 'string' || !workspaceId.trim() || workspaceId.length > 256) throw problem('WORKSPACE_NOT_FOUND', 404, '请选择已登记的 DSH 工作区。');
    const workspace = registry.get(workspaceId);
    if (!workspace || typeof workspace.path !== 'string') throw problem('WORKSPACE_NOT_FOUND', 404, '该工作区已移除，请重新选择。');
    return { workspaceId, path: workspace.path, title: workspace.title || workspace.path };
  };
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const READS = {
  '/learning': 'library',
  '/workspace': 'workspace', '/document': 'read', '/history': 'history',
  '/history/document': 'historyRead', '/state': 'state', '/asset': 'asset',
};
const WRITES = { '/learning/create': 'createLearning', '/learning/import': 'importLearning', '/answers': 'answer', '/history/restore': 'restore', '/document': 'save', '/state': 'updateState' };

/** Fetch-shaped handler runs only behind Connection's trust/authentication/owner guard. */
export function createWorkbenchHandler(service) {
  return async request => {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(API_BASE.length);
      const method = request.method.toUpperCase();
      let operation, input;
      if (method === 'GET' || method === 'HEAD') {
        operation = READS[path];
        input = Object.fromEntries(url.searchParams);
      } else if ((path === '/document' && (method === 'PUT' || method === 'POST')) || (path === '/state' && (method === 'PATCH' || method === 'POST')) || (method === 'POST' && WRITES[path])) {
        operation = WRITES[path];
        if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw problem('INVALID_JSON', 415, '请求必须使用 application/json。');
        const raw = await request.text();
        // JSON escaping can expand an otherwise valid 8 MiB UTF-8 document.
        // The domain service independently enforces the decoded-file size.
        if (Buffer.byteLength(raw, 'utf8') > 50 * 1024 * 1024) throw problem('PAYLOAD_TOO_LARGE', 413, '文档超过工作台请求上限。');
        try { input = JSON.parse(raw); } catch { throw problem('INVALID_JSON', 400, '请求 JSON 无效。'); }
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw problem('INVALID_JSON', 400, '请求必须是 JSON 对象。');
      }
      if (!operation || !url.pathname.startsWith(`${API_BASE}/`)) throw problem('METHOD_NOT_ALLOWED', 405, '该操作不受支持。');
      const data = await service[operation](input, { signal: request.signal });
      if (operation === 'asset') return new Response(method === 'HEAD' ? null : data.bytes, { headers: { 'content-type': data.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
      return new Response(method === 'HEAD' ? null : JSON.stringify({ ok: true, data }), { headers: JSON_HEADERS });
    } catch (failure) {
      const known = typeof failure?.code === 'string' && Number.isInteger(failure.status) && failure.status >= 400 && failure.status <= 599;
      const error = known ? { code: failure.code, message: failure.message, ...(failure.details === undefined ? {} : { details: failure.details }) } : { code: 'INTERNAL_ERROR', message: '工作台操作未完成，请重试。' };
      return new Response(JSON.stringify({ ok: false, error }), { status: known ? failure.status : 500, headers: JSON_HEADERS });
    }
  };
}

export function installWorkbenchBridge(ctx) {
  if (typeof ctx.connection?.fetch?.register !== 'function') throw Error('STG requires a DSH host with Connection authenticated Fetch routes (verified 0.2.1-rc.1 through 0.2.1-rc.5 and 0.2.2-rc.1).');
  // Reading the picker lazily keeps the workbench available on hosts that
  // never provide one; create/import then fail with a specific diagnostic.
  const pickDirectory = signal => {
    const picker = typeof ctx.get === 'function' ? ctx.get('directoryPickerController') : ctx.directoryPickerController;
    if (typeof picker?.pick !== 'function') {
      throw Object.assign(Error('当前 DSH 宿主没有可用的文件夹选择器，请在桌面版创建或导入学习空间。'), { code: 'PICKER_UNAVAILABLE', status: 503 });
    }
    return picker.pick(signal);
  };
  const learning = createLearningSpacesService({ registry: ctx.workspaceRegistry, pickDirectory });
  const service = { ...createWorkbenchService({ resolveWorkspace: learning.resolveWorkspace, learningOnly: true }), ...learning };
  const fetch = createWorkbenchHandler(service);
  // Native exact routes retain Connection's Host/Origin/authentication fence,
  // installation lock waterfall, request cancellation, and owner-only policy.
  // POST aliases are the public typed carrier path; PUT/PATCH retain HTTP semantics.
  for (const path of Object.keys(READS).concat(Object.keys(WRITES)).filter((v, i, all) => all.indexOf(v) === i)) {
    const methods = [...(READS[path] ? ['GET', 'HEAD'] : []), ...(WRITES[path] ? ['POST'] : []), ...(path === '/document' ? ['PUT'] : []), ...(path === '/state' ? ['PATCH'] : [])];
    ctx.connection.fetch.register({ path: `${API_BASE}${path}`, methods, requestBody: 'buffered', fetch });
  }
  return service;
}
