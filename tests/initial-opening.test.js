import test from 'node:test';
import assert from 'node:assert/strict';
import { insertMentorDraft } from '../src/native-protocol.js';
import { validateLearningName } from '../src/learning-name.js';
import { createMentorDraftMailbox } from '../src/mentor-drafts.js';

function composer() {
  const input = { phase: 'plain', draft: '' };
  let writes = 0, saves = 0, available = true;
  const actions = {
    captureInsertion: () => ({ start: 0, end: input.draft.length }),
    insertText(text) { if (!available) return false; input.draft += text; writes++; return true; },
    persistDraft() { saves++; },
  };
  return { input, actions, counts: () => ({ writes, saves }), unavailable: () => { available = false; }, ready: () => { available = true; } };
}

test('same unsent opening and user edits survive repeated navigation or a fresh consumer', () => {
  const c = composer(), opening = { initialization: true };
  assert.equal(insertMentorDraft(c.actions, c.input, '我想学数学', opening), true);
  assert.equal(insertMentorDraft(c.actions, c.input, '我想学数学', opening), 'preserved');
  c.input.draft = '我改主意了，先学统计。';
  assert.equal(insertMentorDraft(c.actions, { ...c.input }, '我想学数学', opening), 'preserved');
  assert.equal(c.input.draft, '我改主意了，先学统计。');
  assert.equal(c.counts().writes, 1);
});

test('sent conversation resumes without repeating its opening; normal questions still append', () => {
  const c = composer();
  assert.equal(insertMentorDraft(c.actions, c.input, '开场', { initialization: true, started: true }), 'resumed');
  assert.equal(c.input.draft, '');
  assert.equal(insertMentorDraft(c.actions, c.input, '再解释一下'), true);
  assert.equal(insertMentorDraft(c.actions, c.input, '举个例子'), true);
  assert.equal(c.input.draft, '再解释一下\n\n举个例子');
});

test('readiness failure can retry; a deleted unsent draft can be prepared again', () => {
  const c = composer(), opening = { initialization: true };
  c.unavailable(); assert.equal(insertMentorDraft(c.actions, c.input, '开场', opening), false);
  c.ready(); assert.equal(insertMentorDraft(c.actions, c.input, '开场', opening), true);
  c.input.draft = ''; assert.equal(insertMentorDraft(c.actions, c.input, '新的目标', opening), true);
  assert.equal(c.input.draft, '新的目标');
});

test('opening never claims insertion when existing input was kept; mailbox reports actual action', async () => {
  const mailbox = createMentorDraftMailbox();
  const request = mailbox.enqueue('session', 'opening', { intent: 'initialize' });
  assert.equal(mailbox.getSnapshot().pending.get('session').intent, 'initialize');
  mailbox.complete('session', request.id, '已保留你输入的内容');
  await request.ready;
  assert.equal(mailbox.getSnapshot().notices.get('session').message, '已保留你输入的内容');
  mailbox.dispose();
});

test('shared name validation explains leading dots and accepts ordinary Chinese names', () => {
  assert.match(validateLearningName('.学习'), /句点.*开头/);
  for (const name of ['CON.txt', 'nul', '../x', 'x/y', 'x\\y', 'x:ads', ' 学习', '学习 ', '课程.', 'vendor']) assert.ok(validateLearningName(name), name);
  for (const name of ['从零学 Python', '数学.入门', '2026 学习']) assert.equal(validateLearningName(name), '', name);
});
