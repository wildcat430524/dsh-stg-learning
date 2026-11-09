import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLearningName } from '../learning-name.js';
import { isDshProjectFile, LEARNING_README } from './learning-scaffold.js';
import { ensureDirectory, fail, filesystemError, hash, relativePath, textAt } from './files.js';

const SKILL = fileURLToPath(new URL('../../skills/stg-mentor/', import.meta.url));
const PROFILE = '我的学习/00-学习档案.md';
const canonicalKey = value => process.platform === 'win32' ? value.toLowerCase() : value;

/** Recognition reads only a few known files; never crawl unrelated DSH roots. */
export async function inspectLearningSpace(directory) {
  try {
    const root = await fs.realpath(directory);
    if (!(await fs.stat(root)).isDirectory()) return null;
    try { await fs.lstat(path.join(root, '.stg-initializing')); return null; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await textAt(root, PROFILE);
    let mode;
    try {
      const anchor = JSON.parse((await textAt(root, '.steps2great.json', { internal: true, limit: 1024 * 1024 })).content);
      if (anchor.version === 1 && anchor.skill === 'steps2great') mode = anchor.workspaceMode === 'standalone' ? 'standalone' : 'skill';
    } catch { /* An original standalone StepsToGreat folder need not have an anchor. */ }
    if (!mode) {
      const agents = await textAt(root, 'AGENTS.md');
      if (!/Steps(?:To|2)Great/i.test(agents.content)) return null;
      await textAt(root, '协议/00_导师协议.md');
      mode = 'standalone';
    }
    return { path: root, mode };
  } catch { return null; }
}

function validateInput(input, creating) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['operationId', ...(creating ? ['name'] : [])].includes(key))) {
    fail('INVALID_LEARNING_REQUEST', 400, '请使用学习入口选择文件夹，不能直接提交任意工作区路径。');
  }
  if (typeof input.operationId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(input.operationId)) fail('INVALID_OPERATION', 400, '请为本次操作提供唯一标识。');
  if (creating) {
    const name = input.name;
    const problem = validateLearningName(name);
    if (problem) fail('INVALID_LEARNING_NAME', 400, problem);
    try { relativePath(name); } catch { fail('INVALID_LEARNING_NAME', 400, '学习名称不能包含特殊路径字符或 Windows 保留名称。'); }
  }
}

async function resourcesAt(skill) {
  const root = await fs.realpath(path.join(skill, 'assets/project'));
  const manifest = JSON.parse((await textAt(root, 'manifest.json')).content);
  if (manifest.version !== 1 || !manifest.files || typeof manifest.files !== 'object') fail('INVALID_SCAFFOLD', 500, '内置学习框架清单无效，请重新安装插件。');
  const resources = [];
  for (const [file, expected] of Object.entries(manifest.files)) {
    relativePath(file, { internal: true });
    const source = await textAt(root, file, { internal: true });
    if (source.version !== expected) fail('INVALID_SCAFFOLD', 500, '内置学习框架指纹不符，未创建学习文件夹。');
    resources.push({ file, bytes: source.bytes });
  }
  if (!manifest.files['AGENTS.md'] || !manifest.files['协议/00_导师协议.md'] || !manifest.files['模板/学习档案模板.md']) fail('INVALID_SCAFFOLD', 500, '内置框架缺少入口、协议或学习档案模板。');
  if (manifest.files[PROFILE] || manifest.files['.steps2great.json'] || manifest.files['.stg-initializing']) fail('INVALID_SCAFFOLD', 500, '内置框架不能包含真实学生档案或初始化记录。');
  const profile = resources.find(item => item.file === '模板/学习档案模板.md').bytes;
  const version = JSON.parse(await fs.readFile(path.join(skill, 'package.json'), 'utf8')).version;
  const selected = resources.filter(item => isDshProjectFile(item.file)).map(item => item.file === 'README.md' ? { ...item, bytes: Buffer.from(LEARNING_README) } : item);
  const projectFiles = Object.fromEntries(selected.map(item => [item.file, hash(item.bytes)]));
  return { resources: selected, profile, projectFiles, version };
}

