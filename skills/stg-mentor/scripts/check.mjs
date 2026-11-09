#!/usr/bin/env node
/**
 * check.mjs —— Steps2Great-skill 自检
 *
 * 查什么：
 *   1. SKILL.md 的 frontmatter：必有 name / description；name 合规；description 长度够用
 *   2. 相对链接：指向的文件真的存在（工作区口径的路径除外，见下）
 *   3. 编码：UTF-8 无 BOM、无替换字符；行尾 LF
 *   4. 围栏成对（```）
 *   5. 镜像是否与上游一致（跑 sync --dry，有差异就报 —— 说明忘了同步）
 *
 * 用法：
 *   node scripts/check.mjs           # 全量检查
 *   node scripts/check.mjs --quiet   # 只输出问题
 *
 * 退出码：0 = 全过 / 1 = 有问题
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..'));
const QUIET = process.argv.includes('--quiet');
const SKIP_DIRS = new Set(['node_modules', '.git', '.tmp-workspace', 'assets']); // checked by upstream sync and generated-project tests

const problems = [];
const warnings = [];
let fileCount = 0;

/** 指向「学生工作区」或「外部」的路径 —— 在 skill 仓库里本来就不存在，不是坏链 */
const WORKSPACE_PREFIXES = ['我的学习/', '资料/', '学科/'];
const AGENTS_ALIAS = /(^|\/)AGENTS(\.en)?\.md$/;
const UPSTREAM_ONLY = /(^|\/)(tests|docs\/simulations\/_|宣传视频)\//;

