import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { studyMarkers } from '../src/workbench/study-markers.js';
const md = new MarkdownIt({ html: false }).use(studyMarkers);

test('reading hides only standalone STG bookkeeping without losing the teaching content', () => {
  const source = '# 教学\n\n<!-- s2g-goal-view:start -->\n\n目标原文。\n\n<!-- s2g-goal-view:end -->';
  const rendered = md.render(source);
  assert.match(rendered, /目标原文/); assert.doesNotMatch(rendered, /s2g-goal-view/);
  assert.match(source, /s2g-goal-view:start/);
});
test('fenced code examples retain the literal marker', () => {
  assert.match(md.render('```html\n<!-- s2g-goal-view:start -->\n```'), /&lt;!-- s2g-goal-view:start --&gt;/);
});
test('inline code examples retain the literal marker', () => {
  assert.match(md.render('`<!-- s2g-goal-view:start -->`'), /<code>&lt;!-- s2g-goal-view:start --&gt;<\/code>/);
});
test('indented code remains visible', () => {
  assert.match(md.render('    <!-- s2g-goal-view:end -->'), /&lt;!-- s2g-goal-view:end --&gt;/);
});
test('ordinary comments and raw HTML are still escaped, never enabled', () => {
  assert.match(md.render('<!-- note -->'), /&lt;!-- note --&gt;/);
  assert.match(md.render('<script>alert(1)</script>'), /&lt;script&gt;/);
});
test('mixed-content lines are not removed and adjacent paragraphs survive', () => {
  assert.match(md.render('<!-- s2g-goal-view:start --> important'), /important/);
  assert.match(md.render('before\n<!-- s2g-goal-view:end -->\nafter'), /before[\s\S]*after/);
});
