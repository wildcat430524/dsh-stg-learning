/**
 * Tests for the pure data layer in `src/model.js`.
 *
 * Run with `npm test` (`node --test tests/*.test.js`). Every fixture mirrors the
 * real DSH shapes recorded in the module header, so a failure here means either
 * this module or the assumed runtime contract changed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COURSE_MAX_LENGTH,
  DEFAULT_STAGE,
  METADATA_VERSION,
  STAGES,
  learningSessions,
  currentSessionId,
  normalizeMetadata,
} from '../src/model.js';

test('native retainedBy.mainView identifies the current session without a current field', () => {
  const sessions = {byId:{a:{id:'a',cwd:'E:/learn',retainedBy:{mainView:0}},b:{id:'b',cwd:'E:/learn',retainedBy:{mainView:1}}}};
  assert.equal(currentSessionId(sessions),'b');
  const rows=learningSessions({sessions,workspaces:{items:[{workspaceId:'w',path:'E:/learn',sessionIds:['a','b']}]},workspaceId:'w'});
  assert.equal(rows.find(r=>r.id==='b').current,true);
  assert.equal(rows.find(r=>r.id==='a').current,false);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A workspace snapshot shaped exactly like `workspaces.list.getSnapshot()`. */
function workspaceSnapshot(items, archivedSessionIds = []) {
  return { items, archivedSessionIds, phase: 'ready' };
}

/** A workspace row shaped exactly like one `WorkspaceView` from DSH. */
function workspace(workspaceId, path, sessionIds, title = workspaceId) {
  return { workspaceId, path, title, sessionIds, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' };
}

/** A client session snapshot shaped exactly like `sessions.list.getSnapshot()`. */
function sessionSnapshot(rows, current = undefined, phase = 'ready') {
  const byId = {};
  const ids = [];
  for (const [id, row] of Object.entries(rows)) {
    ids.push(id);
    // defineProperty rather than assignment, so a hostile id such as `__proto__`
    // becomes an own key instead of silently rewriting the prototype.
    Object.defineProperty(byId, id, { value: row, enumerable: true, writable: true, configurable: true });
  }
  return { ids, byId, current, phase };
}

/** One ordinary client session summary. */
function summary(id, overrides = {}) {
  return {
    id,
    displayTitle: id,
    running: false,
    blank: false,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** A fresh, unmarked metadata value. */
function emptyMetadata() {
  return normalizeMetadata(null);
}

/** Deep-freeze a fixture so any mutation attempt throws in strict mode. */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

// ---------------------------------------------------------------------------
// normalizeMetadata — schema
// ---------------------------------------------------------------------------

test('normalizeMetadata always returns the canonical schema', () => {
  const result = normalizeMetadata(null);
  assert.deepEqual(result, { version: METADATA_VERSION, workspaces: {}, sessions: {} });
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.workspaces), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.sessions), Object.prototype);
});

test('normalizeMetadata ignores non-object input without throwing', () => {
  for (const input of [undefined, null, 0, 1, NaN, true, false, 'text', [], [1, 2], () => {}]) {
    const result = normalizeMetadata(input);
    assert.deepEqual(result.workspaces, {}, `workspaces for ${String(input)}`);
    assert.deepEqual(result.sessions, {}, `sessions for ${String(input)}`);
  }
});

test('normalizeMetadata drops unknown fields and keeps the known ones', () => {
  const result = normalizeMetadata({
    version: 99,
    evil: 'drop me',
    workspaces: { ws1: { enabled: true, title: 'drop me', path: '/tmp' } },
    sessions: { s1: { course: 'Python', stage: 'review', pinned: true, mastery: 0.9, extra: 1 } },
  });
  assert.deepEqual(result, {
    version: METADATA_VERSION,
    workspaces: { ws1: { enabled: true } },
    sessions: { s1: { course: 'Python', stage: 'review', pinned: true } },
  });
});