export function createLearningSpacesService({ registry, pickDirectory, skill = SKILL } = {}) {
  if (typeof registry?.get !== 'function') throw Error('Learning spaces require the official workspace registry.');
  const operations = new Map();
  let pickerBusy = false;
  const registered = () => typeof registry.list === 'function' ? registry.list() : [];
  const view = (item, inspected) => ({ workspaceId: item.id, title: item.title || path.basename(inspected.path), ...inspected });
  async function library() {
    const items = [], seen = new Set();
    for (const item of registered()) {
      if (!item?.id || typeof item.path !== 'string') continue;
      const inspected = await inspectLearningSpace(item.path);
      if (!inspected || seen.has(canonicalKey(inspected.path))) continue;
      seen.add(canonicalKey(inspected.path)); items.push(view(item, inspected));
    }
    return { items };
  }
  async function resolveWorkspace(workspaceId) {
    const item = typeof workspaceId === 'string' && workspaceId.length <= 256 ? registry.get(workspaceId) : null;
    if (!item?.path) fail('WORKSPACE_NOT_FOUND', 404, '该学习空间已移除，请重新导入。');
    const inspected = await inspectLearningSpace(item.path);
    if (!inspected) fail('NOT_STG_WORKSPACE', 409, '这不是有效的 StepsToGreat 学习文件夹，请返回学习空间创建或导入。');
    return view({ ...item, id: workspaceId }, inspected);
  }
  async function register(directory) {
    const inspected = await inspectLearningSpace(directory);
    if (!inspected) fail('NOT_STG_WORKSPACE', 400, '请选择 StepsToGreat 学习文件夹根目录（包含 我的学习/00-学习档案.md，以及导师协议或 Steps2Great 初始化标记）。未修改或登记该文件夹。');
    for (const item of registered()) {
      const existing = await fs.realpath(item.path).catch(() => null);
      if (existing && canonicalKey(existing) === canonicalKey(inspected.path)) return view(item, inspected);
    }
    const item = await registry.create(inspected.path, path.basename(inspected.path));
    return view(item, inspected);
  }
  async function choose(signal) {
    signal?.throwIfAborted();
    if (typeof pickDirectory !== 'function') fail('PICKER_UNAVAILABLE', 503, '当前宿主没有文件夹选择器，请在 DSH 桌面版打开学习入口。');
    let directory;
    try { directory = await pickDirectory(signal || new AbortController().signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      // A structured picker error already explains the real cause (no picker,
      // denied permission, cancelled dialog); do not replace it with a
      // generic message that hides which condition applies.
      if (typeof error?.code === 'string' && Number.isInteger(error.status)) throw error;
      fail('PICKER_UNAVAILABLE', 503, '无法打开系统文件夹选择器，请在 DSH 桌面版重试。');
    }
    signal?.throwIfAborted();
    return directory;
  }
  function operate(kind, input, options, action) {
    validateInput(input, kind === 'create');
    const fingerprint = hash(JSON.stringify({ kind, name: input.name }));
    const previous = operations.get(input.operationId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail('OPERATION_CONFLICT', 409, '该操作标识已用于另一项学习操作。');
      return previous.task;
    }
    if (pickerBusy) fail('PICKER_BUSY', 409, '已有学习文件夹选择窗口，请先完成或取消该窗口。');
    pickerBusy = true;
    const task = Promise.resolve().then(() => action(options?.signal)).finally(() => { pickerBusy = false; });
    operations.set(input.operationId, { fingerprint, task });
    // Keep bounded idempotent responses, including cancelled/failed requests.
    if (operations.size > 128) operations.delete(operations.keys().next().value);
    return task;
  }
  return {
    library, resolveWorkspace,
    importLearning(input, options) {
      return operate('import', input, options, async signal => {
        const directory = await choose(signal);
        if (!directory) return { cancelled: true };
        return { cancelled: false, workspace: await register(directory), imported: true };
      });
    },
    createLearning(input, options) {
      return operate('create', input, options, async signal => {
        const resources = await resourcesAt(skill); // Verify everything before creating any user file.
        const directory = await choose(signal);
        if (!directory) return { cancelled: true };
        const parent = await fs.realpath(directory);
        if (!(await fs.stat(parent)).isDirectory()) fail('INVALID_PATH', 400, '请选择一个父文件夹。');
        const destination = path.join(parent, input.name);
        signal?.throwIfAborted();
        try { await fs.mkdir(destination); }
        catch (error) {
          if (error.code === 'EEXIST') fail('LEARNING_FOLDER_EXISTS', 409, '同名文件夹已经存在。请换一个学习名称；导入已有学习请使用“导入已有”入口。原文件夹未修改。');
          throw filesystemError(error);
        }
        // Once writes begin, finish the initialization even if the client disconnects.
        // A marker prevents a partial folder from being mistaken for an importable project.
        try {
          const root = await fs.realpath(destination);
          const entry = await fs.lstat(destination);
          if (!entry.isDirectory() || entry.isSymbolicLink() || canonicalKey(root) !== canonicalKey(destination)) fail('INVALID_PATH', 400, '新建目录在初始化前发生变化，已停止写入。');
          await fs.writeFile(path.join(root, '.stg-initializing'), input.operationId, { flag: 'wx' });
          const write = async (file, bytes) => {
            const entry = await fs.lstat(destination);
            if (!entry.isDirectory() || entry.isSymbolicLink() || canonicalKey(await fs.realpath(destination)) !== canonicalKey(root)) fail('INVALID_PATH', 400, '学习目录在初始化期间发生变化，已停止写入。');
            const dirname = path.posix.dirname(file);
            const folder = dirname === '.' ? root : await ensureDirectory(root, dirname);
            await fs.writeFile(path.join(folder, path.posix.basename(file)), bytes, { flag: 'wx' });
          };
          for (const { file, bytes } of resources.resources) await write(file, bytes);
          await write(PROFILE, resources.profile);
          await ensureDirectory(root, '我的学习/学科');
          await write('.steps2great.json', JSON.stringify({ version: 1, skill: 'steps2great', skillVersion: resources.version, workspaceMode: 'standalone', scaffold: 'dsh', initializedAt: new Date().toISOString(), projectFiles: resources.projectFiles }, null, 2) + '\n');
          await fs.unlink(path.join(root, '.stg-initializing'));
          const workspace = await register(root);
          return { cancelled: false, workspace, initialized: true };
        } catch (error) {
          fail('LEARNING_SETUP_INCOMPLETE', 500, '学习文件夹已保留，但初始化或登记未完成。请检查磁盘权限与空间；不要覆盖原文件夹。若初始化已完整完成，可使用“导入已有”重新登记。', { createdPath: destination, reason: error.code || 'UNKNOWN' });
        }
      });
    },
  };
}
