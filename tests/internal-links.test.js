import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createWorkbenchService } from '../src/host/service.js';
import { inspectLearningSpace, createLearningSpacesService } from '../src/host/learning-spaces.js';
import { atomicWrite, resolvePath, textAt, treeAt } from '../src/host/files.js';

const dirLink = process.platform === 'win32' ? 'junction' : 'dir';
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-internal-links-'));
  const directory = path.join(base, 'learning'), outside = path.join(base, 'outside');
  await fs.mkdir(directory); await fs.mkdir(outside);
  const root = await fs.realpath(directory);
  t.after(async () => {
    const absolute = path.resolve(base);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
    assert.ok(path.basename(absolute).startsWith('stg-internal-links-'));
    await fs.rm(absolute, { recursive: true, force: true });
  });
  const write = async (relative, text) => { await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true }); await fs.writeFile(path.join(root, relative), text); };
  const link = (target, alias, type = 'file') => fs.symlink(path.join(root, target), path.join(root, alias), type);
  const service = createWorkbenchService({ learningOnly: true, resolveWorkspace: async () => ({ workspaceId: 'w', path: root }) });
  return { root: await fs.realpath(root), outside, write, link, service };
}
const req = path => ({ workspaceId: 'w', path });

test('legacy playground layout imports without changing links or student records and discovers canonical courses', async t => {
  const f = await fixture(t);
  const profile = '# Java 学习档案\n\n## 🚦 当前交接状态\n\n| 项目 | 当前状态 |\n| --- | --- |\n| 当前学科 | Java |\n| 当前课次 | Lambda |\n| 教学文档 | [教学](./17-Lambda/01_教学引导.md) |\n| 回答文档 | [回答](./17-Lambda/01_学生回答.md) |\n| 当前进度 | 等待作答 |\n';
  await f.write('00_学习档案.md', profile);
  await f.write('00_课程路线.md', '# 课程路线\n\n| 课程 | 状态 |\n| --- | --- |\n| Lambda | 进行中 |\n');
  await f.write('AGENTS.md', '# StepsToGreat · 导师协议入口');
  await f.write('协议/00_导师协议.md', '# 导师协议');
  await f.write('17-Lambda/01_教学引导.md', '# Lambda\n\n## 第一轮\n\n### 问题 1\n\n有什么作用？');
  await f.write('17-Lambda/01_学生回答.md', '# 回答\n\n## 第一轮\n\n### 问题 1\n\n有什么作用？\n\n**我的回答**\n');
  await fs.mkdir(path.join(f.root, '我的学习'));
  await f.link('00_学习档案.md', '我的学习/00-学习档案.md');
  await f.link('00_学习档案.md', '我的学习/00_学习档案.md');
  await f.link('00_课程路线.md', '我的学习/00_课程路线.md');
  await f.link('17-Lambda', '我的学习/17-Lambda', dirLink);
  const before = await fs.readdir(f.root);
  const entries = [{ id: 'w', path: f.root, title: 'playground' }];
  const spaces = createLearningSpacesService({ registry: { get: id => entries.find(row => row.id === id), list: () => entries, create: () => assert.fail('must reuse registered identity') }, pickDirectory: async () => f.root });
  assert.equal((await inspectLearningSpace(f.root)).mode, 'standalone');
  assert.equal((await spaces.importLearning({ operationId: 'legacy-import' })).workspace.workspaceId, 'w');
  const overview = await f.service.workspace({ workspaceId: 'w' });
  assert.equal(overview.courses.length, 1); assert.equal(overview.courses[0].id, '17-Lambda');
  assert.equal(overview.current.courseId, '17-Lambda');
  assert.equal(overview.profile.path, '00_学习档案.md'); assert.equal(overview.profile.content, profile);
  assert.equal(overview.progress.overall, 'Java · 0 / 1 课已掌握');
  assert.equal(overview.tree.count, 4); assert.deepEqual(await fs.readdir(f.root), before);
  assert.equal((await fs.lstat(path.join(f.root, '我的学习/00-学习档案.md'))).isSymbolicLink(), true);
});

test('saving through a file alias preserves the link, shares history and reuses canonical operation receipts', async t => {
  const f = await fixture(t); await f.write('real.md', '# original'); await f.link('real.md', 'alias.md');
  const original = await f.service.read(req('alias.md'));
  const request = { ...req('alias.md'), expectedVersion: original.version, operationId: 'same-save', content: '# edited' };
  await f.service.save(request);
  assert.equal((await fs.lstat(path.join(f.root, 'alias.md'))).isSymbolicLink(), true);
  assert.equal(await fs.readFile(path.join(f.root, 'real.md'), 'utf8'), '# edited');
  assert.equal((await f.service.save({ ...request, path: 'real.md' })).content, '# edited');
  const aliasHistory = await f.service.history(req('alias.md')), realHistory = await f.service.history(req('real.md'));
  assert.deepEqual(aliasHistory, realHistory); assert.equal(realHistory.items.length, 1);
  const id = realHistory.items[0].id;
  assert.equal((await f.service.historyRead({ ...req('alias.md'), id })).content, '# original');
  const current = await f.service.read(req('alias.md'));
  await f.service.restore({ ...req('alias.md'), id, expectedVersion: current.version, operationId: 'restore-alias' });
  assert.equal(await fs.readFile(path.join(f.root, 'real.md'), 'utf8'), '# original');
  assert.equal((await fs.lstat(path.join(f.root, 'alias.md'))).isSymbolicLink(), true);
});

