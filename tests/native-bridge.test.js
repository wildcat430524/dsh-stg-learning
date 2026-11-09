import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchHandler, createWorkspaceResolver, installWorkbenchBridge } from '../src/bridge.js';
import { createWorkbenchApi, WorkbenchApiError } from '../src/api.js';

test('workspace resolution uses only registered identity and never a supplied root', async () => {
  const resolve = createWorkspaceResolver({ get: id => id === 'registered' ? { path: 'E:/lessons', title: '学习' } : undefined });
  assert.deepEqual(await resolve('registered'), { workspaceId: 'registered', path: 'E:/lessons', title: '学习' });
  for (const input of ['E:/lessons', '../private', null, '', { path: 'E:/private' }]) await assert.rejects(resolve(input), { code: 'WORKSPACE_NOT_FOUND', status: 404 });
});

test('native bridge registers only authenticated Connection routes', () => {
  const routes = [];
  const ctx = { connection: { fetch: { register: route => routes.push(route) } }, workspaceRegistry: { get() {} } };
  installWorkbenchBridge(ctx);
  assert.equal(routes.length, 11);
  assert.ok(routes.every(route => route.path.startsWith('/api/stg-learning/') && route.requestBody === 'buffered'));
  assert.deepEqual(routes.find(route => route.path.endsWith('/document')).methods, ['GET', 'HEAD', 'POST', 'PUT']);
  assert.deepEqual(routes.find(route => route.path.endsWith('/state')).methods, ['GET', 'HEAD', 'POST', 'PATCH']);
  assert.throws(() => installWorkbenchBridge({ workspaceRegistry: ctx.workspaceRegistry }), /Connection authenticated Fetch routes/);
  assert.throws(() => installWorkbenchBridge({ workspaceRegistry: ctx.workspaceRegistry }), /0\.2\.1-rc\.1 through 0\.2\.1-rc\.5/);
});

test('a host without a directory picker still serves every non-picker route', async () => {
  // The optional inject must not become a hard startup requirement: reading,
  // saving, state and the mentor flow have to work without any picker.
  const routes = [];
  const ctx = {
    connection: { fetch: { register: route => routes.push(route) } },
    workspaceRegistry: { get: id => id === 'w' ? { path: 'E:/lessons', title: '学习' } : undefined },
  };
  const service = installWorkbenchBridge(ctx);
  assert.equal(routes.length, 11);
  assert.equal(ctx.directoryPickerController, undefined);
  const handler = routes.find(route => route.path.endsWith('/workspace')).fetch;
  const response = await handler(new Request('http://dsh/api/stg-learning/workspace?workspaceId=w'));
  // The fixture is not a real StepsToGreat folder, so the domain answers a
  // specific learning-space error instead of crashing at startup.
  assert.ok([409, 500].includes(response.status), String(response.status));
  assert.equal((await response.json()).ok, false);
  assert.equal(typeof service.importLearning, 'function');
});

test('create/import without a picker fails with a specific, non-upgrading error', async () => {
  const routes = [];
  const ctx = {
    connection: { fetch: { register: route => routes.push(route) } },
    workspaceRegistry: { get() { return undefined; } },
  };
  installWorkbenchBridge(ctx);
  const handler = routes.find(route => route.path.endsWith('/learning/import')).fetch;
  const response = await handler(new Request('http://dsh/api/stg-learning/learning/import', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationId: 'op-1' }),
  }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'PICKER_UNAVAILABLE');
  assert.match(body.error.message, /没有可用的文件夹选择器/);
});

