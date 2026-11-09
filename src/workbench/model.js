// Display and draft helpers. Learning facts are always read from workspace files.
export const VIEWS = ['read', 'answer', 'review'];
export const asText = value => typeof value === 'string' ? value : '';
export const basename = value => asText(value).replace(/\\/g, '/').split('/').at(-1) || '';
export const titleOf = value => basename(value).replace(/\.(?:md|markdown|txt)$/i, '');
export const learningDocumentLabel = value => ({ '我的学习/00-学习档案.md': '学习档案', '我的学习/我的规则.md': '我的学习规则', '我的学习/我的规则.en.md': 'Learning rules · English', '我的学习/README.md': '学习目录说明', '资料/README.md': '资料使用说明' }[value] || titleOf(value));
export function normalizeCourses(courses) {
  const seen = new Set();
  return (Array.isArray(courses) ? courses : []).filter(c => c && typeof c.id === 'string' && !seen.has(c.id) && seen.add(c.id)).map(c => {
    const rounds = [], identities = new Set();
    for (const [i, round] of (Array.isArray(c.rounds) ? c.rounds : []).entries()) {
      if (!round || typeof round.path !== 'string') continue;
      const id = String(round.id ?? i), identity = `${id}\u0000${round.path}`;
      // A source document can expose the same round twice (outer round heading
      // plus a nested question heading). Keep the first real heading only so the
      // menu never lists one round twice.
      if (identities.has(identity)) continue;
      identities.add(identity);
      rounds.push({ ...round, id, path: round.path, title: asText(round.title) || titleOf(round.path) });
    }
    return {
      ...c, title: asText(c.title) || titleOf(c.directory) || '未命名课程', subject: asText(c.subject) || '课程',
      directory: asText(c.directory), guidePath: asText(c.guidePath), answerPath: asText(c.answerPath), rounds,
    };
  });
}
export function flattenFiles(tree) {
  const files = [], seen = new Set();
  function visit(nodes, depth) {
    if (depth > 40) return;
    for (const node of Array.isArray(nodes) ? nodes : nodes ? [nodes] : []) {
      if (!node || typeof node !== 'object' || seen.has(node)) continue;
      seen.add(node);
      if (node.type === 'file' && node.readable !== false && typeof node.path === 'string') files.push({ path: node.path, name: asText(node.name) || basename(node.path) });
      else if (node.type === 'directory' || node.children) visit(node.children, depth + 1);
    }
  }
  visit(tree, 0);
  return [...new Map(files.map(file => [file.path, file])).values()];
}
/**
 * The single place that answers "where does this course open when the user
 * enters learning?". The recorded current round wins over `lastDocumentPath`
 * (which may be a historical round or the answer/review view from last time),
 * and over `lastView`, so entering learning never silently resumes the wrong
 * position. A course without an identifiable current round degrades to its
 * teaching entry without inventing a round. Independent round files and rounds
 * inside one guide both come from the host `rounds` list, so the menu identity
 * and the opened document cannot drift apart.
 */
export function courseLocation(course) {
  const id = asText(course?.currentRoundId);
  const round = id ? (course?.rounds || []).find(item => item && String(item.id) === id) : null;
  if (round?.path) return { path: round.path, view: 'read', roundId: String(round.id) };
  return { path: asText(course?.guidePath) || asText(course?.rounds?.[0]?.path) || asText(course?.answerPath), view: 'read', roundId: '' };
}

