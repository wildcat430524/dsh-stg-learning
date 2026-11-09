import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { createWorkbenchService } from '../src/host/service.js';

// Committed MIT STG Desk demo/StepsToGreat fixture (6b047b17...), copied as text for portable tests.
const COURSE = '我的学习/学科/Python/01-认识变量';
const GUIDE = `${COURSE}/01_教学引导.md`;
const ANSWER = `${COURSE}/01_学生回答.md`;
const PROFILE = '我的学习/00-学习档案.md';
const profile = `# 我的学习档案 · 演示

> 本工作区仅演示软件功能。作答保存不代表正式掌握。

## 🚦 当前交接状态

| 字段 | 值 |
| --- | --- |
| 当前学科 | Python |
| 当前课程 | 01-认识变量 |
| 当前轮次 | 第一轮 |
| 教学引导 | [阅读本课](./学科/Python/01-认识变量/01_教学引导.md) |
| 学生回答 | [我的回答](./学科/Python/01-认识变量/01_学生回答.md) |
| 状态 | 等待学生作答 |

## 📊 掌握表

| 单元 | 状态 |
| --- | --- |
| 认识变量 | 未评估 |

## ⏳ 待办表

- 回答第一轮的两个问题，再由导师评估。
`;
const answer = `# Python · 认识变量 · 学生回答

> 演示工作区。历史原答与评估记录保留，新增作答原文追加。

## 第一轮

### 问题 1：变量名与变量值

在 \`price = 25\` 中，哪个是变量名，哪个是变量值？请用你自己的话解释。

**我的回答**

### 问题 2：写一段代码

把顾客年龄记录为 21，并打印这个年龄。请写出两行 Python 代码。

**我的回答**

\`\`\`python
\`\`\`

---

## 最终复评结果

（整课所有轮次通过后由导师填写）

---

## 正确答案与解析

（评估完成后由导师填写）
`;
const guide = "# Python · 认识变量\n\n> 演示课程：把一项信息交给一个名字保管。\n\n## 小目标｜记录一位顾客的年龄\n\n- [ ] 说清变量名和变量值的区别\n- [ ] 创建变量，并输出它的值\n\n## 从一个具体场景开始\n\n你在给咖啡店写一段顾客登记程序。今天的顾客是 18 岁，需要把年龄记录下来，稍后打印到屏幕。\n\n```python\nage = 18\nprint(age)\n```\n\n`age` 是变量名，`18` 是变量值。这里的 `=` 表示把右侧的值交给左侧的名字。\n\n| 名称 | 含义 | 例子 |\n| --- | --- | --- |\n| 变量名 | 在程序里找到这项信息的名字 | `age` |\n| 变量值 | 这个名字当前保存的信息 | `18` |\n\n## 第一轮\n\n### 问题 1：变量名与变量值\n\n在 `price = 25` 中，哪个是变量名，哪个是变量值？请用你自己的话解释。\n\n### 问题 2：写一段代码\n\n把顾客年龄记录为 21，并打印这个年龄。请写出两行 Python 代码。\n\n---\n\n右侧答案保存后会追加到本课的学生回答中。**软件负责文档保存，正式评估由导师完成。**\n";
const hash = value => createHash('sha256').update(value).digest('hex');
const countAnswers = value => (value.match(/\*\*学生作答 ·/g) || []).length;
const mutation = (document, rest = {}) => ({ workspaceId: 'registered', path: document.path, expectedVersion: document.version, operationId: randomUUID(), ...rest });

async function fixture(t, documents = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'stg-host-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (relative, content) => {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  };
  for (const [relative, content] of Object.entries({ [PROFILE]: profile, [GUIDE]: guide, [ANSWER]: answer, 'README.md': '# 学习工作区', ...documents })) await write(relative, content);
  const resolveWorkspace = async workspaceId => {
    if (workspaceId !== 'registered') throw new Error('unknown workspace');
    return { workspaceId, path: root, title: '真实注册的演示工作区' };
  };
  return { root, write, resolveWorkspace, service: createWorkbenchService({ resolveWorkspace }) };
}
const errorCode = code => error => error.code === code && typeof error.status === 'number';

