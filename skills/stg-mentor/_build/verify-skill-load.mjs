#!/usr/bin/env node
/**
 * verify-skill-load.mjs —— 用**真实 YAML 解析器**复刻 skill 加载器的路径，验证 SKILL.md 能被装进去
 *
 * 为什么需要它：frontmatter 里一个裸标量中的 `: ` 就能让严格解析器直接抛错、
 * 整个 skill 加载失败 —— 而纯文本检查看不出来。这个脚本模拟加载器的实际动作：
 *   ① 首行必须是 `---`；② frontmatter 必须解析成普通对象；
 *   ③ name 合规（小写字母/数字/连字符）；④ description 非空、长度合理、双语触发词齐全；
 *   ⑤ 不带已废弃的 invocation 键；⑥ body 能被切出来。
 *
 * 用法：
 *   node _build/verify-skill-load.mjs [path/to/SKILL.md]
 *
 * yaml 依赖：优先用环境里的，找不到就退化为内置的严格子集解析（只认本 skill 用到的字段）。
 */

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require_ = createRequire(import.meta.url);

/** 找一个能用的 YAML 解析器（不新增依赖：从常见安装位置借用） */
function loadYaml() {
  // --no-yaml：强制走内置退化解析，用来验证「没有 YAML 库时也能自检」这条兜底路径
  if (process.argv.includes('--no-yaml')) return null;
  const candidates = [
    'yaml',
    join(process.env.DSH_RUNTIME ?? '', 'node_modules', 'yaml'),
    'D:/deepseek-harness-master/deepseek-harness-0.1.6-alpha.1/runtime/node_modules/yaml',
    'C:/Users/Administrator/.dsh/profiles/web/node_modules/yaml',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return { parse: require_(c).parse, source: c };
    } catch {
      /* 换下一个 */
    }
  }
  return null;
}

/** 退化路径：严格子集解析（只处理 frontmatter 里允许出现的形式） */
function strictSubsetParse(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) throw new Error(`无法解析的 frontmatter 行："${line}"`);
    let v = m[2];
    const quoted = /^"(?:[^"\\]|\\.)*"$/.test(v) || /^'(?:[^']|'')*'$/.test(v);
    if (!quoted && /: /.test(v)) {
      throw new Error(`${m[1]} 是裸标量却含 ": " —— 严格 YAML 会报 Nested mappings，请加双引号`);
    }
    if (quoted) v = v.slice(1, -1).replace(/\\(.)/g, '$1');
    out[m[1]] = v;
  }
  return out;
}

/** 位置参数（跳过 --flag），默认 SKILL.md */
const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'SKILL.md';
if (!existsSync(file)) {
  console.error(`❌ 找不到 ${file}`);
  process.exit(2);
}

const raw = readFileSync(file, 'utf8');
const firstLineEnd = raw.indexOf('\n');
const hasFm = firstLineEnd > 0 && raw.slice(0, firstLineEnd).replace(/\r$/, '') === '---';
if (!hasFm) {
  console.error('❌ 首行不是 `---`：加载器不会把它当成 frontmatter，skill 会被跳过');
  process.exit(1);
}

const start = firstLineEnd + 1;
const closing = raw.indexOf('\n---\n', start);
if (closing < 0) {
  console.error('❌ frontmatter 没有闭合的 `---`');
  process.exit(1);
}

const yaml = loadYaml();
let data;
let engine;
try {
  data = yaml ? yaml.parse(raw.slice(start, closing)) : strictSubsetParse(raw.slice(start, closing));
  engine = yaml ? yaml.source : 'strict-subset (内置退化解析)';
} catch (error) {
  console.error(`❌ frontmatter 解析失败：${error.message}`);
  console.error('   → 这会让 skill 完全加载不上（不是警告，是直接失败）');
  process.exit(1);
}

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const desc = data.description ?? '';
const checks = [
  ['frontmatter 解析成对象', typeof data === 'object' && data !== null && !Array.isArray(data)],
  ['name 合规（小写/数字/连字符）', SKILL_NAME.test(data.name ?? '')],
  ['description 非空', desc.length > 0],
  ['description ≤ 1024 字符', desc.length <= 1024],
  ['description ≥ 40 字符（够写触发词）', desc.length >= 40],
  ['description 中英双语触发词', /[\u4e00-\u9fa5]/.test(desc) && /[A-Za-z]{4,}/.test(desc)],
  ['无已废弃 invocation 键', !['disableModelInvocation', 'modelInvocable', 'userInvocable'].some((k) => Object.hasOwn(data, k))],
];

const body = raw.slice(closing + 5).trim();
checks.push(['body 非空', body.length > 0]);

console.log(`文件    ：${file}`);
console.log(`解析器  ：${engine}`);
console.log(`name    ：${data.name}`);
console.log(`desc    ：${desc.length} 字符\n`);

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  if (!ok) failed++;
}

if (failed) {
  console.error(`\n❌ ${failed} 项不通过 —— 这个 SKILL.md 装进加载器会有问题`);
  process.exit(1);
}
console.log('\n✅ 加载器视角全部通过（frontmatter、name、description、body 都能被正确读取）');
