// Connection's browser/Electron carriers resolve document-relative routes.
// This also preserves a reverse-proxy mount prefix.
const BASE = 'api/stg-learning';
const METHODS = { workspace: ['GET', '/workspace'], read: ['GET', '/document'], save: ['POST', '/document'], answer: ['POST', '/answers'], history: ['GET', '/history'], historyRead: ['GET', '/history/document'], restore: ['POST', '/history/restore'], state: ['GET', '/state'], updateState: ['POST', '/state'] };
Object.assign(METHODS, { library: ['GET', '/learning'], createLearning: ['POST', '/learning/create'], importLearning: ['POST', '/learning/import'] });

export class WorkbenchApiError extends Error {
  constructor(error, status) { super(error?.message || '学习工作台暂时不可用。'); this.name = 'WorkbenchApiError'; this.code = error?.code || 'TRANSPORT_ERROR'; this.status = status; this.details = error?.details; }
}

/** Uses the shell's fetch carrier (including Electron IPC); carries no credentials. */
export function createWorkbenchApi({ fetch: carrier = (...args) => globalThis.__DSH_TRANSPORT__?.fetch ? globalThis.__DSH_TRANSPORT__.fetch(...args) : globalThis.fetch(...args), base = BASE } = {}) {
  const api = {};
  for (const [operation, [method, path]] of Object.entries(METHODS)) {
    api[operation] = async (input = {}, { signal } = {}) => {
      const query = method === 'GET' ? `?${new URLSearchParams(Object.entries(input).filter(([, value]) => value !== undefined && value !== null)).toString()}` : '';
      let response;
      try { response = await carrier(`${base}${path}${query}`, { method, credentials: 'same-origin', cache: 'no-store', signal, ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }) }); }
      catch (error) { if (error?.name === 'AbortError') throw error; throw new WorkbenchApiError({ code: 'TRANSPORT_ERROR', message: '无法连接 DSH 工作台，请检查宿主连接后重试。' }); }
      let body;
      try { body = await response.json(); } catch { throw new WorkbenchApiError({ code: response.status === 401 ? 'UNAUTHENTICATED' : 'INVALID_RESPONSE', message: response.status === 401 ? 'DSH 登录已失效，请重新打开宿主页面。' : '宿主未返回工作台数据，请确认插件已加载。' }, response.status); }
      if (!response.ok || body?.ok !== true) throw new WorkbenchApiError(body?.error, response.status);
      return body.data;
    };
  }
  api.assetUrl = ({ workspaceId, path }) => `${base}/asset?${new URLSearchParams({ workspaceId, path })}`;
  return Object.freeze(api);
}
