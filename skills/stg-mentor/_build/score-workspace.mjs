#!/usr/bin/env node
/**
 * score-workspace.mjs —— 按六维给一个被测工作区打分（只读，不修改任何文件）
 *
 * 为什么不直接用 validate-state.mjs：它是**状态自洽性**校验器（10 条不变式），
 * 抓不到本次测试最关心的两类问题：
 *   ① 落档层的重复 —— 「最终复评结果」被写了两遍（一份已填一份是空占位）
 *      上游那次弱模型测试吃过这个亏：GLM 拿到 PASSED，却留下两份互相矛盾的复评区
 *   ② 封装层的口径错 —— 产出里写 skill 目录路径、工作区死链
 * 所以本脚本是**补充**，不是替代：F 维仍调用 validate-state.mjs。
 *
 * 用法：
 *   node _build/score-workspace.mjs --root <工作区> [--skill <skill 目录>]
 *
 * 退出码：0 = 跑完（分数看输出）/ 2 = 找不到工作区
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const argOf = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const ROOT = resolve(argOf('--root', '.'));
/**
 * 校验器位置解析顺序：
 *   ① 显式 --skill
 *   ② 已安装的 skill 目录（~/.dsh/skills/steps2great-skill）
 *   ③ **本仓库自己**（跑分的人通常就在仓库里）
 * 为什么要有 ③：把 skill 临时卸掉之后，跑分器会「找不到校验器」而把 F 维判成 1/2，
 * 于是同一份产出在不同时刻得到不同分数 —— 那是跑分器的不稳定，不是模型的差异。
 * 跑分器的输入应当只有「被测产出」，不该受本机装了没装 skill 影响。
 */
function resolveSkill() {
  const explicit = argOf('--skill');
  const candidates = [
    explicit,
    join(process.env.USERPROFILE ?? '', '.dsh', 'skills', 'steps2great-skill'),
    join(dirname(fileURLToPath(import.meta.url)), '..'),
  ].filter(Boolean);
  for (const c of candidates) {
    const abs = resolve(c);
    if (existsSync(join(abs, 'scripts', 'validate-state.mjs'))) return abs;
  }
  return resolve(explicit ?? join(process.env.USERPROFILE ?? '', '.dsh', 'skills', 'steps2great-skill'));
}
const SKILL = resolveSkill();

if (!existsSync(ROOT)) {
  console.error(`❌ 找不到工作区：${ROOT}`);
  process.exit(2);
}

const findings = [];
const add = (dim, level, msg) => findings.push({ dim, level, msg });
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/**
 * 判断覆盖层里有没有**真正生效**的规则。
 *
 * 不能简单地「去掉 HTML 注释再看有没有 `- `」—— 因为 `我的规则.md` 里
 * 有一节是**用代码块示范怎么取消注释**的：
 *     ```markdown
 *     <!-- 改之前：这行是注释，不生效 -->
 *     <!-- - 每轮出题：2 题 -->
 *     <!-- 改之后：生效了，覆盖框架默认 -->
 *     - 每轮出题：1 题
 *     ```
 * 代码块里那行 `- 每轮出题：1 题` 是**示例文本**，不是生效规则。
 * 不排除代码块就会把「原样未改的脚手架」误判成「学生写过规则」。
 * （踩过：GLM-5.2 的规则文件与脚手架逐字节相同，却被判 A 维扣分。）
 */