export function initialLocation(data) {
  const courses = normalizeCourses(data?.courses), files = flattenFiles(data?.tree), current = data?.current || {}, state = data?.state || {};
  const course = courses.find(c => c.id === current.courseId) || courses.find(c => c.id === state.lastCourseId) || courses[0] || null;
  const available = new Set([...files.map(f => f.path), ...courses.flatMap(c => [c.guidePath, c.answerPath, ...c.rounds.map(r => r.path)])].filter(Boolean));
  const exists = path => !!path && (available.has(path) || files.some(file => file.path === path));
  if (!course) {
    const saved = asText(state.lastDocumentPath);
    return { courseId: '', path: exists(saved) ? saved : files[0]?.path || '', view: VIEWS.includes(state.lastView) ? state.lastView : 'read', roundId: '' };
  }
  // The host resolves the real current round from the learning profile; this
  // only selects it. No maximum-round guessing happens in the front end.
  const recorded = asText(course.currentRoundId) || (current.courseId === course.id ? asText(current.roundId) : '');
  const round = recorded ? (course.rounds || []).find(item => String(item.id) === recorded) : null;
  if (round?.path && exists(round.path)) return { courseId: course.id, path: round.path, view: 'read', roundId: String(round.id) };
  const guide = asText(course.guidePath) || asText(current.guidePath);
  if (exists(guide)) return { courseId: course.id, path: guide, view: 'read', roundId: '' };
  const answer = asText(course.answerPath) || asText(current.answerPath);
  if (exists(answer)) return { courseId: course.id, path: answer, view: 'read', roundId: '' };
  return { courseId: course.id, path: files[0]?.path || '', view: 'read', roundId: '' };
}
export function currentQuestions(snapshot) {
  const input = snapshot?.questions?.current;
  if (!Array.isArray(input) || input.length < 1 || input.length > 3) return [];
  const ids = new Set();
  const valid = input.filter(q => q && (typeof q.id === 'string' || typeof q.id === 'number') && !ids.has(String(q.id)) && ids.add(String(q.id)) && typeof q.prompt === 'string');
  return valid.length === input.length ? valid.map(q => ({ ...q, id: String(q.id), title: asText(q.title) || `问题 ${q.number || ''}`, answer: { value: asText(q.answer?.value), kind: asText(q.answer?.kind) } })) : [];
}
export function answersToSave(answers, snapshot) {
  const questions = currentQuestions(snapshot), valid = new Set(questions.map(q => q.id));
  const submitted = Object.entries(answers || {}).filter(([, text]) => typeof text === 'string' && text.trim()).map(([id, text]) => ({ id, text }));
  if (!submitted.length) throw Error('请先填写至少一道题的回答。');
  if (!questions.length || submitted.some(a => !valid.has(a.id))) throw Error('题目或轮次已变化。请先查看最新题目，原草稿已保留。');
  return submitted;
}
export function newDocumentEntry(snapshot) {
  return { snapshot, content: asText(snapshot?.content), answers: {}, orphanAnswers: [], saving: false, error: '', recovery: null };
}
export function hasChanges(entry) {
  return !!entry && (entry.content !== entry.snapshot?.content || Object.values(entry.answers || {}).some(text => typeof text === 'string' && text.trim()) || !!entry.orphanAnswers?.length);
}
// A save acknowledges only its captured payload. Typing during an in-flight save
// must survive, including when the user has already navigated to another file.
export function acceptSave(entry, request, snapshot) {
  if (!entry) return newDocumentEntry(snapshot);
  const pending = { ...entry.answers }, answers = {}, orphanAnswers = [...(entry.orphanAnswers || [])];
  for (const answer of request.answers || []) if (pending[answer.id] === answer.text) delete pending[answer.id];
  const oldQuestions = currentQuestions(entry.snapshot), nextQuestions = currentQuestions(snapshot);
  const identity = q => JSON.stringify([asText(q.round), String(q.number ?? ''), q.title, q.prompt]);
  for (const [id, text] of Object.entries(pending)) {
    if (typeof text !== 'string' || !text.trim()) continue;
    const original = oldQuestions.find(q => q.id === id);
    const matches = original ? nextQuestions.filter(q => identity(q) === identity(original)) : [];
    if (matches.length === 1 && !Object.hasOwn(answers, matches[0].id)) answers[matches[0].id] = text;
    else orphanAnswers.push({ title: original?.title || `问题 ${id}`, round: asText(original?.round), text });
  }
  return { ...entry, snapshot, content: entry.content === request.content ? snapshot.content : entry.content, answers, orphanAnswers, saving: false, error: '' };
}
export const draftKey = (workspaceId, path, version) => `stgw.draft.v1:${encodeURIComponent(workspaceId)}:${encodeURIComponent(path)}:${encodeURIComponent(version)}`;
export function draftRecord(entry) {
  return { version: entry.snapshot.version, content: entry.content, questions: entry.snapshot.questions, answers: { ...entry.answers }, orphanAnswers: [...(entry.orphanAnswers || [])], updatedAt: Date.now() };
}
export function recoverEntryDraft(entry) {
  const recovery = entry.recovery;
  if (!recovery) return entry;
  const originalSnapshot = { version: recovery.version, content: recovery.content, questions: recovery.questions || (!recovery.outdated ? entry.snapshot.questions : undefined) };
  const restored = acceptSave({ ...newDocumentEntry(originalSnapshot), content: recovery.content, answers: { ...recovery.answers }, orphanAnswers: [...(recovery.orphanAnswers || [])] }, {}, entry.snapshot);
  return { ...restored, content: recovery.content, recovery: null };
}
export function reconcileExternal(entry, incoming) {
  if (!entry) return { action: 'replace', entry: newDocumentEntry(incoming) };
  if (entry.saving) return { action: 'busy', entry };
  if (entry.snapshot.version === incoming.version) return { action: 'same', entry };
  if (hasChanges(entry)) return { action: 'retain', entry };
  return { action: 'replace', entry: { ...newDocumentEntry(incoming), recovery: entry.recovery } };
}
export function readDraft(storage, workspaceId, path, version) {
  try {
    const prefix = draftKey(workspaceId, path, '');
    const found = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const record = JSON.parse(storage.getItem(key));
        if (record && typeof record.content === 'string' && typeof record.version === 'string' && record.answers && typeof record.answers === 'object' && !Array.isArray(record.answers)) found.push({ ...record, orphanAnswers: (Array.isArray(record.orphanAnswers) ? record.orphanAnswers : []).filter(item => item && typeof item.text === 'string'), key, outdated: record.version !== version });
      } catch { /* One broken record must not hide another recoverable draft. */ }
    }
    return found.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0] || null;
  } catch { return null; }
}
export function saveDraft(storage, workspaceId, path, entry, previousVersion) {
  if (!storage) return false;
  try {
    const key = draftKey(workspaceId, path, entry.snapshot.version);
    if (hasChanges(entry)) storage.setItem(key, JSON.stringify(draftRecord(entry)));
    else storage.removeItem(key);
    if (previousVersion && previousVersion !== entry.snapshot.version) storage.removeItem(draftKey(workspaceId, path, previousVersion));
    return true;
  } catch { return false; }
}
export function operationId() { return globalThis.crypto?.randomUUID?.() || `stgw-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function createRequestGate() { let generation = 0; return { next: () => ++generation, current: token => token === generation, cancel: () => { generation++; } }; }
/**
 * Single-flight runner for disk checks. Background (quiet) calls made while a
 * check runs are dropped, but an explicit user call is never lost: it waits
 * for the running check and then runs once more, so it sees a fresh result.
 */
export function createCheckRunner(run) {
  let active = null, queued = null;
  const start = options => {
    active = Promise.resolve().then(() => run(options)).finally(() => {
      active = null;
      if (queued) { const next = queued; queued = null; start(next.options).then(next.resolve, next.reject); }
    });
    return active;
  };
  return options => {
    if (!active) return start(options);
    if (options?.quiet) return active;
    if (!queued) { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); queued = { options, promise, resolve, reject }; }
    else queued.options = options;
    return queued.promise;
  };
}
export function localDocumentPath(from, destination) {
  if (typeof destination !== 'string' || !destination || /^[a-z][a-z\d+.-]*:/i.test(destination) || /^[\\/]/.test(destination)) return null;
  let decoded;
  try { decoded = decodeURIComponent(destination.split('#')[0]); } catch { return null; }
  if (!decoded || /[\u0000-\u001f?#]/.test(decoded) || /^[a-z][a-z\d+.-]*:/i.test(decoded) || /^[\\/]/.test(decoded)) return null;
  const parts = asText(from).replace(/\\/g, '/').split('/').slice(0, -1);
  for (const part of decoded.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
}
export function readableDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? asText(value) || '时间未知' : date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
