import test from 'node:test';
import assert from 'node:assert/strict';
import { createMentorCoordinator, isTeacherSession, STG_PRESET } from '../src/native-protocol.js';
import { createTeacherDraftRegistry, createTeacherSessionSwitcher, teacherSessionLabel, teacherSessionRows, NEW_TEACHER_SESSION_LABEL } from '../src/teacher-sessions.js';

const PRESET = STG_PRESET;

/** A coordinator fixture where every side effect is observable and orderable. */
function fixture({ state = { revision: 1 }, rows = {}, ids = Object.keys(rows), workspaceSessions, extraWorkspaces = {}, failUpdate, failRetain, retainDelay = 0 } = {}) {
  let data = structuredClone(state), creates = 0, retains = 0, releases = 0;
  const members = workspaceSessions ? [...workspaceSessions] : [...ids];
  const workspaces = new Map([['w', { workspaceId: 'w', path: 'E:/lessons', sessionIds: members }], ...Object.entries(extraWorkspaces)]);
  const snapshot = { ids: [...ids], byId: rows };
  const calls = [];
  const coordinator = createMentorCoordinator({
    api: {
      state: async () => structuredClone(data),
      updateState: async value => { if (failUpdate) await failUpdate(value); data = { ...data, ...value.patch, revision: data.revision + 1 }; calls.push(value); },
    },
    getWorkspace: id => workspaces.get(id) || null,
    getSessions: () => snapshot,
    create: async options => {
      creates++; calls.push(options);
      const id = options.sessionId || `new-${creates}`;
      snapshot.byId[id] = { id, blank: true, projectionValues: { agentPreset: PRESET } };
      if (!snapshot.ids.includes(id)) snapshot.ids.push(id);
      workspaces.get(options.workspaceId || 'w')?.sessionIds.push(id);
      return id;
    },
    retain: id => {
      retains++; failRetain?.();
      return {
        sessionId: id,
        ready: retainDelay ? new Promise(resolve => setTimeout(resolve, retainDelay)) : Promise.resolve(),
        release: () => { releases++; },
      };
    },
  });
  return { coordinator, calls, snapshot, workspaces, counts: () => ({ creates, retains, releases }), state: () => data };
}

const row = (id, patch = {}) => ({ id, blank: false, title: `对话 ${id}`, updatedAt: 1, projectionValues: { agentPreset: PRESET }, ...patch });

test('the switcher lists only teacher Sessions placed in the current learning space', () => {
  const snapshot = { ids: ['mine', 'blank', 'child', 'archived', 'other', 'generic'], byId: {
    mine: row('mine', { title: '分数怎么通分', updatedAt: 30 }),
    blank: row('blank', { blank: true, title: undefined, updatedAt: 10 }),
    child: row('child', { parentId: 'mine' }),
    archived: row('archived', { archived: true }),
    other: row('other', { title: '别的空间' }),
    generic: row('generic', { projectionValues: { agentPreset: 'standard' } }),
  } };
  const workspace = { workspaceId: 'w', sessionIds: ['mine', 'blank', 'child', 'archived', 'generic'] };
  const rows = teacherSessionRows(snapshot, workspace);
  assert.deepEqual(rows.map(r => r.id), ['mine', 'blank']);
  assert.equal(rows[1].label, NEW_TEACHER_SESSION_LABEL);
  assert.equal(rows[0].label, '分数怎么通分');
  // Two untouched blank conversations must still be distinguishable, without
  // mangling the label itself.
  const twin = teacherSessionRows({ ids: ['a', 'b'], byId: { a: row('a', { blank: true, updatedAt: 1000 }), b: row('b', { blank: true, updatedAt: 2000 }) } }, { workspaceId: 'w', sessionIds: ['a', 'b'] });
  assert.equal(twin[0].label, NEW_TEACHER_SESSION_LABEL);
  assert.equal(twin[1].label, NEW_TEACHER_SESSION_LABEL);
  assert.notEqual(twin[0].hint, twin[1].hint);
  assert.match(twin[0].hint, /空白/);  // A different space's teacher never appears even when the caller forgets to filter.
  const visible = teacherSessionRows(snapshot, { workspaceId: 'other-space', sessionIds: ['other'] });
  assert.deepEqual(visible.map(r => r.id), ['other']);
  assert.equal(teacherSessionRows(snapshot, workspace, { archivedSessionIds: ['mine'] }).some(r => r.id === 'mine'), false);
});

