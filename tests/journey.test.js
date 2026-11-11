import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { deriveJourney, deriveOpeningPlan, normalizeSetup, readSetup, saveSetup } from '../src/workbench/journey-model.js';
import { createMentorDraftMailbox } from '../src/mentor-drafts.js';
import { buildMentorDraft, createMentorCoordinator, STG_PERSONA } from '../src/native-protocol.js';
import { CLARIFY_START_NOTE, DIRECT_START_NOTE, EMPTY_DIRECT_NOTE, SAVED_OPENING_STALE, SAVED_RESTART_EMPTY, SAVED_RESTART_HINT, clarifyStartDirection, directStartDirection } from '../src/start-guidance.js';

test('new workspace stays at initialization; a profile file does not imply mastery or a course', () => {
  const result = deriveJourney({ profile: { content: '# 空档案' }, tree: { children: [{ type: 'file', path: '我的学习/00-学习档案.md' }] }, courses: [], state: { revision: 0 } });
  assert.equal(result.phase, 'clarify'); assert.equal(result.course, null); assert.equal(result.savedSessionId, null);
  assert.doesNotMatch(result.phaseLabel, /已通过|已掌握|完成/);
  assert.equal(deriveJourney({ current: { status: '<示例：教学已发布>' }, courses: [] }).nextAction, '');
});
test('existing placement and route files are labeled records, not completion or measured ability', () => {
  const data = { tree: { children: [{ type: 'file', path: '我的学习/学科/英语/00-摸底测试.md' }] } };
  assert.equal(deriveJourney(data).phaseLabel, '已有摸底记录');
  data.tree.children.push({ type: 'file', path: '我的学习/学科/英语/00-课程路线.md' });
  assert.equal(deriveJourney(data).phaseLabel, '已有路线记录');
});
test('journey follows current saved course identity and its existing conversation', () => {
  const data = { current: { courseId: 'math/2', status: '待修订' }, courses: [{ id: 'math/1' }, { id: 'math/2', title: '方程' }], state: { courseSessions: { 'math/2': 'saved' } } };
  const result = deriveJourney(data); assert.equal(result.context.course.id, 'math/2'); assert.equal(result.savedSessionId, 'saved'); assert.equal(result.nextAction, '待修订');
});
test('optional kickoff preferences never become a parallel mastery record', () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(normalizeSetup({ mode: 'unknown', level: 'mastered', brief: 123 }), { mode: 'direct', brief: '' });
  saveSetup(storage, 'w', { mode: 'clarify', brief: '我还不确定要学什么', mastered: true });
  assert.deepEqual(readSetup(storage, 'w'), { mode: 'clarify', brief: '我还不确定要学什么' });
  assert.equal(normalizeSetup({ brief: 'x'.repeat(4000) }).brief.length, 2000);
});
test('normal startup uses integrated clarification and single-question introduction without requiring an external skill', () => {
  const draft = buildMentorDraft({ intent: 'initialize', setup: { mode: 'direct', brief: '学 Python，每天30分钟' } });
  assert.match(draft, /每天30分钟/);
  // Direct start acts on what the learner wrote instead of a fixed story/example opening.
  assert.match(draft, /有具体问题先解答/); assert.match(draft, /有任务先给出第一步/);
  assert.match(draft, /只给了主题就结合我说的基础讲合适的第一步/);
  assert.match(draft, /不要固定用故事或算术题开场/); assert.match(draft, /问我一个必要的问题/);
  assert.doesNotMatch(draft, /小例子/); assert.doesNotMatch(draft, /重复确认|等待重复确认/);
  assert.doesNotMatch(draft, /JSON|AGENTS|guidePath|grill-me/); assert.ok(draft.length < 200);
  assert.match(STG_PERSONA, /已有目标不重复问/); assert.match(STG_PERSONA, /不能编造学习进度/);
  assert.match(STG_PERSONA, /直接从此处开始/); assert.match(STG_PERSONA, /不固定用故事或算术题开场/);
  assert.doesNotMatch(draft, /安装 grill-me|\/grill-me/);
});
test('a direct start with no topic asks one necessary question instead of inventing a topic', () => {
  const draft = buildMentorDraft({ intent: 'initialize', setup: { mode: 'direct', brief: '   ' } });
  assert.match(draft, /先问我一个最要紧的问题/);
  assert.doesNotMatch(draft, /小例子|故事或算术题开场/);
  assert.match(STG_PERSONA, /只有缺少决定起点的关键信息才问一个必要的问题/);
});
test('the staged draft is exactly the page note for both start modes', () => {
  const direct = buildMentorDraft({ intent: 'initialize', setup: { mode: 'direct', brief: '分数通分' } });
  assert.ok(direct.endsWith(directStartDirection('分数通分')));
  const clarify = buildMentorDraft({ intent: 'initialize', setup: { mode: 'clarify', brief: '我想学数学' } });
  assert.ok(clarify.startsWith('我想学数学')); assert.ok(clarify.endsWith(clarifyStartDirection()));
  assert.match(clarify, /一次聊一个问题/); assert.match(clarify, /由我决定/);
  const empty = deriveOpeningPlan({ savedSessionId: '', brief: '', mode: 'direct' });
  assert.equal(empty.startNote, EMPTY_DIRECT_NOTE);
  assert.equal(deriveOpeningPlan({ brief: 'x', mode: 'direct' }).startNote, DIRECT_START_NOTE);
});
test('a saved conversation offers continue and restart as two separate, honest paths', () => {
  const saved = deriveOpeningPlan({ savedSessionId: 's1', savedAvailable: true, brief: '分数通分', mode: 'direct' });
  assert.equal(saved.canContinue, true); assert.equal(saved.stale, false);
  // Restart is always offered, even with no new topic written yet.
  assert.equal(saved.canRestart, true); assert.equal(saved.restartHint, SAVED_RESTART_HINT);
  // The restart text never claims the saved conversation is changed or lost.
  assert.match(saved.openingNote, /原来的对话和草稿都保留/);
  assert.equal(deriveOpeningPlan({ savedSessionId: 's1', brief: '  ' }).restartHint, SAVED_RESTART_EMPTY);
  // In clarify mode the restart hint describes questioning, not a topic apply.
  assert.equal(deriveOpeningPlan({ savedSessionId: 's1', brief: 'x', mode: 'clarify' }).restartHint, CLARIFY_START_NOTE);
});
test('a stale or archived saved binding is reported instead of silently offered', () => {
  // The binding may point at a conversation archived elsewhere or already gone:
  // the page must not draw a "继续原对话" button that cannot honour its promise.
  const stale = deriveOpeningPlan({ savedSessionId: 's1', savedAvailable: false });
  assert.equal(stale.canContinue, false); assert.equal(stale.stale, true);
  assert.equal(stale.staleNote, SAVED_OPENING_STALE);
  assert.match(stale.staleNote, /已不在这个学习空间/);
  // Restart still works, so the learner is never dead-ended.
  assert.equal(stale.canRestart, true);
  // Nothing saved means nothing to report as stale.
  assert.equal(deriveOpeningPlan({ savedSessionId: '' }).stale, false);
});
test('deeper clarification is explicit, bounded by confirmation, and distinct from placement', () => {  const draft = buildMentorDraft({ intent: 'initialize', setup: { mode: 'clarify' } });
  assert.match(draft, /帮我理清目标/); assert.match(draft, /一次聊一个问题/); assert.match(draft, /由我决定/);
  assert.match(STG_PERSONA, /不无限质询/); assert.match(STG_PERSONA, /不把导入.*当成模块掌握/);
});
test('main-composer mailbox coalesces duplicate requests and acknowledges insertion only once', async () => {
  const mailbox = createMentorDraftMailbox(); let notifications = 0;
  const off = mailbox.subscribe(() => notifications++);
  const a = mailbox.enqueue('s', 'request'), b = mailbox.enqueue('s', 'request');
  assert.equal(a.ready, b.ready); assert.throws(() => mailbox.enqueue('s', 'different'), /待准备/);
  assert.equal(mailbox.complete('s', a.id), true); assert.equal(mailbox.complete('s', a.id), false);
  await a.ready; assert.equal(notifications, 2); assert.equal(mailbox.getSnapshot().pending.size, 0); assert.equal(mailbox.getSnapshot().notices.get('s').error, '');
  mailbox.dismiss('s'); assert.equal(mailbox.getSnapshot().notices.size, 0);
  off(); mailbox.dispose();
});
test('mailbox timeouts and plugin teardown never report success or leak to another Session', async () => {
  const mailbox = createMentorDraftMailbox({ timeoutMs: 10 });
  const first = mailbox.enqueue('a', 'kept draft');
  await assert.rejects(first.ready, /未在时限内就绪/);
  assert.ok(mailbox.getSnapshot().notices.get('a').error); assert.equal(mailbox.getSnapshot().notices.has('b'), false);
  const second = mailbox.enqueue('b', 'other draft'); const rejected = assert.rejects(second.ready, /已卸载/); mailbox.dispose(); await rejected;
});
test('a workspace initialization conversation continues into the first course instead of creating another blank mentor', async () => {
  const workspace = { workspaceId: 'w', sessionIds: ['initial'] }, sessions = { ids: ['initial'], byId: { initial: { id: 'initial' } } };
  let patch;
  const coordinator = createMentorCoordinator({ api: { state: async () => ({ revision: 0, courseSessions: { _workspace: 'initial' } }), updateState: async value => { patch = value; } }, getWorkspace: () => workspace, getSessions: () => sessions, create: () => assert.fail('must reuse initialization session'), retain: () => ({ ready: Promise.resolve(), release() {} }) });
  assert.equal((await coordinator.acquire({ workspaceId: 'w', courseId: 'math/1' })).id, 'initial');
  assert.equal(patch.patch.courseSessions['math/1'], 'initial');
});
test('bundled teaching Skill 1.2.0 exposes integrated clarification and complete per-round guide rules', async () => {
  const root = new URL('../skills/stg-mentor/', import.meta.url);
  const pkg = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'));
  const entry = await fs.readFile(new URL('SKILL.md', root), 'utf8');
  assert.equal(pkg.version, '1.2.0'); assert.match(entry, /grill-me 式需求澄清/); assert.match(entry, /不要求安装\/调用外部 skill/); assert.match(entry, /第N轮_教学引导/);
});
