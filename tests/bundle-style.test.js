import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { workbenchCSS } from '../src/workbench/style.js';
import { experienceCSS } from '../src/workbench/experience-style.js';
import { css as panelCSS } from '../src/style.js';

const bundleText = () => fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

test('distributed native bundle mounts and cleans up the editor CSS before applying the client', () => {
  let registration;
  const sandbox = { window: { __ModuleLoader__: { load: item => { registration = item; } } } };
  vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
  const plugin = registration.factory(createRequire(import.meta.url));
  const attached = [], stop = new Error('stop before host-specific registration');
  sandbox.document = { createElement: () => ({ dataset: {}, remove() { this.removed = true; } }), head: { append: style => attached.push(style) } };
  let cleanup;
  assert.throws(() => plugin.apply({ effect(callback, label) {
    assert.equal(label, 'stg-editor: scoped CSS', 'The exported apply must execute the stylesheet wrapper');
    cleanup = callback(); throw stop;
  } }), error => error === stop);
  assert.equal(attached.length, 1);
  assert.equal(attached[0].dataset.plugin, 'stg-editor');
  const css = attached[0].textContent;
  assert.match(css, /\.stgw-rich.*\.visual-document/);
  assert.match(css, /\.edh-code-tools/);
  // The distributed stylesheet is the one that actually paints the editable
  // reading body and in-place code panel. esbuild pretty-prints it, so match
  // whitespace between declarations; a packaging regression fails here rather
  // than only being noticed in a live desktop screenshot.
  assert.match(css, /\.stgw-rich \.visual-document \{[^}]*font-size: 16px/);
  assert.match(css, /\.stgw-rich \.visual-document h2 \{[^}]*font-weight: 600/);
  assert.match(css, /\.edh-code-tools \+ pre \{[^}]*border-radius: 0 0 12px 12px/);
  assert.match(css, /\.stgw-rich \.edh-code-tools \{[^}]*border-radius: 12px 12px 0 0/);
  cleanup(); assert.equal(attached[0].removed, true);
});

test('reader tokens paint a warm paper column on the neutral canvas instead of a full grey reading background', () => {
  // The canvas and the sheet are separate surfaces: the scroll area carries the
  // barely-tinted canvas, the document column carries warm paper.
  assert.match(experienceCSS, /--stgw-paper:#f7f6f2;--stgw-canvas:#f0efeb/);
  assert.match(experienceCSS, /\.stgw-root \.stgw-scroll\{background:var\(--stgw-canvas\)/);
  assert.match(experienceCSS, /\.stgw-root \.stgw-content,\.stgw-root \.stgw-progress-page\{[^}]*background:var\(--stgw-paper\)/);
  assert.match(experienceCSS, /--stgw-font:"Segoe UI Variable Text","Microsoft YaHei","PingFang SC","Microsoft YaHei UI"/);
  assert.match(experienceCSS, /html\[data-theme=dark\][^{]*\{[^}]*--stgw-paper:#1b1f26/);
  // Workbench markdown (answer/review) keeps the same paper, heading weight and
  // 12px code surfaces as the editable body.
  assert.match(workbenchCSS, /\.stgw-markdown h2\{font-size:24px;[^}]*font-weight:600/);
  assert.match(workbenchCSS, /\.stgw-markdown pre\{[^}]*font-size:14px;line-height:1\.75/);
  assert.match(workbenchCSS, /\.stgw-scroll\{[^}]*background:var\(--stgw-canvas\)/);
});

test('the archive confirmation ships its own rules wherever it can be opened', () => {
  // A dialog that renders unstyled is a functional defect, not a cosmetic one.
  // Both surfaces live in the distributed bundle, so assert on the shipped file
  // rather than on the source module: the regression was a missing injection.
  const bundle = bundleText();
  const rules = css => [...bundle.matchAll(new RegExp(css, 'g'))].length;
  assert.ok(rules('\\.stga-backdrop\\{position:absolute') > 0, 'the dialog backdrop rule must ship');
  assert.ok(rules('\\.stga-dialog\\{') > 0, 'the dialog box rule must ship');
  assert.ok(rules('\\.stga-actions button\\.stga-confirm\\{') > 0, 'the confirm button rule must ship');
  // The teacher surface combines its two stylesheets at apply time; assert both
  // the rule text and the concatenation that puts them in one <style> element.
  assert.match(bundle, /NATIVE_CSS|stg-learning-native/);
  assert.ok(bundle.includes('stga-backdrop'), 'the dialog CSS must reach the bundle');
});

test('the session manager paints its recoverable archive shelf', () => {
  // "移出" must never read as a permanent delete: the page shows the archived
  // set and a restore action right beneath the live list.
  assert.match(panelCSS, /\.stgl-page button\.stgl-archive\{/);
  assert.match(panelCSS, /\.stgl-archived-toggle\{/);
  assert.match(panelCSS, /\.stgl-archived-list li>button\{/);
  assert.match(panelCSS, /\.stgl-notice-error\{/);
  const bundle = bundleText();
  assert.ok(bundle.includes('stgl-archived-list'), 'the archive shelf must be part of the built client');
});