test('different directory aliases serialize against the same real document', async t => {
  const f = await fixture(t); await f.write('lesson/doc.md', '# before');
  await f.link('lesson', 'one', dirLink); await f.link('lesson', 'two', dirLink);
  const initial = await f.service.read(req('one/doc.md'));
  const responses = await Promise.allSettled(['one', 'two'].map((alias, index) => f.service.save({ ...req(alias + '/doc.md'), expectedVersion: initial.version, operationId: 'concurrent-' + index, content: '# edit ' + index })));
  assert.equal(responses.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(responses.find(row => row.status === 'rejected').reason.code, 'VERSION_CONFLICT');
  assert.equal((await f.service.history(req('lesson/doc.md'))).items.length, 1);
});

test('internal links cannot expose hidden directories, dependencies or external-hop-return chains', async t => {
  const f = await fixture(t);
  for (const folder of ['.private', '.stg-desk', 'node_modules', 'vendor', 'release']) {
    await f.write(folder + '/secret.md', '# private');
    const alias = 'public-' + folder.replace(/\W/g, ''); await f.link(folder, alias, dirLink);
    await assert.rejects(f.service.read(req(alias + '/secret.md')), { code: 'INVALID_PATH' });
  }
  await f.write('public.md', '# public');
  await fs.symlink(path.join(f.root, 'public.md'), path.join(f.outside, 'return.md'), 'file');
  await fs.symlink(path.join(f.outside, 'return.md'), path.join(f.root, 'escape-return.md'), 'file');
  await assert.rejects(f.service.read(req('escape-return.md')), { code: 'INVALID_PATH' });
  assert.equal(await fs.readFile(path.join(f.root, 'public.md'), 'utf8'), '# public');
});

test('directory cycles and repeated aliases are bounded and each real document is listed once', async t => {
  const f = await fixture(t); await f.write('lesson/inner/doc.md', '# lesson');
  await f.link('lesson', 'lesson/inner/back', dirLink); await f.link('lesson', 'duplicate', dirLink);
  const tree = await treeAt(f.root); assert.equal(tree.count, 1);
  await f.link('cycle-b.md', 'cycle-a.md'); await f.link('cycle-a.md', 'cycle-b.md');
  await assert.rejects(resolvePath(f.root, 'cycle-a.md'), { code: 'INVALID_PATH' });
  await fs.symlink(f.root, path.join(f.root, 'root-loop'), dirLink);
  await assert.rejects(resolvePath(f.root, 'root-loop'), { code: 'INVALID_PATH' });
});

test('metadata links remain forbidden even if their targets are inside the same workspace', async t => {
  const f = await fixture(t); await f.write('metadata/workbench.json', '{"revision":0}'); await f.write('doc.md', '# original');
  await f.link('metadata', '.stg-desk', dirLink);
  await assert.rejects(f.service.state({ workspaceId: 'w' }), { code: 'INVALID_PATH' });
  await assert.rejects(f.service.updateState({ workspaceId: 'w', patch: { lastView: 'read' } }), { code: 'INVALID_PATH' });
  const doc = await f.service.read(req('doc.md'));
  await assert.rejects(f.service.save({ ...req('doc.md'), expectedVersion: doc.version, operationId: 'blocked', content: '# new' }), { code: 'INVALID_PATH' });
  assert.deepEqual(await fs.readdir(path.join(f.root, 'metadata')), ['workbench.json']);
  assert.equal(await fs.readFile(path.join(f.root, 'doc.md'), 'utf8'), '# original');
});

test('retargeting a file alias before replacement aborts without replacing either target or the alias', async t => {
  const f = await fixture(t); await f.write('one.md', '# one'); await f.write('two.md', '# two'); await f.link('one.md', 'alias.md');
  await assert.rejects(atomicWrite(f.root, 'alias.md', '# replacement', { beforeReplace: async () => {
    await fs.unlink(path.join(f.root, 'alias.md')); await f.link('two.md', 'alias.md');
  } }), { code: 'INVALID_PATH' });
  assert.equal(await fs.readFile(path.join(f.root, 'one.md'), 'utf8'), '# one');
  assert.equal(await fs.readFile(path.join(f.root, 'two.md'), 'utf8'), '# two');
  assert.equal((await fs.lstat(path.join(f.root, 'alias.md'))).isSymbolicLink(), true);
  assert.equal((await textAt(f.root, 'alias.md')).content, '# two');
});
