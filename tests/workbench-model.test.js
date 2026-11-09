import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptSave, answersToSave, courseLocation, createRequestGate, currentQuestions, draftKey, draftRecord, flattenFiles, hasChanges, initialLocation, localDocumentPath, newDocumentEntry, readDraft, reconcileExternal, recoverEntryDraft, saveDraft } from '../src/workbench/model.js';

const question = (id, number = 1, prompt = '说明你的理解', round = '第一轮') => ({ id, number: String(number), title: `问题 ${number}`, prompt, round, answer: { value: '', kind: 'empty' } });
const snapshot = (version = 'v1', content = '# 教学', questions = [question('10')]) => ({ version, content, path: '课程/学生回答.md', questions: { current: questions, round: questions[0]?.round } });
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test('a completed source save never erases typing that happened while it was pending', () => {
  const old = snapshot(), entry = { ...newDocumentEntry(old), content: 'newer unsaved typing', answers: { '10': 'pending answer' }, saving: true };
  const next = acceptSave(entry, { content: 'submitted source' }, snapshot('v2', 'submitted source'));
  assert.equal(next.snapshot.version, 'v2');
  assert.equal(next.content, 'newer unsaved typing');
  assert.equal(next.answers['10'], 'pending answer');
  assert.equal(hasChanges(next), true);
});

test('answer acknowledgement remaps offset ids so edits during a pending append stay visible', () => {
  const before = snapshot('v1', 'before', [question('10', 1), question('90', 2)]);
  const after = snapshot('v2', 'after append', [question('10', 1), question('210', 2)]);
  const entry = { ...newDocumentEntry(before), answers: { '10': 'submitted one', '90': 'newer two typed during request' } };
  const next = acceptSave(entry, { content: 'before', answers: [{ id: '10', text: 'submitted one' }, { id: '90', text: 'submitted two' }] }, after);
  assert.deepEqual(next.answers, { '210': 'newer two typed during request' });
  assert.deepEqual(next.orphanAnswers, []);
  assert.deepEqual(answersToSave(next.answers, next.snapshot), [{ id: '210', text: 'newer two typed during request' }]);
});

test('a semantic question change retains the pending answer as visible recovery instead of guessing its destination', () => {
  const before = snapshot('v1', 'before', [question('10')]);
  const after = snapshot('v2', 'after', [question('10', 1, '导师修改后的新题目')]);
  const entry = { ...newDocumentEntry(before), answers: { '10': 'my preserved text' } };
  const next = acceptSave(entry, { content: 'before' }, after);
  assert.deepEqual(next.answers, {});
  assert.equal(next.orphanAnswers[0].text, 'my preserved text');
  assert.equal(next.orphanAnswers[0].title, '问题 1');
  assert.equal(hasChanges(next), true);
});

test('a changed answer for the submitted question also survives acknowledgement', () => {
  const before = snapshot(), entry = { ...newDocumentEntry(before), answers: { '10': 'revision typed in flight' } };
  const next = acceptSave(entry, { content: before.content, answers: [{ id: '10', text: 'original submitted answer' }] }, snapshot('v2', 'appended'));
  assert.equal(next.answers['10'], 'revision typed in flight');
  assert.equal(next.content, 'appended');
});

test('question forms reject malformed, duplicate, too many, and stale questions without losing source access', () => {
  assert.deepEqual(currentQuestions(snapshot('v1', '', [question('1'), question('1')])), []);
  assert.deepEqual(currentQuestions(snapshot('v1', '', [null])), []);
  assert.deepEqual(currentQuestions(snapshot('v1', '', [1, 2, 3, 4].map(n => question(String(n), n)))), []);
  assert.throws(() => answersToSave({ old: 'saved draft' }, snapshot()), /题目或轮次已变化/);
  assert.throws(() => answersToSave({ '10': '   ' }, snapshot()), /至少一道题/);
  assert.deepEqual(answersToSave({ '10': 'answer', unused: '' }, snapshot()), [{ id: '10', text: 'answer' }]);
});

test('drafts are isolated by workspace/path/version and a previous-version draft is recoverable', () => {
  const store = new MemoryStorage(), entry = { ...newDocumentEntry(snapshot()), content: 'unsaved', answers: { '10': 'also unsaved' } };
  assert.equal(saveDraft(store, 'ws1', '课程/回答.md', entry), true);
  assert.equal(readDraft(store, 'ws2', '课程/回答.md', 'v1'), null);
  assert.equal(readDraft(store, 'ws1', '课程/其他.md', 'v1'), null);
  const recovery = readDraft(store, 'ws1', '课程/回答.md', 'v2');
  assert.equal(recovery.content, 'unsaved'); assert.equal(recovery.outdated, true);
  assert.equal(recovery.answers['10'], 'also unsaved');
});