test('registered workspace resolves demo course, current lesson, raw records and evidence-only progress', async t => {
  const { service, root, write } = await fixture(t);
  await write('.git/config', 'hidden');
  await write('node_modules/private.md', 'hidden');
  const result = await service.workspace({ workspaceId: 'registered', root: 'C:/' });
  assert.equal(result.workspace.path, root);
  assert.equal(result.workspace.title, '真实注册的演示工作区');
  assert.equal(result.current.courseId, COURSE);
  assert.equal(result.current.guidePath, GUIDE);
  assert.equal(result.current.answerPath, ANSWER);
  assert.equal(result.current.roundId, GUIDE);
  assert.equal(result.courses[0].subject, 'Python');
  assert.equal(result.profile.content, profile);
  assert.match(result.progress.chapter, /第一轮.*等待学生作答/);
  assert.doesNotMatch(JSON.stringify(result.progress), /%/);
  assert.equal(result.state.revision, 0);
  assert.ok(!JSON.stringify(result.tree).includes('private.md'));
  assert.ok(!JSON.stringify(result.tree).includes('.git'));
  const document = await service.read({ workspaceId: 'registered', path: ANSWER });
  assert.equal(document.version, hash(answer));
  assert.equal(document.questions.current.length, 2);
  assert.equal(document.records.rounds.length, 1);
  assert.match(document.records.finalReview.content, /整课所有轮次通过后由导师填写/);
  assert.equal(document.records.blocks.map(block => block.content).join(''), answer);
  await assert.rejects(service.read({ workspaceId: 'unknown', path: ANSWER }), errorCode('WORKSPACE_NOT_FOUND'));
  await assert.rejects(service.read({ path: ANSWER }), errorCode('WORKSPACE_NOT_FOUND'));
});

test('host resolves the recorded profile round for independent round files and same-file rounds', async t => {
  const course = '我的学习/学科/Python/07-独立轮次';
  const guide = `${course}/01_教学引导.md`, answerPath = `${course}/01_学生回答.md`;
  const rounds = [1, 2, 3].map(n => `${course}/第${n}轮_教学引导.md`);
  const profileWith = round => profile.replace('| 当前课程 | 01-认识变量 |', `| 当前课程 | 07-独立轮次 |`).replace('| 当前轮次 | 第一轮 |', round ? `| 当前轮次 | ${round} |` : '').replace('| 教学引导 | [阅读本课](./学科/Python/01-认识变量/01_教学引导.md) |', `| 教学引导 | [阅读本课](./学科/Python/07-独立轮次/01_教学引导.md) |`).replace('| 学生回答 | [我的回答](./学科/Python/01-认识变量/01_学生回答.md) |', `| 学生回答 | [我的回答](./学科/Python/07-独立轮次/01_学生回答.md) |`);
  const { service, write } = await fixture(t, {
    [PROFILE]: profileWith('第三轮'),
    [guide]: '# 独立轮次课\n\n这里只是本轮索引。\n',
    [answerPath]: '# 回答\n\n## 第一轮\n\n### 问题 1\n旧题\n\n## 第三轮\n\n### 问题 1\n新题\n',
    [rounds[0]]: '# 第一轮教学\n\n第一轮内容。\n',
    [rounds[1]]: '# 第二轮教学\n\n第二轮内容。\n',
    [rounds[2]]: '# 第三轮教学\n\n第三轮内容。\n',
  });
  const independent = await service.workspace({ workspaceId: 'registered' });
  assert.equal(independent.current.courseId, course);
  assert.equal(independent.current.roundId, rounds[2]);
  assert.equal(independent.courses.find(item => item.id === course).currentRoundId, rounds[2]);

  // Same-file rounds: the round heading lives inside the teaching entry document.
  const sameGuide = '# 多轮教学\n\n## 第一轮\n\n### 问题 1\n一\n\n## 第二轮\n\n### 问题 1\n二\n\n## 第三轮\n\n### 问题 1\n三\n';
  await write(PROFILE, profileWith('第二轮'));
  await write(guide, sameGuide);
  const sameFile = await service.workspace({ workspaceId: 'registered' });
  const sameCourse = sameFile.courses.find(item => item.id === course);
  const expected = `${guide}#round=${encodeURIComponent('第二轮')}`;
  assert.ok(sameCourse.rounds.some(round => round.title === '第二轮' && round.path === guide));
  assert.equal(sameFile.current.roundId, expected);
  assert.equal(sameCourse.currentRoundId, expected);
});

