import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTeachingVisual, extractTeachingVisuals } from '../src/teaching-visual.js';
const data = { version: 1, type: 'steps', title: '过程', summary: '示意', items: [{ label: '输入', detail: '原始内容' }, { label: '输出', detail: '处理结果' }] };
const wrap = value => `<!--stg-visual\n${JSON.stringify(value)}\n-->`;
test('complete diagrams survive serialization; incomplete and invalid markers leave text alone', () => {
  assert.deepEqual(extractTeachingVisuals(wrap(data)), [data]);
  for (let i = 0; i < wrap(data).length; i++) assert.deepEqual(extractTeachingVisuals(wrap(data).slice(0, i)), []);
  assert.deepEqual(extractTeachingVisuals('<!--stg-visual\n{bad}\n-->'), []);
  assert.deepEqual(extractTeachingVisuals(`prefix ${wrap(data)}`), []);
  assert.deepEqual(extractTeachingVisuals('```html\n' + wrap(data) + '\n```'), []);
  assert.equal(extractTeachingVisuals('```html\nexample\n```\n' + wrap(data)).length, 1);
});
test('diagram schema rejects missing explanations, invalid numeric scales and unbounded payloads', () => {
  assert.equal(validateTeachingVisual({ ...data, type: 'html' }), null);
  assert.equal(validateTeachingVisual({ ...data, items: Array(13).fill(data.items[0]) }), null);
  for (const value of [-1, Infinity, NaN, '1']) assert.equal(validateTeachingVisual({ ...data, type: 'bars', unit: '个', source: '示意数据', items: data.items.map(item => ({ ...item, value })) }), null);
  assert.equal(validateTeachingVisual({ ...data, summary: '' }), null);
  assert.deepEqual(extractTeachingVisuals('x'.repeat(200001) + wrap(data)), []);
});
test('unrecognized executable fields are discarded; numbers and labels remain plain data', () => {
  const input = { ...data, onClick: 'fetch("https://invalid.example")', items: data.items.map(item => ({ ...item, html: '<script>alert(1)</script>' })) };
  assert.deepEqual(validateTeachingVisual(input), data);
  assert.equal(extractTeachingVisuals(Array(5).fill(wrap(data)).join('\n')).length, 3);
});