test('host handler maps operations, preserves domain conflict, and hides unknown exception details', async () => {
  const handler = createWorkbenchHandler({
    read: async input => input,
    save: async () => { throw Object.assign(Error('文件已在 STG Desk 中修改'), { code: 'VERSION_CONFLICT', status: 409, details: { version: 'new' } }); },
    workspace: async () => { throw Error('PRIVATE_CREDENTIAL_MUST_NOT_LEAK'); },
  });
  const read = await handler(new Request('http://dsh/api/stg-learning/document?workspaceId=w&path=%E8%AF%BE.md'));
  assert.deepEqual(await read.json(), { ok: true, data: { workspaceId: 'w', path: '课.md' } });
  const save = await handler(new Request('http://dsh/api/stg-learning/document', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(save.status, 409);
  assert.deepEqual((await save.json()).error, { code: 'VERSION_CONFLICT', message: '文件已在 STG Desk 中修改', details: { version: 'new' } });
  const failure = await handler(new Request('http://dsh/api/stg-learning/workspace?workspaceId=w'));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /PRIVATE/);
});

test('malformed JSON and media types cannot reach domain mutations', async () => {
  let writes = 0;
  const handler = createWorkbenchHandler({ save: async () => { writes++; } });
  for (const [body, media, status] of [['{', 'application/json', 400], ['[]', 'application/json', 400], ['{}', 'text/plain', 415]]) {
    const response = await handler(new Request('http://dsh/api/stg-learning/document', { method: 'POST', headers: { 'content-type': media }, body }));
    assert.equal(response.status, status);
  }
  assert.equal(writes, 0);
});

test('JSON escaping does not reject an otherwise valid near-limit document', async () => {
  const content = '\n'.repeat(5 * 1024 * 1024);
  const handler = createWorkbenchHandler({ save: async input => ({ bytes: Buffer.byteLength(input.content) }) });
  const response = await handler(new Request('http://dsh/api/stg-learning/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId: 'w', path: 'large.md', content }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.bytes, 5 * 1024 * 1024);
});

test('local asset bytes remain inert and uncacheable', async () => {
  const handler = createWorkbenchHandler({ asset: async () => ({ bytes: Buffer.from([137, 80, 78, 71]), mime: 'image/png' }) });
  const result = await handler(new Request('http://dsh/api/stg-learning/asset?workspaceId=w&path=pic.png'));
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  assert.match(result.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [137, 80, 78, 71]);
});

test('browser API uses carrier-compatible aliases and propagates actionable domain errors', async () => {
  const seen = [];
  const api = createWorkbenchApi({ fetch: async (input, init) => {
    seen.push({ input, init });
    return new Response(JSON.stringify(init.method === 'POST' ? { ok: false, error: { code: 'VERSION_CONFLICT', message: '保留草稿', details: { version: 'v2' } } } : { ok: true, data: { path: '课.md' } }), { status: init.method === 'POST' ? 409 : 200 });
  } });
  assert.deepEqual(await api.read({ workspaceId: 'w', path: '课.md' }), { path: '课.md' });
  await assert.rejects(api.save({ workspaceId: 'w', path: '课.md', content: 'a', expectedVersion: 'v1' }), error => error instanceof WorkbenchApiError && error.code === 'VERSION_CONFLICT' && error.status === 409 && error.details.version === 'v2');
  assert.match(seen[0].input, /^api\/stg-learning\/document\?/);
  assert.equal(seen[1].init.method, 'POST');
  assert.equal(seen[1].init.credentials, 'same-origin');
  assert.equal(JSON.parse(seen[1].init.body).expectedVersion, 'v1');
});

test('browser API honors shell-owned fetch transport without reading auth material', async () => {
  const previous = globalThis.__DSH_TRANSPORT__;
  globalThis.__DSH_TRANSPORT__ = { fetch: async () => new Response('{"ok":true,"data":{"revision":3}}') };
  try { assert.deepEqual(await createWorkbenchApi().state({ workspaceId: 'w' }), { revision: 3 }); }
  finally { if (previous === undefined) delete globalThis.__DSH_TRANSPORT__; else globalThis.__DSH_TRANSPORT__ = previous; }
});

test('expired DSH auth and cancelled loads retain distinct error behavior', async () => {
  const api = createWorkbenchApi({ fetch: async () => new Response('unauthorized', { status: 401 }) });
  await assert.rejects(api.workspace({ workspaceId: 'w' }), { code: 'UNAUTHENTICATED', status: 401 });
  const abort = new DOMException('Cancelled', 'AbortError');
  const cancelled = createWorkbenchApi({ fetch: async () => { throw abort; } });
  await assert.rejects(cancelled.workspace({}), error => error === abort);
});