test('host degrades safely without explicit round evidence and never guesses a maximum round', async t => {
  const course = '我的学习/学科/Python/08-无轮次';
  const guide = `${course}/01_教学引导.md`, answerPath = `${course}/01_学生回答.md`;
  const base = profile.replace('| 当前课程 | 01-认识变量 |', '| 当前课程 | 08-无轮次 |').replace('| 当前轮次 | 第一轮 |\n', '').replace('| 教学引导 | [阅读本课](./学科/Python/01-认识变量/01_教学引导.md) |', `| 教学引导 | [阅读本课](./学科/Python/08-无轮次/01_教学引导.md) |`).replace('| 学生回答 | [我的回答](./学科/Python/01-认识变量/01_学生回答.md) |', `| 学生回答 | [我的回答](./学科/Python/08-无轮次/01_学生回答.md) |`);
  const { service, write } = await fixture(t, {
    [PROFILE]: base,
    [guide]: '# 无轮次课\n\n## 第一轮\n\n一\n\n## 第二轮\n\n二\n\n## 第三轮\n\n三\n',
    [answerPath]: '# 回答\n\n## 当前轮\n\n### 问题 1\n无轮次标记\n',
  });
  const result = await service.workspace({ workspaceId: 'registered' });
  const target = result.courses.find(item => item.id === course);
  assert.equal(result.current.courseId, course);
  assert.equal(result.current.roundId, null, 'no explicit or scanned current round must not fabricate one');
  assert.equal(target.currentRoundId, undefined);
  assert.equal(target.rounds.length, 3, 'recorded rounds stay navigable for manual selection');
  // The answer document's current question round is real evidence when the
  // profile has no declared round.
  await write(answerPath, '# 回答\n\n## 第二轮\n\n### 问题 1\n新题\n');
  const evidenced = await service.workspace({ workspaceId: 'registered' });
  assert.equal(evidenced.current.roundId, `${guide}#round=${encodeURIComponent('第二轮')}`);
  // An unknown declared round is a warning, not a fabricated current round.
  await write(PROFILE, base.replace('| 学生回答 |', '| 当前轮次 | 第九轮 |\n| 学生回答 |'));
  await write(answerPath, '# 回答\n\n## 当前轮\n\n### 问题 1\n无轮次标记\n');
  const unknown = await service.workspace({ workspaceId: 'registered' });
  assert.equal(unknown.current.roundId, null);
  assert.ok(unknown.warnings.some(warning => warning.includes('第九轮')));
  await write(answerPath, '# 回答\n\n## 第二轮\n\n### 问题 1\n旧题\n');
  assert.equal((await service.workspace({ workspaceId: 'registered' })).current.roundId, null, 'an unmatched explicit handoff must not silently fall back to older answer evidence');
});

test('answer appends original attempts safely, preserves tutor and profile, and survives durable idempotent retries', async t => {
  const { service, resolveWorkspace } = await fixture(t);
  const initial = await service.read({ workspaceId: 'registered', path: ANSWER });
  const text = '变量名是 price，变量值是 25。\n```python\nprint(price)\n```\n## 第二轮\n### 问题 99';
  const request = mutation(initial, { answers: [{ id: initial.questions.current[0].id, text }] });
  const saved = await service.answer(request);
  assert.equal(countAnswers(saved.content), 1);
  assert.equal(saved.questions.current.length, 2, 'answer Markdown cannot create new tutor questions');
  assert.equal(saved.questions.current[0].answer.value, text);
  assert.equal(saved.questions.current[0].answer.kind, 'saved');
  assert.ok(saved.content.includes('**我的回答**'));
  assert.equal(saved.records.finalReview.content, initial.records.finalReview.content);
  assert.equal(saved.records.answerKey.content, initial.records.answerKey.content);
  assert.equal((await service.read({ workspaceId: 'registered', path: PROFILE })).content, profile);
  const restarted = createWorkbenchService({ resolveWorkspace });
  assert.deepEqual(await restarted.answer(request), saved);
  assert.equal(countAnswers((await service.read({ workspaceId: 'registered', path: ANSWER })).content), 1);
  await assert.rejects(service.answer({ ...request, answers: [{ id: initial.questions.current[0].id, text: 'changed' }] }), errorCode('OPERATION_CONFLICT'));
  await assert.rejects(service.answer({ ...request, operationId: randomUUID() }), errorCode('VERSION_CONFLICT'));
  const attempt2 = await service.answer(mutation(saved, { answers: [{ id: saved.questions.current[0].id, text: '再解释一次。' }] }));
  assert.equal(countAnswers(attempt2.content), 2);
  assert.ok(attempt2.content.includes(text));
  assert.equal(attempt2.questions.current[0].answer.value, '再解释一次。');
});

