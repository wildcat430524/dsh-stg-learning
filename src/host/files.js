import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const DOCUMENT_LIMIT = 8 * 1024 * 1024;
export const STATE_LIMIT = 256 * 1024;
const IGNORED = new Set(['node_modules', 'vendor', 'release']);
const sharedWrites = new Map();
export const hash = value => createHash('sha256').update(value).digest('hex');
export const posix = value => value.split(path.sep).join('/');
export const isDocument = value => /\.(?:md|markdown|txt)$/i.test(value);

export class WorkbenchError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.name = 'WorkbenchError';
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}
export const fail = (code, status, message, details) => { throw new WorkbenchError(code, status, message, details); };
export const invalidPath = () => fail('INVALID_PATH', 400, '无效文件路径：文件及链接目标必须位于工作区内，不能经过隐藏目录或应用目录；内部状态目录不允许链接。');
export const isWithin = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

export function relativePath(value, { allowRoot = false, internal = false } = {}) {
  if (typeof value !== 'string' || !value || value.length > 4096 || /^[\\/]|^[a-zA-Z]:/.test(value)) invalidPath();
  const normalized = value.replace(/\\/g, '/');
  if (allowRoot && normalized === '.') return '.';
  const parts = normalized.split('/');
  if (parts.some(segment => !segment || segment === '.' || segment === '..' || /[<>:"|?*\u0000-\u001f]/.test(segment)
    || /[. ]$/.test(segment) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)
    || (!internal && (segment.startsWith('.') || IGNORED.has(segment.toLowerCase()))))) invalidPath();
  return normalized;
}

export async function serialized(key, action) {
  // Shared by every service instance in this process, including differently cased Windows workspace aliases.
  key = process.platform === 'win32' ? key.toLowerCase() : key;
  const previous = sharedWrites.get(key) || Promise.resolve();
  const task = previous.catch(() => {}).then(action);
  sharedWrites.set(key, task);
  try { return await task; }
  finally { if (sharedWrites.get(key) === task) sharedWrites.delete(key); }
}

export async function resolvePath(root, relative, options = {}) {
  relative = relativePath(relative, options);
  let hops = 0;
  const walk = async value => {
    let current = root;
    for (const segment of relativePath(value, options).split('/')) {
      const next = path.join(current, segment), entry = await fs.lstat(next);
      let real;
      if (entry.isSymbolicLink()) {
        // Public documents may use legacy aliases, but every hop stays public
        // and inside this exact workspace. Metadata/scaffold paths stay strict.
        if (options.internal || ++hops > 40) invalidPath();
        const destination = path.resolve(path.dirname(next), await fs.readlink(next));
        if (!isWithin(root, destination)) invalidPath();
        real = await walk(posix(path.relative(root, destination)));
        if ((await fs.realpath(next)) !== real) invalidPath();
      } else real = await fs.realpath(next);
      if (!isWithin(root, real)) invalidPath();
      relativePath(posix(path.relative(root, real)), options);
      current = real;
    }
    return current;
  };
  return walk(relative);
}

export async function ensureDirectory(root, relative) {
  relative = relativePath(relative, { internal: true });
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink() || !entry.isDirectory() || !isWithin(root, await fs.realpath(current))) invalidPath();
  }
  return current;
}

export async function bytesAt(root, relative, { limit = DOCUMENT_LIMIT, internal = false } = {}) {
  const target = await resolvePath(root, relative, { internal });
  let handle;
  try {
    handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile()) fail('INVALID_PATH', 400, '此路径是文件夹，请选择文件。');
    if (stat.size > limit) fail('DOCUMENT_TOO_LARGE', 413, `文件超过 ${Math.floor(limit / 1024 / 1024)} MB。`);
    // Revalidate after opening: a replacement junction must never be followed unnoticed.
    const still = await resolvePath(root, relative, { internal });
    if (still !== target) invalidPath();
    const bytes = await handle.readFile();
    if (bytes.length > limit) fail('DOCUMENT_TOO_LARGE', 413, '文件读取期间超出大小限制。');
    return { bytes, modifiedAt: stat.mtime.toISOString(), target, mode: stat.mode };
  } finally { await handle?.close(); }
}

export function decodeUtf8(bytes) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('INVALID_ENCODING', 415, '文档不是 UTF-8 编码，请先转换编码以避免损坏。'); }
  return bytes.toString('utf8');
}

export async function textAt(root, relative, options) {
  const result = await bytesAt(root, relative, options);
  return { ...result, content: decodeUtf8(result.bytes), version: hash(result.bytes) };
}

export async function atomicWrite(root, relative, content, { internal = false, beforeReplace, mode } = {}) {
  relative = relativePath(relative, { internal });
  // Write the existing real document, never rename over its alias/link.
  const canonical = internal ? relative : posix(path.relative(root, await resolvePath(root, relative)));
  const parts = canonical.split('/');
  const name = parts.pop();
  const directory = parts.length ? await resolvePath(root, parts.join('/'), { internal }) : root;
  const destination = path.join(directory, name);
  try {
    const old = await fs.lstat(destination);
    if (old.isSymbolicLink() || !old.isFile()) invalidPath();
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(directory, `.stgw-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', mode ?? 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (parts.length) await resolvePath(root, parts.join('/'), { internal });
    await beforeReplace?.();
    if (!internal && (await resolvePath(root, relative)) !== destination) invalidPath();
    await fs.rename(temporary, destination);
  } finally {
    await handle?.close();
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function treeAt(root, { learningOnly = false } = {}) {
  const warnings = [];
  let count = 0;
  const key = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const directories = new Set([key(root)]), files = new Set();
  const walk = async (directory, depth) => {
    if (depth > 32) { warnings.push('目录层级过深，部分目录未展开。'); return []; }
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    const nodes = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED.has(entry.name.toLowerCase())) continue;
      if (learningOnly && depth === 0 && !['我的学习', '资料'].includes(entry.name)) continue;
      const relative = posix(path.relative(root, path.join(directory, entry.name)));
      try {
        const target = await resolvePath(root, relative);
        const stat = await fs.lstat(target);
        const canonical = posix(path.relative(root, target));
        if (stat.isDirectory()) {
          if (directories.has(key(target))) continue;
          directories.add(key(target));
          const children = await walk(target, depth + 1);
          nodes.push({ type: 'directory', name: entry.name, path: canonical, readable: false, children });
        } else if (stat.isFile()) {
          if (files.has(key(target))) continue;
          files.add(key(target));
          count++;
          nodes.push({ type: 'file', name: entry.name, path: canonical, readable: isDocument(canonical) });
        }
      } catch (error) {
        warnings.push(`${error.code === 'INVALID_PATH' ? '跳过不安全路径' : '无法读取'}：${relative}`);
      }
    }
    return nodes;
  };
  const children = await walk(root, 0);
  return { type: 'directory', root, name: path.basename(root), path: '', readable: false, children, count, warnings };
}

export function filesystemError(error) {
  if (error instanceof WorkbenchError) return error;
  if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return new WorkbenchError('DOCUMENT_NOT_FOUND', 404, '文件不存在或已被移动。');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return new WorkbenchError('ACCESS_DENIED', 403, '无法访问文件，请检查工作区文件权限。');
  return new WorkbenchError('WORKSPACE_IO_ERROR', 500, '工作区文件操作失败，请保留草稿后重试。', { reason: error?.code || 'UNKNOWN' });
}
