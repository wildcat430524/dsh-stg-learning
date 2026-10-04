/**
 * Pure data layer for the DSH STG learning-workspace plugin.
 *
 * Browser ESM only: no imports, no Node built-ins, no DSH packages, no DOM and
 * no global state. Every export is a total function of its arguments, so
 * Codex's `src/client.jsx` may call it during render and the tests in
 * `tests/model.test.js` drive it without a runtime.
 *
 * The two contract exports are:
 *  - `normalizeMetadata(input)` — sanitize persisted plugin state.
 *  - `learningSessions({ sessions, workspaces, workspaceId, metadata, query })`
 *    — project one Workspace's learning sessions.
 *
 * DSH shapes verified against the installed 0.1.6 runtime and the 0.2rc bundle
 * (`D:\dsh\resources\app.asar`): the client Session list snapshot is
 * `{ ids, byId, phase, ... }` where each row carries `retainedBy.mainView`
 * for the current main session (with a legacy `current` fallback), plus
 * `id`, optional `title`, always-present `displayTitle`, optional `cwd`,
 * optional `parentId`, optional `origin: 'subagent'`, `blank`, `running` and
 * `updatedAt: number` (epoch ms). The Workspace snapshot is
 * `{ items: [{ workspaceId, title, path, sessionIds }], archivedSessionIds, phase }`.
 */

/** Persisted schema version owned by this module. */
export const METADATA_VERSION = 1;
/** The only legal learning stages. */
export const STAGES = Object.freeze(['learning', 'review', 'done']);
/** Stage used for unmarked and invalid entries. */
export const DEFAULT_STAGE = 'learning';
/** Course label budget; mirrors the composer's `maxLength` in `client.jsx`. */
export const COURSE_MAX_LENGTH = 200;

const STAGE_SET = new Set(STAGES);
/**
 * Keys that must never be written through, because assigning them on a plain
 * object would mutate `Object.prototype` instead of storing data.
 * `JSON.parse` DOES create an own `__proto__` property, so persisted JSON is a
 * real attack surface for this.
 */
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Bound on identifier length, purely to keep hostile payloads from bloating state. */
const MAX_KEY_LENGTH = 1024;

/** True for plain-ish objects, excluding `null`, arrays, and functions. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read one property without letting a hostile accessor throw out of the normalizer. */
function readField(object, key) {
  try {
    return object[key];
  } catch {
    return undefined;
  }
}

/** Whether `key` is an own property, so inherited members are never mistaken for data. */
function hasOwn(object, key) {
  try {
    return Object.prototype.hasOwnProperty.call(object, key);
  } catch {
    return false;
  }
}

/**
 * Read an own property only. Session ids are host data, and an id spelled
 * `__proto__` must resolve to "no entry" rather than to `Object.prototype`.
 * @param {object} object - lookup table.
 * @param {string} key - candidate id.
 * @returns {unknown} the stored value, or `undefined` when absent.
 */
function ownField(object, key) {
  return hasOwn(object, key) ? readField(object, key) : undefined;
}

/** Reject empty, whitespace-only, oversized, and prototype-polluting keys. */
function isCleanKey(key) {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.length <= MAX_KEY_LENGTH &&
    key.trim() !== '' &&
    !POLLUTION_KEYS.has(key)
  );
}

/**
 * Own enumerable string entries whose keys are safe to write through.
 * @param {unknown} value - candidate record.
 * @returns {Array<[string, unknown]>} clean entries; `[]` for anything else.
 */
function ownEntries(value) {
  if (!isRecord(value)) return [];
  let keys;
  try {
    keys = Object.keys(value);
  } catch {
    return [];
  }
  const entries = [];
  for (const key of keys) {
    if (!isCleanKey(key)) continue;
    entries.push([key, readField(value, key)]);
  }
  return entries;
}

/**
 * Keep a string only when it carries visible text; DSH owns the stored value, so
 * it is preserved verbatim rather than trimmed.
 * @param {unknown} value - candidate text.
 * @returns {string|undefined} the original text, or `undefined` when absent or blank.
 */
