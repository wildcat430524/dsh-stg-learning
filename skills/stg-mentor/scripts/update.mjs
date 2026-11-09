#!/usr/bin/env node
/**
 * update.mjs —— 自适应更新：把本 skill 更新到最新框架版本，且**不碰**学习记录
 *
 * 两层更新（见 SKILL.md）：
 *   ① 框架层（本脚本管的）—— 协议 / 学科包 / 模板 / 脚本，升级不影响任何人
 *   ② 教学层（本脚本管不着的）—— 学生的偏好写 `我的学习/我的规则.md`，进度写 `00-学习档案.md`
 *
 * 用法：
 *   node scripts/update.mjs --root <工作区>           # 检查并同步工作区脚手架
 *   node scripts/update.mjs --root <工作区> --check    # 只报告，不写
 *   node scripts/update.mjs --self                     # 更新 skill 自身（git 仓库用 git pull；否则提示 npx）
 *
 * 铁律：
 *   - **永不覆盖** `我的学习/00-学习档案.md` 与 `我的学习/我的规则.md`（学生资产）。
 *   - 轻量目录仅补齐缺失脚手架；独立项目仅更新指纹未变的框架文件。
 *   - `.steps2great.json` 的版本号与文件指纹会更新。
 *   - 学生在覆盖层里写过的规则，更新后依然生效（覆盖层优先级最高）。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { syncProject } from './project-workspace.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(join(HERE, '..'));
const args = process.argv.slice(2);
const has = (n) => args.includes(n);
const argOf = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};

const CHECK = has('--check');
const SELF = has('--self');
const ROOT = resolve(argOf('--root', process.cwd()));

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};
const skillVersion = () => readJson(join(SKILL, 'package.json'))?.version ?? '0.0.0';

/** 只补齐缺失的脚手架；已有内容可能含学生笔记，永远保留 */
const SCAFFOLD = [
  { to: '我的学习/README.md', from: 'templates/workspace/我的学习-README.md' },
  { to: '资料/README.md', from: 'templates/workspace/资料-README.md' },
];

/** 学生资产：更新时必须原样保留 —— 列出来是为了让脚本显式承诺 */
const PRESERVED = ['我的学习/00-学习档案.md', '我的学习/我的规则.md', '我的学习/我的规则.en.md', '我的学习/学科/', '我的学习/README.md', '资料/'];

const ANCHOR = '.steps2great.json';

console.log(`skill   ：${SKILL}`);
console.log(`版本    ：${skillVersion()}`);
console.log(`工作区  ：${ROOT}\n`);

const anchorPath = join(ROOT, ANCHOR);
const anchor = readJson(anchorPath);
if (anchor === null) {
  console.log(`⚠️ 工作区没有 ${ANCHOR} —— 看起来还没初始化。`);
  console.log(`   先跑：node "${join(SKILL, 'scripts/init-workspace.mjs')}" --root "${ROOT}"`);
  if (!CHECK) process.exitCode = 1;
} else {
  const oldV = anchor.skillVersion ?? '(未知)';
  const newV = skillVersion();
  console.log(oldV === newV ? `✅ 框架版本一致（${newV}）` : `🔄 框架更新：${oldV} → ${newV}`);
}

let changed = 0;
if (anchor?.workspaceMode === 'standalone') {
  const result = syncProject(SKILL, ROOT, { update: true, dry: CHECK, anchor });
  if (!CHECK) anchor.projectFiles = result.projectFiles;
}
for (const f of anchor?.workspaceMode === 'standalone' ? [] : SCAFFOLD) {
  const src = join(SKILL, f.from);
  const dst = join(ROOT, f.to);
  if (!existsSync(src)) continue;
  if (existsSync(dst)) continue;
  changed++;
  console.log(`  ${CHECK ? '将更新' : '更新'} ${f.to}`);
  if (!CHECK) {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
  }
}
if (changed === 0) console.log('  （脚手架无需更新）');

if (!CHECK && anchor !== null) {
  anchor.skillVersion = skillVersion();
  anchor.updatedAt = new Date().toISOString();
  writeFileSync(anchorPath, JSON.stringify(anchor, null, 2) + '\n', 'utf8');
  console.log(`  ${ANCHOR} 版本锚已更新`);
}

console.log('\n以下学生资产被显式保留（更新永不触碰）：');
for (const p of PRESERVED) console.log('  🔒 ' + p);

if (SELF) {
  console.log('\n更新 skill 自身：');
  if (existsSync(join(SKILL, '.git'))) {
    if (CHECK) {
      console.log('  这是 git 检出 —— 跑 `git -C "' + SKILL + '" pull --ff-only` 即更新。');
    } else {
      try {
        const out = execFileSync('git', ['-C', SKILL, 'pull', '--ff-only'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        console.log(out.trim() || '  已是最新。');
      } catch (error) {
        console.error('  ⚠️ git pull 失败（本地有改动？）：' + String(error.message).split('\n')[0]);
        console.error('     你的学习记录不受影响；先处理 skill 目录里的本地改动，或改用下面的 npx 方式。');
        process.exitCode = 1;
      }
    }
  } else {
    console.log('  不是 git 检出（例如被复制进 agent 的 skill 目录）。');
    console.log('  更新方式：让客户端重新安装该 skill，或手动覆盖');
    console.log('    https://github.com/wildcat430524/Steps2Great-skill');
    console.log('  你的学习记录在别处（我的学习/ 与 资料/），覆盖 skill 不会影响它。');
  }
}

if (CHECK) console.log('\n（--check：未写任何文件）');
