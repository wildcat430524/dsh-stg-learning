import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const hash = (body) => createHash('sha256').update(body).digest('hex');

// Upgrades only replace files whose recorded content is still intact.
export function syncProject(skill, root, { update = false, dry = false, anchor = {} } = {}) {
  const assets = join(skill, 'assets/project');
  const manifest = JSON.parse(readFileSync(join(assets, 'manifest.json'), 'utf8'));
  const managed = { ...anchor.projectFiles };
  const changed = [], conflicts = [];
  // Verify every resource before updating any existing project file.
  const resources = Object.entries(manifest.files).map(([rel, expected]) => {
    const source = readFileSync(join(assets, rel));
    if (hash(source) !== expected) throw new Error('项目资源指纹不符：' + rel);
    return { rel, expected, source };
  });
  const profileSource = readFileSync(join(assets, '模板/学习档案模板.md'));
  for (const { rel, expected, source } of resources) {
    const dest = join(root, rel);
    const current = existsSync(dest) ? hash(readFileSync(dest)) : null;
    // Rules and learner materials are assets, never upgrade targets.
    const preserved = rel.startsWith('我的学习/') || rel.startsWith('资料/');
    if (current !== null) {
      if (current === expected) { managed[rel] = expected; continue; }
      if (!update || preserved || current !== anchor.projectFiles?.[rel]) {
        conflicts.push(rel);
        continue;
      }
    }
    changed.push(rel);
    managed[rel] = expected;
    if (!dry) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, source);
    }
  }
  // A fresh profile is a template, not an upstream learner's progress.
  const profile = join(root, '我的学习/00-学习档案.md');
  if (!existsSync(profile)) {
    changed.push('我的学习/00-学习档案.md');
    if (!dry) {
      mkdirSync(dirname(profile), { recursive: true });
      writeFileSync(profile, profileSource);
    }
  }
  if (!dry) mkdirSync(join(root, '我的学习/学科'), { recursive: true });
  console.log(`独立项目：${changed.length} 个文件${dry ? '将写入' : '已写入'}；${conflicts.length} 个已有差异文件保留。`);
  for (const rel of conflicts) console.log('  保留 ' + rel);
  return { projectFiles: managed, conflicts, changed };
}
