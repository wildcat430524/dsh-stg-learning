import assert from 'node:assert/strict';
import test from 'node:test';
import { editorSync, shouldAttemptMount } from '../src/editor/editor-sync.js';

const current = { path: '课程/教学.md', workspaceId: 'ws', source: '# 原文', editable: true };

test('an unchanged document reuses the live editor instance instead of remounting', () => {
  assert.equal(editorSync(current, { path: '课程/教学.md', workspaceId: 'ws', content: '# 原文', readOnly: false }), 'none');
});

test('typing is acknowledged before React re-renders, so the edited source is treated as the same instance', () => {
  const typed = '# 原文\n\n新增一行';
  const live = { ...current, source: typed, editor: {} };
  assert.equal(editorSync(live, { path: '课程/教学.md', workspaceId: 'ws', content: typed, readOnly: false }), 'none');
});

test('a clean refresh/draft recovery with different bytes re-parses instead of patching rendered DOM', () => {
  assert.equal(editorSync(current, { path: '课程/教学.md', workspaceId: 'ws', content: '# 导师更新', readOnly: false }), 'remount');
});

test('a different document, workspace or mount request always remounts even for identical content', () => {
  assert.equal(editorSync(current, { path: '课程/回答.md', workspaceId: 'ws', content: '# 原文' }), 'mount');
  assert.equal(editorSync(current, { path: '课程/教学.md', workspaceId: 'other', content: '# 原文' }), 'mount');
  assert.equal(editorSync(null, { path: '课程/教学.md', workspaceId: 'ws', content: '# 原文' }), 'mount');
});

test('only the read-only flag changes without destroying the editor', () => {
  assert.equal(editorSync(current, { path: '课程/教学.md', workspaceId: 'ws', content: '# 原文', readOnly: true }), 'editable');
  assert.equal(editorSync({ ...current, editable: false }, { path: '课程/教学.md', workspaceId: 'ws', content: '# 原文', readOnly: false }), 'editable');
});

test('a failed parse is not retried for every keystroke in the safe source route', () => {
  const failed = { path: '课程/教学.md', workspaceId: 'ws' };
  assert.equal(shouldAttemptMount(failed, { path: '课程/教学.md', workspaceId: 'ws' }), false);
  assert.equal(shouldAttemptMount(failed, { path: '课程/回答.md', workspaceId: 'ws' }), true);
  assert.equal(shouldAttemptMount(failed, { path: '课程/教学.md', workspaceId: 'other' }), true);
  assert.equal(shouldAttemptMount(null, { path: '课程/教学.md', workspaceId: 'ws' }), true);
});
