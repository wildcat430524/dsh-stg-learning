import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningEntryPolicy } from '../src/learning-layout.js';

test('opening learning closes an expanded host sidebar once', () => {
  const policy = createLearningEntryPolicy();
  assert.equal(policy(null, true), false);
  assert.equal(policy('stg-learning', true), true);
  assert.equal(policy('stg-learning', false), false);
});
test('an already collapsed sidebar is never toggled open on learning entry', () => {
  assert.equal(createLearningEntryPolicy()('stg-learning', false), false);
});
test('manual reopening while studying is respected until the next entry', () => {
  const policy = createLearningEntryPolicy();
  assert.equal(policy('stg-learning', true), true);
  assert.equal(policy('stg-learning', false), false);
  assert.equal(policy('stg-learning', true), false);
  assert.equal(policy(null, true), false);
  assert.equal(policy('stg-learning', true), true);
});
test('other panels never trigger learning sidebar behavior', () => {
  const policy = createLearningEntryPolicy();
  for (const id of ['plugins', null, 'stg-learning-sessions', 'other']) assert.equal(policy(id, true), false);
});
test('a closing animation with stale wide=true must not reopen an already collapsed rail', () => {
  const policy = createLearningEntryPolicy();
  assert.equal(policy(null, true, true), false);
  assert.equal(policy('stg-learning', true, true), false);
  assert.equal(policy('stg-learning', true, false), false);
});

test('returning from learning to chat opens the sidebar once without fighting later manual closure', () => {
  const policy = createLearningEntryPolicy();
  policy('stg-learning', false, true);
  assert.equal(policy(null, false, true), true);
  assert.equal(policy(null, true, false), false);
  assert.equal(policy(null, false, true), false);
});

test('return to chat never closes an expanded sidebar and accepts a stale wide flag', () => {
  const open = createLearningEntryPolicy();open('stg-learning', true, false);
  assert.equal(open(null, true, false), false);
  const collapsed = createLearningEntryPolicy();collapsed('stg-learning', false, true);
  assert.equal(collapsed(null, true, true), true);
});

test('learning session management also restores chat navigation, other panels do not', () => {
  const policy = createLearningEntryPolicy();policy('stg-learning-sessions', false, true);
  assert.equal(policy(null, false, true), true);
  policy('plugins', false, true);
  assert.equal(policy(null, false, true), false);
});
