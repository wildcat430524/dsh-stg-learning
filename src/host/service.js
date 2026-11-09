import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import stg from '../../vendor/stg/stg.cjs';
import learningTools from '../../vendor/stg/learning.cjs';
import progressTools from '../../vendor/stg/learning-progress.cjs';
import answerRecords from '../../vendor/stg/answer-records.cjs';
import { roundKey, roundToken } from '../round.js';
import {
  atomicWrite, bytesAt, DOCUMENT_LIMIT, ensureDirectory, fail, filesystemError,
  hash, invalidPath, isDocument, posix, relativePath, resolvePath, serialized, textAt, treeAt,
} from './files.js';
import { readState, writeState } from './state.js';

export { WorkbenchError } from './files.js';
const { parseQuestions, appendAnswers } = stg;
const { getLearningState, describeFile } = learningTools;
const { getLearningProgress } = progressTools;
const { analyzeAnswerRecords } = answerRecords;
const VERSION = /^[a-f0-9]{64}$/;
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const byName = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });

function validateContent(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > DOCUMENT_LIMIT || (content.isWellFormed && !content.isWellFormed())) {
    fail('INVALID_DOCUMENT', 400, '文档内容必须是有效文本，且不超过 8 MB。');
  }
}
function validateMutation({ expectedVersion, operationId }) {
  if (typeof expectedVersion !== 'string' || !VERSION.test(expectedVersion)) fail('VERSION_REQUIRED', 400, '保存需要已读取文档的版本标识。');
  if (typeof operationId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(operationId)) {
    fail('INVALID_OPERATION', 400, '保存需要有效且唯一的 operationId。');
  }
}
function versionConflict(expected, current) {
  fail('VERSION_CONFLICT', 409, '文件已被其他窗口或导师修改。当前草稿已保留，请重新加载后合并。', { expectedVersion: expected, currentVersion: current });
}
function documentSnapshot(relative, content, modifiedAt) {
  return {
    path: relative, content, version: hash(content), questions: parseQuestions(content),
    records: analyzeAnswerRecords(content), ...(modifiedAt ? { modifiedAt } : {}),
  };
}
async function readDocument(root, relative) {
  relative = relativePath(relative);
  if (!isDocument(relative)) fail('UNSUPPORTED_DOCUMENT', 415, '学习工作台只读取和编辑 Markdown 和 TXT 文档。');
  const document = await textAt(root, relative);
  return documentSnapshot(relative, document.content, document.modifiedAt);
}
function flatten(tree) {
  const files = [];
  const walk = nodes => { for (const node of nodes) { if (node.children) walk(node.children); else if (node.readable) files.push(node.path); } };
  walk(tree.children);
  return files;
}
function courseDirectory(file) {
  const parts = file.split('/');
  const subjectIndex = parts.lastIndexOf('学科');
  return subjectIndex >= 0 && parts.length - subjectIndex >= 4
    ? parts.slice(0, subjectIndex + 3).join('/') : path.posix.dirname(file);
}
function preferred(files, current) {
  return files.includes(current) ? current : files.slice().sort(byName)[0] || null;
}
function matchingRound(rounds, value) {
  const key = roundKey(value);
  if (!key) return null;
  return rounds.find(round => roundKey(round.title) === key) || null;
}
async function currentRoundOf(root, learning, courseRounds, answerPath, warnings) {
  // 1) The learning profile's 🚦 handoff is the only explicit declaration.
  const declared = matchingRound(courseRounds, learning.round);
  if (declared) return declared;
  if (learning.round) {
    if (courseRounds.length) warnings.push(`学习档案轮次「${learning.round}」未在本课教学文档中找到，请核对交接状态。`);
    return null;
  }
  // 2) The answer document's current question round is real scanned evidence
  //    when the profile has no explicit round (common in imported courses).
  if (answerPath) {
    try {
      const answer = await readDocument(root, answerPath);
      const evidenced = matchingRound(courseRounds, answer.questions?.round);
      if (evidenced) return evidenced;
    } catch (error) { warnings.push(`无法读取回答文档轮次 ${answerPath}：${error.message}`); }
  }
  // 3) A lesson with exactly one identifiable round can only be that round.
  if (courseRounds.length === 1) return courseRounds[0];
  return null;
}
async function coursesFrom(root, files, learning, warnings) {
  const grouped = new Map();
  for (const file of files) {
    const kind = describeFile(file).kind;
    if (kind !== 'guide' && kind !== 'answer') continue;
    const directory = courseDirectory(file);
    let group = grouped.get(directory);
    if (!group) { group = { guides: [], answers: [] }; grouped.set(directory, group); }
    group[kind === 'guide' ? 'guides' : 'answers'].push(file);
  }
  const courses = [];
  for (const [directory, group] of [...grouped].sort((a, b) => byName(a[0], b[0]))) {
    const parts = directory.split('/');
    const index = parts.lastIndexOf('学科');
    const guidePath = preferred(group.guides, learning.guidePath);
    const answerPath = preferred(group.answers, learning.answerPath);
    const rounds = [];
    const seenRounds = new Set();
    const addRound = round => {
      if (!round || seenRounds.has(`${round.id}\u0000${round.path}`)) return;
      seenRounds.add(`${round.id}\u0000${round.path}`);
      rounds.push(round);
    };
    for (const file of group.guides.sort(byName)) {
      try {
        const document = await readDocument(root, file);
        const sourceRounds = document.records.rounds;
        const filenameRound = roundToken(path.posix.basename(file));
        if (sourceRounds.length > 1) {
          for (const round of sourceRounds) addRound({ id: `${file}#round=${encodeURIComponent(round.round)}`, title: round.title, path: file });
        } else {
          addRound({ id: file, title: sourceRounds[0]?.title || filenameRound || describeFile(file).displayName, path: file });
        }
      } catch (error) { warnings.push(`无法解析课程文档 ${file}：${error.message}`); }
    }
    // An answer-only lesson stays navigable, with only its evidenced rounds.
    if (!rounds.length && answerPath) {
      try {
        const document = await readDocument(root, answerPath);
        for (const round of document.records.rounds) addRound({ id: `${answerPath}#round=${encodeURIComponent(round.round)}`, title: round.title, path: answerPath });
      } catch (error) { warnings.push(`无法解析回答文档 ${answerPath}：${error.message}`); }
    }
    const currentHere = [learning.guidePath, learning.answerPath].some(file => file && courseDirectory(file) === directory);
    const currentRound = currentHere ? await currentRoundOf(root, learning, rounds, answerPath, warnings) : null;
    courses.push({
      id: directory, directory, title: directory === '.' ? path.basename(root) : parts.at(-1),
      subject: index >= 0 ? parts[index + 1] : (currentHere ? learning.subject : null),
      guidePath, answerPath, rounds, ...(currentRound ? { currentRoundId: currentRound.id } : {}),
    });
  }
  return courses;
}