test('normalizeMetadata coerces every wrong-typed value to its default', () => {
  const result = normalizeMetadata({
    workspaces: {
      numeric: { enabled: 1 },
      string: { enabled: 'true' },
      object: { enabled: {} },
      nil: { enabled: null },
      missing: {},
      notObject: 'enabled',
candidate: [],
    },
    sessions: {
      badCourse: { course: 42, stage: 'review', pinned: true },
      badStage: { course: 'x', stage: 'mastered', pinned: true },
      badPinned: { course: 'x', stage: 'done', pinned: 'true' },
      notObject: null,
      missing: {},
    },
  });
  assert.deepEqual(result.workspaces, {
    numeric: { enabled: false },
    string: { enabled: false },
    object: { enabled: false },
    nil: { enabled: false },
    missing: { enabled: false },
  });
  assert.deepEqual(result.sessions, {
    badCourse: { course: '', stage: 'review', pinned: true },
    badStage: { course: 'x', stage: DEFAULT_STAGE, pinned: true },
    badPinned: { course: 'x', stage: 'done', pinned: false },
    missing: { course: '', stage: DEFAULT_STAGE, pinned: false },
  });
});

test('normalizeMetadata accepts exactly the three declared stages', () => {
  for (const stage of STAGES) {
    const result = normalizeMetadata({ sessions: { s: { stage } } });
    assert.equal(result.sessions.s.stage, stage);
  }
  assert.deepEqual(STAGES, ['learning', 'review', 'done']);
  assert.equal(DEFAULT_STAGE, 'learning');
});

test('normalizeMetadata normalizes the course label', () => {
  assert.equal(normalizeMetadata({ sessions: { s: { course: '  Python · 变量  ' } } }).sessions.s.course, 'Python · 变量');
  assert.equal(normalizeMetadata({ sessions: { s: { course: '   ' } } }).sessions.s.course, '');
  const long = 'x'.repeat(COURSE_MAX_LENGTH + 50);
  assert.equal(normalizeMetadata({ sessions: { s: { course: long } } }).sessions.s.course.length, COURSE_MAX_LENGTH);
});

test('normalizeMetadata materializes a full session record from a partial patch', () => {
  // client.jsx calls `update(id, { pinned: true })`, i.e. a declared field on an
  // otherwise empty object; every sibling field must still come out defined.
  const base = normalizeMetadata({ sessions: { s1: { course: 'Rust', stage: 'done' } } });
  const patched = normalizeMetadata({ ...base, sessions: { ...base.sessions, s1: { ...base.sessions.s1, pinned: true } } });
  assert.deepEqual(patched.sessions.s1, { course: 'Rust', stage: 'done', pinned: true });

  const fresh = normalizeMetadata({ sessions: { s2: { pinned: true } } });
  assert.deepEqual(fresh.sessions.s2, { course: '', stage: DEFAULT_STAGE, pinned: true });
});

test('normalizeMetadata is idempotent and does not mutate its input', () => {
  const input = {
    version: 1,
    workspaces: { ws: { enabled: true } },
    sessions: { s: { course: 'Go', stage: 'review', pinned: false } },
  };
  const before = JSON.stringify(input);
  const once = normalizeMetadata(input);
  const twice = normalizeMetadata(once);
  assert.deepEqual(twice, once);
  assert.equal(JSON.stringify(input), before, 'input must be untouched');
});

test('normalizeMetadata never aliases input objects in its output', () => {
  const workspaceEntry = { enabled: true };
  const sessionEntry = { course: 'C', stage: 'review', pinned: true };
  const input = { workspaces: { ws: workspaceEntry }, sessions: { s: sessionEntry } };
  const result = normalizeMetadata(input);
  assert.notEqual(result.workspaces.ws, workspaceEntry);
  assert.notEqual(result.sessions.s, sessionEntry);
  workspaceEntry.enabled = false;
  sessionEntry.course = 'mutated';
  assert.equal(result.workspaces.ws.enabled, true);
  assert.equal(result.sessions.s.course, 'C');
});