test('current question validation rejects duplicates, old rounds, empty answers and malformed four-question rounds', async t => {
  const { service, write } = await fixture(t);
  const oldRound = '## 第一轮\n\n### 问题 1\n旧题\n\n## 第二轮\n\n### 问题 1\n新题\n';
  await write(ANSWER, oldRound);
  const document = await service.read({ workspaceId: 'registered', path: ANSWER });
  await assert.rejects(service.answer(mutation(document, { answers: [{ id: document.questions.questions[0].id, text: '旧题回答' }] })), errorCode('INVALID_ANSWERS'));
  const id = document.questions.current[0].id;
  for (const answers of [[], [{ id, text: '' }], [{ id, text: '一' }, { id, text: '二' }], [{ id: 1, text: '一' }], [{ id, text: '一', token: 'secret' }]]) {
    await assert.rejects(service.answer(mutation(document, { answers })), errorCode('INVALID_ANSWERS'));
  }
  const malformed = '## 第二轮\n\n' + [1, 2, 3, 4].map(n => `### 问题 ${n}\n\n作答\n`).join('\n');
  await write(ANSWER, malformed);
  const four = await service.read({ workspaceId: 'registered', path: ANSWER });
  await assert.rejects(service.answer(mutation(four, { answers: [{ id: four.questions.current[0].id, text: '一' }] })), errorCode('INVALID_ANSWERS'));
  assert.equal((await service.read({ workspaceId: 'registered', path: ANSWER })).content, malformed);
  await assert.rejects(service.answer(mutation(document, { path: GUIDE, answers: [{ id, text: '一' }] })), errorCode('INVALID_ANSWERS'));
});

test('fenced examples, comments, blockquotes and tutor questions stay outside current question detection', async t => {
  const { service, write } = await fixture(t);
  const content = '## 第一轮\n\n### 问题 1\n\n真题\n\n```markdown\n## 第二轮\n### 问题 8\n```\n\n<!--\n## 第三轮\n### 问题 9\n-->\n\n> ### 问题 7\n\n## 导师评估\n\n### 问题 6\n\n## 最终复评结果\n\n### 问题 5\n';
  await write(ANSWER, content);
  const document = await service.read({ workspaceId: 'registered', path: ANSWER });
  assert.deepEqual(document.questions.current.map(question => question.number), ['1']);
  const saved = await service.answer(mutation(document, { answers: [{ id: document.questions.current[0].id, text: '真实答案' }] }));
  assert.equal(saved.content.slice(saved.content.indexOf('## 导师评估')), content.slice(content.indexOf('## 导师评估')));
});

test('optimistic saves across service instances serialize, retain external edits, back up, preview and restore', async t => {
  const { service, resolveWorkspace, write } = await fixture(t);
  const second = createWorkbenchService({ resolveWorkspace });
  const initial = await service.read({ workspaceId: 'registered', path: GUIDE });
  const responses = await Promise.allSettled([
    service.save(mutation(initial, { content: `${guide}\n窗口一修改` })),
    second.save(mutation(initial, { content: `${guide}\n窗口二修改` })),
  ]);
  assert.equal(responses.filter(response => response.status === 'fulfilled').length, 1);
  assert.equal(responses.find(response => response.status === 'rejected').reason.code, 'VERSION_CONFLICT');
  const current = await service.read({ workspaceId: 'registered', path: GUIDE });
  const history = await service.history({ workspaceId: 'registered', path: GUIDE });
  assert.equal(history.items.length, 1);
  assert.equal((await service.historyRead({ workspaceId: 'registered', path: GUIDE, id: history.items[0].id })).content, guide);
  const restored = await service.restore(mutation(current, { id: history.items[0].id }));
  assert.equal(restored.content, guide);
  const afterRestore = await service.history({ workspaceId: 'registered', path: GUIDE });
  assert.equal(afterRestore.items.length, 2);
  assert.ok((await Promise.all(afterRestore.items.map(item => service.historyRead({ workspaceId: 'registered', path: GUIDE, id: item.id })))).some(item => item.content === current.content));
  const noop = await service.save(mutation(restored, { content: restored.content }));
  assert.equal(noop.content, guide);
  assert.equal((await service.history({ workspaceId: 'registered', path: GUIDE })).items.length, 2);
  await write(GUIDE, `${guide}\n导师外部编辑`);
  await assert.rejects(service.save(mutation(restored, { content: '不得覆盖' })), errorCode('VERSION_CONFLICT'));
  assert.match((await service.read({ workspaceId: 'registered', path: GUIDE })).content, /导师外部编辑/);
  await assert.rejects(service.historyRead({ workspaceId: 'registered', path: ANSWER, id: history.items[0].id }), errorCode('INVALID_HISTORY'));
});

