import test from 'node:test';
import assert from 'node:assert/strict';
import { STG_PRESET, STG_PERSONA, buildMentorDraft, createMentorCoordinator, insertMentorDraft, mentorPresetDefinition } from '../src/native-protocol.js';

function fixture({ state = { revision: 1 }, rows = {}, ids = Object.keys(rows), failUpdate, failRetain, delayWorkspaceMembership = false } = {}) {
  let data = structuredClone(state), creates = 0, retains = 0, releases = 0;
  const workspace = { workspaceId: 'w', path: 'E:/lessons', sessionIds: [...ids] };
  const snapshot = { ids, byId: rows };
  const calls = [];
  const coordinator = createMentorCoordinator({
    api: { state: async () => structuredClone(data), updateState: async value => { if (failUpdate) await failUpdate(value); data = { ...data, ...value.patch, revision: data.revision + 1 }; calls.push(value); } },
    getWorkspace: id => id === 'w' ? workspace : null,
    getSessions: () => snapshot,
    create: async options => { creates++; calls.push(options); const id = options.sessionId || `new-${creates}`; snapshot.byId[id] = { id, blank: true }; if (!snapshot.ids.includes(id)) snapshot.ids.push(id); if (!delayWorkspaceMembership && !workspace.sessionIds.includes(id)) workspace.sessionIds.push(id); return id; },
    retain: id => { retains++; failRetain?.(); return { sessionId: id, ready: Promise.resolve(), release: () => { releases++; } }; },
  });
  return { coordinator, calls, counts: () => ({ creates, retains, releases }), state: () => data };
}

test('restoring a saved course does not create an empty session', async () => {
  const f = fixture({ state: { revision: 2, courseSessions: { course: 'saved' } }, rows: { saved: { id: 'saved' } } });
  const result = await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' });
  assert.equal(result.id, 'saved');
  assert.equal(f.counts().creates, 0);
  result.reference.release();
  assert.equal(f.counts().releases, 1);
});

test('repeated open clicks share one creation and do not send messages or override model settings', async () => {
  const f = fixture();
  const [first, second] = await Promise.all([f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' }), f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' })]);
  assert.equal(first, second);
  assert.equal(f.counts().creates, 1);
  assert.deepEqual(f.calls[0], { workspaceId: 'w', agentPreset: STG_PRESET });
  assert.equal(f.state().courseSessions.course, 'new-1');
});