test('a just-created Session appears before the workspace stream catches up, and the current row is first', () => {
  const snapshot = { ids: ['fresh', 'old'], byId: { fresh: row('fresh', { blank: true, title: undefined }), old: row('old') } };
  const rows = teacherSessionRows(snapshot, { workspaceId: 'w', sessionIds: ['old'] }, { includeSessionIds: ['fresh'], currentSessionId: 'fresh' });
  assert.deepEqual(rows.map(r => r.id), ['fresh', 'old']);
  assert.equal(rows[0].current, true);
  // Rows with no projected title still need a stable, non-empty label.
  assert.match(teacherSessionLabel({ id: 'session-abcdef', blank: false }), /cdef$/);
});

test('a foreign or non-teacher Session cannot be selected into this space', async () => {
  const f = fixture({ rows: { mine: row('mine') }, extraWorkspaces: { other: { workspaceId: 'other', path: 'E:/other', sessionIds: ['theirs'] } } });
  f.snapshot.ids.push('theirs'); f.snapshot.byId.theirs = row('theirs');
  await assert.rejects(f.coordinator.select({ workspaceId: 'w', sessionId: 'theirs' }), /当前工作区|老师对话/);
  assert.deepEqual(f.counts(), { creates: 0, retains: 0, releases: 0 });
  assert.equal(isTeacherSession('theirs', { workspaceId: 'w', sessionIds: ['mine'] }, f.snapshot), false);
  // A real non-mentor conversation in this space is refused even though it is a member.
  f.snapshot.byId.generic = row('generic', { projectionValues: { agentPreset: 'standard' } });
  f.workspaces.get('w').sessionIds.push('generic'); f.snapshot.ids.push('generic');
  await assert.rejects(f.coordinator.select({ workspaceId: 'w', sessionId: 'generic' }), /当前工作区|老师对话/);
  // The space's own teacher is accepted.
  const picked = await f.coordinator.select({ workspaceId: 'w', sessionId: 'mine' });
  assert.equal(picked.id, 'mine');
  picked.reference.release();
});

test('new conversation creates a distinct blank Session, persists it and sends no message', async () => {
  const f = fixture({ state: { revision: 2, courseSessions: { course: 'old' } }, rows: { old: row('old', { updatedAt: 5 }) } });
  const result = await f.coordinator.createNew({ workspaceId: 'w', courseId: 'course' });
  assert.equal(result.id, 'new-1');
  assert.notEqual(result.id, 'old');
  // Never reuses the previous identity: clearing the old history would not be a new conversation.
  assert.equal(f.calls.filter(call => call && typeof call === 'object' && 'agentPreset' in call).every(call => !call.sessionId), true);
  assert.equal(f.state().courseSessions.course, 'new-1');
  assert.equal(f.counts().creates, 1);
  assert.equal(f.counts().retains, 1);
  result.reference.release();
  assert.equal(f.counts().releases, 1);
  // The old conversation is untouched and remains listed and selectable.
  const rows = teacherSessionRows(f.snapshot, { workspaceId: 'w', sessionIds: ['old', 'new-1'] });
  assert.deepEqual(rows.map(r => r.id).sort(), ['new-1', 'old']);
  assert.equal(f.snapshot.byId.old.blank, false);
});

test('an explicit pick becomes the Session later questions use, not the previous binding', async () => {
  const f = fixture({ state: { revision: 1, courseSessions: { course: 'first' } }, rows: { first: row('first'), second: row('second') } });
  f.snapshot.byId.first.blank = false;
  const picked = await f.coordinator.select({ workspaceId: 'w', courseId: 'course', sessionId: 'second' });
  assert.equal(picked.id, 'second');
  assert.equal(f.state().courseSessions.course, 'second');
  picked.reference.release();
  const later = await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' });
  assert.equal(later.id, 'second');
  assert.equal(f.counts().creates, 0, 'a bound teacher must not be replaced by a new Session');
  later.reference.release();
});

test('rapid create then select is serialized so the later pick wins and only one Session is made', async () => {
  const f = fixture({ rows: { existing: row('existing', { blank: false }) }, retainDelay: 1 });
  const created = f.coordinator.createNew({ workspaceId: 'w', courseId: 'course' });
  const selected = f.coordinator.select({ workspaceId: 'w', courseId: 'course', sessionId: 'existing' });
  const [made, picked] = await Promise.all([created, selected]);
  assert.equal(made.id, 'new-1');
  assert.equal(picked.id, 'existing');
  assert.equal(f.counts().creates, 1);
  assert.equal(f.state().courseSessions.course, 'existing', 'the last explicit intent owns the binding');
  made.reference.release(); picked.reference.release();
  const next = await f.coordinator.acquire({ workspaceId: 'w', courseId: 'course' });
  assert.equal(next.id, 'existing');
  next.reference.release();
});