test('corrupt draft records cannot hide another valid draft; successful save retires only its old version', () => {
  const store = new MemoryStorage();
  store.setItem(draftKey('ws', 'a.md', 'corrupt'), '{not json');
  const entry = { ...newDocumentEntry(snapshot()), content: 'recover me' };
  saveDraft(store, 'ws', 'a.md', entry);
  assert.equal(readDraft(store, 'ws', 'a.md', 'v1').content, 'recover me');
  const saved = newDocumentEntry(snapshot('v2', 'recover me'));
  saveDraft(store, 'ws', 'a.md', saved, 'v1');
  assert.equal(store.getItem(draftKey('ws', 'a.md', 'v1')), null);
  assert.equal(store.getItem(draftKey('ws', 'a.md', 'corrupt')), '{not json');
});

test('storage quota failures preserve the in-memory draft and return a useful failure signal', () => {
  const entry = { ...newDocumentEntry(snapshot()), content: 'keep this' };
  const store = { setItem() { throw Error('quota'); }, removeItem() {} };
  assert.equal(saveDraft(store, 'ws', 'a.md', entry), false);
  assert.equal(entry.content, 'keep this');
});

test('foreground polling replaces clean data, retains all dirty work, and avoids identical-state repaints', () => {
  const clean = newDocumentEntry(snapshot()), changed = snapshot('v2', 'mentor feedback');
  assert.equal(reconcileExternal(clean, snapshot()).entry, clean);
  assert.equal(reconcileExternal(clean, snapshot()).action, 'same');
  assert.equal(reconcileExternal(clean, changed).entry.content, 'mentor feedback');
  const typed = { ...clean, content: 'my unsaved typing', answers: { '10': 'my answer' } };
  assert.equal(reconcileExternal(typed, changed).action, 'retain');
  assert.equal(reconcileExternal(typed, changed).entry, typed);
  assert.equal(reconcileExternal({ ...typed, saving: true }, changed).action, 'busy');
});

test('recovering an old-version draft after an external edit remaps answer ids, preserving unmatched text', () => {
  const before = { ...newDocumentEntry(snapshot('v1', 'old', [question('10'), question('90', 2)])), answers: { '10': 'first', '90': 'second' } };
  const after = newDocumentEntry(snapshot('v2', 'latest', [question('30'), question('230', 2, 'changed question')]));
  const recovered = recoverEntryDraft({ ...after, recovery: { ...draftRecord(before), outdated: true } });
  assert.deepEqual(recovered.answers, { '30': 'first' });
  assert.equal(recovered.orphanAnswers[0].text, 'second');
  assert.equal(recovered.content, 'old');
  assert.equal(recovered.snapshot.version, 'v2');
});

test('current file evidence selects the course, with a valid reading location restored inside it', () => {
  const data = { current: { courseId: 'math', guidePath: '学科/数学/教学.md' }, state: { lastCourseId: 'physics', lastDocumentPath: '学科/数学/第二轮.md', lastView: 'answer' }, courses: [{ id: 'math', directory: '学科/数学', guidePath: '学科/数学/教学.md', rounds: [{ path: '学科/数学/第二轮.md' }] }, { id: 'physics', guidePath: '物理.md' }] };
  assert.deepEqual(initialLocation(data), { courseId: 'math', path: '学科/数学/教学.md', view: 'read', roundId: '' });
  data.state.lastDocumentPath = '../../outside';
  assert.equal(initialLocation(data).path, '学科/数学/教学.md');
});

test('a stale historical round and answer view never displace the recorded current round', () => {
  // Same-file round: current round lives in the teaching entry file as a heading.
  const sameFile = {
    current: { courseId: 'java/17', guidePath: '17/01_教学引导.md', roundId: '17/01_教学引导.md#round=第二轮' },
    courses: [{ id: 'java/17', directory: '17', guidePath: '17/01_教学引导.md', answerPath: '17/01_学生回答.md', currentRoundId: '17/01_教学引导.md#round=第二轮', rounds: [
      { id: '17/01_教学引导.md#round=第一轮', path: '17/01_教学引导.md', title: '第一轮' },
      { id: '17/01_教学引导.md#round=第二轮', path: '17/01_教学引导.md', title: '第二轮' },
      { id: '17/01_教学引导.md#round=第三轮', path: '17/01_教学引导.md', title: '第三轮' },
    ] }],
    state: { lastCourseId: 'java/17', lastDocumentPath: '17/01_教学引导.md#round=第三轮', lastView: 'review' },
  };
  assert.deepEqual(initialLocation(sameFile), { courseId: 'java/17', path: '17/01_教学引导.md', view: 'read', roundId: '17/01_教学引导.md#round=第二轮' });

  // Independent round file: the recorded round file opens instead of last time's document.
  const separateFile = {
    courses: [{ id: 'java/17', directory: '17', guidePath: '17/01_教学引导.md', answerPath: '17/01_学生回答.md', currentRoundId: '17/第3轮_教学引导.md#round=第三轮', rounds: [
      { id: '17/第1轮_教学引导.md', path: '17/第1轮_教学引导.md', title: '第一轮' },
      { id: '17/第2轮_教学引导.md', path: '17/第2轮_教学引导.md', title: '第二轮' },
      { id: '17/第3轮_教学引导.md#round=第三轮', path: '17/第3轮_教学引导.md', title: '第三轮' },
    ] }],
    current: { courseId: 'java/17' },
    state: { lastCourseId: 'java/17', lastDocumentPath: '17/第2轮_教学引导.md', lastView: 'answer' },
  };
  assert.deepEqual(initialLocation(separateFile), { courseId: 'java/17', path: '17/第3轮_教学引导.md', view: 'read', roundId: '17/第3轮_教学引导.md#round=第三轮' });
});

