import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// Raw project files keep upstream paths; references/ serves the installed skill.
export function exportProject(upstream, target, check = false) {
  const roots = ['协议', '学科包', '模板', '示例', '教程', 'docs', '_tools', 'tools', 'evals/behavior', 'tests/fixtures'];
  const files = new Set(['AGENTS.md', 'AGENTS.en.md', 'README.md', 'README.en.md', 'CONTEXT.md', 'CONTRIBUTING.md', 'LICENSE', 'LICENSE-DOCS', 'package.json', '我的学习/README.md', '我的学习/我的规则.md', '我的学习/我的规则.en.md', '资料/README.md', 'tests/materials.test.mjs', 'tests/behavior-eval.test.mjs']);
  const walk = (rel) => {
    if (!existsSync(join(upstream, rel))) return;
    for (const item of readdirSync(join(upstream, rel), { withFileTypes: true })) {
      const path = rel + '/' + item.name;
      if (item.isDirectory()) walk(path);
      else files.add(path);
    }
  };
  for (const root of roots) walk(root);
  for (const rel of ['.cursor', '.trae', '.agents', '.qoder']) walk(rel);
  files.add('tests/README.md');
  files.add('tests/progress-view.test.mjs');
  files.add('tests/state-regression.mjs');
  files.add('package-lock.json');
  const setup = readFileSync(join(upstream, '_tools/setup-agents.mjs'), 'utf8');
  const targets = setup.slice(setup.indexOf('const TARGETS ='), setup.indexOf('\n];', setup.indexOf('const TARGETS =')));
  for (const match of targets.matchAll(/path:\s*'([^']+)'/g)) files.add(match[1]);
  const hashes = {};
  const stale = [];
  const scaffoldSources = {
    '我的学习/我的规则.md': '模板/我的规则.md',
    '我的学习/我的规则.en.md': '模板/我的规则.en.md',
  };
  for (const rel of [...files].sort()) {
    // Personal overlays in upstream's learner directory are never distributable.
    const source = join(upstream, scaffoldSources[rel] ?? rel);
    if (!existsSync(source)) throw new Error('Project resource missing: ' + source);
    const body = readFileSync(source);
    const dest = join(target, rel);
    hashes[rel] = createHash('sha256').update(body).digest('hex');
    if (check) {
      if (!existsSync(dest) || !readFileSync(dest).equals(body)) stale.push(rel);
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, body);
    }
  }
  const manifest = JSON.stringify({ version: 1, files: hashes }, null, 2) + '\n';
  const manifestPath = join(target, 'manifest.json');
  if (check) {
    if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== manifest) stale.push('manifest.json');
  } else writeFileSync(manifestPath, manifest);
  if (stale.length) throw new Error('Standalone project out of sync: ' + stale.join(', '));
  console.log(`✅ 独立项目资源 ${files.size} 个${check ? '，与上游一致' : '已同步'}`);
}