test('interrupted operation receipts recover both before and after filesystem replacement without duplicate answers', async t => {
  const { service, root, write, resolveWorkspace } = await fixture(t);
  const initial = await service.read({ workspaceId: 'registered', path: ANSWER });
  const request = mutation(initial, { answers: [{ id: initial.questions.current[0].id, text: '可恢复的回答' }] });
  const saved = await service.answer(request);
  const receiptPath = path.join(root, '.stg-desk', 'operations', `${hash(request.operationId)}.json`);
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  receipt.committed = false;
  await fs.writeFile(receiptPath, JSON.stringify(receipt));
  const restarted = createWorkbenchService({ resolveWorkspace });
  assert.equal(countAnswers((await restarted.answer(request)).content), 1);
  await write(ANSWER, initial.content);
  receipt.committed = false;
  await fs.writeFile(receiptPath, JSON.stringify(receipt));
  assert.equal((await restarted.answer(request)).content, saved.content);
  assert.equal(countAnswers((await restarted.read({ workspaceId: 'registered', path: ANSWER })).content), 1);
  await write(ANSWER, `${initial.content}\n导师另开一轮`);
  receipt.committed = false;
  await fs.writeFile(receiptPath, JSON.stringify(receipt));
  await assert.rejects(restarted.answer(request), errorCode('VERSION_CONFLICT'));
});

test('validated persistent state merges concurrent course associations and detects stale revisions', async t => {
  const { service, resolveWorkspace, root } = await fixture(t);
  const other = createWorkbenchService({ resolveWorkspace });
  await Promise.all([
    service.updateState({ workspaceId: 'registered', patch: { lastCourseId: COURSE, courseSessions: { [COURSE]: 'session-one' } } }),
    other.updateState({ workspaceId: 'registered', patch: { lastView: 'answer', courseSessions: { '另一学科/课程': 'session-two' } } }),
  ]);
  const state = await service.state({ workspaceId: 'registered' });
  assert.equal(state.revision, 2);
  assert.deepEqual(state.courseSessions, { [COURSE]: 'session-one', '另一学科/课程': 'session-two' });
  assert.equal(state.lastView, 'answer');
  assert.deepEqual(await other.state({ workspaceId: 'registered' }), state);
  await assert.rejects(service.updateState({ workspaceId: 'registered', patch: { lastView: 'review' }, expectedRevision: 0 }), errorCode('STATE_CONFLICT'));
  for (const patch of [{ apiKey: 'never persist credentials' }, { messages: [] }, { lastView: 'tutor-model' }, { revision: 100 }, { lastDocumentPath: '../outside.md' }, JSON.parse('{"courseSessions":{"__proto__":"x"}}')]) {
    await assert.rejects(service.updateState({ workspaceId: 'registered', patch }), error => ['INVALID_STATE', 'INVALID_PATH'].includes(error.code));
  }
  const next = await service.updateState({ workspaceId: 'registered', patch: { lastDocumentPath: GUIDE, courseSessions: { [COURSE]: null } }, expectedRevision: 2 });
  assert.equal(next.revision, 3);
  assert.equal(next.courseSessions[COURSE], undefined);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, '.stg-desk/workbench.json'), 'utf8')).revision, 3);
  assert.equal({}.polluted, undefined);
});

test('corrupt state stays intact and isolated to a workspace warning', async t => {
  const { service, write, root } = await fixture(t);
  await write('.stg-desk/workbench.json', '{broken state');
  await assert.rejects(service.state({ workspaceId: 'registered' }), errorCode('INVALID_STATE'));
  await assert.rejects(service.updateState({ workspaceId: 'registered', patch: { lastView: 'read' } }), errorCode('INVALID_STATE'));
  const result = await service.workspace({ workspaceId: 'registered' });
  assert.equal(result.current.courseId, COURSE);
  assert.ok(result.warnings.some(warning => warning.includes('偏好无法读取')));
  assert.equal(await fs.readFile(path.join(root, '.stg-desk/workbench.json'), 'utf8'), '{broken state');
});

