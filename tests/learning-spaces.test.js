import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLearningSpacesService, inspectLearningSpace } from '../src/host/learning-spaces.js';
import { createWorkbenchService } from '../src/host/service.js';
import { createWorkbenchHandler } from '../src/bridge.js';
import { buildMentorDraft } from '../src/native-protocol.js';
import { isDshProjectFile, LEARNING_README } from '../src/host/learning-scaffold.js';
import { STG_PERSONA } from '../src/native-protocol.js';
import { hash } from '../src/host/files.js';

const skill = fileURLToPath(new URL('../skills/stg-mentor/', import.meta.url));
const profile = '我的学习/00-学习档案.md';
async function fixture(t, { picker, create } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-spaces-test-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('stg-spaces-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const entries = [], picks = [];
  const registry = { get: id => entries.find(w => w.id === id), list: () => entries, create: async (directory, title) => {
    if (create) await create(directory);
    const entry = { id: `w${entries.length}`, path: directory, title }; entries.push(entry); return entry;
  } };
  const service = createLearningSpacesService({ registry, pickDirectory: async signal => { picks.push(signal); return picker ? picker(root, signal) : root; } });
  return { root, entries, picks, registry, service };
}
async function seed(root, { standalone = false } = {}) {
  await fs.mkdir(path.join(root, '我的学习'), { recursive: true });
  await fs.writeFile(path.join(root, profile), '# 我的档案\n真实的学生记录，不可覆盖。');
  if (standalone) {
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# StepsToGreat · 导师协议入口');
    await fs.mkdir(path.join(root, '协议'));
    await fs.writeFile(path.join(root, '协议/00_导师协议.md'), '# 导师协议');
  } else await fs.writeFile(path.join(root, '.steps2great.json'), JSON.stringify({ version: 1, skill: 'steps2great' }));
}

test('new learning builds a verified DSH teaching framework and pristine profile, registering exactly once', async t => {
  const f = await fixture(t);
  const request = { name: '我的数学学习', operationId: 'new-one' };
  const [first, second] = await Promise.all([f.service.createLearning(request), f.service.createLearning(request)]);
  assert.deepEqual(first, second);
  assert.equal(f.picks.length, 1); assert.equal(f.entries.length, 1);
  const root = path.join(f.root, request.name);
  assert.equal(first.workspace.path, await fs.realpath(root));
  assert.equal(first.initialized, true);
  const manifest = JSON.parse(await fs.readFile(path.join(skill, 'assets/project/manifest.json'), 'utf8'));
  const selected = Object.fromEntries(Object.entries(manifest.files).filter(([file]) => isDshProjectFile(file)).map(([file, expected]) => [file, file === 'README.md' ? hash(LEARNING_README) : expected]));
  for (const [file, expected] of Object.entries(selected)) assert.equal(hash(await fs.readFile(path.join(root, file))), expected, file);
  for (const file of Object.keys(manifest.files).filter(file => !isDshProjectFile(file))) await assert.rejects(fs.stat(path.join(root, file)), { code: 'ENOENT' });
  assert.ok((await fs.readdir(root)).length < 30);
  for (const file of ['协议/00_导师协议.md', '协议/05_对话导入.md', '模板/学习档案模板.md', '_tools/validate-state.mjs', 'docs/UPGRADE.md', '我的学习/我的规则.md']) assert.ok(selected[file], file);
  assert.deepEqual(await fs.readFile(path.join(root, profile)), await fs.readFile(path.join(skill, 'assets/project/模板/学习档案模板.md')));
  const anchor = JSON.parse(await fs.readFile(path.join(root, '.steps2great.json'), 'utf8'));
  assert.equal(anchor.workspaceMode, 'standalone'); assert.equal(anchor.skill, 'steps2great');
  assert.deepEqual(anchor.projectFiles, selected); assert.equal(anchor.scaffold, 'dsh');
  assert.deepEqual(await fs.readdir(path.join(root, '我的学习/学科')), []);
  assert.deepEqual((await f.service.library()).items, [first.workspace]);
  assert.deepEqual(await f.service.resolveWorkspace(first.workspace.workspaceId), first.workspace);
  await assert.rejects(fs.stat(path.join(root, '.stg-initializing')), { code: 'ENOENT' });
});

test('folder names and client-supplied roots cannot escape the native chooser', async t => {
  const f = await fixture(t);
  for (const name of ['', '..', '../escape', 'x/y', 'x\\y', 'D:\\escape', '.hidden', 'con', 'nul.txt', 'trailing.', ' spaced ', 'x:ads', 'x'.repeat(81)]) {
    await assert.rejects(async () => f.service.createLearning({ name, operationId: 'invalid' }), { code: 'INVALID_LEARNING_NAME' }, name);
  }
  await assert.rejects(async () => f.service.createLearning({ name: 'safe', operationId: 'path', path: f.root }), { code: 'INVALID_LEARNING_REQUEST' });
  await assert.rejects(async () => f.service.importLearning({ operationId: 'path', root: f.root }), { code: 'INVALID_LEARNING_REQUEST' });
  assert.equal(f.picks.length, 0); assert.deepEqual(await fs.readdir(f.root), []);
});

test('cancelling either system picker makes no folder or registration', async t => {
  const f = await fixture(t, { picker: () => null });
  assert.deepEqual(await f.service.createLearning({ name: 'cancelled', operationId: 'cancel-new' }), { cancelled: true });
  assert.deepEqual(await f.service.importLearning({ operationId: 'cancel-import' }), { cancelled: true });
  assert.equal(f.entries.length, 0); assert.deepEqual(await fs.readdir(f.root), []);
});

test('new learning never adopts or overwrites an existing folder', async t => {
  const f = await fixture(t);
  const root = path.join(f.root, '已有学习'); await fs.mkdir(root); await seed(root);
  const before = await fs.readFile(path.join(root, profile));
  await assert.rejects(f.service.createLearning({ name: '已有学习', operationId: 'existing' }), { code: 'LEARNING_FOLDER_EXISTS' });
  assert.deepEqual(await fs.readFile(path.join(root, profile)), before);
  assert.equal(f.entries.length, 0);
});

test('import validates an existing root, preserves every byte and reuses registration', async t => {
  const f = await fixture(t); await seed(f.root, { standalone: true });
  const before = await fs.readFile(path.join(f.root, profile));
  const first = await f.service.importLearning({ operationId: 'import-1' });
  const second = await f.service.importLearning({ operationId: 'import-2' });
  assert.equal(first.workspace.workspaceId, second.workspace.workspaceId); assert.equal(f.entries.length, 1);
  assert.deepEqual(await fs.readFile(path.join(f.root, profile)), before);
  assert.deepEqual((await fs.readdir(f.root)).sort(), ['AGENTS.md', '协议', '我的学习'].sort());
});

test('ordinary code repositories, nested roots and marker-only folders cannot be imported', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'README.md'), '# Not a learning project');
  await fs.writeFile(path.join(f.root, '.steps2great.json'), '{"version":1,"skill":"steps2great"}');
  const child = path.join(f.root, 'StepsToGreat'); await fs.mkdir(child); await seed(child);
  await assert.rejects(f.service.importLearning({ operationId: 'invalid-import' }), { code: 'NOT_STG_WORKSPACE' });
  assert.equal(f.entries.length, 0); assert.equal(await inspectLearningSpace(f.root), null);
});

