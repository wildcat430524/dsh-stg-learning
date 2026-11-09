import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { exportProject } from '../_build/export-project.mjs';

const skill = fileURLToPath(new URL('..', import.meta.url));
const run = (path, args = [], cwd = skill) => execFileSync(process.execPath, [path, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const digest = (body) => createHash('sha256').update(body).digest('hex');

test('standalone project is portable, complete, and protects existing learner files', () => {
  const temp = mkdtempSync(join(tmpdir(), 's2g-project-'));
  try {
    const root = join(temp, 'workspace');
    const init = join(skill, 'scripts/init-workspace.mjs');
    run(init, ['--root', root, '--standalone', '--dry']);
    assert.equal(existsSync(root), false);
    run(init, ['--root', root, '--standalone']);
    const manifest = JSON.parse(readFileSync(join(skill, 'assets/project/manifest.json')));
    for (const [rel, expected] of Object.entries(manifest.files)) {
      assert.equal(digest(readFileSync(join(root, rel))), expected, rel);
    }
    assert.equal(readFileSync(join(root, '我的学习/00-学习档案.md'), 'utf8'), readFileSync(join(root, '模板/学习档案模板.md'), 'utf8'));
    run(join(root, '_tools/check.mjs'), ['--quiet'], root);
    run(join(root, '_tools/setup-agents.mjs'), ['--check'], root);
    run(join(root, '_tools/validate-state.mjs'), [], root);
    run(join(root, '_tools/validate-state.mjs'), ['--fixtures', 'tests/fixtures'], root);
    run(join(root, 'tools/materials.mjs'), ['list', '--root', root], root);
    run(join(root, 'tools/behavior-eval.mjs'), ['--help'], root);
    run(join(root, 'tests/progress-view.test.mjs'), [], root);
    assert.ok(existsSync(join(root, 'package-lock.json')));
    for (const rel of ['我的学习/00-学习档案.md', '我的学习/我的规则.md', '资料/README.md', 'AGENTS.md']) {
      const body = readFileSync(join(root, rel), 'utf8') + '\n<!-- keep private change -->\n';
      writeFileSync(join(root, rel), body);
    }
    const before = new Map(['我的学习/00-学习档案.md', '我的学习/我的规则.md', '资料/README.md', 'AGENTS.md'].map(rel => [rel, readFileSync(join(root, rel), 'utf8')]));
    run(init, ['--root', root, '--standalone', '--force']);
    run(init, ['--root', root, '--force']);
    assert.equal(JSON.parse(readFileSync(join(root, '.steps2great.json'))).workspaceMode, 'standalone');
    run(join(skill, 'scripts/update.mjs'), ['--root', root]);
    for (const [rel, body] of before) assert.equal(readFileSync(join(root, rel), 'utf8'), body);

    // Simulate a new release without mutating the installed skill or upstream.
    const release = join(temp, 'release');
    mkdirSync(release);
    cpSync(join(skill, 'scripts'), join(release, 'scripts'), { recursive: true });
    cpSync(join(skill, 'assets'), join(release, 'assets'), { recursive: true });
    cpSync(join(skill, 'package.json'), join(release, 'package.json'));
    const rel = '协议/05_对话导入.md';
    const next = readFileSync(join(release, 'assets/project', rel), 'utf8') + '\n<!-- new release -->\n';
    writeFileSync(join(release, 'assets/project', rel), next);
    manifest.files[rel] = digest(next);
    writeFileSync(join(release, 'assets/project/manifest.json'), JSON.stringify(manifest));
    run(join(release, 'scripts/update.mjs'), ['--root', root, '--check']);
    assert.notEqual(readFileSync(join(root, rel), 'utf8'), next);
    run(join(release, 'scripts/update.mjs'), ['--root', root]);
    assert.equal(readFileSync(join(root, rel), 'utf8'), next);
    for (const [rel, body] of before) assert.equal(readFileSync(join(root, rel), 'utf8'), body);
    const newer = next + '\n<!-- further release -->\n';
    writeFileSync(join(release, 'assets/project', rel), newer);
    manifest.files[rel] = digest(newer);
    writeFileSync(join(release, 'assets/project/manifest.json'), JSON.stringify(manifest));
    const corrupt = Object.keys(manifest.files).at(-1);
    writeFileSync(join(release, 'assets/project', corrupt), 'corrupted resource');
    const anchorBefore = readFileSync(join(root, '.steps2great.json'), 'utf8');
    assert.throws(() => run(join(release, 'scripts/update.mjs'), ['--root', root]));
    assert.equal(readFileSync(join(root, rel), 'utf8'), next, 'failed validation must not partially update framework');
    assert.equal(readFileSync(join(root, '.steps2great.json'), 'utf8'), anchorBefore);
    const light = join(temp, 'light');
    run(init, ['--root', light]);
    assert.equal(existsSync(join(light, 'AGENTS.md')), false);
    assert.equal(existsSync(join(light, '我的学习/00-学习档案.md')), true);
    const privateNotes = ['我的学习/README.md', '资料/README.md'];
    for (const rel of privateNotes) writeFileSync(join(light, rel), 'PRIVATE NOTES: ' + rel);
    const lightAnchor = readFileSync(join(light, '.steps2great.json'), 'utf8');
    run(join(skill, 'scripts/update.mjs'), ['--root', light, '--check']);
    assert.equal(readFileSync(join(light, '.steps2great.json'), 'utf8'), lightAnchor);
    run(join(skill, 'scripts/update.mjs'), ['--root', light]);
    for (const rel of privateNotes) assert.equal(readFileSync(join(light, rel), 'utf8'), 'PRIVATE NOTES: ' + rel);
    run(init, ['--root', light, '--standalone']);
    for (const rel of privateNotes) assert.equal(readFileSync(join(light, rel), 'utf8'), 'PRIVATE NOTES: ' + rel);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('exported project uses reusable rule templates without learner preferences or progress', () => {
  const temp = mkdtempSync(join(tmpdir(), 's2g-export-'));
  try {
    const upstream = join(temp, 'upstream');
    cpSync(join(skill, 'assets/project'), upstream, { recursive: true });
    for (const rel of ['我的学习/我的规则.md', '我的学习/我的规则.en.md', '我的学习/00-学习档案.md']) {
      writeFileSync(join(upstream, rel), 'PRIVATE LEARNER DATA');
    }
    const output = join(temp, 'output');
    exportProject(upstream, output);
    for (const language of ['', '.en']) {
      assert.equal(readFileSync(join(output, `我的学习/我的规则${language}.md`), 'utf8'),
        readFileSync(join(upstream, `模板/我的规则${language}.md`), 'utf8'));
    }
    assert.equal(existsSync(join(output, '我的学习/00-学习档案.md')), false);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