test('repeated new-conversation clicks share one creation', async () => {
  const f = fixture({ rows: { existing: row('existing', { blank: false }) }, retainDelay: 2 });
  const [first, second] = await Promise.all([f.coordinator.createNew({ workspaceId: 'w' }), f.coordinator.createNew({ workspaceId: 'w' })]);
  assert.equal(first.id, second.id);
  assert.equal(f.counts().creates, 1);
  first.reference.release(); second.reference.release();
});

test('a failed switch releases nothing of the current conversation and keeps its binding', async () => {
  const f = fixture({ state: { revision: 1, courseSessions: { course: 'first' } }, rows: { first: row('first'), second: row('second') }, failRetain: () => { throw Error('retain unavailable'); } });
  await assert.rejects(f.coordinator.select({ workspaceId: 'w', courseId: 'course', sessionId: 'second' }), /retain unavailable/);
  assert.equal(f.coordinator.select, f.coordinator.select);
  assert.equal(f.state().courseSessions.course, 'first');
  assert.equal(f.counts().releases, 0, 'nothing was retained, so nothing may be released');
});

test('a switch whose binding write conflicts reloads and still binds the picked Session', async () => {
  let attempts = 0;
  const f = fixture({
    state: { revision: 1, courseSessions: { other: 'keep' } }, rows: { first: row('first'), second: row('second') },
    failUpdate: async () => { if (attempts++ === 0) throw Object.assign(Error('changed'), { code: 'STATE_CONFLICT' }); },
  });
  const picked = await f.coordinator.select({ workspaceId: 'w', courseId: 'course', sessionId: 'second' });
  assert.equal(picked.id, 'second');
  assert.deepEqual(f.state().courseSessions, { other: 'keep', course: 'second' });
  assert.equal(attempts, 2);
  picked.reference.release();
});