test('library excludes generic, missing, duplicate and incomplete roots without crawling their contents', async t => {
  const f = await fixture(t);
  const valid = path.join(f.root, 'learning'); await fs.mkdir(valid); await seed(valid);
  const partial = path.join(f.root, 'partial'); await fs.mkdir(partial); await seed(partial); await fs.writeFile(path.join(partial, '.stg-initializing'), 'pending');
  f.entries.push({ id: 'code', path: f.root }, { id: 'valid', path: valid }, { id: 'alias', path: valid }, { id: 'missing', path: path.join(f.root, 'missing') }, { id: 'partial', path: partial });
  assert.deepEqual((await f.service.library()).items.map(w => w.workspaceId), ['valid']);
  await assert.rejects(f.service.resolveWorkspace('code'), { code: 'NOT_STG_WORKSPACE' });
  await assert.rejects(f.service.resolveWorkspace('unknown'), { code: 'WORKSPACE_NOT_FOUND' });
});

test('different operations cannot open simultaneous native picker windows; repeated id with different content is rejected', async t => {
  let release;
  const f = await fixture(t, { picker: () => new Promise(resolve => { release = resolve; }) });
  const pending = f.service.importLearning({ operationId: 'same' });
  await assert.rejects(async () => f.service.createLearning({ name: 'different', operationId: 'same' }), { code: 'OPERATION_CONFLICT' });
  await assert.rejects(async () => f.service.importLearning({ operationId: 'second' }), { code: 'PICKER_BUSY' });
  while (!release) await new Promise(r => setTimeout(r, 1));
  release(null); await pending;
});

test('aborted requests do not open a picker or create folders', async t => {
  const f = await fixture(t), abort = new AbortController(); abort.abort();
  await assert.rejects(f.service.createLearning({ name: 'aborted', operationId: 'aborted' }, { signal: abort.signal }), { name: 'AbortError' });
  assert.equal(f.picks.length, 0); assert.deepEqual(await fs.readdir(f.root), []);
});

