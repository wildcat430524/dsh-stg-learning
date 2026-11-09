#!/usr/bin/env node
/**
 * sync-from-upstream.mjs —— 把 StepsToGreat 的框架文件镜像进本 skill 的 references/
 *
 * 为什么需要它：本 skill 的协议内容不是在 StepsToGreat 里手抄一份，而是**镜像**它。
 * 有了这张映射表，上游改协议 → 跑一次 `node _build/sync-from-upstream.mjs` 即同步完成；
 * 映射表本身也是「谁对应谁」的文档。
 *
 * 用法：
 *   node _build/sync-from-upstream.mjs                      # 用默认源 E:/StepsToGreat
 *   node _build/sync-from-upstream.mjs --from <目录>        # 指定 StepsToGreat 检出位置
 *   node _build/sync-from-upstream.mjs --dry                # 只报告，不落盘
 *   node _build/sync-from-upstream.mjs --check              # 只读逐文件比对，差异即失败
 *   node _build/sync-from-upstream.mjs --prune              # 删掉 references/ 里已不在映射内的文件
 *
 * 铁律：只读上游，绝不写上游。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportProject } from './export-project.mjs';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const FROM = resolve(argOf('--from', 'E:/StepsToGreat'));
/** 本仓库根 = 本脚本所在目录（_build/）的上一级 */
const TO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CHECK = args.includes('--check');
const DRY = args.includes('--dry') || CHECK;
const PRUNE = args.includes('--prune');

/**
 * 映射表：源相对路径（相对 StepsToGreat）→ 目标相对路径（相对本仓库）。
 * 以 `/` 结尾的键表示整棵子树按同一前缀平移。
 * 目标为 `null` 表示「刻意不要」（例如英文镜像、测试夹具），链接落到它时降级为纯文本路径。
 */
const MAP = [
  ['AGENTS.md', 'SKILL.md'],
  ['CONTEXT.md', 'references/CONTEXT.md'],

  ['协议/', 'references/协议/'],
  ['学科包/', 'references/学科包/'],
  ['模板/', 'references/模板/'],
  ['示例/', 'references/示例/'],
  ['教程/', 'references/教程/'],

  ['_tools/validate-state.mjs', 'scripts/validate-state.mjs'],
  ['tests/state-regression.mjs', 'tests/regression-state.mjs'],
  ['_tools/render-progress.mjs', 'scripts/render-progress.mjs'],
  ['tests/progress-view.test.mjs', 'tests/progress-view.test.mjs'],
  ['tools/materials.mjs', 'scripts/materials.mjs'],
  ['tests/materials.test.mjs', 'tests/materials.test.mjs'],
  ['tools/behavior-eval.mjs', 'scripts/behavior-eval.mjs'],
  ['tests/behavior-eval.test.mjs', 'tests/behavior-eval.test.mjs'],
  ['evals/behavior/', 'evals/behavior/'],
  ['docs/', 'references/docs/'],

  // 注意：学生工作区的脚手架（我的学习/*、资料/*）**不由本脚本镜像** ——
  // 上游那些文件里的相对链接（../协议/、../../AGENTS.md）在工作区里不存在，
  // 必须改成工作区口径。它们手写在 templates/workspace/ 里，见该目录的 README。
];

/**
 * 对镜像结果做定点改写：source 相对路径 → [[正则, 替换], ...]。
 * 用于把上游「仓库口径」的小细节改成「skill 口径」，避免正文里留下指向不存在的路径。
 */