test('the draft registry stashes the exact composer of the Session being left and restores it', () => {
  const store = new Map();
  const storage = { getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  const registry = createTeacherDraftRegistry({ storage });
  const live = { text: '原来的草稿别丢' };
  const unbind = registry.bind('session-a', {
    getDraft: () => live.text,
    setDraft: value => { live.text = value; },
    persist: () => writes.push('persist'),
  });
  const writes = [];
  assert.deepEqual(registry.persist('session-a'), { text: '原来的草稿别丢', stored: true, mounted: true });
  assert.deepEqual(writes, ['persist'], 'the official persistence hook is still flushed when bound');
  assert.equal(registry.hasDraft('session-a'), true);
  unbind();
  assert.deepEqual(registry.persist('session-a'), { text: '原来的草稿别丢', stored: false, mounted: false }, 'an unmounted composer must not erase the stash');
  assert.equal(registry.hasDraft('session-a'), true);
  // Re-mounting restores the stash into an empty composer.
  live.text = '';
  const rebind = registry.bind('session-a', { getDraft: () => live.text, setDraft: value => { live.text = value; } });
  assert.equal(registry.restore('session-a'), 'restored');
  assert.equal(live.text, '原来的草稿别丢');
  assert.equal(registry.restore('session-a'), 'occupied', 'restoring never overwrites text the user typed');
  live.text = '新写的';
  rebind();
  assert.equal(registry.hasDraft('session-a'), true, 'the newest text wins');
  const slow = { text: '' };
  const third = registry.bind('session-a', { getDraft: () => slow.text, setDraft: value => { slow.text = value; } });
  assert.equal(registry.restore('session-a'), 'restored');
  slow.text = '新写的';
  assert.equal(registry.restore('session-a'), 'occupied');
  assert.equal(store.size, 0, 'a restored draft is consumed so it cannot reappear after sending');
  third();
  registry.clear('session-a');
  assert.equal(registry.hasDraft('session-a'), false);
});

test('a disabled storage still keeps drafts for this page session', () => {
  const registry = createTeacherDraftRegistry({ storage: () => { throw Error('denied'); } });
  let text = 'offline';
  const unbind = registry.bind('s', { getDraft: () => text, setDraft: value => { text = value; } });
  const result = registry.persist('s');
  assert.equal(result.stored, false);
  unbind(); text = '';
  registry.bind('s', { getDraft: () => text, setDraft: value => { text = value; } });
  assert.equal(registry.restore('s'), 'restored');
  assert.equal(text, 'offline');
});

test('the switcher flushes before switching, never creates twice and keeps the current one on failure', async () => {
  const events = [];
  let current = { id: 'a', workspaceId: 'w', courseId: 'c' };
  let created = 0;
  const switcher = createTeacherSessionSwitcher({
    getTarget: () => ({ workspaceId: 'w', courseId: 'c' }),
    getCurrent: () => current,
    isBlank: () => false,
    hasDraft: () => true,
    flush: () => events.push('flush'),
    createSession: async () => { await new Promise(r => setTimeout(r, 2)); created++; return { id: `n${created}`, reference: { release: () => events.push('release-new') }, workspaceId: 'w', courseId: 'c' }; },
    openSession: async () => { throw Error('当前学习空间还没有这段对话。'); },
    applySession: next => { events.push(`commit:${next.id}`); current = next; },
    onChange: patch => events.push(`state:${patch.busy ?? ''}:${patch.error || patch.status || ''}`),
  });
  const first = switcher.create(), second = switcher.create();
  await Promise.all([first, second]);
  assert.equal(created, 1, 'double click must not mint two blank Sessions');
  assert.deepEqual(events.filter(e => e === 'flush'), ['flush']);
  assert.ok(events.includes('commit:n1'));
  const selected = await switcher.select('gone');
  assert.equal(selected, undefined);
  assert.match(events.filter(e => e.startsWith('state:false:')).at(-1), /当前学习空间还没有这段对话/);
  assert.equal(current.id, 'n1', 'a failed pick keeps the current conversation');
  switcher.dispose();
});

test('pressing new twice on an untouched blank created here does not mint a second Session', async () => {
  let created = 0, current = { id: 'a', workspaceId: 'w', courseId: 'c' };
  const switcher = createTeacherSessionSwitcher({
    getTarget: () => ({ workspaceId: 'w', courseId: 'c' }),
    getCurrent: () => current,
    isBlank: row => row.id.startsWith('n'),
    hasDraft: () => false,
    flush: () => {},
    createSession: async () => { created++; return { id: `n${created}`, reference: { release() {} }, workspaceId: 'w', courseId: 'c' }; },
    applySession: next => { current = next; },
  });
  await switcher.create();
  assert.equal(current.id, 'n1');
  await switcher.create();
  assert.equal(created, 1, 'an untouched blank conversation is already the new conversation');
  assert.equal(current.id, 'n1');
  // Once the user leaves it, the next new conversation is genuinely new again.
  current = { id: 'n1', workspaceId: 'w', courseId: 'c' };
  switcher.invalidate();
  await switcher.create();
  assert.equal(created, 2);
  assert.equal(current.id, 'n2');
});

test('a draft typed in a created blank makes the next new press create again', async () => {
  let created = 0, current = { id: 'a', workspaceId: 'w', courseId: 'c' }, draft = false;
  const switcher = createTeacherSessionSwitcher({
    getTarget: () => ({ workspaceId: 'w', courseId: 'c' }),
    getCurrent: () => current,
    isBlank: row => row.id.startsWith('n'),
    hasDraft: () => draft,
    flush: () => {},
    createSession: async () => { created++; return { id: `n${created}`, reference: { release() {} }, workspaceId: 'w', courseId: 'c' }; },
    applySession: next => { current = next; },
  });
  await switcher.create();
  draft = true;
  await switcher.create();
  assert.equal(created, 2);
  assert.equal(current.id, 'n2');
});

test('the switcher coalesces rapid picks and releases a superseded result', async () => {
  const released = [];
  let current = { id: 'a', workspaceId: 'w', courseId: 'c' };
  const resolvers = [];
  const switcher = createTeacherSessionSwitcher({
    getTarget: () => ({ workspaceId: 'w', courseId: 'c' }),
    getCurrent: () => current,
    isBlank: () => true,
    flush: () => {},
    openSession: ({ sessionId }) => new Promise(resolve => resolvers.push({ sessionId, resolve })),
    applySession: next => { current = next; },
  });
  switcher.select('b');
  switcher.select('c');
  // Only one pick is in flight; the newest queued intent replaces the older one.
  await Promise.resolve();
  assert.equal(resolvers.length, 1);
  resolvers[0].resolve({ id: 'b', reference: { release: () => released.push('b') }, workspaceId: 'w', courseId: 'c' });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(current.id, 'b');
  assert.equal(resolvers.length, 2);
  assert.equal(resolvers[1].sessionId, 'c');
  resolvers[1].resolve({ id: 'c', reference: { release: () => released.push('c') }, workspaceId: 'w', courseId: 'c' });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(current.id, 'c');
  // Closing the teacher mid-flight discards the pending result instead of committing it.
  const pendingSwap = switcher.select('d');
  await new Promise(r => setTimeout(r, 0));
  const last = resolvers.at(-1);
  switcher.invalidate();
  last.resolve({ id: 'd', reference: { release: () => released.push('d') }, workspaceId: 'w', courseId: 'c' });
  await pendingSwap.catch(() => {});
  assert.equal(current.id, 'c');
  assert.ok(released.includes('d'));
});