function textOrUndefined(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Sanitize an edited course label: strings only, trimmed, length-capped. */
function normalizeCourse(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > COURSE_MAX_LENGTH ? trimmed.slice(0, COURSE_MAX_LENGTH) : trimmed;
}

/** Sanitize a stage: exact membership only, otherwise the default. */
function normalizeStage(value) {
  return typeof value === 'string' && STAGE_SET.has(value) ? value : DEFAULT_STAGE;
}

/** Sanitize a pin flag: only the literal `true` pins. */
function normalizePinned(value) {
  return value === true;
}

/**
 * Clean arbitrary persisted plugin state into the canonical schema.
 *
 * Guarantees:
 *  - the return value is always `{ version: 1, workspaces, sessions }`;
 *  - unknown fields and wrong-typed values are dropped or replaced by defaults;
 *  - `__proto__` / `constructor` / `prototype` keys are refused, so the result
 *    can never pollute a prototype even when the input came from `JSON.parse`;
 *  - the input is never mutated and no output value aliases an input object.
 *
 * A Workspace entry is kept when it is an object, with `enabled` coerced to a
 * strict boolean. A Session entry is kept when it is an object, always
 * materializing all three fields — this is what makes `client.jsx`'s
 * `update(id, { pinned: true })` partial patch produce a complete record.
 *
 * @param {unknown} input - parsed metadata, `localStorage` JSON, or anything else.
 * @returns {{version: number, workspaces: Record<string, {enabled: boolean}>, sessions: Record<string, {course: string, stage: string, pinned: boolean}>}} cleaned metadata.
 */
export function normalizeMetadata(input) {
  const source = isRecord(input) ? input : {};
  const workspaces = {};
  const sessions = {};

  for (const [workspaceId, entry] of ownEntries(readField(source, 'workspaces'))) {
    if (!isRecord(entry)) continue;
    workspaces[workspaceId] = { enabled: readField(entry, 'enabled') === true };
  }

  for (const [sessionId, entry] of ownEntries(readField(source, 'sessions'))) {
    if (!isRecord(entry)) continue;
    sessions[sessionId] = {
      course: normalizeCourse(readField(entry, 'course')),
      stage: normalizeStage(readField(entry, 'stage')),
      pinned: normalizePinned(readField(entry, 'pinned')),
    };
  }

  return { version: METADATA_VERSION, workspaces, sessions };
}

/**
 * Coerce a real timestamp to epoch milliseconds.
 *
 * DSH host and client summaries both declare `updatedAt: number`, so a finite
 * number passes through untouched. Date strings and all-digit strings are also
 * accepted defensively; nothing is ever inferred from `ctime` or from the
 * current clock.
 *
 * @param {unknown} value - `updatedAt` as delivered.
 * @returns {number|undefined} epoch ms, or `undefined` when unusable.
 */
function timeOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (/^-?\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Final path segment, mirroring DSH's own `workspaceTitleOf` so this module
 * derives the same project label the runtime would.
 * @param {string} path - POSIX or Windows path spelling.
 * @returns {string} the last segment, or `''` for a separator-only path.
 */
function basenameOf(path) {
  const trimmed = path.replace(/[/\\]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return trimmed.slice(cut + 1);
}

/** Whether a path is spelled as a Windows drive path or UNC share. */
function isWindowsSpelling(path) {
  return /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]{2}[^\\/]/.test(path);
}

/** Fold both separators and drop trailing separators for comparison. */
function normalizePathSpelling(path) {
  const trimmed = path.replace(/[/\\]+$/, '');
  if (trimmed === '') return '/';
  return trimmed.replace(/\\/g, '/');
}

/**
 * Compare two Workspace paths using the native casing rule implied by their own
 * spelling: Windows drive/UNC paths compare case-insensitively, POSIX paths
 * compare case-sensitively. DSH itself reaches the same outcome by canonicalizing
 * through `fs.realpath` and then testing strict string equality.
 * @param {string} left - first path.
 * @param {string} right - second path.
 * @returns {boolean} whether both spellings name the same location.
 */
function samePath(left, right) {
  const normalizedLeft = normalizePathSpelling(left);
  const normalizedRight = normalizePathSpelling(right);
  if (isWindowsSpelling(left) || isWindowsSpelling(right)) {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }
  return normalizedLeft === normalizedRight;
}

/**
 * Resolve the display title the way DSH's `displayTitleOf` does: durable title,
 * then the runtime-projected `displayTitle`, then the project basename, then the
 * raw id.
 * @param {Record<string, unknown>} summary - client Session summary.
 * @param {string} id - the Session id used as the last resort.
 * @returns {string} a non-empty label.
 */
function titleOf(summary, id) {
  const durable = textOrUndefined(readField(summary, 'title'));
  if (durable !== undefined) return durable;
  const projected = textOrUndefined(readField(summary, 'displayTitle'));
  if (projected !== undefined) return projected;
  const cwd = textOrUndefined(readField(summary, 'cwd'));
  if (cwd !== undefined) {
    const base = basenameOf(cwd);
    if (base !== '') return base;
  }
  return id;
}

/**
 * Order rows for display: pinned first, then most recent first, with unknown
 * timestamps last and declaration order preserved for every tie.
 * @param {Array<object>} rows - rows in Workspace declaration order.
 * @returns {Array<object>} a new, stably ordered array.
 */
function sortRows(rows) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      if (left.row.pinned !== right.row.pinned) return left.row.pinned ? -1 : 1;
      const leftTime = left.row.updatedAt;
      const rightTime = right.row.updatedAt;
      const leftKnown = typeof leftTime === 'number';
      const rightKnown = typeof rightTime === 'number';
      if (leftKnown && rightKnown && leftTime !== rightTime) return rightTime - leftTime;
      if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
      return left.index - right.index;
    })
    .map((entry) => entry.row);
}