const TRANSFORM = [
  ['tests/state-regression.mjs', [[/join\(ROOT, '_tools', 'validate-state\.mjs'\)/g, "join(ROOT, 'scripts', 'validate-state.mjs')"]]],
  ['tests/progress-view.test.mjs', [[/\.\.\/_tools\/render-progress\.mjs/g, '../scripts/render-progress.mjs']]],
  ['协议/06_小目标进度.md', [[/_tools\/render-progress\.mjs/g, 'scripts/render-progress.mjs']]],
  ['协议/06_小目标进度.en.md', [[/_tools\/render-progress\.mjs/g, 'scripts/render-progress.mjs']]],
  ['tools/behavior-eval.mjs', [[/\.\.\/AGENTS\.md/g, '../SKILL.md']]],
  ['tests/behavior-eval.test.mjs', [[/\.\.\/tools\/behavior-eval\.mjs/g, '../scripts/behavior-eval.mjs']]],
  ['docs/behavior-evaluation.md', [[/node tools\/behavior-eval\.mjs/g, 'node scripts/behavior-eval.mjs']]],
  ['tests/materials.test.mjs', [[/\.\.\/tools\/materials\.mjs/g, '../scripts/materials.mjs']]],
  ['docs/material-retrieval.md', [[/node tools\/materials\.mjs/g, 'node "$SKILL/scripts/materials.mjs"']]],
  [
    '_tools/validate-state.mjs',
    [
      // skill 里没有仓库根可言，默认校验对象应是**当前工作目录**（学生工作区）
      [/const REPO_ROOT = join\(HERE, '\.\.'\);/,
       "const REPO_ROOT = process.cwd(); // skill 版：默认校验当前工作目录（学生工作区）"],
      [/node _tools\/validate-state\.mjs/g, 'node scripts/validate-state.mjs'],
      [/`_tools\/validate-state\.mjs`/g, '`scripts/validate-state.mjs`'],
      [/校验本仓库 我的学习\//g, '校验当前目录的 我的学习/'],
      // 回归测试夹具没有镜像进来 —— 用法行保留但注明，免得学生以为丢了文件
      [/^(\s*\*?\s*node scripts\/validate-state\.mjs\s+--fixtures\s+)\S+(\s+#.*)?$/gm,
       '$1<上游回归测试集，本 skill 未附带>$2'],
    ],
  ],
];

/**
 * 模板的「虚拟目标位置」——模板里的相对链接是**按被复制到哪儿**写的，
 * 不是按 `references/模板/` 写的。上游 `_tools/check.mjs` 也用同一套虚拟基准。
 *
 * 例：`课程路线模板.md` 会被复制成 `我的学习/学科/<学科>/00-课程路线.md`，
 * 所以它里面写 `../../../我的学习/00-学习档案.md` —— 从那个位置往上三级正好是工作区根。
 * 知道了目标位置，就能把链接改写成**从目标位置出发的正确相对路径**。
 */
const TEMPLATE_DEST = {
  '我的规则.md': '我的学习',
  '我的规则.en.md': '我的学习',
  '学习档案模板.md': '我的学习',
  '课程路线模板.md': '我的学习/学科/<学科>',
  '摸底测试模板.md': '我的学习/学科/<学科>',
  '学生回答模板.md': '我的学习/学科/<学科>/NN-<课名>',
  '教学引导模板.md': '我的学习/学科/<学科>/NN-<课名>',
  '轮次教学引导模板.md': '我的学习/学科/<学科>/NN-<课名>',
};

/**
 * `模板/` 目录是**给学生工作区用的脚手架** —— 模型会把它们复制/照抄成
 * `我的学习/学科/<学科>/00-课程路线.md` 之类的文件。
 *
 * 上游模板里的相对链接（`../协议/…`、`../../../模板/…`）在**上游仓库**里是对的
 * （上游的学习者就工作在仓库根，`协议/` 确实存在），但**本 skill 的工作区里没有框架目录**，
 * 复制过去就是死链。（弱模型实测：GLM-5.2 照抄模板并把深度改成 `../../协议/…`，
 *   生成的文件里留下 3 处死链，学生点开是 404。）
 *
 * 处理分两类：
 *   ① **框架内部链接**（协议/学科包/模板/示例/教程/docs）→ 改成文字说明。
 *      无论复制到哪一层都不可能变成有效链接，索性不让它成为链接。
 *   ② **工作区内部链接**（我的学习/…、资料/…）→ 按目标位置改写成正确的相对路径，
 *      保住可点性（这是模板最有用的部分：交叉引用）。
 */
function defuseTemplateLinks(body, dstFileRel, srcFileRel) {
  const name = srcFileRel.split('/').pop();
  const dest = TEMPLATE_DEST[name];
  if (!dest) return { body, rewritten: 0, defused: 0 };

  let defused = 0;
  let rewritten = 0;
  const out = body.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, text, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole;
    const [pathPart, hash = ''] = target.split(/(?=#)/);
    const p = pathPart.replace(/\\/g, '/');

    // ① 框架内部链接 → 文字
    const fm = /(?:^|\/)(协议|学科包|模板|示例|教程|docs)\/(.+)$/.exec(p);
    if (fm) {
      defused++;
      const label = pickLabel(text, [pathPart, p], `${fm[1]}/${fm[2]}`);
      return '`' + `${label}（在 skill 的 references/ 下）` + '`';
    }

    // ①b 交叉引用另一个模板 → 指向它在工作区里的最终文件名
    const tpl = /(?:^|\/)([^/]*模板\.md)$/.exec(p);
    if (tpl && TEMPLATE_TARGET_NAME[tpl[1]]) {
      const otherName = tpl[1];
      const otherDest = TEMPLATE_DEST[otherName];
      if (otherDest) {
        // 目标文件与「本模板的目标目录」的层级关系
        const rel = posixRelative(dest, `${otherDest}/${TEMPLATE_TARGET_NAME[otherName]}`);
        if (rel !== null) {
          rewritten++;
          const label = pickLabel(text, [pathPart, p, otherName], `\`${TEMPLATE_TARGET_NAME[otherName]}\``);
          return `[${label}](${rel}${hash})`;
        }
      }
      defused++;
      return '`' + `${pickLabel(text, [pathPart, p], otherName)}（同目录下的对应文件）` + '`';
    }

    // ①c 契约文件（上游叫 AGENTS.md，本 skill 叫 SKILL.md）→ 文字
    if (/(^|\/)(AGENTS|CLAUDE)\.(md|en\.md)$/.test(p)) {
      defused++;
      const label = pickLabel(text, [pathPart, p], 'SKILL.md');
      return '`' + `${label}（skill 的入口契约）` + '`';
    }

    // ② 工作区内部链接 → 从目标位置算出的正确相对路径
    const ws = /(?:^|\/)((?:我的学习|资料)\/.+)$/.exec(p);
    if (ws) {
      const targetWs = ws[1];
      const rel = posixRelative(dest, targetWs);
      if (rel !== null) {
        rewritten++;
        // 若原链接文字就是那条路径本身（上游习惯写法），换成更好读的短标签，
        // 免得渲染成 `../../../我的学习/00-学习档案.md` 这种长串。
        const label = pickLabel(text, [pathPart, p, targetWs], shortLabel(targetWs));
        return `[${label}](${rel}${hash})`;
      }
    }
    return whole;
  });
  return { body: out, rewritten, defused };
}

/** 给工作区内部路径起个短标签：`我的学习/00-学习档案.md` → `00-学习档案.md` */
function shortLabel(wsPath) {
  const base = wsPath.split('/').pop();
  return `\`${base}\``;
}

/**
 * 选一个可读的链接文字。
 * 上游习惯写 [`长路径`](长路径) —— 文字与目标相同。这种情况换成短标签，
 * 否则渲染出来是 `../../../我的学习/00-学习档案.md` 这种又长又重复的一串。
 * 注意要先把文字两端的反引号剥掉再比较（`\`../协议/x.md\`` 与 `../协议/x.md` 是同一个东西）。
 */
function pickLabel(text, targets, fallback) {
  const bare = String(text ?? '').replace(/^`|`$/g, '').trim();
  if (!bare) return fallback;
  const isEcho = targets.some((t) => bare === t || bare === t.replace(/^\.\//, ''));
  if (isEcho) return fallback;
  return bare;
}

/** POSIX 相对路径（dest 是目录，均相对工作区根）；无法表达时返回 null */
function posixRelative(fromDir, toPath) {
  const a = fromDir.split('/').filter(Boolean);
  const b = toPath.split('/').filter(Boolean);
  // `<学科>` / `NN-<课名>` 这类占位段也算一层，正常参与计算
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const up = a.slice(i).map(() => '..');
  const down = b.slice(i);
  const rel = [...up, ...down].join('/');
  return rel === '' ? b[b.length - 1] : rel;
}

/**
 * 模板之间的互相引用要**改名**：`学生回答模板.md` 到了工作区叫 `01_学生回答.md`。
 * 只把链接路径重算是不够的（算出来还是 `学生回答模板.md`，那个文件在工作区里不存在）。
 * 这张表是「模板文件名 → 它在工作区里的最终文件名」。
 */
const TEMPLATE_TARGET_NAME = {
  '学习档案模板.md': '00-学习档案.md',
  '课程路线模板.md': '00-课程路线.md',
  '摸底测试模板.md': '00-摸底测试.md',
  '教学引导模板.md': '01_教学引导.md',
  '学生回答模板.md': '01_学生回答.md',
};

/** 精确文件映射（含上面的脚手架）：先于 SKIP 判定，SKIP 只拦目录通配。 */
const EXACT = new Map(MAP.filter(([from]) => !from.endsWith('/')));

/** 刻意不镜像的路径（体积、与学生有关）。`.en.md` 不在此列 —— 它们落到 references/en/。 */
const SKIP = [
  /^AGENTS\.en\.md$/,
  /^宣传视频\//,
  /^我的学习\//,
  /^资料\//,
  /^tests\//,
  /^docs\/[^/]*\/_[^/]*$/, // 上游 docs/ 下划线开头的中间产物（如 docs/simulations/_抽取-*.md）
  /\.(mp4|png|jpg)$/,
];

const SKIP_REASON = [
  [/^AGENTS\.en\.md$/, '英文契约：内容已重写进 SKILL.md 与 README.en.md（不整文件镜像）'],
  [/^宣传视频\//, '视频与封面素材，不属于 skill 资源'],
  [/^我的学习\//, '学习者数据，由 init-workspace 在学生工作区里生成（脚手架已单独映射）'],
  [/^资料\//, '学习者资料，属于学生工作区（脚手架已单独映射）'],
  [/^tests\//, '上游回归测试夹具，不属于 skill 资源'],
  [/^docs\/[^/]*\/_[^/]*$/, '上游 docs/ 下划线开头的中间产物'],
  [/\.(mp4|png|jpg)$/, '二进制素材'],
];

const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

/**
 * 英文镜像的落点：`协议/00_导师协议.en.md` → `references/en/协议/00_导师协议.en.md`。
 * 英文版照样镜像（对英文用户有用），只是与中文版分开放，避免同名混淆。
 */
function englishTarget(p) {
  if (!/\.en\.md$/.test(p)) return null;
  const base = p.replace(/\.en\.md$/, '.md');
  for (const [from, to] of MAP) {
    if (from.endsWith('/')) {
      if (base.startsWith(from)) return 'references/en/' + to.slice('references/'.length) + base.slice(from.length).replace(/\.md$/, '.en.md');
    } else if (base === from) {
      return 'references/en/' + (to.startsWith('references/') ? to.slice('references/'.length) : to).replace(/\.md$/, '.en.md');
    }
  }
  return null;
}

/** 源相对路径 → 目标相对路径；未命中或命中 SKIP 返回 null。 */
function mapPath(srcRel) {
  const p = srcRel.split(sep).join('/');
  if (EXACT.has(p)) return EXACT.get(p);
  const en = englishTarget(p);
  if (en !== null) return en;
  if (SKIP.some((re) => re.test(p))) return null;
  for (const [from, to] of MAP) {
    if (from.endsWith('/')) {
      if (p.startsWith(from)) return to + p.slice(from.length);
    } else if (p === from) {
      return to;
    }
  }
  return null;
}

function walk(dirAbs, rel = '') {
  const out = [];
  for (const name of readdirSync(dirAbs)) {
    if (name === 'node_modules' || name === '.git') continue;
    const abs = join(dirAbs, name);
    const r = rel ? rel + '/' + name : name;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, r));
    else out.push(r);
  }
  return out;
}

/** 收集映射表覆盖到的全部源文件 */
function collect() {
  const roots = MAP.filter(([from]) => from.endsWith('/')).map(([from]) => from.replace(/\/$/, ''));
  const files = [];
  for (const [from] of MAP) {
    if (from.endsWith('/')) continue;
    const abs = join(FROM, from);
    if (existsSync(abs) && statSync(abs).isFile()) files.push(from);
  }
  for (const root of roots) {
    const abs = join(FROM, root);
    if (!existsSync(abs)) continue;
    for (const r of walk(abs)) files.push(root + '/' + r);
  }
  return files;
}

/** 把文件正文里的相对链接重写为「目标视角」的链接；无法映射的降级为纯文本路径。 */
function rewriteLinks(body, srcFileRel, dstFileRel) {
  const srcDir = srcFileRel.includes('/') ? srcFileRel.slice(0, srcFileRel.lastIndexOf('/')) : '';
  const dstDir = dstFileRel.includes('/') ? dstFileRel.slice(0, dstFileRel.lastIndexOf('/')) : '';
  const downgraded = [];

  const replaceLink = (whole, text, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole;
    // Workspace example links have no corresponding file in the skill tree.
    if (/^(?:\.\/)?(学科|我的学习|资料)\//.test(target)) return '`' + text.replace(/^`|`$/g, '') + '`';
    const m = /^([^#]*)(#.*)?$/.exec(target);
    const targetPath = m[1];
    const hash = m[2] ?? '';
    const resolvedSrc = posixJoin(srcDir, targetPath);
    const mapped = mapPath(resolvedSrc);
    if (mapped === null) {
      const shown = resolvedSrc.split(sep).join('/');
      downgraded.push(shown);
      return '`' + (text && text !== target ? `${text}（${shown}）` : shown) + '`';
    }
    let rel = relative(dstDir || '.', mapped).split(sep).join('/');
    if (rel === '') rel = mapped.slice(mapped.lastIndexOf('/') + 1);
    return `[${text}](${rel}${hash})`;
  };

  // Fenced examples belong to the eventual learner document, not this protocol's directory.
  // Preserve their relative links verbatim, including in the English mirror.
  let fence = null;
  const out = body.split('\n').map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return line;
    }
    return fence ? line : line.replace(LINK_RE, replaceLink);
  }).join('\n');

  return { out, downgraded };
}

/** POSIX 风格拼接 + 归一化：链接解析必须用 `/`，不能用平台分隔符（Windows 上 join 会给 `\`）。 */
function posixJoin(dir, p) {
  return norm((dir ? dir + '/' : '') + p.split(sep).join('/'));
}

function norm(p) {
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

const BANNER =
  '> 📄 **只读镜像**（Steps2Great-skill ← StepsToGreat，由 `_build/sync-from-upstream.mjs` 生成；改内容请改上游再同步）。\n' +
  '> 路径口径：`我的学习/`、`资料/`、`学科/`（= `我的学习/学科/`）指**学生工作区**；`协议/`、`学科包/`、`模板/` 指本 skill 的 `references/` 下同名目录。\n';

/** 这些行在镜像时丢弃（英文版指向、上游专属的仓库结构说明） */
const DROP_LINE = [/^\s*>?\s*英文版：/, /^\s*English version:/i, /^\s*>?\s*英文：/];

const files = collect().filter((f) => mapPath(f) !== null);
const written = [];
const stale = [];
const downgradedAll = new Map();
const templateStats = [];

for (const srcFileRel of [...files].sort()) {
  const dstFileRel = mapPath(srcFileRel);
  const abs = join(FROM, srcFileRel);
  const raw = readFileSync(abs, 'utf8');

  if (dstFileRel === 'SKILL.md') {
    console.log(`  跳过 ${srcFileRel}（SKILL.md 手写，见文件头的映射说明）`);
    continue;
  }

  let body = raw;
  let downgraded = [];
  // 模板要**跳过**通用链接重写：通用重写按 `references/模板/` 这个落点算相对路径，
  // 而模板真正的工作位置是「学生工作区」（见 TEMPLATE_DEST），两套坐标系不同。
  // 模板一律交给下面的 defuseTemplateLinks 单独处理。
  const isTemplate = srcFileRel.startsWith('模板/');
  if (srcFileRel.endsWith('.md') && !isTemplate) {
    body = raw.split(/\r?\n/).filter((l) => !DROP_LINE.some((re) => re.test(l))).join('\n');
    ({ out: body, downgraded } = rewriteLinks(body, srcFileRel, dstFileRel));
    body = body.replace(/^\s*---\s*\n/, ''); // 去掉紧邻的分隔线（丢行后可能形成孤儿 ---）
  } else if (isTemplate) {
    body = raw.split(/\r?\n/).filter((l) => !DROP_LINE.some((re) => re.test(l))).join('\n');
  }

  // 定点改写（skill 口径修正），在链接重写之后做，避免刚改出来的路径又被改写
  for (const [re, to] of TRANSFORM.find(([f]) => f === srcFileRel)?.[1] ?? []) {
    body = body.replace(re, to);
  }

  // 模板目录特有：链接要按「模板将被复制到哪」改写（详见 defuseTemplateLinks 注释）
  {
    const r = defuseTemplateLinks(body, dstFileRel, srcFileRel);
    if (r.defused || r.rewritten) {
      templateStats.push({ file: dstFileRel, ...r, body: undefined });
    }
    body = r.body;
  }

  if (downgraded.length) downgradedAll.set(dstFileRel, [...new Set(downgraded)]);

  const content = srcFileRel.endsWith('.md') ? BANNER + '\n' + body : body;
  written.push(dstFileRel);
  if (CHECK) {
    const target = join(TO, dstFileRel);
    if (!existsSync(target) || readFileSync(target, 'utf8') !== content) stale.push(dstFileRel);
  }
  if (!DRY) {
    mkdirSync(dirname(join(TO, dstFileRel)), { recursive: true });
    writeFileSync(join(TO, dstFileRel), content, 'utf8');
  }
}

if (PRUNE && !DRY) {
  const kept = new Set(written);
  for (const r of walk(join(TO, 'references'))) {
    const dstRel = 'references/' + r.split(sep).join('/');
    if (!kept.has(dstRel) && !dstRel.endsWith('README.md')) {
      rmSync(join(TO, dstRel));
      console.log(`  删除（已不在映射内）${dstRel}`);
    }
  }
}

console.log(`源  ：${FROM}`);
console.log(`目标：${TO}`);
const skipped = walk(FROM).filter((f) => SKIP.some((re) => re.test(f.split(sep).join('/'))));
console.log(`\n镜像 ${written.length} 个文件${DRY ? '（--dry，未落盘）' : ''}`);
for (const f of written) console.log('  ✓ ' + f);

if (!DRY || CHECK) {
  try { exportProject(FROM, join(TO, 'assets/project'), CHECK); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
if (CHECK && stale.length) {
  console.error(`❌ 镜像内容过期或缺失（${stale.length} 个）：\n${stale.join('\n')}`);
  process.exitCode = 1;
} else if (CHECK) console.log('✅ 镜像内容与上游一致');

console.log(`\n刻意跳过 ${skipped.length} 个文件：`);
for (const [re, why] of SKIP_REASON) {
  const hits = walk(FROM).filter((f) => re.test(f.split(sep).join('/')));
  if (hits.length) console.log(`  ✗ ${String(hits.length).padStart(3)} 个 —— ${why}`);
}

if (downgradedAll.size) {
  console.log('\nℹ️ 链接改写说明：');
  let wsCount = 0;
  for (const [file, links] of downgradedAll) {
    const ws = links.filter((l) => /^(我的学习|资料)\//.test(l));
    const other = links.filter((l) => !/^(我的学习|资料)\//.test(l));
    wsCount += ws.length;
    if (ws.length) console.log(`  🔒 ${file} —— 工作区路径，保留为纯文本（学生工作区里才有）：${ws.join('、')}`);
    for (const l of other) console.log(`  ⚠️ ${file} —— ${l} 未镜像（上游专属，已降级为文本）`);
  }
  if (wsCount) console.log('  （banner 已说明：以 我的学习/ 资料/ 开头的路径指学习者工作区）');
}

if (templateStats.length) {
  console.log('\n📐 模板链接改写（按「模板将被复制到哪」重算相对路径）：');
  for (const t of templateStats) {
    console.log(`  ${t.file}`);
    console.log(`     框架内部链接 → 文字说明：${t.defused} 处`);
    console.log(`     工作区内部链接 → 重算为正确相对路径：${t.rewritten} 处`);
  }
}
