#!/usr/bin/env node
/**
 * init-workspace.mjs —— 在学生的工作区里搭出 Steps2Great 的目录骨架
 *
 * 它做什么（只新建，不覆盖）：
 *   我的学习/00-学习档案.md    ← 起始档案（模板原样复制，仍是空模板）
 *   我的学习/我的规则.md       ← 覆盖层，优先级最高
 *   我的学习/README.md         ← 给人类看的目录说明
 *   我的学习/学科/             ← 空目录，导师按学科往里建
 *   资料/README.md             ← 学生放资料的地方
 *   .steps2great.json          ← 记下初始化时的框架版本（供自适应更新比对）
 *
 * 用法：
 *   node scripts/init-workspace.mjs [--root <工作区目录>] [--force] [--standalone] [--dry]
 *   --standalone 复制完整同源学习项目；已有文件保持原样（包括 --force 时）。
 *
 * 铁律：默认**绝不覆盖**已存在的文件；--force 才重写「脚手架文件」（档案与规则永不重写）。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncProject } from './project-workspace.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(join(HERE, '..'));
const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const ROOT = resolve(argOf('--root') ?? process.cwd());
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');

// Explicit standalone mode carries the full framework with the folder.
const anchorPath = join(ROOT, '.steps2great.json');
const existingAnchor = existsSync(anchorPath) ? JSON.parse(readFileSync(anchorPath, 'utf8')) : {};
if (args.includes('--standalone') || existingAnchor.workspaceMode === 'standalone') {
  const anchor = existingAnchor;
  const result = syncProject(SKILL, ROOT, { dry: DRY, anchor });
  if (!DRY) writeFileSync(anchorPath, JSON.stringify({
    ...anchor, version: 1, skill: 'steps2great', skillVersion: skillVersion(),
    initializedAt: anchor.initializedAt ?? new Date().toISOString(),
    workspaceMode: 'standalone', projectFiles: result.projectFiles,
  }, null, 2) + '\n', 'utf8');
  console.log(`工作区：${ROOT}；入口：AGENTS.md（可脱离 skill 目录使用）。`);
  process.exit(0);
}

/** 读本 skill 的版本（供 .steps2great.json 记录） */
function skillVersion() {
  try {
    return JSON.parse(readFileSync(join(SKILL, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 要放置的文件：目标路径（相对工作区）→ 来源（相对本 skill）
 * `scaffold: false` 的文件**永不重写**（学生的档案与规则）。
 * `rewrite: true` 表示该文件来自 `references/`（镜像来源），里面的相对链接是
 * **skill 仓库口径**，放进工作区后必须改写成工作区口径，否则全是死链。
 */
const FILES = [
  { to: '我的学习/00-学习档案.md', from: 'references/模板/学习档案模板.md', scaffold: false, rewrite: true },
  { to: '我的学习/我的规则.md', from: 'templates/workspace/我的规则.md', scaffold: false },
  { to: '我的学习/我的规则.en.md', from: 'templates/workspace/我的规则.en.md', scaffold: false },
  { to: '我的学习/README.md', from: 'templates/workspace/我的学习-README.md', scaffold: true },
  { to: '资料/README.md', from: 'templates/workspace/资料-README.md', scaffold: true },
];

/**
 * 把「skill 仓库口径」的链接改写成「学生工作区口径」。
 *
 * 档案放在 `<工作区>/我的学习/`，所以：
 *   `../协议/00_导师协议.md`        → 框架在 skill 里，工作区没有 → 改成文字说明
 *   `../../SKILL.md` / `../AGENTS.md` → 同上
 *   `../我的学习/xx.md`（自身）      → 保留为工作区内相对路径的写法错误 → 修正
 *
 * 规则保守优先：**认不出来的链接一律转成纯文本**，宁可少一个可点的链接，
 * 也不要留一个点了报 404 的死链。
 */
function toWorkspacePaths(body) {
  return body.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, text, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole;
    const [pathPart, hash = ''] = target.split(/(?=#)/);
    const p = pathPart.replace(/\\/g, '/');

    // 指向 skill 自己的（协议 / 学科包 / 模板 / 示例 / 教程 / SKILL.md）→ 转文字，并注明在 skill 里
    const m = /(?:^|\/)(协议|学科包|模板|示例|教程|docs)\/(.+)$/.exec(p);
    if (m) return '`' + `${m[1]}/${m[2]}（在 skill 的 references/ 下）` + '`';
    if (/(^|\/)(SKILL\.md|AGENTS\.md|AGENTS\.en\.md)$/.test(p)) {
      return '`SKILL.md（skill 的入口契约）`';
    }
    // 指向工作区内部
    if (p.startsWith('我的学习/')) return `[${text}](${p}${hash})`;
    if (p.startsWith('资料/')) return `[${text}](${`../${p}`}${hash})`;
    // ../我的学习/xx.md 这种从模板视角写的自身引用 → 工作区里就是同目录
    const self = /(?:^|\/)我的学习\/(.+)$/.exec(p);
    if (self) return `[${text}](${self[1]}${hash})`;
    return '`' + (text || p) + '`';
  });
}

/** 起始档案的 banner：说明这些相对路径在工作区里的口径 */
const WORKSPACE_BANNER =
  '> 📍 本文件在你自己的**工作区**里。框架（协议 / 学科包 / 模板）在 **skill 目录**中，不在本工作区。\n' +
  '> 下文提到 `协议/xx.md`、`学科包/xx.md`、`SKILL.md` 时，都指 skill 里的对应文件。\n';


const DIRS = ['我的学习/学科', '资料'];

const created = [];
const skipped = [];
const missing = [];

for (const dir of DIRS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) {
    created.push(dir + '/');
    if (!DRY) mkdirSync(abs, { recursive: true });
  }
}

for (const f of FILES) {
  const abs = join(ROOT, f.to);
  const src = join(SKILL, f.from);
  if (!existsSync(src)) {
    missing.push(f.from);
    continue;
  }
  if (existsSync(abs) && !(FORCE && f.scaffold)) {
    skipped.push(f.to);
    continue;
  }
  created.push(f.to);
  if (!DRY) {
    mkdirSync(dirname(abs), { recursive: true });
    if (f.rewrite) {
      // 镜像来源 → 改写链接口径 + 加 banner，别把 skill 仓库的路径照抄进工作区
      const body = readFileSync(src, 'utf8');
      const lines = body.split('\n');
      // 去掉镜像 banner（前 2 行）
      const stripped = /^> 📄 \*\*只读镜像\*\*/.test(lines[0]) ? lines.slice(3).join('\n') : body;
      writeFileSync(abs, WORKSPACE_BANNER + '\n' + toWorkspacePaths(stripped), 'utf8');
    } else {
      copyFileSync(src, abs);
    }
  }
}

// 版本锚：供 SKILL.md 的「自适应更新」比对
const ANCHOR = '.steps2great.json';
const anchorAbs = join(ROOT, ANCHOR);
if (!existsSync(anchorAbs) || FORCE) {
  const payload = {
    version: 1,
    skill: 'steps2great',
    skillVersion: skillVersion(),
    initializedAt: new Date().toISOString(),
    note: '你的学习记录在 我的学习/ 与 资料/，本 skill 的更新永不覆盖它们。',
  };
  created.push(ANCHOR);
  if (!DRY) {
    writeFileSync(join(ROOT, ANCHOR), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
} else {
  skipped.push(ANCHOR + '（已存在，未改动）');
}

console.log(`工作区：${ROOT}`);
console.log(`框架版本：${skillVersion()}${DRY ? '（--dry，未落盘）' : ''}\n`);
if (created.length) {
  console.log('新建：');
  for (const c of created) console.log('  + ' + c);
}
if (skipped.length) {
  console.log('\n已存在，保持原样（不会覆盖你的记录）：');
  for (const s of skipped) console.log('  = ' + s);
}
if (missing.length) {
  console.error('\n❌ skill 资源缺失（请重装或重新 clone 本 skill）：');
  for (const m of missing) console.error('  - ' + m);
  process.exitCode = 2;
}

if (!DRY) {
  console.log(`\n下一步：让导师按 ${'references/协议/01_摸底剧本.md'} 走「需求收集 → 摸底 → 路线 → 第一课」。`);
  console.log('（告诉它：工作区已初始化，我的学习/00-学习档案.md 还是空模板。）');
}
