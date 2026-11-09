import { atomicWrite, ensureDirectory, fail, relativePath, serialized, STATE_LIMIT, textAt } from './files.js';

const STATE_PATH = '.stg-desk/workbench.json';
const PATCH_KEYS = new Set(['lastCourseId', 'lastDocumentPath', 'lastView', 'courseSessions']);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const invalid = () => fail('INVALID_STATE', 400, '工作台状态字段无效；只允许课程、文档、视图和课程会话关联。');
const cleanId = value => typeof value === 'string' && value.trim() !== '' && value.length <= 512 && !/[\u0000-\u001f]/.test(value) && !BAD_KEYS.has(value);

export function validateStatePatch(patch) {
  if (!plainRecord(patch)) invalid();
  const output = {};
  for (const key of Object.keys(patch)) {
    if (!PATCH_KEYS.has(key)) invalid();
    const value = patch[key];
    if (value === null) { output[key] = null; continue; }
    if (key === 'lastView') {
      if (!['read', 'answer', 'review'].includes(value)) invalid();
      output[key] = value;
    } else if (key === 'lastCourseId' || key === 'lastDocumentPath') {
      if (!cleanId(value)) invalid();
      output[key] = relativePath(value, { allowRoot: key === 'lastCourseId' });
    } else {
      if (!plainRecord(value) || Object.keys(value).length > 2000) invalid();
      const sessions = {};
      for (const courseId of Object.keys(value)) {
        if (!cleanId(courseId)) invalid();
        relativePath(courseId, { allowRoot: true });
        if (value[courseId] !== null && !cleanId(value[courseId])) invalid();
        sessions[courseId] = value[courseId];
      }
      output[key] = sessions;
    }
  }
  if (Buffer.byteLength(JSON.stringify(output)) > STATE_LIMIT) invalid();
  return output;
}

export async function readState(root) {
  let document;
  try { document = await textAt(root, STATE_PATH, { internal: true, limit: STATE_LIMIT }); }
  catch (error) { if (error.code === 'ENOENT') return { state: { revision: 0 }, version: null }; throw error; }
  let parsed;
  try { parsed = JSON.parse(document.content); }
  catch { fail('INVALID_STATE', 409, '工作台状态文件无法解析，原文件已保留，请恢复或修复后重试。'); }
  if (!plainRecord(parsed) || !Number.isSafeInteger(parsed.revision) || parsed.revision < 0) {
    fail('INVALID_STATE', 409, '工作台状态版本无效，原文件已保留。');
  }
  const { revision, ...patch } = parsed;
  const validated = validateStatePatch(patch);
  if (Object.values(validated).some(value => value === null) || Object.values(validated.courseSessions || {}).some(value => value === null)) {
    fail('INVALID_STATE', 409, '工作台状态包含未完成的删除字段，原文件已保留。');
  }
  return { state: { revision, ...validated }, version: document.version };
}

export async function writeState(root, patch, expectedRevision) {
  patch = validateStatePatch(patch);
  if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) invalid();
  return serialized(`${root}/.stg-desk/workbench.json`, async () => {
    const old = await readState(root);
    if (expectedRevision !== undefined && old.state.revision !== expectedRevision) {
      fail('STATE_CONFLICT', 409, '工作台状态已在其他窗口更新，请重新加载后重试。', { expectedRevision, currentRevision: old.state.revision });
    }
    const next = { ...old.state, revision: old.state.revision + 1 };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) { delete next[key]; continue; }
      if (key !== 'courseSessions') { next[key] = value; continue; }
      next.courseSessions = { ...next.courseSessions };
      for (const [courseId, sessionId] of Object.entries(value)) {
        if (sessionId === null) delete next.courseSessions[courseId];
        else next.courseSessions[courseId] = sessionId;
      }
    }
    if (Buffer.byteLength(JSON.stringify(next)) > STATE_LIMIT) invalid();
    await ensureDirectory(root, '.stg-desk');
    await atomicWrite(root, STATE_PATH, `${JSON.stringify(next, null, 2)}\n`, {
      internal: true,
      beforeReplace: async () => {
        if ((await readState(root)).version !== old.version) fail('STATE_CONFLICT', 409, '保存时检测到外部状态修改，请重新加载。');
      },
    });
    return next;
  });
}