/**
 * Project the ordinary learning sessions of one Workspace.
 *
 * Membership is `workspace.sessionIds` — the authoritative account trail DSH's
 * own Workspace browser walks — so a Session is included only when it is
 * accounted to this Workspace AND its `cwd` agrees with the Workspace path under
 * {@link samePath} whenever both are known. Excluded: subagent rows
 * (`origin === 'subagent'`, the runtime's coarse navigation flag) and every id in
 * the registry-global `archivedSessionIds` set. Fork children keep `parentId` but
 * no subagent `origin`, so they remain ordinary sessions.
 *
 * `metadata` supplies per-Session plugin marks only; it is never a mastery
 * record. Deliberately, `metadata.workspaces[workspaceId].enabled` is NOT
 * required, so the Workspace-management picker can preview an unmarked Workspace.
 * Neither argument is mutated and no output value aliases an input object.
 *
 * @param {object} options - projection inputs.
 * @param {{ids?: unknown, byId?: unknown, current?: unknown}} [options.sessions] - `sessions.list.getSnapshot()`.
 * @param {{items?: unknown, archivedSessionIds?: unknown}|Array<unknown>} [options.workspaces] - `workspaces.list.getSnapshot()`.
 * @param {string} [options.workspaceId] - owning Workspace; unknown ids yield `[]`.
 * @param {{sessions?: unknown}} [options.metadata] - `normalizeMetadata` output.
 * @param {string} [options.query] - optional case-insensitive title/course filter.
 * @returns {Array<{id: string, title: string, cwd: string|undefined, updatedAt: number|undefined, course: string, stage: string, pinned: boolean, current: boolean}>} display rows.
 */
export function currentSessionId(snapshot) {
  const byId = readField(snapshot, 'byId');
  if (isRecord(byId)) {
    for (const id of Object.keys(byId)) {
      const retained = readField(ownField(byId, id), 'retainedBy');
      if (readField(retained, 'mainView') > 0) return id;
    }
  }
  const legacy = readField(snapshot, 'current');
  return typeof legacy === 'string' ? legacy : undefined;
}

export function learningSessions(options) {
  const request = isRecord(options) ? options : {};

  const sessionSnapshotValue = readField(request, 'sessions');
  const sessionSnapshot = isRecord(sessionSnapshotValue) ? sessionSnapshotValue : {};
  const byIdValue = readField(sessionSnapshot, 'byId');
  const byId = isRecord(byIdValue) ? byIdValue : {};
  const current = currentSessionId(sessionSnapshot);

  const workspaceSnapshot = readField(request, 'workspaces');
  let workspaceItems = [];
  let archivedValue;
  if (Array.isArray(workspaceSnapshot)) {
    workspaceItems = workspaceSnapshot;
  } else if (isRecord(workspaceSnapshot)) {
    const itemsValue = readField(workspaceSnapshot, 'items');
    if (Array.isArray(itemsValue)) workspaceItems = itemsValue;
    archivedValue = readField(workspaceSnapshot, 'archivedSessionIds');
  }
  const archived = new Set(
    Array.isArray(archivedValue) ? archivedValue.filter((id) => typeof id === 'string') : [],
  );

  const workspaceId = readField(request, 'workspaceId');
  if (typeof workspaceId !== 'string' || workspaceId === '') return [];
  const workspace = workspaceItems.find(
    (item) => isRecord(item) && readField(item, 'workspaceId') === workspaceId,
  );
  if (!isRecord(workspace)) return [];

  const memberIdsValue = readField(workspace, 'sessionIds');
  const memberIds = Array.isArray(memberIdsValue) ? memberIdsValue : [];
  const pathValue = readField(workspace, 'path');
  const workspacePath = typeof pathValue === 'string' ? pathValue : '';

  const metadataValue = readField(request, 'metadata');
  let marks = {};
  if (isRecord(metadataValue)) {
    const marksValue = readField(metadataValue, 'sessions');
    if (isRecord(marksValue)) marks = marksValue;
  }

  const queryValue = readField(request, 'query');
  const query = (typeof queryValue === 'string' ? queryValue : '').trim().toLowerCase();

  const rows = [];
  const seen = new Set();

  for (const id of memberIds) {
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    seen.add(id);

    const summary = ownField(byId, id);
    if (!isRecord(summary)) continue;

    // A subagent row belongs to its parent's catalog; archived rows are visible nowhere.
    if (readField(summary, 'origin') === 'subagent') continue;
    if (archived.has(id)) continue;

    const cwd = textOrUndefined(readField(summary, 'cwd'));
    if (cwd !== undefined && workspacePath.trim() !== '' && !samePath(cwd, workspacePath)) continue;

    const title = titleOf(summary, id);
    const markValue = ownField(marks, id);
    const mark = isRecord(markValue) ? markValue : undefined;
    const course = mark === undefined ? '' : normalizeCourse(readField(mark, 'course'));
    const stage = mark === undefined ? DEFAULT_STAGE : normalizeStage(readField(mark, 'stage'));
    const pinned = mark === undefined ? false : normalizePinned(readField(mark, 'pinned'));

    if (query !== '' && !title.toLowerCase().includes(query) && !course.toLowerCase().includes(query)) {
      continue;
    }

    rows.push({
      id,
      title,
      cwd,
      updatedAt: timeOf(readField(summary, 'updatedAt')),
      course,
      stage,
      pinned,
      current: id === current,
    });
  }

  return sortRows(rows);
}