function hasActiveRules(text) {
  const noCode = text.replace(/```[\s\S]*?```/g, ''); // 先整块移除围栏代码
  const noComment = noCode.replace(/<!--[\s\S]*?-->/g, ''); // 再移除 HTML 注释
  return /^\s*-\s+\S/m.test(noComment);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** 六个维度，顺序即报告顺序 */
const DIMS = ['A 接手顺序', 'B 轮次纪律', 'C 三维评估', 'D 代改协议', 'E 落档纪律', 'F 自检通过'];

const PROFILE = join(ROOT, '我的学习', '00-学习档案.md');
const RULES = join(ROOT, '我的学习', '我的规则.md');
const profile = read(PROFILE);
const rules = read(RULES);

console.log(`工作区：${ROOT}`);
console.log(`skill ：${SKILL}\n`);

if (profile === undefined) {
  console.error('❌ 没有 我的学习/00-学习档案.md —— 这个工作区没被初始化或没产出');
  process.exit(2);
}
if (rules === undefined) add('A 接手顺序', 'FAIL', '缺 我的规则.md（覆盖层没建）');

// ── 运行类型判定（方法学）──────────────────────────────────────────────
//
// 六维评分是为**完整符合性运行**（走到整课闭环）设计的。只走到摸底阶段的路由测试
// 不该套用六维 —— 那样 C/D/E 会因为没有产出而虚低，制造假结论。
// （踩过：拿路由测试的输出当六维分数，得出「9/12 需补指引」的错误印象。）
const answers = walk(join(ROOT, '我的学习', '学科')).filter((p) => p.endsWith('01_学生回答.md'));
const hasLesson = answers.length > 0;
const RUN_TYPE = hasLesson ? '完整符合性运行' : '路由/摸底阶段运行';
console.log(`运行类型：${RUN_TYPE}（回答文档 ${answers.length} 份）\n`);
if (!hasLesson) {
  console.log('⚠️ 本次没有回答文档 —— 六维评分**不适用**（C/D/E 需整课产出）。');
  console.log('   路由测试只需回答两件事：① 是否自主加载了 skill？② 是否正确定位并使用了 skill 里的脚本/参考？\n');
}

// ── A. 接手顺序 ────────────────────────────────────────────────────────
// 直接判据（读了没读）无法从产物看出，但可以判「是否无端改写了覆盖层」——
// 覆盖层是最高优先级，未经学生授权就写入 = 违反接手顺序里「先读、尊重覆盖层」
{
  const original = read(join(SKILL, 'templates', 'workspace', '我的规则.md'));
  if (rules !== undefined) {
    if (original !== undefined && rules.trim() === original.trim()) {
      add('A 接手顺序', 'ok', '我的规则.md 保持全注释（空覆盖层被正确尊重）');
    } else if (hasActiveRules(rules)) {
      add('A 接手顺序', 'warn', '我的规则.md 被写入 —— 需人工确认是否经学生同意');
    } else {
      add('A 接手顺序', 'ok', '我的规则.md 无生效规则');
    }
  }
  // 摸底/开课之前不该动 📊 掌握表（状态机 I 系列）
  if (profile !== undefined && /\|\s*✅\s*已掌握/.test(profile) && !/最终复评结果/.test(profile)) {
    const answers = walk(join(ROOT, '我的学习', '学科')).filter((p) => p.endsWith('01_学生回答.md'));
    const anyFinal = answers.some((a) => /^##\s*最终复评结果/m.test(read(a) ?? ''));
    if (!anyFinal) add('A 接手顺序', 'FAIL', '📊 掌握表标了「已掌握」，但没有任何回答文档写过「最终复评结果」—— 提前推进');
  }
}

// ── B. 轮次纪律 ────────────────────────────────────────────────────────
if (answers.length === 0) {
  add('B 轮次纪律', 'warn', '还没有回答文档（可能只走到摸底阶段）');
}
for (const a of answers) {
  const t = read(a) ?? '';
  // 只数**题目小节本身**，绝不全文数「问题 N」。
  // 踩过：回答文档的评估区会反复提到题号（「三段式讲解（问题 1）」「问题 1 修正点」），
  // 全文计数会把第 1 轮的 2 题数成 6 题 → 误报「违反每轮 1–3 题」。
  // 判据是**标题行**：`第 N 轮 · 问题 M`（允许 `·`/`-`/`：` 等分隔）。
  const qPerRound = {};
  const qHeadRe = /^#+\s*第\s*([一二三四五1-5])\s*轮\s*[·・:：\-—]*\s*问题\s*(\d+)/gm;
  for (const m of t.matchAll(qHeadRe)) {
    qPerRound[m[1]] = (qPerRound[m[1]] ?? 0) + 1;
  }
  const entries = Object.entries(qPerRound).sort((x, y) => Number(x[0]) - Number(y[0]));
  if (entries.length === 0) {
    // 退回：用「第 N 轮」标记估个数（部分模型把题目写成普通列表）
    const roundNames = [...new Set([...t.matchAll(/^#+\s*第\s*([一二三四五1-5])\s*轮/gm)].map((m) => m[1]))];
    if (roundNames.length === 0) {
      add('B 轮次纪律', 'warn', `${rel(a)} 找不到「第 N 轮」标记，无法核对题量`);
    } else {
      for (const r of roundNames) {
        const seg = new RegExp(`第\\s*${r}\\s*轮([\\s\\S]*?)(?=^#+\\s*第\\s*[一二三四五1-5]\\s*轮|(?![\\s\\S]))`, 'm').exec(t);
        const body = seg ? seg[1] : '';
        // 排除评估区之后再数题号
        const beforeEval = body.split(/^#+\s*第\s*[一二三四五1-5]\s*轮\s*导师评估|^#+\s*导师评估|^#+\s*三维评估/m)[0];
        const n = new Set([...beforeEval.matchAll(/问题\s*(\d+)/g)].map((m) => m[1])).size;
        qPerRound[r] = n;
      }
      add('B 轮次纪律', 'warn', `${rel(a)} 无「第 N 轮 · 问题 M」标题，按题号估算：${Object.entries(qPerRound).map(([r, n]) => `第${r}轮≈${n}题`).join(' / ')}`);
    }
  }
  const finalEntries = Object.entries(qPerRound).sort((x, y) => Number(x[0]) - Number(y[0]));
  const over = finalEntries.filter(([, n]) => n > 3);
  if (entries.length > 0) {
    if (over.length) {
      for (const [r, n] of over) {
        add('B 轮次纪律', 'FAIL', `${rel(a)} 第 ${r} 轮出了 ${n} 题（>3，违反硬规则 6）`);
      }
    } else {
      add('B 轮次纪律', 'ok', `${rel(a)} 各轮题量：${finalEntries.map(([r, n]) => `第${r}轮=${n}题`).join(' / ')}`);
    }
  }
}

// ── C. 三维评估 ────────────────────────────────────────────────────────
for (const a of answers) {
  const t = read(a) ?? '';
  const hasConcept = /概念理解/.test(t);
  const hasLogic = /逻辑正确/.test(t);
  // 维度③的名称随学科变化，接受任意一种
  const hasNorm = /规范表达|语法可编译|推导与计算|表述规范|答题规范/.test(t);
  if (hasConcept && hasLogic && hasNorm) {
    add('C 三维评估', 'ok', `${rel(a)} 三维齐全（含维度③的学科名）`);
  } else {
    const miss = [!hasConcept && '概念理解', !hasLogic && '逻辑正确', !hasNorm && '维度③'].filter(Boolean);
    add('C 三维评估', 'FAIL', `${rel(a)} 缺维度标注：${miss.join('、')}`);
  }
  if (answers.length && !/不适用/.test(t)) {
    add('C 三维评估', 'warn', `${rel(a)} 没有出现「不适用」—— 纯概念题应把不适用维度标出来`);
  }
}

// ── D. 代改协议（三段式）───────────────────────────────────────────────
for (const a of answers) {
  const t = read(a) ?? '';
  const p1 = /原答案|你的原答案/.test(t);
  const p2 = /问题在哪里|错在哪|为什么错|问题在于/.test(t);
  const p3 = /我改成|正确写法|改成了|我改成的是/.test(t);
  if (p1 && p2 && p3) add('D 代改协议', 'ok', `${rel(a)} 三段式齐全（原答案 / 错因 / 改法）`);
  else {
    const miss = [!p1 && '①原答案', !p2 && '②错因', !p3 && '③改法'].filter(Boolean);
    add('D 代改协议', 'FAIL', `${rel(a)} 三段式缺：${miss.join('、')}（协议第 5 节：只回「已修改」不合格）`);
  }
}

// ── E. 落档纪律（本次重点）─────────────────────────────────────────────
for (const a of answers) {
  const t = read(a) ?? '';
  const finals = (t.match(/^##\s*最终复评结果/gm) ?? []).length;
  const parses = (t.match(/^##\s*正确答案与解析/gm) ?? []).length;
  let bad = false;
  if (finals > 1) {
    add('E 落档纪律', 'FAIL', `${rel(a)} 「最终复评结果」出现 ${finals} 次（应 1 次）—— 会产生两份互相矛盾的复评区`);
    bad = true;
  }
  if (parses > 1) {
    add('E 落档纪律', 'FAIL', `${rel(a)} 「正确答案与解析」出现 ${parses} 次（应 1 次）`);
    bad = true;
  }
  if (/由导师填写|整课所有轮次通过后由导师填写/.test(t)) {
    add('E 落档纪律', 'FAIL', `${rel(a)} 残留模板空占位「由导师填写」（忘删模板占位块）`);
    bad = true;
  }
  if (!bad && finals === 1 && parses === 1) {
    add('E 落档纪律', 'ok', `${rel(a)} 复评区唯一、无残留占位`);
  } else if (!bad && finals === 0) {
    add('E 落档纪律', 'warn', `${rel(a)} 还没写「最终复评结果」（若整课未通过则正常）`);
  }
  // 只增不改：学生原始答案不应被覆盖成空
  if (/你的回答：\s*```\s*```/.test(t)) {
    add('E 落档纪律', 'warn', `${rel(a)} 有空的作答围栏 —— 可能是学生未答，也可能是答案被覆盖`);
  }
}
// 中间轮次不该动 📊/⏳
if (profile !== undefined) {
  // 只看 📊 掌握表**小节内部**的行 —— 别处的表（如「档案更新触发点」）也有
  // `⏳` 这类状态列，若全文扫描会把模板行误判成「已写入掌握记录」。
  // （踩过两次：先是被模板示例行骗，再是被「档案更新触发点」表骗。）
  const masterySection = (/##\s*📊[^\n]*\n([\s\S]*?)(?=\n##\s|\n---\s*\n##|$)/.exec(profile) ?? [, ''])[1];
  const masteryRows = (masterySection.match(/^\|[^|]+\|[^|]+\|[^|]*\|[^|]*\|/gm) ?? [])
    .filter((row) => !/^-{2,}|^\|\s*-{2,}/.test(row)) // 分隔行
    .filter((row) => !/<\s*知识点\s*>|<yyyy-mm-dd>|<\s*填\s*>|（尚未开始）/.test(row)) // 模板占位行
    .filter((row) => /✅|⚠️|⏳/.test(row)).length;
  const anyFinal = answers.some((a) => /^##\s*最终复评结果/m.test(read(a) ?? ''));
  if (masteryRows > 0 && !anyFinal) {
    add('E 落档纪律', 'FAIL', `📊 掌握表已写入 ${masteryRows} 条真实记录，但没有任何「最终复评结果」—— 中间轮次动了档案`);
  }
}

// ── F. 自检通过（调用 skill 里的校验器）────────────────────────────────
const validator = join(SKILL, 'scripts', 'validate-state.mjs');
if (existsSync(validator)) {
  console.log('--- validate-state.mjs ---');
  try {
    const out = execFileSync(process.execPath, [validator, '--root', ROOT], { encoding: 'utf8' });
    console.log(out.trim());
    // 校验器的三种结局：PASSED / NEW（空模板） / FAILED
    const passed = /状态：PASSED|状态：NEW（空模板）|→ 状态 = NEW/.test(out) || /PASSED|BLANK/.test(out);
    add('F 自检通过', passed ? 'ok' : 'FAIL', passed ? 'validate-state.mjs 通过' : 'validate-state.mjs 未通过');
  } catch (error) {
    const out = String(error.stdout ?? error.message);
    console.log(out.trim());
    add('F 自检通过', 'FAIL', 'validate-state.mjs 退出码非 0');
  }
  console.log('---\n');
} else {
  add('F 自检通过', 'warn', `找不到校验器：${validator}`);
}

// ── 封装层专查（本次测试真正要看的东西）────────────────────────────────
//
// 注意：只查**被测模型自己产出**的文件。`init-workspace.mjs` 复制过去的脚手架
// （我的规则.md / README.md / 资料-README.md）本来就用「在 skill 的 references/ 下」
// 这种说明性措辞，那是**脚手架设计**，不是模型的口径错误 —— 若把它们计入，
// 会给每一次运行都刷出假阳性，让这一维失去信号。（踩过这个坑。）
const SCAFFOLD = new Set([
  '我的学习/我的规则.md',
  '我的学习/我的规则.en.md',
  '我的学习/README.md',
  '资料/README.md',
]);

for (const f of walk(ROOT)) {
  const t = read(f);
  if (t === undefined) continue;
  const r = rel(f);
  const isScaffold = SCAFFOLD.has(r) || r === '.steps2great.json';
  // ① 路径口径错：工作区产出里出现 skill 目录口径（脚手架文件豁免）
  //
  // 注意：模板里**本来就该**写「协议/xx.md（在 skill 的 references/ 下）」这种说明
  // —— 那是我们主动改写的正确结果（避免复制进工作区变死链），不是模型的口径错误。
  // 只有**以链接形式**指向 skill 目录才算错（那会在工作区里变死链）。
  if (!isScaffold) {
    const badLink = [...t.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)]
      .map((m) => m[1])
      .find((tg) => /(\.dsh[\\/]skills|references\/(协议|学科包|模板|示例|教程))/.test(tg));
    if (badLink) {
      add('封装·路径口径', 'warn', `${r} 用**链接**指向 skill 目录（${badLink}）—— 工作区里是死链`);
    } else if (/\.dsh[\\/]skills/.test(t) && !/（在 skill 的 references\/ 下）/.test(t)) {
      add('封装·路径口径', 'warn', `${r} 出现 skill 安装路径（.dsh/skills）`);
    }
  }
  // ② 死链（脚手架里的说明性路径不算死链目标）
  if (!isScaffold) {
    for (const m of t.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
      const target = m[2];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const abs = resolve(join(f, '..'), target.split('#')[0]);
      if (!existsSync(abs)) add('封装·死链', 'warn', `${r} 死链 → ${target}`);
    }
  }
}

// ── 计分与输出 ─────────────────────────────────────────────────────────
const score = Object.fromEntries(DIMS.map((d) => [d, 2]));
for (const f of findings) {
  if (!(f.dim in score)) continue;
  if (f.level === 'FAIL') score[f.dim] = 0;
  else if (f.level === 'warn') score[f.dim] = Math.min(score[f.dim], 1);
}

console.log('六维评分：');
let total = 0;
for (const d of DIMS) {
  total += score[d];
  console.log(`  ${score[d]}/2  ${d}`);
  for (const f of findings.filter((x) => x.dim === d)) {
    console.log(`         [${f.level}] ${f.msg}`);
  }
}
if (hasLesson) {
  console.log(`\n总分：${total}/12`);
  console.log(total >= 10 ? '→ 协议对弱模型够明确' : total >= 7 ? '→ 需补明确指引' : '→ 对弱模型不可用，必须改');
} else {
  console.log('\n（无回答文档，总分不给出 —— 见上方「运行类型」说明）');
}

const pack = findings.filter((f) => f.dim.startsWith('封装'));
if (pack.length) {
  console.log('\n封装层专查：');
  for (const f of pack) console.log(`  [${f.level}] ${f.msg}`);
} else {
  console.log('\n封装层专查：未发现路径口径错或死链 ✅');
}