/** 这些文件允许出现占位词（模板 / 示例） */
const TEMPLATE_OK = [/^references\/模板\//, /^references\/学科包\/_/, /^templates\/workspace\//];

/**
 * 模板的**虚拟目标位置** —— 模板里的相对链接是按「被复制到哪儿」写的，
 * 不是按 `references/模板/` 写的。校验链接时要用这个基准，否则会把
 * 正确的链接误判成坏链。（上游 `_tools/check.mjs` 用的是同一套思路。）
 */
const TEMPLATE_VIRTUAL_BASE = {
  '我的规则.md': '我的学习',
  '我的规则.en.md': '我的学习',
  '学习档案模板.md': '我的学习',
  '课程路线模板.md': '我的学习/学科/<学科>',
  '摸底测试模板.md': '我的学习/学科/<学科>',
  '学生回答模板.md': '我的学习/学科/<学科>/NN-<课名>',
  '教学引导模板.md': '我的学习/学科/<学科>/NN-<课名>',
  '轮次教学引导模板.md': '我的学习/学科/<学科>/NN-<课名>',
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

const files = walk(ROOT);
const rel = (abs) => relative(ROOT, abs).split(sep).join('/');

// ── 1. SKILL.md frontmatter ────────────────────────────────────────────
{
  const abs = join(ROOT, 'SKILL.md');
  if (!existsSync(abs)) {
    problems.push('缺少 SKILL.md（skill 的入口，必须有）');
  } else {
    const text = readFileSync(abs, 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (!m) {
      problems.push('SKILL.md 头部没有 YAML frontmatter（--- 包裹）');
    } else {
      const fm = m[1];

      // 关键：frontmatter 必须是**真 YAML 解析器也能解析**的。裸标量里出现 ": " 会让
      // 严格解析器直接报 "Nested mappings are not allowed"，整个 skill 加载失败 ——
      // 这里不引依赖，只做这一条最容易踩的静态检查（含中文冒号「：」是安全的，不用管）。
      for (const line of fm.split('\n')) {
        const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (!kv) continue;
        const value = kv[2];
        const quoted = /^"(?:[^"\\]|\\.)*"$/.test(value) || /^'(?:[^']|'')*'$/.test(value);
        if (quoted) continue;
        if (/: /.test(value)) {
          problems.push(
            `SKILL.md frontmatter 的 ${kv[1]} 是裸标量却含 ": " —— 严格 YAML 解析器会报错、skill 直接加载失败。` +
              `请把整行值用双引号包起来。`,
          );
        }
        if (/^\s*[>|]/.test(value) === false && /^[[{]/.test(value) === false && value.includes(' #')) {
          problems.push(`SKILL.md frontmatter 的 ${kv[1]} 含 " #"，会被当成注释截断 —— 请加引号`);
        }
      }

      const nameM = /^name:\s*(.+)$/m.exec(fm);
      const descM = /^description:\s*(.+)$/m.exec(fm);
      if (!nameM) problems.push('SKILL.md frontmatter 缺 name');
      else {
        const name = nameM[1].trim();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
          problems.push(`SKILL.md 的 name「${name}」不合规：只能小写字母/数字/连字符`);
        }
      }
      if (!descM) problems.push('SKILL.md frontmatter 缺 description');
      else {
        const desc = descM[1].trim();
        if (desc.length < 40) warnings.push(`description 偏短（${desc.length} 字符）—— 触发词可能不够用`);
        if (desc.length > 1024) problems.push(`description 过长（${desc.length} 字符）—— 多数客户端会截断`);
      }
      // description 里同时有中英触发词 = 语言策略的落点，值得核一下
      const desc = descM?.[1] ?? '';
      if (!/[\u4e00-\u9fa5]/.test(desc) || !/[A-Za-z]{4,}/.test(desc)) {
        warnings.push('description 未同时包含中英文触发词 —— 双语用户可能触发不到');
      }
    }
  }
}

// ── 2..4. 逐文件检查 ───────────────────────────────────────────────────
for (const abs of files) {
  const r = rel(abs);
  if (!/\.(md|mjs|js|json|yml|yaml)$/.test(r)) continue;
  fileCount++;
  const raw = readFileSync(abs);
  const text = raw.toString('utf8');

  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) problems.push(`${r}: 含 UTF-8 BOM`);
  if (text.includes('\uFFFD')) problems.push(`${r}: 含替换字符 U+FFFD（编码损坏）`);
  if (text.includes('\r\n')) problems.push(`${r}: 含 CRLF，请统一为 LF`);

  if (!r.endsWith('.md')) continue;

  // 围栏成对
  const fences = (text.match(/^\s*```/gm) ?? []).length;
  if (fences % 2 !== 0) problems.push(`${r}: 代码围栏不成对（${fences} 个 \`\`\`）`);

  // 相对链接
  const dir = dirname(abs);
  const tplBase = TEMPLATE_VIRTUAL_BASE[r.split('/').pop()];
  // Links inside fenced examples are for their eventual target documents.
  let fence = null;
  const linkText = text.split('\n').map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
  for (const m of linkText.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const target = m[2];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [pathPart] = target.split('#');
    if (!pathPart) continue;
    const p = pathPart.split(sep).join('/');
    // Lesson-local SVG filenames in protocol examples are virtual template paths.
    if (/\.svg$/i.test(p) && /<[^>]+>/.test(p)) continue;
    if (WORKSPACE_PREFIXES.some((pre) => p.startsWith(pre))) continue; // 工作区口径
    if (AGENTS_ALIAS.test(p)) continue; // 镜像里保留的上游 AGENTS.md 引用
    if (UPSTREAM_ONLY.test(p)) continue; // 上游专属、已降级说明
    if (/^\.\.\/\.\.\/\.\.\/\.\.\//.test(p)) continue; // 模板里的虚拟目标目录
    // 模板：链接是按「模板将被复制到的位置」写的，而那个位置（学生工作区）在本仓库里
    // 并不存在，所以**无法**在这里校验工作区内部链接。
    // 能校验的只有一件事，也正是我们真正关心的：**框架内部链接必须已被改写成文字**
    // （框架目录不会出现在学生工作区里，留成链接就是死链 —— GLM-5.2 实测踩过）。
    if (tplBase !== undefined) {
      if (/^(协议|学科包|模板|示例|教程|docs)\//.test(p) || /(^|\/)(AGENTS|CLAUDE)\.(md|en\.md)$/.test(p)) {
        problems.push(`${r}: 模板里的框架链接未被改写（复制进工作区会成死链）→ ${target}`);
      }
      continue;
    }
    const absTarget = resolve(dir, pathPart);
    if (!existsSync(absTarget)) {
      // 允许 link 指向仓库根的绝对式相对路径（如 协议/xx.md 实际在 references/协议/）
      const alt = resolve(ROOT, 'references', p);
      if (!existsSync(alt)) problems.push(`${r}: 坏链 → ${target}`);
    }
  }

  // 占位词
  if (!TEMPLATE_OK.some((re) => re.test(r))) {
    for (const pat of [/<待填>/g, /<TODO>/gi, /lorem ipsum/gi]) {
      const hits = text.match(pat);
      if (hits) problems.push(`${r}: 残留占位词 ${hits[0]}（×${hits.length}）`);
    }
  }
}

// ── 5. 镜像与上游一致性（可选，上游不存在时跳过）─────────────────────
{
  const syncScript = join(ROOT, '_build', 'sync-from-upstream.mjs');
  const upstream = process.env.STEPS2GREAT_UPSTREAM || 'E:/StepsToGreat';
  if (existsSync(syncScript) && existsSync(upstream)) {
    try {
      const out = execFileSync(process.execPath, [syncScript, '--from', upstream, '--check'], { encoding: 'utf8', cwd: ROOT });
      const n = /镜像 (\d+) 个文件/.exec(out);
      if (!QUIET) console.log(`ℹ️ 镜像内容一致（${n ? n[1] : '?'} 个文件）—— ${upstream}`);
    } catch (error) {
      problems.push(`镜像内容校验失败：${String(error.stderr ?? error.message).trim()}`);
    }
  }
}

// ── 6. 加载器视角：SKILL.md 能否被真实 YAML 解析器接受 ────────────────
{
  const v = join(ROOT, '_build', 'verify-skill-load.mjs');
  if (existsSync(v)) {
    try {
      const out = execFileSync(process.execPath, [v, join(ROOT, 'SKILL.md')], { encoding: 'utf8', cwd: ROOT });
      if (!QUIET) console.log('ℹ️ 加载器视角校验通过（frontmatter / name / description / body）');
      void out;
    } catch (error) {
      const detail = String(error.stdout ?? error.message).split('\n').filter((l) => l.includes('❌'));
      problems.push(`加载器视角校验失败：${detail.join(' / ') || String(error.message).split('\n')[0]}`);
    }
  }
}

// ── 输出 ───────────────────────────────────────────────────────────────
if (!QUIET) console.log(`🔍 Steps2Great-skill 自检：${fileCount} 个文件\n`);
if (problems.length) {
  console.error(`❌ ${problems.length} 个问题：`);
  for (const p of problems) console.error('  - ' + p);
}
if (warnings.length) {
  console.log(`⚠️ ${warnings.length} 个提示：`);
  for (const w of warnings) console.log('  - ' + w);
}
if (!problems.length) console.log(`✅ 全部通过（${warnings.length} 个提示）`);
process.exit(problems.length ? 1 : 0);