test('an aborted picker selection does not become an import', async t => {
  const abort = new AbortController();
  const f = await fixture(t, { picker: root => { abort.abort(); return root; } }); await seed(f.root);
  await assert.rejects(f.service.importLearning({ operationId: 'aborted' }, { signal: abort.signal }), { name: 'AbortError' });
  assert.equal(f.entries.length, 0);
});

test('registration failure leaves a complete importable folder instead of deleting learner files', async t => {
  const f = await fixture(t, { create: () => { throw Error('offline registry'); } });
  const parent = await fs.realpath(f.root);
  await assert.rejects(f.service.createLearning({ name: '保留', operationId: 'register-fail' }), error => error.code === 'LEARNING_SETUP_INCOMPLETE' && error.details.createdPath === path.join(parent, '保留'));
  assert.ok(await inspectLearningSpace(path.join(f.root, '保留'))); assert.equal(f.entries.length, 0);
});

test('tampered bundled assets are detected before choosing or creating a directory', async t => {
  const f = await fixture(t), copiedSkill = path.join(f.root, 'skill');
  await fs.cp(skill, copiedSkill, { recursive: true });
  await fs.appendFile(path.join(copiedSkill, 'assets/project/AGENTS.md'), '\nTAMPERED');
  const service = createLearningSpacesService({ registry: f.registry, skill: copiedSkill, pickDirectory: async () => { throw Error('must not open'); } });
  await assert.rejects(service.createLearning({ name: 'never', operationId: 'tampered' }), { code: 'INVALID_SCAFFOLD' });
  assert.deepEqual(await fs.readdir(f.root), ['skill']); assert.equal(f.entries.length, 0);
});

test('linked learner subtree is not recognized as an owned learning project', async t => {
  const f = await fixture(t), real = path.join(f.root, 'real'), linked = path.join(f.root, 'linked');
  await fs.mkdir(real); await seed(real); await fs.mkdir(linked);
  await fs.symlink(path.join(real, '我的学习'), path.join(linked, '我的学习'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.writeFile(path.join(linked, '.steps2great.json'), '{"version":1,"skill":"steps2great"}');
  assert.equal(await inspectLearningSpace(linked), null);
});

test('production workbench scans learning subtrees only and refuses generic workspace identity through the bridge', async t => {
  const f = await fixture(t); await seed(f.root);
  await fs.writeFile(path.join(f.root, 'README.md'), '# Framework README');
  await fs.mkdir(path.join(f.root, 'src')); await fs.writeFile(path.join(f.root, 'src/教学引导.md'), '# Not a course');
  await fs.mkdir(path.join(f.root, '资料')); await fs.writeFile(path.join(f.root, '资料/笔记.md'), '# 我的笔记');
  f.entries.push({ id: 'learning', path: f.root });
  const generic = path.join(f.root, 'generic'); await fs.mkdir(generic); f.entries.push({ id: 'generic', path: generic });
  const service = createWorkbenchService({ resolveWorkspace: f.service.resolveWorkspace, learningOnly: true });
  const data = await service.workspace({ workspaceId: 'learning' });
  assert.deepEqual(data.tree.children.map(n => n.name).sort(), ['我的学习', '资料'].sort()); assert.equal(data.courses.length, 0);
  const response = await createWorkbenchHandler(service)(new Request('http://dsh/api/stg-learning/workspace?workspaceId=generic'));
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'NOT_STG_WORKSPACE');
});

test('onboarding routes preserve native cancellation signal and return no private transport errors', async () => {
  let signal;
  const handler = createWorkbenchHandler({ createLearning: async (_input, options) => { signal = options.signal; return { cancelled: true }; }, importLearning: async () => { throw Error('PRIVATE'); }, library: async () => ({ items: [] }) });
  const result = await handler(new Request('http://dsh/api/stg-learning/learning/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.deepEqual(await result.json(), { ok: true, data: { cancelled: true } }); assert.ok(signal instanceof AbortSignal);
  assert.equal((await handler(new Request('http://dsh/api/stg-learning/learning'))).status, 200);
  const failure = await handler(new Request('http://dsh/api/stg-learning/learning/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(failure.status, 500); assert.doesNotMatch(await failure.text(), /PRIVATE/);
});

test('initial mentor draft starts goal discovery and explicitly preserves existing evidence', () => {
  const draft = buildMentorDraft({ intent: 'initialize' });
  assert.match(draft, /还没确定具体目标/); assert.match(STG_PERSONA, /没有文件证据时如实说明/); assert.match(STG_PERSONA, /不自动覆盖升级/); assert.match(STG_PERSONA, /AGENTS.md/);
});
