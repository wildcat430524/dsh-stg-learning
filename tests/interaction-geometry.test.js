import test from 'node:test';
import assert from 'node:assert/strict';
import { readSelection, rangeConnected, rangeVisibleIn, virtualAnchor } from '../src/workbench/selection-anchor.js';
import { clampPanelOffset, panelGeometry, WIDE_MIN_WIDTH, readTeacherLayout, readTeacherSize, resizePanel, LAYOUT_KEY } from '../src/workbench/teacher-geometry.js';

function node(type, parent = null) { const item = { nodeType: type, parentElement: parent }; if (parent) parent.children = [...(parent.children || []), item]; return item; }
function rect(x, y, width, height) { return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height }; }

test('a selection is only accepted when both anchors live in the reading surface', () => {
  const root = node(1), inside = node(3, root), outside = node(3, node(1));
  root.contains = candidate => candidate === root || candidate === inside;
  const range = { collapsed: false, startContainer: inside, startOffset: 0, endOffset: 5, cloneRange() { return { ...this, cloned: true }; } };
  const make = (anchorNode, focusNode, text = '变量名') => ({ rangeCount: 1, isCollapsed: false, anchorNode, focusNode, getRangeAt: () => range, toString: () => text });
  assert.equal(readSelection(make(inside, inside), root)?.text, '变量名');
  assert.equal(readSelection(make(outside, inside), root), null, 'an outside anchor must be ignored, not clamped');
  assert.equal(readSelection(make(inside, outside), root), null);
  assert.equal(readSelection(make(inside, inside, '   '), root), null, 'whitespace-only selections never open a toolbar');
  assert.equal(readSelection({ rangeCount: 1, isCollapsed: true, anchorNode: inside, focusNode: inside }, root), null);
  assert.equal(readSelection(make(inside, inside), { contains: () => true })?.range.cloned, true, 'a clone keeps the anchor stable after the live selection collapses');
});

test('the virtual anchor exposes the range rectangle and per-line rects', () => {
  const context = node(1);
  const range = { startContainer: node(3, context), getBoundingClientRect: () => rect(20, 100, 300, 40), getClientRects: () => [rect(20, 100, 300, 20), rect(20, 120, 140, 20)] };
  const anchor = virtualAnchor(range, context);
  assert.equal(anchor.contextElement, context);
  assert.deepEqual(anchor.getBoundingClientRect(), rect(20, 100, 300, 40));
  assert.equal(anchor.getClientRects().length, 2, 'multi-line selections must keep every line for inline placement');
  assert.equal(rangeConnected(range), true);
});

test('a selection is hidden only once every line has left the reading viewport', () => {
  const viewport = rect(0, 100, 800, 600);
  assert.equal(rangeVisibleIn([rect(10, 300, 200, 20)], viewport), true);
  assert.equal(rangeVisibleIn([rect(10, 90, 200, 20)], viewport), true, 'partially visible lines keep the toolbar');
  assert.equal(rangeVisibleIn([rect(10, 60, 200, 20), rect(10, 720, 200, 20)], viewport), false, 'fully scrolled out lines hide it');
  assert.equal(rangeVisibleIn([], viewport), false);
  assert.equal(rangeVisibleIn({ 0: rect(10, 300, 200, 20), length: 1 }, viewport), true, 'DOMRectList is array-like, not an Array');
  assert.equal(rangeVisibleIn(null, null), true, 'without a measured viewport the toolbar is not suppressed');
});

