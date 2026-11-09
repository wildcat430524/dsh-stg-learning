import test from 'node:test';
import assert from 'node:assert/strict';
import { teachingChoices, progressExcerpt } from '../src/workbench/lesson-navigation.js';

test('teaching menu keeps recorded same-file rounds and folds only the teaching entry pseudo-round', () => {
  const course = { guidePath: '课/01_教学引导.md', rounds: [{ id: '课/01_教学引导.md', path: '课/01_教学引导.md' }, { id: '课/01_教学引导.md#round=第二轮', path: '课/01_教学引导.md', title: '第二轮' }, { id: 'third', path: '课/第三轮_教学引导.md', title: '第三轮' }] };
  assert.deepEqual(teachingChoices(course).map(row => row.id), ['课/01_教学引导.md#round=第二轮', 'third']);
});
test('a same-file round recorded from a heading stays selectable and checkable', () => {
  const single = { guidePath: '课/第三轮_教学引导.md', currentRoundId: '课/第三轮_教学引导.md', rounds: [{ id: '课/第三轮_教学引导.md', path: '课/第三轮_教学引导.md', title: '第三轮' }] };
  assert.equal(teachingChoices(single)[0]?.id, single.currentRoundId, 'a real current round must not disappear when it is also the guide');
  const course = { guidePath: '课/01_教学引导.md', currentRoundId: '课/01_教学引导.md#round=第二轮', rounds: [{ id: '课/01_教学引导.md#round=第一轮', path: '课/01_教学引导.md', title: '第一轮' }, { id: '课/01_教学引导.md#round=第二轮', path: '课/01_教学引导.md', title: '第二轮' }] };
  assert.deepEqual(teachingChoices(course).map(row => row.id), ['课/01_教学引导.md#round=第一轮', '课/01_教学引导.md#round=第二轮']);
  // Historical rounds and the teaching entry stay available; nothing is disabled.
  const multi = { guidePath: '课/01_教学引导.md', rounds: [
    { id: '课/第三轮_教学引导.md', path: '课/第三轮_教学引导.md', title: '第三轮' },
    { id: '课/第二轮_教学引导.md', path: '课/第二轮_教学引导.md', title: '第二轮' },
    { id: '课/第一轮_教学引导.md', path: '课/第一轮_教学引导.md', title: '第一轮' },
  ] };
  assert.deepEqual(teachingChoices(multi).map(row => row.id), ['课/第三轮_教学引导.md', '课/第二轮_教学引导.md', '课/第一轮_教学引导.md']);
});
test('teaching choices ignore invalid and duplicate identities without inventing a round', () => {
  assert.deepEqual(teachingChoices(null), []);
  assert.deepEqual(teachingChoices({ rounds: [{ id: 'a', path: 'a.md' }, { id: 'a', path: 'a.md' }, { id: 'bad' }] }).map(row => row.id), ['a']);
});
test('chapter evidence displays only original handoff section and nested content', () => {
  const source = '# 档案\n\n## 🚦 当前交接状态\n\n待作答。\n\n### 下一步\n\n继续本轮。\n\n## 📊 掌握表\n\n未评估。';
  const chapter = progressExcerpt(source, 'chapter');
  assert.match(chapter, /待作答/); assert.match(chapter, /继续本轮/); assert.doesNotMatch(chapter, /掌握表|未评估/);
  const overall = progressExcerpt(source, 'overall'); assert.match(overall, /未评估/); assert.doesNotMatch(overall, /待作答/);
});
test('fenced headings, comments and quoted examples are never treated as progress records', () => {
  const source = '# 档案\n\n```markdown\n## 🚦 当前交接状态\nfake\n```\n\n> ## 📊 掌握表\n> fake\n\n<!--\n## 📊 掌握表\nfake\n-->\n';
  assert.equal(progressExcerpt(source, 'chapter'), ''); assert.equal(progressExcerpt(source, 'overall'), '');
});
test('empty progress stays empty and overlapping sections are not duplicated', () => {
  assert.equal(progressExcerpt('', 'chapter'), ''); assert.equal(progressExcerpt(null, 'overall'), '');
  assert.equal(progressExcerpt('## 📊 掌握表\n\n### 知识掌握\n\n唯一证据。', 'overall').split('唯一证据').length - 1, 1);
});
