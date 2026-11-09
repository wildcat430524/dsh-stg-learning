import { STG_PRESET } from './native-protocol.js';

export const NEW_TEACHER_SESSION_LABEL = '新对话';
export const TEACHER_SESSION_FALLBACK_LABEL = '老师对话';

function cleanTitle(value) {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

/**
 * A short, non-technical row name. A blank conversation is simply "新对话"; a
 * started one uses the host's durable title and falls back to a short identity
 * suffix rather than inventing a title.
 */
export function teacherSessionLabel(row) {
  if (!row) return TEACHER_SESSION_FALLBACK_LABEL;
  if (row.blank) return NEW_TEACHER_SESSION_LABEL;
  const title = cleanTitle(row.title);
  if (title) return title;
  return `${TEACHER_SESSION_FALLBACK_LABEL} · ${String(row.id).slice(-4)}`;
}

/** Time of day, or the date when it is not today; '' when the host has none. */
function sessionWhen(updatedAt) {
  const date = new Date(Number(updatedAt));
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return '';
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString() ? time : `${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${time}`;
}

/**
 * Teacher Sessions in exactly one learning space.
 *
 * Membership comes from the Workspace row (the Host's account of which
 * Sessions belong to this space). The mentor preset is the durable marker of a
 * teacher conversation; a current Session and Sessions created by this plugin
 * are also admitted while their projection/attachment stream is still
 * arriving. Archived and subagent Sessions never appear, so no other space or
 * child conversation can leak into this picker.
 */
export function teacherSessionRows(snapshot, workspace, { archivedSessionIds = [], includeSessionIds = [], currentSessionId = '' } = {}) {
  const byId = snapshot?.byId || {};
  const archived = new Set(Array.isArray(archivedSessionIds) ? archivedSessionIds : []);
  const extra = new Set((Array.isArray(includeSessionIds) ? includeSessionIds : []).filter(id => typeof id === 'string' && id));
  const members = new Set([...(Array.isArray(workspace?.sessionIds) ? workspace.sessionIds : []), ...extra]);
  const rows = [];
  for (const id of members) {
    const row = byId[id];
    const current = id === currentSessionId;
    if (row) {
      if (row.archived || row.parentId || archived.has(id)) continue;
      const teacher = row.projectionValues?.agentPreset === STG_PRESET;
      if (!teacher && !extra.has(id) && !current) continue;
    } else if (!extra.has(id)) continue;
    const blank = row?.blank !== false;
    const updatedAt = Number(row?.updatedAt) || 0;
    rows.push({
      id,
      title: cleanTitle(row?.title),
      blank,
      running: Boolean(row?.running),
      updatedAt,
      current,
      label: teacherSessionLabel({ id, title: row?.title, blank }),
      hint: blank ? (sessionWhen(updatedAt) ? `${sessionWhen(updatedAt)} · 空白` : '空白对话') : row?.running ? '正在回答' : sessionWhen(updatedAt),
    });
  }
  rows.sort((left, right) => Number(right.current) - Number(left.current) || right.updatedAt - left.updatedAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  // Untouched blanks created in the same minute would otherwise read
  // identically; number only the colliding rows so each one stays pickable.
  const totals = new Map();
  for (const row of rows) totals.set(row.hint, (totals.get(row.hint) || 0) + 1);
  const seen = new Map();
  for (const row of rows) {
    if (totals.get(row.hint) < 2) continue;
    const index = (seen.get(row.hint) || 0) + 1;
    seen.set(row.hint, index);
    row.hint = `${row.hint} ${index}`;
  }
  return rows;
}

function stashKey(sessionId) { return `stg-teacher.draft.v1:${sessionId}`; }

/**
 * Unsent composer text per Teacher Session.
 *
 * The official composer keeps a draft in the retained Session's input shell,
 * which is torn down when the last reference is released (a switch). The
 * conversation store only persists drafts for opened (non-blank) Sessions, and
 * its writer is bound by the official View area rather than by this embedded
 * panel. So that a switch never costs the user their text, this registry keeps
 * the exact composer projection for one Session while its composer unmounts and
 * restores it through the official `setDraft` action when the Session returns.
 * It never submits, never copies history and never overwrites a non-empty
 * composer.
 */
export function createTeacherDraftRegistry({ storage = () => { try { return globalThis.localStorage; } catch { return null; } }, maxLength = 200000 } = {}) {
  const faces = new Map(), stashes = new Map();
  // Accept either a storage accessor or a storage object; a host may throw on
  // access (sandboxed iframe, disabled storage), which must stay non-fatal.
  const area = () => { try { return typeof storage === 'function' ? storage() : storage; } catch { return null; } };
  const clip = text => typeof text === 'string' ? text.slice(0, maxLength) : '';
  function readStash(sessionId) {
    if (stashes.has(sessionId)) return stashes.get(sessionId);
    try {
      const raw = area()?.getItem(stashKey(sessionId));
      if (typeof raw === 'string' && raw) { stashes.set(sessionId, clip(raw)); return stashes.get(sessionId); }
    } catch { /* A disabled storage still keeps this page's stash below. */ }
    return '';
  }
  function writeStash(sessionId, text) {
    const value = clip(text);
    if (value) stashes.set(sessionId, value); else stashes.delete(sessionId);
    const memory = area();
    if (!memory || typeof memory.setItem !== 'function') return false;
    try {
      if (value) memory.setItem(stashKey(sessionId), value);
      else memory.removeItem?.(stashKey(sessionId));
      return true;
    } catch { return false; }
  }
  function liveDraft(sessionId) {
    const token = faces.get(sessionId);
    try { return typeof token?.face.getDraft === 'function' ? clip(token.face.getDraft()) : ''; } catch { return ''; }
  }
  return {
    /** The last mounted composer for a Session owns its face. */
    bind(sessionId, face) {
      if (typeof sessionId !== 'string' || !sessionId || !face) return () => {};
      const token = { face };
      faces.set(sessionId, token);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (faces.get(sessionId) !== token) return;
        // The composer is going away (switch, layout change, close): keep what
        // is actually in it, including an intentional deletion.
        writeStash(sessionId, liveDraft(sessionId));
        faces.delete(sessionId);
      };
    },
    /** Keep the exact text of the composer that is about to lose its Session. */
    persist(sessionId) {
      const token = faces.get(sessionId);
      // Without a mounted composer there is nothing newer to write: erasing the
      // stash here would lose the draft the user is about to return to.
      if (!token) return { text: readStash(sessionId), stored: false, mounted: false };
      const text = liveDraft(sessionId);
      const stored = writeStash(sessionId, text);
      // Also flush the official conversation store where the host has bound it.
      try { token.face.persist?.(); } catch { /* The stash above already holds the text. */ }
      return { text, stored, mounted: true };
    },
    /** Restore a stashed draft into an empty composer; never replaces typed text. */
    restore(sessionId) {
      const token = faces.get(sessionId);
      if (!token || typeof token.face.setDraft !== 'function') return 'unavailable';
      if (liveDraft(sessionId)) return 'occupied';
      const text = readStash(sessionId);
      if (!text) return 'empty';
      try { token.face.setDraft(text); } catch { return 'failed'; }
      if (!liveDraft(sessionId)) return 'pending';
      // The composer now holds the text, so the stash must not reapply it after
      // a later send; the unmount hook writes the next state again.
      stashes.delete(sessionId);
      try { area()?.removeItem?.(stashKey(sessionId)); } catch { /* Memory already dropped. */ }
      return 'restored';
    },
    hasDraft(sessionId) { return Boolean(liveDraft(sessionId) || readStash(sessionId)); },
    focus(sessionId) {
      const token = faces.get(sessionId);
      try { token?.face.focus?.(); } catch { /* Focus is a convenience, never a correctness gate. */ }
    },
    /** Test/cleanup hook: forget one Session's stash without touching live text. */
    clear(sessionId) { writeStash(sessionId, ''); },
  };
}

function failureMessage(error) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message || '老师对话没有切换成功，当前对话未变，请重试。';
}