function backupId(relative, id) {
  if (typeof id !== 'string' || !new RegExp(`^${hash(relative)}-\\d{13}-${UUID}\\.bak$`).test(id)) {
    fail('INVALID_HISTORY', 400, '备份标识无效或不属于此文档。');
  }
  return `.stg-desk/backups/${id}`;
}
async function historyItems(root, relative) {
  relative = posix(path.relative(root, await resolvePath(root, relative)));
  let directory;
  try { directory = await resolvePath(root, '.stg-desk/backups', { internal: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(`${hash(relative)}-`)) continue;
    if (!new RegExp(`^${hash(relative)}-\\d{13}-${UUID}\\.bak$`).test(entry.name)) continue;
    const relativeBackup = backupId(relative, entry.name);
    const target = await resolvePath(root, relativeBackup, { internal: true });
    const stat = await fs.lstat(target);
    if (!entry.isFile() || !stat.isFile()) continue;
    const timestamp = Number(entry.name.slice(65, 78));
    items.push({ id: entry.name, date: new Date(timestamp).toISOString(), bytes: stat.size });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
async function backupDocument(root, relative, content) {
  await ensureDirectory(root, '.stg-desk/backups');
  const id = `${hash(relative)}-${Date.now()}-${randomUUID()}.bak`;
  const file = backupId(relative, id);
  // Publish only flushed, complete versions. Unpredictable names preserve existing history.
  await atomicWrite(root, file, content, { internal: true });
  await resolvePath(root, file, { internal: true });
}
async function readReceipt(root, receiptPath) {
  let document;
  try { document = await textAt(root, receiptPath, { internal: true, limit: 64 * 1024 * 1024 }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  let receipt;
  try { receipt = JSON.parse(document.content); }
  catch { fail('OPERATION_RECOVERY_REQUIRED', 409, '保存操作记录损坏，原文件已保留。'); }
  if (receipt?.schema !== 1 || typeof receipt.content !== 'string' || !VERSION.test(receipt.beforeVersion || '')
    || hash(receipt.content) !== receipt.afterVersion || !VERSION.test(receipt.payloadHash || '') || typeof receipt.committed !== 'boolean') {
    fail('OPERATION_RECOVERY_REQUIRED', 409, '保存操作记录无效，原文件已保留。');
  }
  validateContent(receipt.content);
  return receipt;
}
async function writeReceipt(root, receiptPath, receipt) {
  await ensureDirectory(root, '.stg-desk/operations');
  await atomicWrite(root, receiptPath, `${JSON.stringify(receipt)}\n`, { internal: true });
}

async function mutateDocument(root, relative, request, kind, payload, compose) {
  validateMutation(request);
  const target = await resolvePath(root, relative);
  const canonical = posix(path.relative(root, target));
  const receiptPath = `.stg-desk/operations/${hash(request.operationId)}.json`;
  const payloadHash = hash(JSON.stringify({ kind, path: canonical, expectedVersion: request.expectedVersion, payload }));
  return serialized(`${root}/${receiptPath}`, () => serialized(target, async () => {
    if ((await resolvePath(root, relative)) !== target) invalidPath();
    let receipt = await readReceipt(root, receiptPath);
    if (receipt && (receipt.kind !== kind || receipt.path !== canonical || receipt.payloadHash !== payloadHash)) {
      fail('OPERATION_CONFLICT', 409, '此 operationId 已用于不同的保存内容，请为新操作生成新标识。');
    }
    if (receipt?.committed) return documentSnapshot(relative, receipt.content, receipt.modifiedAt);
    const current = await readDocument(root, relative);
    if (receipt && current.version === receipt.afterVersion) {
      receipt.committed = true;
      receipt.modifiedAt = current.modifiedAt;
      await writeReceipt(root, receiptPath, receipt);
      return documentSnapshot(relative, receipt.content, receipt.modifiedAt);
    }
    if (current.version !== request.expectedVersion || (receipt && current.version !== receipt.beforeVersion)) {
      versionConflict(request.expectedVersion, current.version);
    }
    if (!receipt) {
      const content = await compose(current);
      validateContent(content);
      receipt = { schema: 1, kind, path: canonical, payloadHash, beforeVersion: current.version, afterVersion: hash(content), content, committed: false, createdAt: new Date().toISOString() };
      // A prepared receipt makes a crash between document replacement and receipt commit recoverable.
      await writeReceipt(root, receiptPath, receipt);
    }
    if (receipt.afterVersion !== current.version) {
      await backupDocument(root, canonical, current.content);
      const mode = (await fs.stat(target)).mode;
      await atomicWrite(root, canonical, receipt.content, {
        mode,
        beforeReplace: async () => {
          if ((await resolvePath(root, relative)) !== target) invalidPath();
          const latest = await readDocument(root, relative);
          if (latest.version !== current.version) versionConflict(current.version, latest.version);
        },
      });
    }
    const result = await readDocument(root, relative);
    if (result.version !== receipt.afterVersion) versionConflict(receipt.afterVersion, result.version);
    receipt.committed = true;
    receipt.modifiedAt = result.modifiedAt;
    await writeReceipt(root, receiptPath, receipt);
    return result;
  }));
}

function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 3) fail('INVALID_ANSWERS', 400, '请提交当前轮 1–3 道题的回答。');
  const seen = new Set();
  return answers.map(answer => {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || Object.keys(answer).some(key => !['id', 'text'].includes(key))
      || typeof answer.id !== 'string' || !/^\d+$/.test(answer.id) || typeof answer.text !== 'string' || !answer.text.trim()
      || Buffer.byteLength(answer.text) > DOCUMENT_LIMIT || seen.has(answer.id)) fail('INVALID_ANSWERS', 400, '回答必须包含互不重复的当前题目标识和非空文本。');
    seen.add(answer.id);
    return { id: answer.id, text: answer.text };
  });
}
function imageMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp' && /^(?:avif|avis)$/.test(bytes.subarray(8, 12).toString('ascii'))) return 'image/avif';
  return null;
}

/** DSH owns workspace registration. Browser payloads supply an id, never an absolute filesystem root. */
export function createWorkbenchService({ resolveWorkspace, learningOnly = false } = {}) {
  if (typeof resolveWorkspace !== 'function') throw new TypeError('createWorkbenchService requires resolveWorkspace(workspaceId)');
  async function context(request) {
    if (!request || typeof request !== 'object' || typeof request.workspaceId !== 'string' || !request.workspaceId.trim() || request.workspaceId.length > 512) {
      fail('WORKSPACE_NOT_FOUND', 404, '请先选择已在 DSH 注册的工作区。');
    }
    let registered;
    try { registered = await resolveWorkspace(request.workspaceId); }
    catch (error) { if (error?.code === 'NOT_STG_WORKSPACE') throw error; fail('WORKSPACE_NOT_FOUND', 404, '工作区未注册或已被移除。'); }
    if (!registered || registered.workspaceId !== request.workspaceId || typeof registered.path !== 'string' || !path.isAbsolute(registered.path)) {
      fail('WORKSPACE_NOT_FOUND', 404, '工作区未注册或路径无效。');
    }
    let root;
    try {
      root = await fs.realpath(registered.path);
      if (!(await fs.stat(root)).isDirectory()) throw new Error('not directory');
    } catch { fail('WORKSPACE_NOT_FOUND', 404, '工作区目录不存在或无法读取。'); }
    return { root, workspace: { workspaceId: registered.workspaceId, path: root, title: typeof registered.title === 'string' ? registered.title : path.basename(root) } };
  }
  const wrap = action => async request => {
    try { return await action(await context(request), request); }
    catch (error) { throw filesystemError(error); }
  };
  return {
    workspace: wrap(async ({ root, workspace }) => {
      const tree = await treeAt(root, { learningOnly });
      const warnings = [...tree.warnings];
      const adapter = { root, resolve: relative => resolvePath(root, relative), read: relative => readDocument(root, relative), tree: async () => tree };
      const learning = await getLearningState(adapter);
      warnings.push(...learning.warnings);
      const files = flatten(tree);
      const courses = await coursesFrom(root, files, learning, warnings);
      const active = learning.guidePath || learning.answerPath;
      const course = active ? courses.find(item => item.id === courseDirectory(active)) : null;
      let profile = null;
      if (learning.profilePath) {
        try { profile = await readDocument(root, learning.profilePath); }
        catch (error) { warnings.push(`学习档案无法读取：${error.message}`); }
      }
      let state = { revision: 0 };
      try { state = (await readState(root)).state; }
      catch (error) { warnings.push(`工作台偏好无法读取，原文件已保留：${error.message}`); }
      const parent = course ? path.posix.dirname(course.directory) : null;
      const routePath = files.find(file => describeFile(file).kind === 'route' && (!course || (parent === '.' ? path.posix.dirname(file) === '.' : file.startsWith(`${parent}/`)))) || null;
      const progress = await getLearningProgress(adapter, { learning, guidePath: learning.guidePath, answerPath: learning.answerPath, routePath });
      const current = {
        courseId: course?.id || null, guidePath: learning.guidePath, answerPath: learning.answerPath,
        roundId: course?.currentRoundId || null, subject: learning.subject, status: learning.status,
        nextAction: learning.answerPath ? '继续本轮作答，保存后请导师评估' : learning.guidePath ? '阅读当前教学引导' : null,
      };
      return { workspace, tree, courses, current, profile, progress, warnings: [...new Set(warnings)], state };
    }),
    read: wrap(({ root }, request) => readDocument(root, request.path)),
    save: wrap(async ({ root }, request) => {
      const relative = relativePath(request.path);
      validateContent(request.content);
      return mutateDocument(root, relative, request, 'save', { content: request.content }, async () => request.content);
    }),
    answer: wrap(async ({ root }, request) => {
      const relative = relativePath(request.path);
      if (describeFile(relative).kind !== 'answer') fail('INVALID_ANSWERS', 400, '答题只能追加到学生回答文档。');
      const answers = validateAnswers(request.answers);
      return mutateDocument(root, relative, request, 'answer', { answers }, async current => {
        const questions = current.questions.current;
        const allowed = new Set(questions.map(question => question.id));
        if (questions.length < 1 || questions.length > 3 || answers.some(answer => !allowed.has(answer.id))) {
          fail('INVALID_ANSWERS', 400, '题目已变化或当前轮不是 1–3 题，请重新加载；也可在源文档中作答。');
        }
        return appendAnswers(current.content, Object.fromEntries(answers.map(answer => [answer.id, answer.text])));
      });
    }),
    history: wrap(async ({ root }, request) => {
      const relative = relativePath(request.path);
      if (!isDocument(relative)) fail('UNSUPPORTED_DOCUMENT', 415, '此文件类型没有文档历史。');
      return { items: await historyItems(root, relative) };
    }),
    historyRead: wrap(async ({ root }, request) => {
      const relative = relativePath(request.path);
      await readDocument(root, relative);
      const canonical = posix(path.relative(root, await resolvePath(root, relative)));
      return { content: (await textAt(root, backupId(canonical, request.id), { internal: true })).content };
    }),
    restore: wrap(async ({ root }, request) => {
      const relative = relativePath(request.path);
      const canonical = posix(path.relative(root, await resolvePath(root, relative)));
      const backup = backupId(canonical, request.id);
      return mutateDocument(root, relative, request, 'restore', { id: request.id }, async () => (await textAt(root, backup, { internal: true })).content);
    }),
    state: wrap(async ({ root }) => (await readState(root)).state),
    updateState: wrap(({ root }, request) => writeState(root, request.patch, request.expectedRevision)),
    asset: wrap(async ({ root }, request) => {
      const relative = relativePath(request.path);
      if (!/\.(?:png|jpe?g|gif|webp|avif)$/i.test(relative)) fail('UNSUPPORTED_ASSET', 415, '仅允许本地 PNG、JPEG、GIF、WebP 和 AVIF 图片。');
      const { bytes } = await bytesAt(root, relative, { limit: 20 * 1024 * 1024 });
      const mime = imageMime(bytes);
      const expected = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }[relative.split('.').at(-1).toLowerCase()];
      if (!mime || mime !== expected) fail('UNSUPPORTED_ASSET', 415, '图片内容与扩展名不符。');
      return { bytes, mime };
    }),
  };
}