test('only the sidebar reserves reading width; floating content fills the frame', () => {
  const floating = panelGeometry({ layout: 'float', width: 1440, height: 900 });
  assert.equal(floating.narrow, false);
  assert.equal(floating.panelWidth, 420);
  assert.equal(floating.left, 1440 - 16 - 420);
  assert.equal(floating.panelHeight, 560);
  assert.equal(floating.readingWidth, 1440);
  const compact = panelGeometry({ layout: 'float', width: 1000, height: 900 });
  assert.equal(compact.panelWidth, 420);
  const split = panelGeometry({ layout: 'split', width: 1440, height: 900 });
  assert.equal(split.left, 1440 - split.panelWidth);
  assert.equal(split.top, 0);
  assert.equal(split.panelHeight, 900);
  assert.equal(split.readingWidth + split.panelWidth, 1440, 'no unused gutter between the reader and sidebar');
  assert.deepEqual(panelGeometry({ width: 1440, height: 900 }), split);
  const narrow = panelGeometry({ layout: 'float', width: WIDE_MIN_WIDTH - 1, height: 900 });
  assert.equal(narrow.narrow, true, 'below the wide boundary both layouts are the bottom sheet');
  assert.deepEqual(narrow, panelGeometry({ layout: 'split', width: WIDE_MIN_WIDTH - 1, height: 900 }));
});

test('upgraded layout defaults to sidebar independently of old preferences', () => {
  assert.equal(readTeacherLayout({ getItem: key => key === 'stg-teacher.layout.v1' ? 'float' : null }), 'split');
  assert.equal(readTeacherLayout({ getItem: key => key === LAYOUT_KEY ? 'float' : null }), 'float');
  assert.equal(readTeacherLayout({ getItem() { throw Error('blocked'); } }), 'split');
  assert.deepEqual(readTeacherSize({ getItem: () => '{bad' }), { width: 420, height: 560 });
  assert.deepEqual(readTeacherSize({ getItem: () => '{"width":-20,"height":"9999"}' }), { width: 420, height: 560 });
});

test('resize clamps to minimum size and frame while keeping the opposite edge fixed', () => {
  const rect = { left: 600, top: 40, width: 420, height: 560 }, frame = { width: 1200, height: 800 };
  const small = resizePanel(rect, 'se', -500, -500, frame);
  assert.deepEqual(small, { left: 600, top: 40, width: 360, height: 380 });
  const large = resizePanel(rect, 'nw', -9999, -9999, frame);
  assert.equal(large.left, 8); assert.equal(large.top, 8);
  assert.equal(large.left + large.width, rect.left + rect.width);
  assert.equal(large.top + large.height, rect.top + rect.height);
  const edge = resizePanel(rect, 'se', 9999, 9999, frame);
  assert.equal(edge.left + edge.width, frame.width - 8);
  assert.equal(edge.top + edge.height, frame.height - 8);
});

test('stored oversized floats are bounded by a smaller viewport without shrinking text', () => {
  const p = panelGeometry({ layout: 'float', width: 1000, height: 340, floatingSize: { width: 99999, height: 99999 } });
  assert.ok(p.panelWidth < 1000 && p.panelHeight < 340);
  const offset = clampPanelOffset({ x: 500, y: 500 }, p, { width: 1000, height: 340 });
  assert.ok(p.left + offset.x >= 8 && p.top + offset.y >= 8);
  assert.ok(p.left + offset.x + p.panelWidth <= 992 && p.top + offset.y + p.panelHeight <= 332);
});

test('dragging is clamped to the visible frame for both layouts', () => {
  const frame = { width: 1200, height: 800 }, panel = panelGeometry({ layout: 'float', width: 1200, height: 800 });
  assert.deepEqual(clampPanelOffset({ x: 0, y: 0 }, panel, frame), { x: 0, y: 0 });
  const pushed = clampPanelOffset({ x: 9999, y: 9999 }, panel, frame);
  assert.equal(panel.left + panel.panelWidth + pushed.x, frame.width - 8);
  assert.equal(panel.top + panel.panelHeight + pushed.y, frame.height - 8);
  const back = clampPanelOffset({ x: -9999, y: -9999 }, panel, frame);
  assert.equal(panel.left + back.x, 8); assert.equal(panel.top + back.y, 8);
  assert.deepEqual(clampPanelOffset({ x: 400, y: 200 }, panelGeometry({ layout: 'split', width: 400 }), frame), { x: 0, y: 0 }, 'the bottom sheet never carries a drag offset');
});
