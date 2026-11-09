import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMentorDraft, STG_PERSONA } from '../src/native-protocol.js';

test('local teacher questions send only a bounded quote and source locator', () => {
  const draft = buildMentorDraft({ intent: 'quick', course: { title: 'Java' }, document: { path: '课程/第三轮.md', content: 'DO_NOT_COPY_THE_ENTIRE_DOCUMENT'.repeat(10000) }, round: '第三轮', selection: '为什么没有执行？' });
  assert.match(draft, /为什么没有执行/); assert.match(draft, /课程\/第三轮.md/);
  assert.match(STG_PERSONA, /普通追问沿用本会话/); assert.doesNotMatch(draft, /DO_NOT_COPY/);
  assert.ok(draft.length < 300);
  const long = buildMentorDraft({ intent: 'quick', selection: '字'.repeat(10000) });
  assert.ok(long.length < 2700); assert.match(long, /选段较长/);
});
test('adding a quote leaves room for a natural follow-up without homework instructions', () => {
  const draft = buildMentorDraft({ intent: 'quote', selection: '第一行\n第二行' });
  assert.match(draft, /> 第一行\n> 第二行/); assert.match(draft, /我的问题：$/);
  assert.doesNotMatch(draft, /三维|掌握|全轮|重新读取回答文件/);
});
