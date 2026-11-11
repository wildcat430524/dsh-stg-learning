import test from 'node:test';
import assert from 'node:assert/strict';
import { createMentorCoordinator, isTeacherSession, STG_PRESET } from '../src/native-protocol.js';
import { createTeacherArchiveController, createTeacherDraftRegistry, createTeacherSessionSwitcher, teacherSessionLabel, teacherSessionRows, NEW_TEACHER_SESSION_LABEL } from '../src/teacher-sessions.js';

const PRESET = STG_PRESET;

/** A coordinator fixture where every side effect is observable and orderable. */
function fixture({ state = { revision: 1 }, rows = {}, ids = Object.keys(rows), workspaceSessions, extraWorkspaces = {}, failUpdate, failRetain, retainDelay = 0, archived = [], failArchive, archiveSupported = true } = {}) {
  let data = structuredClone(state), creates = 0, retains = 0, releases = 0;
  const members = workspaceSessions ? [...workspaceSessions] : [...ids];
  const workspaces = new Map([['w', { workspaceId: 'w', path: 'E:/lessons', sessionIds: members }], ...Object.entries(extraWorkspaces)]);
  const snapshot = { ids: [...ids], byId: rows };
  const calls = [], archivedIds = [...archived], archiveCalls = [], restoreCalls = [];
  const coordinator = createMentorCoordinator({
    api: {
      state: async () => structuredClone(data),
      updateState: async value => {
        if (failUpdate) await failUpdate(value);
        // Mirror the Host writer: a courseSessions patch merges, and a null value
        // deletes just that one mapping.
        const patch = value.patch?.courseSessions
          ? { ...value.patch, courseSessions: { ...(data.courseSessions || {}) } }
          : value.patch;
        if (value.patch?.courseSessions) for (const [courseId, sessionId] of Object.entries(value.patch.courseSessions)) {
          if (sessionId === null) delete patch.courseSessions[courseId]; else patch.courseSessions[courseId] = sessionId;
        }
        data = { ...data, ...patch, revision: data.revision + 1 }; calls.push(value);
      },
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
    ...(archiveSupported ? {
      archive: async id => { archiveCalls.push(id); if (failArchive) await failArchive(id); if (!snapshot.byId[id]) throw Object.assign(Error('missing'), { rpcError: { code: 'session/not-found', message: 'missing' } }); archivedIds.push(id); },
      unarchive: async id => { restoreCalls.push(id); const at = archivedIds.indexOf(id); if (at >= 0) archivedIds.splice(at, 1); },
    } : {}),
    getArchivedSessionIds: () => archivedIds,
  });
  return {
    coordinator, calls, snapshot, workspaces, archivedIds, archiveCalls, restoreCalls,
    counts: () => ({ creates, retains, releases }), state: () => data,
  };
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

test('archiving one conversation uses the recoverable Host archive and unbinds only that id', async () => {
  const { coordinator, archiveCalls, archivedIds, state } = fixture({ rows: { a: row('a'), b: row('b') }, state: { revision: 3, courseSessions: { math: 'a', english: 'b', _workspace: 'a' } } });
  const result = await coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' });
  assert.deepEqual(archiveCalls, ['a']);
  assert.deepEqual(archivedIds, ['a']);
  assert.deepEqual(result, { id: 'a', archived: true, workspaceId: 'w' });
  assert.equal(state().courseSessions.math, undefined);
  assert.equal(state().courseSessions._workspace, undefined);
  assert.equal(state().courseSessions.english, 'b', 'another course keeps its own conversation');
  // Archiving is a rename of the list position, never a transcript delete.
  assert.ok('a' in fixture({ rows: { a: row('a') } }).snapshot.byId);
});

test('a foreign, unknown or already-archived id is refused before the Host is called', async () => {
  const { coordinator, archiveCalls } = fixture({ rows: { a: row('a'), foreign: row('foreign') }, workspaceSessions: ['a'], extraWorkspaces: { other: { workspaceId: 'other', path: 'E:/other', sessionIds: ['foreign'] } }, archived: ['gone'] });
  await assert.rejects(coordinator.archiveSession({ workspaceId: 'w', sessionId: 'foreign' }), /不属于当前学习空间/);
  await assert.rejects(coordinator.archiveSession({ workspaceId: 'w', sessionId: 'missing' }), /不属于当前学习空间/);
  await assert.rejects(coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a', knownSessionIds: ['b'] }), /不属于当前学习空间/);
  assert.deepEqual(archiveCalls, []);
  // A generic (non-teacher) Session in this space is also refused.
  const generic = fixture({ rows: { g: row('g', { projectionValues: { agentPreset: 'standard' } }) } });
  await assert.rejects(generic.coordinator.archiveSession({ workspaceId: 'w', sessionId: 'g' }), /不属于当前学习空间/);
  assert.deepEqual(generic.archiveCalls, []);
});

test('archiving a conversation that is still answering reports the Host refusal and changes nothing', async () => {
  const { coordinator, archiveCalls, state } = fixture({
    rows: { a: row('a') }, state: { revision: 2, courseSessions: { math: 'a' } },
    failArchive: () => { throw Object.assign(Error('workspace session archive failed: workspace/session-active: busy'), { rpcError: { code: 'workspace/session-active', message: 'busy' } }); },
  });
  await assert.rejects(coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' }), /session-active/);
  assert.deepEqual(archiveCalls, ['a']);
  assert.equal(state().courseSessions.math, 'a', 'a refused archive keeps the course binding');
});

test('a failed local unbind reports the archive as done instead of pretending nothing happened', async () => {
  const { coordinator, archivedIds } = fixture({
    rows: { a: row('a') }, state: { revision: 2, courseSessions: { math: 'a' } },
    failUpdate: () => { throw Error('disk full'); },
  });
  const failure = await coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' }).then(() => null, error => error);
  assert.equal(failure?.code, 'BINDING_STALE');
  assert.equal(failure?.archived, true);
  assert.deepEqual(archivedIds, ['a']);
});

test('a repeated archive click joins the in-flight call instead of archiving twice', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const { coordinator, archiveCalls } = fixture({ rows: { a: row('a') }, failArchive: () => blocked });
  const first = coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' });
  const second = coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' });
  assert.equal(first, second);
  release();
  await first.catch(() => {});
  assert.deepEqual(archiveCalls, ['a']);
});

test('an archived conversation cannot be reacquired or selected until it is restored', async () => {
  const f = fixture({ rows: { a: row('a') }, state: { revision: 1, courseSessions: { _workspace: 'a' } } });
  const { coordinator, archivedIds, restoreCalls, archiveCalls } = f;
  await coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' });
  assert.deepEqual(archiveCalls, ['a']);
  await assert.rejects(coordinator.select({ workspaceId: 'w', courseId: 'math', sessionId: 'a' }), /已经移出列表/);
  await assert.rejects(coordinator.acquire({ workspaceId: 'w', courseId: 'math', sessionId: 'a' }), /已经移出列表/);
  // An implicit acquire must not reopen the hidden conversation either: the
  // stale binding was unbound, so it mints a fresh blank one instead.
  const acquired = await coordinator.acquire({ workspaceId: 'w', courseId: 'math' });
  assert.notEqual(acquired.id, 'a');
  assert.equal(f.snapshot.byId[acquired.id].blank, true);
  const restored = await coordinator.unarchiveSession({ workspaceId: 'w', sessionId: 'a' });
  assert.deepEqual(restored, { id: 'a', archived: false, workspaceId: 'w' });
  assert.deepEqual(restoreCalls, ['a']);
  assert.deepEqual(archivedIds, []);
  assert.equal((await coordinator.select({ workspaceId: 'w', courseId: 'math', sessionId: 'a' })).id, 'a');
});

test('restore is coalesced for a repeated click and reports a Host without unarchive', async () => {
  const { coordinator, restoreCalls } = fixture({ rows: { a: row('a') }, archived: ['a'] });
  const a = coordinator.unarchiveSession({ workspaceId: 'w', sessionId: 'a' });
  const b = coordinator.unarchiveSession({ workspaceId: 'w', sessionId: 'a' });
  assert.equal(a, b);
  await a;
  assert.deepEqual(restoreCalls, ['a']);
  const host = fixture({ rows: { a: row('a') }, archived: ['a'], archiveSupported: false });
  const failure = await host.coordinator.unarchiveSession({ workspaceId: 'w', sessionId: 'a' }).then(() => null, error => error);
  assert.equal(failure?.code, 'ARCHIVE_UNAVAILABLE');
});

test('a Host without an archive method fails honestly instead of faking a removal', async () => {
  const { coordinator, archiveCalls, state } = fixture({ rows: { a: row('a') }, state: { revision: 1, courseSessions: { math: 'a' } }, archiveSupported: false });
  const failure = await coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a' }).then(() => null, error => error);
  assert.equal(failure?.code, 'ARCHIVE_UNAVAILABLE');
  assert.deepEqual(archiveCalls, []);
  assert.equal(state().courseSessions.math, 'a');
});

test('the switcher keeps a non-current conversation and its draft untouched while another is archived', async () => {
  let current = { id: 'b', workspaceId: 'w', courseId: 'c' }, flushed = [];
  const switcher = createTeacherSessionSwitcher({
    getTarget: () => ({ workspaceId: 'w', courseId: 'c' }),
    getCurrent: () => current, isBlank: () => false, hasDraft: id => id === 'b', flush: id => flushed.push(id),
    applySession: next => { current = next; },
  });
  const { coordinator } = fixture({ rows: { a: row('a'), b: row('b') }, state: { revision: 1, courseSessions: { c: 'b' } } });
  await coordinator.archiveSession({ workspaceId: 'w', sessionId: 'a', knownSessionIds: ['a', 'b'] });
  assert.equal(current.id, 'b');
  assert.deepEqual(flushed, []);
  assert.equal(coordinator, coordinator);
});

test('the archive confirmation requires an explicit confirm and cancel never calls the Host', async () => {
  let archived = 0, changes = [];
  const controller = createTeacherArchiveController({
    archiveSession: async () => { archived++; },
    getWorkspaceId: () => 'w',
    onChange: patch => changes.push(patch),
  });
  assert.equal(await controller.confirm(), false, 'nothing happens without a request');
  controller.ask({ id: 'a', label: '分数怎么通分' });
  assert.equal(controller.request.label, '分数怎么通分');
  controller.cancel();
  assert.equal(controller.request, null);
  assert.equal(archived, 0);
  assert.equal(controller.confirm(), false);
  controller.ask({ id: 'a', label: '分数怎么通分' });
  assert.equal(await controller.confirm(), true);
  assert.equal(archived, 1);
  assert.equal(changes.at(-1).status, '已移出“分数怎么通分”，可在“已移出”里恢复。');
});

test('a failed archive keeps the confirmation open and the conversation selectable', async () => {
  let archived = 0;
  const controller = createTeacherArchiveController({
    archiveSession: async () => { archived++; throw Object.assign(Error('x'), { rpcError: { code: 'workspace/session-active', message: 'busy' } }); },
    getWorkspaceId: () => 'w',
  });
  controller.ask({ id: 'a', label: '进行中的对话' });
  assert.equal(await controller.confirm(), false);
  assert.equal(archived, 1);
  assert.equal(controller.request.label, '进行中的对话', 'the target stays named for a retry');
  assert.match(controller.busy ? '' : 'x', /x/);
});

test('a repeated confirm click joins the in-flight archive and restores report the same way', async () => {
  let release, archived = 0, restored = 0;
  const controller = createTeacherArchiveController({
    archiveSession: () => { archived++; return new Promise(resolve => { release = resolve; }); },
    restoreSession: async () => { restored++; },
    getWorkspaceId: () => 'w',
  });
  controller.ask({ id: 'a', label: 'A' });
  const first = controller.confirm(), second = controller.confirm();
  assert.equal(first, second);
  release();
  await first;
  assert.equal(archived, 1);
  assert.equal(await controller.restore({ id: 'b', label: 'B' }), true);
  assert.equal(restored, 1);
});

test('archived rows leave the live list and appear only in the archived view', () => {
  const snapshot = { ids: ['a', 'b'], byId: { a: row('a', { title: '旧对话' }), b: row('b', { title: '现在的对话' }) } };
  const workspace = { workspaceId: 'w', sessionIds: ['a', 'b'] };
  assert.deepEqual(teacherSessionRows(snapshot, workspace, { archivedSessionIds: ['a'] }).map(r => r.id), ['b']);
  const archived = teacherSessionRows(snapshot, workspace, { archivedSessionIds: ['a'], archivedOnly: true });
  assert.deepEqual(archived.map(r => r.id), ['a']);
  assert.equal(archived[0].archived, true);
  assert.equal(archived[0].label, '旧对话');
});

test('a foreign space conversation never appears in either list', () => {
  const snapshot = { ids: ['a', 'foreign'], byId: { a: row('a'), foreign: row('foreign', { title: '别的空间' }) } };
  const workspace = { workspaceId: 'w', sessionIds: ['a'] };
  assert.deepEqual(teacherSessionRows(snapshot, workspace, { archivedSessionIds: ['foreign'], archivedOnly: true }), []);
  assert.deepEqual(teacherSessionRows(snapshot, workspace, { archivedSessionIds: ['foreign'] }).map(r => r.id), ['a']);
});

test('a page listing several spaces resolves the owner of each row before archiving', async () => {
  // The session manager can show every space at once, so the request must name
  // the row's own space rather than whichever one the page happens to have
  // selected; otherwise a row could be handed to the wrong coordinator.
  const asked = [];
  const controller = createTeacherArchiveController({
    archiveSession: async request => { asked.push(request); },
    restoreSession: async request => { asked.push({ ...request, restored: true }); },
    getWorkspaceId: row => ({ a: 'space-1', b: 'space-2' })[row?.id] || '',
  });
  controller.ask({ id: 'a', label: 'A' });
  assert.equal(controller.request.workspaceId, 'space-1');
  controller.cancel();
  controller.ask({ id: 'b', label: 'B' });
  assert.equal(controller.request.workspaceId, 'space-2');
  await controller.confirm();
  assert.deepEqual(asked, [{ sessionId: 'b', workspaceId: 'space-2' }]);
  await controller.restore({ id: 'a', label: 'A' });
  assert.deepEqual(asked.at(-1), { sessionId: 'a', workspaceId: 'space-1', restored: true });
});
