import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckRunner } from '../src/workbench/model.js';
import { floatReserve, panelGeometry, FLOAT_READING_MIN } from '../src/workbench/teacher-geometry.js';
import { maskTeachingVisualText, VISUAL_PENDING_TEXT } from '../src/teaching-visual.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('a manual check during a background check is queued and runs once afterwards', async () => {
  const calls = [], gates = [];
  const run = createCheckRunner(options => { calls.push(options); const gate = deferred(); gates.push(gate); return gate.promise; });
  const background = run({ quiet: true });
  await Promise.resolve();
  const manual = run({ quiet: false });
  const secondManual = run({ quiet: false });
  assert.equal(manual, secondManual, 'repeated clicks coalesce into one follow-up');
  assert.equal(run({ quiet: true }) === manual, false);
  await Promise.resolve();
  assert.deepEqual(calls, [{ quiet: true }], 'the follow-up waits for the running check');
  gates[0].resolve();
  await background;
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls, [{ quiet: true }, { quiet: false }]);
  gates[1].resolve();
  await manual;
});

test('background checks during a running check are dropped, never stacked', async () => {
  let count = 0; const gate = deferred();
  const run = createCheckRunner(() => { count++; return gate.promise; });
  const first = run({ quiet: true });
  await Promise.resolve();
  assert.equal(run({ quiet: true }), first);
  gate.resolve(); await first; await new Promise(r => setTimeout(r, 0));
  assert.equal(count, 1);
});

test('a failing check does not block the next one', async () => {
  let count = 0;
  const run = createCheckRunner(() => { count++; if (count === 1) throw Error('disk'); });
  await assert.rejects(run({}), /disk/);
  await run({});
  assert.equal(count, 2);
});

test('the floating teacher reserves reading space only at its default right-side position', () => {
  const width = 1568, panel = panelGeometry({ layout: 'float', width, height: 896 });
  const reserve = floatReserve(panel, { x: 0, y: 0 }, width);
  assert.ok(reserve >= panel.panelWidth + 16, `reserve ${reserve} covers the panel and its gutter`);
  assert.ok(width - reserve >= FLOAT_READING_MIN);
  assert.equal(floatReserve(panel, { x: -900, y: 0 }, width), 0, 'dragged to the left half: no reserve');
  assert.equal(floatReserve(panelGeometry({ layout: 'split', width, height: 896 }), { x: 0, y: 0 }, width), 0, 'docked uses its own column');
  assert.equal(floatReserve(panelGeometry({ layout: 'float', width: 600, height: 896 }), { x: 0, y: 0 }, 600), 0, 'narrow bottom sheet');
  const tight = panelGeometry({ layout: 'float', width: 950, height: 896, floatingSize: { width: 420, height: 560 } });
  assert.equal(floatReserve(tight, { x: 0, y: 0 }, 950), 0, 'too little reading width remains: keep the full surface');
});

const visual = { version: 1, type: 'steps', title: '过程', summary: '示意', items: [{ label: '输入', detail: '原始' }, { label: '输出', detail: '结果' }] };
const marker = `<!--stg-visual\n${JSON.stringify(visual)}\n-->`;
test('streaming text hides unfinished and finished diagram markers but keeps invalid ones readable', () => {
  assert.equal(maskTeachingVisualText('普通回答'), '普通回答');
  for (let i = '<!--stg-visual'.length; i < marker.length; i++) {
    assert.equal(maskTeachingVisualText(`讲解。\n${marker.slice(0, i)}`), `讲解。\n${VISUAL_PENDING_TEXT}`, `partial length ${i}`);
  }
  assert.equal(maskTeachingVisualText(`讲解。\n${marker}\n后文`), '讲解。\n\n后文');
  const invalid = '<!--stg-visual\n{bad}\n-->';
  assert.equal(maskTeachingVisualText(`a ${invalid} b`), `a ${invalid} b`);
  assert.equal(maskTeachingVisualText(`${marker}${marker.slice(0, 30)}`), VISUAL_PENDING_TEXT);
});