test('without a clear current round learning safely degrades to the teaching entry, never a guessed latest round', () => {
  const data = {
    current: { courseId: 'history', guidePath: '历史/01_教学引导.md', answerPath: '历史/01_学生回答.md' },
    courses: [{ id: 'history', directory: '历史', guidePath: '历史/01_教学引导.md', answerPath: '历史/01_学生回答.md', rounds: [
      { id: '历史/01_教学引导.md#round=第一轮', path: '历史/01_教学引导.md', title: '第一轮' },
      { id: '历史/01_教学引导.md#round=第三轮', path: '历史/01_教学引导.md', title: '第三轮' },
    ] }],
    state: { lastCourseId: 'history', lastDocumentPath: '历史/01_学生回答.md', lastView: 'answer' },
  };
  assert.deepEqual(initialLocation(data), { courseId: 'history', path: '历史/01_教学引导.md', view: 'read', roundId: '' });
  // A current round whose file no longer exists also degrades instead of opening a stale document.
  data.courses[0].currentRoundId = 'gone.md';
  assert.deepEqual(initialLocation(data), { courseId: 'history', path: '历史/01_教学引导.md', view: 'read', roundId: '' });
  assert.deepEqual(courseLocation(data.courses[0]), { path: '历史/01_教学引导.md', view: 'read', roundId: '' });
});

test('courseLocation is the one course-switch rule shared by entering and switching courses', () => {
  const course = { guidePath: '课/01_教学引导.md', currentRoundId: '课/第二轮_教学引导.md', rounds: [{ id: '课/第一轮_教学引导.md', path: '课/第一轮_教学引导.md' }, { id: '课/第二轮_教学引导.md', path: '课/第二轮_教学引导.md' }] };
  assert.deepEqual(courseLocation(course), { path: '课/第二轮_教学引导.md', view: 'read', roundId: '课/第二轮_教学引导.md' });
  assert.deepEqual(courseLocation({ ...course, currentRoundId: undefined }), { path: '课/01_教学引导.md', view: 'read', roundId: '' });
});

test('a root-directory course opens its teaching entry instead of the saved answer view; non-course workspaces still open materials', () => {
  assert.deepEqual(initialLocation({ courses: [{ id: '.', directory: '.', guidePath: '教学.md', answerPath: '回答.md' }], state: { lastCourseId: '.', lastDocumentPath: '回答.md', lastView: 'answer' } }), { courseId: '.', path: '教学.md', view: 'read', roundId: '' });
  const tree = [{ type: 'file', path: '笔记.md', readable: true }];
  assert.deepEqual(initialLocation({ tree }), { courseId: '', path: '笔记.md', view: 'read', roundId: '' });
});

test('async request gates reject stale course/workspace completions and unmount completions', () => {
  const gate = createRequestGate(), first = gate.next(), second = gate.next();
  assert.equal(gate.current(first), false); assert.equal(gate.current(second), true);
  gate.cancel(); assert.equal(gate.current(second), false);
});

test('relative links and images remain within the workspace and reject executable or encoded-absolute paths', () => {
  assert.equal(localDocumentPath('课程/教学.md', '../资料/a%20b.png'), '资料/a b.png');
  assert.equal(localDocumentPath('课程/教学.md', './学生回答.md#第一轮'), '课程/学生回答.md');
  for (const value of ['../../outside.md', '%2fetc/passwd', '//other.host/a.md', 'javascript:alert(1)', 'file:///C:/secret.md', 'C:\\secret.md', '%63%3a/secret', 'data:text/html,hello', 'a.md?token=x', '%00a.md', '%ZZ']) assert.equal(localDocumentPath('课程/教学.md', value), null, value);
});

test('tree flattening ignores unsupported documents, duplicate entries, and cyclic trees', () => {
  const root = { type: 'directory', children: [{ type: 'file', path: 'a.md' }, { type: 'file', path: 'a.md' }, { type: 'file', path: 'x.exe', readable: false }] };
  root.children.push(root);
  assert.deepEqual(flattenFiles(root).map(file => file.path), ['a.md']);
});