test('unmapped empty STG session is reused; another course and unrelated presets are preserved', async () => {
  const f = fixture({ state: { revision: 1, courseSessions: { other: 'busyCourse' } }, rows: {
    busyCourse: { id: 'busyCourse', blank: true, projectionValues: { agentPreset: STG_PRESET } },
    unrelated: { id: 'unrelated', blank: true, projectionValues: { agentPreset: 'standard' } },
    reusable: { id: 'reusable', blank: true, projectionValues: { agentPreset: STG_PRESET } },
  } });
  assert.equal((await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' })).id, 'reusable');
  assert.deepEqual(f.calls[0], { workspaceId: 'w', agentPreset: STG_PRESET, sessionId: 'reusable' });
  assert.equal(f.state().courseSessions.other, 'busyCourse');
});

test('a selected foreign session is rejected before creation or retention', async () => {
  const f = fixture();
  await assert.rejects(f.coordinator.acquire({ workspaceId: 'w', courseId: 'course', sessionId: 'foreign' }), /当前工作区/);
  assert.deepEqual(f.counts(), { creates: 0, retains: 0, releases: 0 });
});

test('persistence failure releases retained generation and retries the same created session', async () => {
  let failures = 1;
  const f = fixture({ failUpdate: async () => { if (failures-- > 0) throw Error('disk full'); } });
  await assert.rejects(f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' }), /disk full/);
  assert.equal(f.counts().releases, 1);
  assert.equal((await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' })).id, 'new-1');
  assert.equal(f.counts().creates, 1);
});

test('state revision conflict reloads before merging session associations', async () => {
  let attempts = 0;
  const f = fixture({ state: { revision: 1, courseSessions: { other: 'saved' } }, failUpdate: async () => { if (attempts++ === 0) throw Object.assign(Error('changed'), { code: 'STATE_CONFLICT' }); } });
  await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' });
  assert.equal(attempts, 2);
  assert.deepEqual(f.state().courseSessions, { other: 'saved', course: 'new-1' });
});

test('a delayed workspace stream does not duplicate an already-created session', async () => {
  const f = fixture({ delayWorkspaceMembership: true });
  assert.equal((await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' })).id, 'new-1');
  assert.equal((await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' })).id, 'new-1');
  assert.equal(f.counts().creates, 1);
});

test('mentor draft identifies exact local evidence without leaking rendered full document', () => {
  const draft = buildMentorDraft({ intent: 'assess', course: { id: 'math/01', title: '一元方程', answerPath: '学科/数学/01/01_学生回答.md' }, document: { path: '课.md', version: 'sha', content: 'NOT_A_WHOLE_DOCUMENT_ATTACHMENT' }, round: '2', selection: 'x + 1 = 2' });
  assert.match(draft, /重新读取回答文件/);
  assert.match(draft, /"documentVersion": "sha"/);
  assert.match(draft, /x \+ 1 = 2/);
  assert.doesNotMatch(draft, /NOT_A_WHOLE_DOCUMENT/);
  assert.throws(() => buildMentorDraft({ intent: 'unknown' }), /未知学习动作/);
});

test('mentor preset composes official instructions and skills without model, permission or profile overrides', () => {
  const definition = mentorPresetDefinition();
  assert.equal(definition.id, STG_PRESET);
  assert.ok(definition.plugins.some(row => row.name === '@deepseek-ai/dsh-agent-instructions'));
  assert.ok(definition.plugins.some(row => row.name === '@deepseek-ai/dsh-skill-filesystem'));
  assert.match(STG_PERSONA, /概念理解、逻辑正确、规范表达/);
  assert.match(STG_PERSONA, /重新读取当前回答文档/);
  assert.match(STG_PERSONA, /不覆盖历史/);
  assert.doesNotMatch(JSON.stringify(definition), /"(provider|model|reasoningEffort|permissions|selectedDefault)"/);
});

test('packaged teaching skill is scoped to the mentor without replacing project and user skill roots', () => {
  const definition = mentorPresetDefinition({ bundledSkillDir: 'C:/package/skills' });
  const row = definition.plugins.find(row => row.id === 'skill-filesystem');
  assert.deepEqual(row.config, { bundledSkillDir: 'C:/package/skills' });
  assert.equal(mentorPresetDefinition().plugins.find(row => row.id === 'skill-filesystem').config, undefined);
});

test('staging a request preserves selected user text and never submits', () => {
  const seen = [];
  const actions = { captureInsertion: () => ({ start: 2, end: 9, draftRev: 7 }), insertText: (...args) => { seen.push(args); return true; }, persistDraft: () => seen.push('persist'), submit: () => assert.fail('staging must never send') };
  assert.equal(insertMentorDraft(actions, { draft: 'existing draft', phase: 'plain' }, 'assessment request'), true);
  assert.deepEqual(seen, [['\n\nassessment request', { start: 9, end: 9, draftRev: 7 }], 'persist']);
  assert.equal(insertMentorDraft(actions, { phase: 'submitting' }, 'second'), false);
  assert.equal(insertMentorDraft(actions, { phase: 'claimed' }, 'second'), false);
  assert.equal(seen.length, 2);
});

test('a cached mentor archived after creation is not reopened', async () => {
  const rows = {}, f = fixture({ rows });
  const first = await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' }); first.reference.release();
  rows[first.id].archived = true;
  const next = await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' });
  assert.notEqual(next.id, first.id); assert.equal(f.counts().creates, 2); next.reference.release();
});

test('transient retain failure retries the created identity without another blank Session', async () => {
  let failures = 1;
  const f = fixture({ failRetain: () => { if (failures-- > 0) throw Error('retain unavailable'); } });
  await assert.rejects(f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' }), /retain unavailable/);
  const next = await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' });
  assert.equal(next.id, 'new-1'); assert.equal(f.counts().creates, 1); next.reference.release();
});

test('draft persistence failure marks insertion as applied so the consumer never retries the text', () => {
  let inserted = 0;
  const actions = { captureInsertion: () => ({ end: 2 }), insertText: () => { inserted++; return true; }, persistDraft: () => { throw Error('disk unavailable'); } };
  assert.throws(() => insertMentorDraft(actions, { phase: 'plain' }, 'request'), error => error.draftInserted === true && /已插入/.test(error.message));
  assert.equal(inserted, 1);
});