test('normalizeMetadata does not throw on hostile accessors or exotic keys', () => {
  const hostile = {
    get workspaces() {
      throw new Error('boom');
    },
    get sessions() {
      throw new Error('boom');
    },
  };
  assert.doesNotThrow(() => normalizeMetadata(hostile));
  assert.deepEqual(normalizeMetadata(hostile).workspaces, {});

  const nullProto = Object.create(null);
  nullProto.sessions = Object.create(null);
  nullProto.sessions.s = Object.assign(Object.create(null), { course: 'Null', stage: 'done', pinned: true });
  assert.deepEqual(normalizeMetadata(nullProto).sessions.s, { course: 'Null', stage: 'done', pinned: true });
});

// ---------------------------------------------------------------------------
// normalizeMetadata — prototype pollution and malicious JSON
// ---------------------------------------------------------------------------

test('normalizeMetadata refuses prototype-polluting keys from parsed JSON', () => {
  const payload = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true},' +
      '"workspaces":{"__proto__":{"enabled":true},"constructor":{"enabled":true},"prototype":{"enabled":true},"ok":{"enabled":true}},' +
      '"sessions":{"__proto__":{"course":"pwn"},"constructor":{"course":"pwn"},"prototype":{"course":"pwn"},"ok":{"course":"fine"}}}',
  );

  const result = normalizeMetadata(payload);

  assert.equal({}.polluted, undefined, 'Object.prototype must not be polluted');
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(Object.keys(result.workspaces), ['ok']);
  assert.deepEqual(Object.keys(result.sessions), ['ok']);
  assert.deepEqual(result.workspaces.ok, { enabled: true });
  assert.deepEqual(result.sessions.ok, { course: 'fine', stage: DEFAULT_STAGE, pinned: false });
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.workspaces), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.sessions), Object.prototype);
  assert.equal(Object.hasOwn(result.workspaces, '__proto__'), false);
  assert.equal(Object.hasOwn(result.sessions, '__proto__'), false);
});

test('normalizeMetadata survives a hostile nested JSON payload', () => {
  const adversarial = JSON.parse(
    '{"version":"1","workspaces":{"a":{"enabled":true},"b":null,"c":[1,2],"__proto__":{"enabled":true}},' +
      '"sessions":{"a":{"course":"ok","stage":"done","pinned":true},"b":"str","c":7,"__proto__":{"pinned":true}},' +
      '"toString":{"enabled":true},"hasOwnProperty":{"enabled":true}}',
  );
  const result = normalizeMetadata(adversarial);
  assert.deepEqual(Object.keys(result.workspaces).sort(), ['a']);
  assert.deepEqual(Object.keys(result.sessions).sort(), ['a']);
  assert.deepEqual(result.workspaces.a, { enabled: true });
  assert.deepEqual(result.sessions.a, { course: 'ok', stage: 'done', pinned: true });
  assert.equal({}.enabled, undefined);
});

test('normalizeMetadata ignores empty and whitespace-only ids', () => {
  const result = normalizeMetadata({
    workspaces: { '': { enabled: true }, '   ': { enabled: true }, good: { enabled: true } },
    sessions: { '': { course: 'x' }, '  ': { course: 'x' }, good: { course: 'x' } },
  });
  assert.deepEqual(Object.keys(result.workspaces), ['good']);
  assert.deepEqual(Object.keys(result.sessions), ['good']);
});