test('browser path escapes, hidden folders and external links are rejected; internal document aliases remain readable', async t => {
  const { service, root, write } = await fixture(t);
  for (const value of ['../outside.md', 'x/../../outside.md', '/outside.md', 'E:/outside.md', 'E:outside.md', '\\\\host\\outside.md', '.git/config', '.stg-desk/workbench.json', 'node_modules/a.md', 'vendor/a.md', 'x/../README.md', 'README.md:stream', 'README.md.', 'CON.md', 'x\u0000.md']) {
    await assert.rejects(service.read({ workspaceId: 'registered', path: value }), errorCode('INVALID_PATH'), value);
  }
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-host-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'outside.md'), 'outside sentinel');
  await fs.symlink(outside, path.join(root, 'escaped'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(path.join(root, '我的学习'), path.join(root, 'inside-link'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(path.join(outside, 'outside.md'), path.join(root, 'linked.md'), 'file');
  for (const value of ['escaped/outside.md', 'linked.md']) {
    await assert.rejects(service.read({ workspaceId: 'registered', path: value }), errorCode('INVALID_PATH'));
  }
  assert.equal((await service.read({ workspaceId: 'registered', path: 'inside-link/00-学习档案.md' })).content, profile);
  const result = await service.workspace({ workspaceId: 'registered' });
  assert.ok(result.warnings.some(warning => warning.includes('escaped')));
  assert.ok(!result.tree.children.some(node => ['escaped', 'inside-link', 'linked.md'].includes(node.name)));
  assert.equal(await fs.readFile(path.join(outside, 'outside.md'), 'utf8'), 'outside sentinel');
});

test('linked metadata directories cannot redirect state, backups or operation receipts', async t => {
  const { service, root } = await fixture(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-host-meta-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.symlink(outside, path.join(root, '.stg-desk'), process.platform === 'win32' ? 'junction' : 'dir');
  const document = await service.read({ workspaceId: 'registered', path: GUIDE });
  await assert.rejects(service.save(mutation(document, { content: 'do not write outside' })), errorCode('INVALID_PATH'));
  await assert.rejects(service.updateState({ workspaceId: 'registered', patch: { lastView: 'read' } }), errorCode('INVALID_PATH'));
  assert.deepEqual(await fs.readdir(outside), []);
  assert.equal((await service.read({ workspaceId: 'registered', path: GUIDE })).content, guide);
});

test('invalid UTF-8, oversized documents and unsupported files fail without changing original bytes', async t => {
  const { service, write } = await fixture(t);
  await write('invalid.md', Buffer.from([0xc3, 0x28]));
  await write('too-large.md', Buffer.alloc(8 * 1024 * 1024 + 1, 0x61));
  await write('executable.js', 'console.log("not a document")');
  await assert.rejects(service.read({ workspaceId: 'registered', path: 'invalid.md' }), errorCode('INVALID_ENCODING'));
  await assert.rejects(service.read({ workspaceId: 'registered', path: 'too-large.md' }), errorCode('DOCUMENT_TOO_LARGE'));
  await assert.rejects(service.read({ workspaceId: 'registered', path: 'executable.js' }), errorCode('UNSUPPORTED_DOCUMENT'));
  const initial = await service.read({ workspaceId: 'registered', path: GUIDE });
  await assert.rejects(service.save(mutation(initial, { content: '\ud800' })), errorCode('INVALID_DOCUMENT'));
  await assert.rejects(service.save({ ...mutation(initial, { content: 'x' }), expectedVersion: undefined }), errorCode('VERSION_REQUIRED'));
  await assert.rejects(service.save({ ...mutation(initial, { content: 'x' }), operationId: undefined }), errorCode('INVALID_OPERATION'));
});

test('raster assets require a matching extension and signature; SVG and disguised HTML never pass', async t => {
  const { service, write } = await fixture(t);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6qN8AAAAASUVORK5CYII=', 'base64');
  await write('assets/pixel.png', png);
  await write('assets/fake.png', '<html><script>alert(1)</script></html>');
  await write('assets/mismatched.jpg', png);
  await write('assets/vector.svg', '<svg onload="alert(1)"></svg>');
  const result = await service.asset({ workspaceId: 'registered', path: 'assets/pixel.png' });
  assert.equal(result.mime, 'image/png');
  assert.deepEqual(result.bytes, png);
  for (const relative of ['assets/fake.png', 'assets/mismatched.jpg', 'assets/vector.svg']) await assert.rejects(service.asset({ workspaceId: 'registered', path: relative }), errorCode('UNSUPPORTED_ASSET'));
  await assert.rejects(service.asset({ workspaceId: 'registered', path: '../outside.png' }), errorCode('INVALID_PATH'));
});