/**
 * Serializes teacher conversation intents so one switch/create cannot interleave
 * with another. A repeated create request is coalesced into the in-flight one
 * (never a second blank Session); rapid selects keep only the latest queued
 * intent. The currently selected Session is committed only after its reference
 * is ready and binding persisted, and a superseded result is released unused.
 */
export function createTeacherSessionSwitcher({
  getTarget, getCurrent, isBlank, hasDraft, flush, openSession, createSession, applySession, onChange, isLive = () => true, gate,
} = {}) {
  let queue = [], active = null, drainPromise = null, epoch = 0, busy = false, disposed = false;
  // The Session this picker itself just created. Another create click while it
  // is still an untouched blank conversation is a no-op, not a second Session.
  let createdId = '';
  const report = patch => { if (!disposed) onChange?.({ busy, ...patch }); };
  const runExclusive = typeof gate === 'function' ? gate : operation => operation();

  function release(next) {
    try { next?.reference?.release?.(); } catch { /* A dead generation is already released. */ }
  }

  async function execute(intent) {
    const target = getTarget?.();
    if (!target || !target.workspaceId) { report({ error: '学习空间还没有就绪，请重新打开后再试。' }); return; }
    const current = getCurrent?.() || null;
    if (intent.kind === 'select') {
      if (!intent.sessionId) { report({ error: '请选择要切换的老师对话。' }); return; }
      if (current?.id === intent.sessionId) { report({ error: '', status: '当前已经是这段对话。' }); return; }
    } else if (current && current.id === createdId && isBlank?.(current) && !hasDraft?.(current.id)) {
      report({ error: '', status: '当前已经是新对话，直接输入就好。' });
      return;
    }
    try { await flush?.(current?.id); }
    catch { report({ error: '当前输入还没保存，已留在原对话。请检查浏览器存储后重试。', status: '' }); return; }
    busy = true; report({ error: '', status: '' });
    const runEpoch = epoch;
    let next;
    try {
      next = intent.kind === 'create'
        ? await createSession?.({ workspaceId: target.workspaceId, courseId: target.courseId, currentSessionId: current?.id })
        : await openSession?.({ workspaceId: target.workspaceId, courseId: target.courseId, sessionId: intent.sessionId });
    } catch (error) {
      busy = false;
      if (!disposed && runEpoch === epoch) report({ error: failureMessage(error), status: '' });
      return;
    }
    if (disposed || runEpoch !== epoch || !isLive(target)) { release(next); busy = false; return; }
    try {
      applySession?.(next, current);
      if (intent.kind === 'create') createdId = next?.id || '';
      else if (intent.kind === 'select') createdId = '';
      busy = false; report({ error: '', status: '' });
    } catch (error) {
      busy = false;
      release(next);
      report({ error: failureMessage(error), status: '' });
    }
  }

  function drain() {
    if (drainPromise) return drainPromise;
    // One gate covers the whole queue: a question cannot slip between two
    // rapid picks and land in a conversation the user already left.
    drainPromise = runExclusive(async () => {
      try {
        while (queue.length && !disposed) {
          const intent = queue.shift();
          active = intent;
          await execute(intent);
          if (active === intent) active = null;
        }
      } finally {
        drainPromise = null; active = null;
      }
    });
    return drainPromise;
  }

  function enqueue(intent) {
    if (disposed) return Promise.resolve();
    if (intent.kind === 'create') {
      // Double-click / keyboard repeat must never mint another blank Session.
      if (queue.some(row => row.kind === 'create') || active?.kind === 'create') return drainPromise || Promise.resolve();
      queue.push(intent);
    } else {
      if (active?.kind === 'select' && active.sessionId === intent.sessionId) return drainPromise || Promise.resolve();
      const index = queue.findIndex(row => row.kind === 'select');
      if (index >= 0) queue[index] = intent; else queue.push(intent);
    }
    return drain();
  }

  return {
    select(sessionId) { return enqueue({ kind: 'select', sessionId }); },
    create() { return enqueue({ kind: 'create' }); },
    /** Invalidate an in-flight result (teacher closed, space changed, unmount). */
    invalidate() {
      epoch++;
      queue = [];
      createdId = '';
      const wasBusy = busy;
      busy = false;
      if (wasBusy) report({ error: '', status: '' });
    },
    dispose() { disposed = true; this.invalidate(); },
    async settled() { if (drainPromise) await drainPromise; },
    get busy() { return busy; },
  };
}
