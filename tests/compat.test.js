import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import semver from 'semver';
import { DSH_ENGINE_RANGE, VERIFIED_DSH_VERSIONS, draftUnavailable, inspectInputCapabilities, persistStagedDraft } from '../src/compat.js';
import { insertMentorDraft } from '../src/native-protocol.js';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('engines.dsh exactly matches the verified host list and admits prereleases', () => {
  assert.equal(manifest.engines.dsh, DSH_ENGINE_RANGE);
  for (const version of VERIFIED_DSH_VERSIONS) {
    assert.equal(semver.satisfies(version, manifest.engines.dsh, { includePrerelease: true }), true, `${version} must be accepted`);
  }
  // The host evaluates ranges with includePrerelease, so an unlisted
  // prerelease must stay outside the claim instead of being swept in by a
  // caret/`>=` range.
  for (const version of ['0.2.0-alpha.1', '0.2.0-rc.1', '0.2.0-rc.2', '0.2.1-alpha.5', '0.2.1-rc.6', '0.2.1', '0.2.2-rc.2', '0.1.7-rc.2', '0.3.0']) {
    assert.equal(semver.satisfies(version, manifest.engines.dsh, { includePrerelease: true }), false, `${version} must not be claimed`);
  }
});

test('verified versions are unique, sorted, and each has its own exact token', () => {
  assert.equal(new Set(VERIFIED_DSH_VERSIONS).size, VERIFIED_DSH_VERSIONS.length);
  assert.deepEqual([...VERIFIED_DSH_VERSIONS], [...VERIFIED_DSH_VERSIONS].sort(semver.compare));
  // Adjacent claims must not collapse into a range token such as `^0.2.1`.
  assert.doesNotMatch(DSH_ENGINE_RANGE, /\^|>=|<=|~|[^-]\*/, 'range must list exact versions');
});

test('composer capabilities separate 0.2.0 host-managed drafts from missing insertion', () => {
  const legacy = { captureInsertion: () => ({ start: 0, end: 0 }), insertText: () => true, setDraft: () => {}, submit: () => {} };
  assert.deepEqual(inspectInputCapabilities(legacy), { ok: true, missing: [], persist: 'host-managed' });
  const modern = { ...legacy, persistDraft() {} };
  assert.deepEqual(inspectInputCapabilities(modern), { ok: true, missing: [], persist: 'explicit' });
  assert.deepEqual(inspectInputCapabilities(undefined), { ok: false, missing: ['captureInsertion', 'insertText'], persist: 'host-managed' });
  assert.deepEqual(inspectInputCapabilities({ captureInsertion() {} }), { ok: false, missing: ['insertText'], persist: 'host-managed' });
  const error = draftUnavailable(inspectInputCapabilities({}));
  assert.equal(error.code, 'DRAFT_UNAVAILABLE');
  assert.match(error.message, /缺少原生输入框插入能力（captureInsertion、insertText）/);
});

test('staged draft persists through the explicit hook and defers to the host otherwise', () => {
  const calls = [];
  const modern = { captureInsertion: () => ({}), insertText: () => true, persistDraft: () => calls.push('persist') };
  assert.equal(persistStagedDraft(modern), 'persisted');
  assert.deepEqual(calls, ['persist']);
  const legacy = { captureInsertion: () => ({}), insertText: () => true };
  assert.equal(persistStagedDraft(legacy), 'host-managed');
  assert.deepEqual(calls, ['persist']);
  assert.throws(() => persistStagedDraft({}), { code: 'DRAFT_UNAVAILABLE' });
});

test('0.2.0-style composer stages a mentor draft without a persistDraft hook', () => {
  const seen = [];
  const actions = {
    captureInsertion: () => ({ start: 3, end: 3, draftRev: 4 }),
    insertText: (text, span) => { seen.push({ text, span }); return true; },
  };
  assert.equal(insertMentorDraft(actions, { draft: 'keep me', phase: 'plain' }, 'assessment'), true);
  // The existing draft is kept and the request is appended after it.
  assert.equal(seen.length, 1);
  assert.equal(seen[0].text, '\n\nassessment');
  assert.equal(seen[0].span.start, 3);
  assert.equal(seen[0].span.draftRev, 4);
});

test('a composer without insertion verbs reports a permanent, actionable failure', () => {
  let inserted = 0;
  const actions = { insertText: () => { inserted++; return true; } };
  assert.throws(() => insertMentorDraft(actions, { phase: 'plain' }, 'request'), error => error.code === 'DRAFT_UNAVAILABLE' && /手动输入问题/.test(error.message));
  assert.equal(inserted, 0, 'must not attempt a partial insertion');
});