test('normalizeMetadata output is JSON round-trippable', () => {
  const result = normalizeMetadata({
    workspaces: { 'ws-1': { enabled: true } },
    sessions: { 's-1': { course: 'Python · 变量', stage: 'review', pinned: true } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

// ---------------------------------------------------------------------------
// learningSessions — membership and exclusion
// ---------------------------------------------------------------------------

test('learningSessions returns the ordinary sessions of the requested workspace', () => {
  const sessions = sessionSnapshot({
    s1: summary('s1', { title: 'Alpha', cwd: '/study/python', updatedAt: 300 }),
    s2: summary('s2', { title: 'Beta', cwd: '/study/python', updatedAt: 200 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study/python', ['s1', 's2'])]);

  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });

  assert.deepEqual(rows.map((row) => row.id), ['s1', 's2']);
  assert.deepEqual(rows[0], {
    id: 's1',
    title: 'Alpha',
    cwd: '/study/python',
    updatedAt: 300,
    course: '',
    stage: DEFAULT_STAGE,
    pinned: false,
    current: false,
  });
});

test('learningSessions follows workspace.sessionIds order, not snapshot order', () => {
  const sessions = sessionSnapshot({
    s1: summary('s1', { updatedAt: 100 }),
    s2: summary('s2', { updatedAt: 100 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s2', 's1'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['s2', 's1']);
});

test('learningSessions merges nothing from other workspaces', () => {
  const sessions = sessionSnapshot({
    a: summary('a', { cwd: '/w1', updatedAt: 5 }),
    b: summary('b', { cwd: '/w2', updatedAt: 9 }),
  });
  const workspaces = workspaceSnapshot([
    workspace('ws1', '/w1', ['a']),
    workspace('ws2', '/w2', ['b']),
  ]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['a']);
});

test('learningSessions excludes subagent rows', () => {
  // The runtime marks subagents with `origin: 'subagent'`; their parent link is `parentId`.
  const sessions = sessionSnapshot({
    parent: summary('parent', { cwd: '/study', updatedAt: 10 }),
    child: summary('child', { cwd: '/study', parentId: 'parent', origin: 'subagent', updatedAt: 20 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['parent', 'child'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['parent']);
});

test('learningSessions keeps fork children, which carry a parent but no subagent origin', () => {
  const sessions = sessionSnapshot({
    source: summary('source', { cwd: '/study', updatedAt: 10 }),
    fork: summary('fork', { cwd: '/study', parentId: 'source', updatedAt: 20, title: 'Source (1)' }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['source', 'fork'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['fork', 'source']);
});

test('learningSessions excludes archived sessions, in any workspace', () => {
  const sessions = sessionSnapshot({
    keep: summary('keep', { cwd: '/study', updatedAt: 30 }),
    gone: summary('gone', { cwd: '/study', updatedAt: 40 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['keep', 'gone'])], ['gone']);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['keep']);
});

test('learningSessions skips members whose summary has not arrived', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1', 'missing'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['s1']);
});

test('learningSessions de-duplicates repeated member ids', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1', 's1'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['s1']);
});

test('learningSessions returns [] for an unknown, empty, or non-string workspace id', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);
  for (const workspaceId of ['nope', '', undefined, null, 7, {}]) {
    assert.deepEqual(
      learningSessions({ sessions, workspaces, workspaceId, metadata: emptyMetadata() }),
      [],
      `workspaceId=${String(workspaceId)}`,
    );
  }
});

test('learningSessions returns [] for malformed inputs instead of throwing', () => {
  assert.deepEqual(learningSessions(), []);
  assert.deepEqual(learningSessions(null), []);
  assert.deepEqual(learningSessions({}), []);
  assert.deepEqual(learningSessions({ sessions: 'x', workspaces: 'y', workspaceId: 'ws1' }), []);
  assert.deepEqual(learningSessions({ sessions: null, workspaces: null, workspaceId: 'ws1' }), []);
  assert.deepEqual(learningSessions({ sessions: { byId: null }, workspaces: { items: [] }, workspaceId: 'ws1' }), []);
  assert.deepEqual(
    learningSessions({ sessions: { byId: {} }, workspaces: { items: [{ workspaceId: 'ws1' }] }, workspaceId: 'ws1' }),
    [],
  );
});

test('learningSessions accepts a bare workspaces array and a missing metadata argument', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const rows = learningSessions({
    sessions,
    workspaces: [workspace('ws1', '/study', ['s1'])],
    workspaceId: 'ws1',
  });
  assert.deepEqual(rows.map((row) => row.id), ['s1']);
  assert.equal(rows[0].stage, DEFAULT_STAGE);
});

// ---------------------------------------------------------------------------
// learningSessions — cwd matching
// ---------------------------------------------------------------------------

test('learningSessions compares Windows drive paths case-insensitively', () => {
  const sessions = sessionSnapshot({
    exact: summary('exact', { cwd: 'C:\\Study\\Python', updatedAt: 3 }),
    folded: summary('folded', { cwd: 'c:/STUDY/python', updatedAt: 2 }),
    slashed: summary('slashed', { cwd: 'C:\\Study\\Python\\', updatedAt: 1 }),
    other: summary('other', { cwd: 'C:\\Study\\Rust', updatedAt: 4 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', 'C:\\Study\\Python', ['exact', 'folded', 'slashed', 'other'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id).sort(), ['exact', 'folded', 'slashed']);
});

test('learningSessions compares POSIX paths case-sensitively', () => {
  const sessions = sessionSnapshot({
    lower: summary('lower', { cwd: '/home/u/study', updatedAt: 2 }),
    upper: summary('upper', { cwd: '/home/u/Study', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/home/u/study', ['lower', 'upper'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['lower']);
});

test('learningSessions ignores trailing separators when comparing POSIX paths', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/home/u/study/', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/home/u/study', ['s1'])]);
  assert.deepEqual(
    learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() }).map((row) => row.id),
    ['s1'],
  );
});

test('learningSessions admits a member whose summary has no cwd', () => {
  // Account membership alone is authoritative when the row cannot contradict it.
  const sessions = sessionSnapshot({ s1: summary('s1', { updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/home/u/study', ['s1'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['s1']);
  assert.equal(rows[0].cwd, undefined);
});

test('learningSessions applies no cwd filter when the workspace path is unusable', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/elsewhere', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '', ['s1'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['s1']);
});

// ---------------------------------------------------------------------------
// learningSessions — title derivation
// ---------------------------------------------------------------------------

test('learningSessions prefers the durable summary.title over displayTitle', () => {
  const sessions = sessionSnapshot({
    s1: summary('s1', { title: 'Durable title', displayTitle: 'Projected title', cwd: '/study/python', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study/python', ['s1'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.equal(rows[0].title, 'Durable title');
});

test('learningSessions falls back to displayTitle, then the cwd basename, then the id', () => {
  const sessions = sessionSnapshot({
    projected: summary('projected', { displayTitle: 'Projected title', cwd: '/study/python', updatedAt: 2 }),
    basename: { id: 'basename', displayTitle: '', running: false, blank: false, updatedAt: 1, cwd: '/study/python' },
    bare: { id: 'bare', running: false, blank: false, updatedAt: 0 },
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study/python', ['projected', 'basename', 'bare'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  const byId = Object.fromEntries(rows.map((row) => [row.id, row.title]));
  assert.equal(byId.projected, 'Projected title');
  assert.equal(byId.basename, 'python');
  assert.equal(byId.bare, 'bare');
});

test('learningSessions derives the basename for both path spellings', () => {
  const sessions = sessionSnapshot({
    win: summary('win', { displayTitle: '', cwd: 'C:\\Study\\Python', updatedAt: 2 }),
    posix: summary('posix', { displayTitle: '', cwd: '/home/u/python/', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', 'C:\\Study\\Python', ['win']), workspace('ws2', '/home/u/python', ['posix'])]);
  assert.equal(learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() })[0].title, 'Python');
  assert.equal(learningSessions({ sessions, workspaces, workspaceId: 'ws2', metadata: emptyMetadata() })[0].title, 'python');
});

test('learningSessions reports the current session', () => {
  const sessions = sessionSnapshot(
    { s1: summary('s1', { cwd: '/study', updatedAt: 2 }), s2: summary('s2', { cwd: '/study', updatedAt: 1 }) },
    's2',
  );
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1', 's2'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  const byId = Object.fromEntries(rows.map((row) => [row.id, row.current]));
  assert.equal(byId.s1, false);
  assert.equal(byId.s2, true);
});

// ---------------------------------------------------------------------------
// learningSessions — metadata marks
// ---------------------------------------------------------------------------

test('learningSessions overlays stored marks onto matching sessions', () => {
  const sessions = sessionSnapshot({
    s1: summary('s1', { cwd: '/study', updatedAt: 2 }),
    s2: summary('s2', { cwd: '/study', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1', 's2'])]);
  const metadata = normalizeMetadata({ sessions: { s1: { course: 'Python', stage: 'review', pinned: true } } });
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId.s1.course, 'Python');
  assert.equal(byId.s1.stage, 'review');
  assert.equal(byId.s1.pinned, true);
  assert.equal(byId.s2.course, '');
  assert.equal(byId.s2.stage, DEFAULT_STAGE);
  assert.equal(byId.s2.pinned, false);
});

test('learningSessions sanitizes hostile marks it is handed directly', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);
  const metadata = { sessions: { s1: { course: 42, stage: 'mastered', pinned: 'yes' } } };
  const [row] = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.deepEqual(
    { course: row.course, stage: row.stage, pinned: row.pinned },
    { course: '', stage: DEFAULT_STAGE, pinned: false },
  );
});

test('learningSessions does not require the workspace to be marked enabled', () => {
  // The Workspace-management picker must preview an unmarked Workspace.
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);

  const unmarked = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(unmarked.map((row) => row.id), ['s1']);

  const disabled = learningSessions({
    sessions,
    workspaces,
    workspaceId: 'ws1',
    metadata: normalizeMetadata({ workspaces: { ws1: { enabled: false } } }),
  });
  assert.deepEqual(disabled.map((row) => row.id), ['s1']);
});

test('learningSessions survives a session id spelled __proto__', () => {
  // Object-literal `__proto__:` sets the prototype, so the own-key row that a
  // hostile payload could really produce is built through JSON.parse instead.
  const byId = JSON.parse(
    '{"__proto__":{"id":"__proto__","displayTitle":"pwn","running":false,"blank":false,"updatedAt":1,"cwd":"/study"}}',
  );
  assert.equal(Object.hasOwn(byId, '__proto__'), true, 'fixture must carry an own __proto__ key');

  const sessions = { ids: ['__proto__'], byId, current: undefined, phase: 'ready' };
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['__proto__'])]);
  const metadata = normalizeMetadata(JSON.parse('{"sessions":{"__proto__":{"course":"pwn"}}}'));

  assert.equal(Object.keys(metadata.sessions).length, 0, 'the polluting mark must be refused');

  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.equal({}.course, undefined);
  assert.equal(rows.length, 1);
  // The row resolves from the own key, and the refused mark leaves the default.
  assert.equal(rows[0].id, '__proto__');
  assert.equal(rows[0].course, '');
  assert.equal(rows[0].stage, DEFAULT_STAGE);
});

test('learningSessions treats an untouched __proto__ id as unmarked, not inherited', () => {
  // No own row for the id: an inherited Object.prototype must not be mistaken
  // for a session summary.
  const sessions = { ids: ['__proto__'], byId: {}, current: undefined, phase: 'ready' };
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['__proto__'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows, []);
});

// ---------------------------------------------------------------------------
// learningSessions — search
// ---------------------------------------------------------------------------

test('learningSessions filters by title, case-insensitively and trimmed', () => {
  const sessions = sessionSnapshot({
    py: summary('py', { title: 'Python 变量', cwd: '/study', updatedAt: 3 }),
    rs: summary('rs', { title: 'Rust ownership', cwd: '/study', updatedAt: 2 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['py', 'rs'])]);
  const match = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata(), query: '  PYTHON  ' });
  assert.deepEqual(match.map((row) => row.id), ['py']);
});

test('learningSessions filters by course as well as title', () => {
  const sessions = sessionSnapshot({
    a: summary('a', { title: 'Session A', cwd: '/study', updatedAt: 2 }),
    b: summary('b', { title: 'Session B', cwd: '/study', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['a', 'b'])]);
  const metadata = normalizeMetadata({ sessions: { b: { course: '数据结构' } } });
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata, query: '数据结构' });
  assert.deepEqual(rows.map((row) => row.id), ['b']);
});

test('learningSessions returns every row for an empty or whitespace query', () => {
  const sessions = sessionSnapshot({
    a: summary('a', { cwd: '/study', updatedAt: 2 }),
    b: summary('b', { cwd: '/study', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['a', 'b'])]);
  for (const query of ['', '   ', undefined, null, 42]) {
    const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata(), query });
    assert.equal(rows.length, 2, `query=${String(query)}`);
  }
});

test('learningSessions applies the search filter before ordering', () => {
  const sessions = sessionSnapshot({
    pinnedOld: summary('pinnedOld', { title: 'match', cwd: '/study', updatedAt: 1 }),
    unpinnedNew: summary('unpinnedNew', { title: 'other', cwd: '/study', updatedAt: 900 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['pinnedOld', 'unpinnedNew'])]);
  const metadata = normalizeMetadata({ sessions: { pinnedOld: { pinned: true } } });
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata, query: 'match' });
  assert.deepEqual(rows.map((row) => row.id), ['pinnedOld']);
});

// ---------------------------------------------------------------------------
// learningSessions — ordering
// ---------------------------------------------------------------------------

test('learningSessions orders pinned first, then most recent first', () => {
  const sessions = sessionSnapshot({
    newest: summary('newest', { cwd: '/study', updatedAt: 300 }),
    middle: summary('middle', { cwd: '/study', updatedAt: 200 }),
    oldest: summary('oldest', { cwd: '/study', updatedAt: 100 }),
    pinnedOld: summary('pinnedOld', { cwd: '/study', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['newest', 'middle', 'oldest', 'pinnedOld'])]);
  const metadata = normalizeMetadata({ sessions: { pinnedOld: { pinned: true } } });
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.deepEqual(rows.map((row) => row.id), ['pinnedOld', 'newest', 'middle', 'oldest']);
});

test('learningSessions orders pinned rows among themselves by recency', () => {
  const sessions = sessionSnapshot({
    p1: summary('p1', { cwd: '/study', updatedAt: 100 }),
    p2: summary('p2', { cwd: '/study', updatedAt: 500 }),
    plain: summary('plain', { cwd: '/study', updatedAt: 900 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['p1', 'p2', 'plain'])]);
  const metadata = normalizeMetadata({ sessions: { p1: { pinned: true }, p2: { pinned: true } } });
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.deepEqual(rows.map((row) => row.id), ['p2', 'p1', 'plain']);
});

test('learningSessions keeps declaration order for equal timestamps', () => {
  const sessions = sessionSnapshot({
    b: summary('b', { cwd: '/study', updatedAt: 100 }),
    a: summary('a', { cwd: '/study', updatedAt: 100 }),
    c: summary('c', { cwd: '/study', updatedAt: 100 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['b', 'a', 'c'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['b', 'a', 'c'], 'the id must not be used as a tie-break');
});

test('learningSessions sorts rows with a missing updatedAt last, stably', () => {
  const sessions = sessionSnapshot({
    none1: { id: 'none1', displayTitle: 'none1', running: false, blank: false, cwd: '/study' },
    known: summary('known', { cwd: '/study', updatedAt: -5 }),
    none2: { id: 'none2', displayTitle: 'none2', running: false, blank: false, cwd: '/study' },
    broken: summary('broken', { cwd: '/study', updatedAt: 'not a date' }),
    zero: summary('zero', { cwd: '/study', updatedAt: 0 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['none1', 'known', 'none2', 'broken', 'zero'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.deepEqual(rows.map((row) => row.id), ['zero', 'known', 'none1', 'none2', 'broken']);
  assert.equal(rows[0].updatedAt, 0);
  assert.equal(rows[4].updatedAt, undefined);
});

test('learningSessions places a pinned row first even without a timestamp', () => {
  const sessions = sessionSnapshot({
    pinnedNoTime: { id: 'pinnedNoTime', displayTitle: 'pinnedNoTime', running: false, blank: false, cwd: '/study' },
    recent: summary('recent', { cwd: '/study', updatedAt: 999 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['pinnedNoTime', 'recent'])]);
  const metadata = normalizeMetadata({ sessions: { pinnedNoTime: { pinned: true } } });
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.deepEqual(rows.map((row) => row.id), ['pinnedNoTime', 'recent']);
});

// ---------------------------------------------------------------------------
// learningSessions — updatedAt parsing
// ---------------------------------------------------------------------------

test('learningSessions passes numeric timestamps through untouched', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1_700_000_000_000 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);
  const [row] = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.equal(row.updatedAt, 1_700_000_000_000);
});

test('learningSessions accepts date strings and numeric strings for updatedAt', () => {
  const iso = '2024-01-02T03:04:05.000Z';
  const sessions = sessionSnapshot({
    iso: summary('iso', { cwd: '/study', updatedAt: iso }),
    numeric: summary('numeric', { cwd: '/study', updatedAt: '1700000000000' }),
    blank: summary('blank', { cwd: '/study', updatedAt: '   ' }),
    object: summary('object', { cwd: '/study', updatedAt: {} }),
    nan: summary('nan', { cwd: '/study', updatedAt: Number.NaN }),
    infinite: summary('infinite', { cwd: '/study', updatedAt: Number.POSITIVE_INFINITY }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['iso', 'numeric', 'blank', 'object', 'nan', 'infinite'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  const byId = Object.fromEntries(rows.map((row) => [row.id, row.updatedAt]));
  assert.equal(byId.iso, Date.parse(iso));
  assert.equal(byId.numeric, 1_700_000_000_000);
  assert.equal(byId.blank, undefined);
  assert.equal(byId.object, undefined);
  assert.equal(byId.nan, undefined);
  assert.equal(byId.infinite, undefined);
});

test('learningSessions never invents a timestamp', () => {
  const sessions = sessionSnapshot({ s1: { id: 's1', displayTitle: 's1', running: false, blank: false, cwd: '/study' } });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);
  const [row] = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.equal(row.updatedAt, undefined);
  assert.equal(Object.hasOwn(row, 'updatedAt'), true);
});

// ---------------------------------------------------------------------------
// learningSessions — purity
// ---------------------------------------------------------------------------

test('learningSessions does not mutate frozen inputs', () => {
  const sessions = deepFreeze(
    sessionSnapshot({
      s1: summary('s1', { title: 'One', cwd: '/study', updatedAt: 2 }),
      s2: summary('s2', { title: 'Two', cwd: '/study', updatedAt: 1 }),
    }),
  );
  const workspaces = deepFreeze(workspaceSnapshot([workspace('ws1', '/study', ['s1', 's2'])], []));
  const metadata = deepFreeze(normalizeMetadata({ sessions: { s1: { course: 'X', pinned: true } } }));

  assert.doesNotThrow(() => learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata, query: '' }));
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.deepEqual(rows.map((row) => row.id), ['s1', 's2']);
});

test('learningSessions output does not alias input objects and is detached from them', () => {
  const summaryRow = summary('s1', { title: 'One', cwd: '/study', updatedAt: 2 });
  const sessions = sessionSnapshot({ s1: summaryRow });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);
  const metadata = normalizeMetadata({ sessions: { s1: { course: 'X', stage: 'done', pinned: true } } });

  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.notEqual(rows[0], summaryRow);
  assert.equal(JSON.stringify(rows[0].cwd), JSON.stringify(summaryRow.cwd));

  summaryRow.title = 'Renamed';
  metadata.sessions.s1.course = 'Changed';
  assert.equal(rows[0].title, 'One');
  assert.equal(rows[0].course, 'X');
});

test('learningSessions is referentially transparent and repeatable', () => {
  const sessions = sessionSnapshot({
    s1: summary('s1', { cwd: '/study', updatedAt: 2 }),
    s2: summary('s2', { cwd: '/study', updatedAt: 1 }),
  });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1', 's2'])]);
  const metadata = normalizeMetadata({});
  const first = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  const second = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata });
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
});

test('learningSessions returns a plain array', () => {
  const sessions = sessionSnapshot({ s1: summary('s1', { cwd: '/study', updatedAt: 1 }) });
  const workspaces = workspaceSnapshot([workspace('ws1', '/study', ['s1'])]);
  const rows = learningSessions({ sessions, workspaces, workspaceId: 'ws1', metadata: emptyMetadata() });
  assert.ok(Array.isArray(rows));
  assert.equal(Object.getPrototypeOf(rows), Array.prototype);
});
