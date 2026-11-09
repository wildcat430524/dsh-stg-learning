import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cp, mkdir, mkdtemp, readFile, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageDir = process.env.STG_NATIVE_PACKAGE_DIR ? path.resolve(process.env.STG_NATIVE_PACKAGE_DIR) : root;
const output = process.env.STG_NATIVE_OUTPUT_DIR ? path.resolve(process.env.STG_NATIVE_OUTPUT_DIR) : path.join(root, 'artifacts', 'native');
await mkdir(output, { recursive: true });
const run = await mkdtemp(path.join(output, 'run-'));
const home = path.join(run, 'home');
const profileDir = path.join(home, 'profiles', 'stg-acceptance');
const workspaceDir = path.join(run, 'learning');
await mkdir(path.join(profileDir, 'node_modules'), { recursive: true });
await cp(path.join(root, 'demo', 'StepsToGreat'), workspaceDir, { recursive: true });
await mkdir(path.join(workspaceDir, '我的学习/学科/Python/02-旧课程'), { recursive: true });
await writeFile(path.join(workspaceDir, '我的学习/学科/Python/02-旧课程/01_教学引导.md'), '# 旧课程\n\n## 第一轮\n\n### 问题 1\n\n旧的学习内容。');
for (const name of ['第二轮', '第三轮']) await writeFile(path.join(workspaceDir, `我的学习/学科/Python/01-列表与切片/${name}_教学引导.md`), `# ${name}教学\n\n## ${name}\n\n### 问题 1\n\n本轮引导。`);
await writeFile(path.join(workspaceDir, '.steps2great.json'), JSON.stringify({ version: 1, skill: 'steps2great' }));
// A stale workbench state that points at a historical round file must not win
// over the profile's recorded current round (第一轮 in 01_教学引导.md).
await mkdir(path.join(workspaceDir, '.stg-desk'), { recursive: true });
await writeFile(path.join(workspaceDir, '.stg-desk', 'workbench.json'), JSON.stringify({
  revision: 7,
  lastCourseId: '我的学习/学科/Python/01-列表与切片',
  lastDocumentPath: '我的学习/学科/Python/01-列表与切片/第二轮_教学引导.md',
  lastView: 'answer',
}, null, 2));
await symlink(packageDir, path.join(profileDir, 'node_modules', 'dsh-stg-learning'), process.platform === 'win32' ? 'junction' : 'dir');
await writeFile(path.join(profileDir, 'package.json'), JSON.stringify({
  name: 'stg-isolated-acceptance', private: true,
  dependencies: { 'dsh-stg-learning': `file:${packageDir.replaceAll('\\', '/')}` },
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-stg-learning'] } },
}, null, 2));
await writeFile(path.join(profileDir, 'cordis.patch.yml'), `- id: web-runtime
  config:
    openBrowser: false
    printUrl: false
    surfaceContext: false
`);
// Set these before importing the official boot modules. Never load the user's
// profile, credentials, agents directory or .env into this composition.
process.env.DSH_HOME = home;
process.env.DSH_AGENTS_HOME = path.join(run, 'agents');
process.env.DSH_TELEMETRY_DISABLED = '1';
process.chdir(workspaceDir);
const runtimeRequire = createRequire(process.env.STG_NATIVE_RUNTIME_ANCHOR || import.meta.url);
const runtimeImport = name => import(pathToFileURL(runtimeRequire.resolve(name)).href);
const runtimeVersion = runtimeRequire('@deepseek-ai/dsh/package.json').version;
const { runProfile, INSTALL_ANCHOR } = await runtimeImport('@deepseek-ai/dsh/profile-boot');
const { loadProfileDirectory } = await runtimeImport('@deepseek-ai/dsh-app-boot');
const { createLaunchEnvironmentSnapshot } = await runtimeImport('@deepseek-ai/dsh-launch-environment');
const checks = [];
let ctx;
let success = false;
try {
  const profile = loadProfileDirectory('stg-acceptance', profileDir, INSTALL_ANCHOR);
  assert.deepEqual(profile.skippedBundles, []);
  ({ ctx } = await runProfile({ profile: 'stg-acceptance', resolvedProfile: { profile, installAnchor: INSTALL_ANCHOR }, patchFiles: [], args: ['--no-open', '--port', '0'], environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: { ...process.env } }]) }));
  assert.ok(ctx.get('connection'), 'Official Connection did not start');
  assert.ok(ctx.get('workspaceRegistry'), 'Official workspace registry did not start');
  const presets = await ctx.agentPresets.list();
  const mentor = presets.find(item => item.id === 'stg-learning-mentor');
  assert.ok(mentor, 'STG mentor preset was not registered');
  assert.ok(!mentor.broken, JSON.stringify(mentor));
  checks.push(`official DSH ${runtimeVersion} profile boots with plugin and mentor preset`);
  const workspace = await ctx.workspaceRegistry.create(workspaceDir, 'STG 隔离验收');
  const initialDir = path.join(run, 'initial-learning');
  await mkdir(path.join(initialDir, '我的学习'), { recursive: true });
  await cp(path.join(packageDir, 'skills/stg-mentor/assets/project/模板/学习档案模板.md'), path.join(initialDir, '我的学习/00-学习档案.md'));
  await writeFile(path.join(initialDir, '.steps2great.json'), JSON.stringify({ version: 1, skill: 'steps2great', skillVersion: '1.2.0' }));
  const initialWorkspace = await ctx.workspaceRegistry.create(initialDir, 'STG 初始化验收');
  const legacyDir = path.join(run, 'legacy-learning');
  await cp(path.join(root, 'demo', 'StepsToGreat'), legacyDir, { recursive: true });
  const profileSource = path.resolve(legacyDir, '我的学习/00-学习档案.md'), profileTarget = path.resolve(legacyDir, '00_学习档案.md');
  const courseSource = path.resolve(legacyDir, '我的学习/学科/Python/01-列表与切片'), courseTarget = path.resolve(legacyDir, '01-列表与切片');
  for (const target of [profileSource, profileTarget, courseSource, courseTarget]) assert.ok(target.startsWith(path.resolve(run) + path.sep), 'Fixture move must stay in isolated run');
  await rename(profileSource, profileTarget); await rename(courseSource, courseTarget);
  await writeFile(profileTarget, (await readFile(profileTarget, 'utf8')).replaceAll('./学科/Python/01-列表与切片/', './01-列表与切片/'));
  await symlink(profileTarget, profileSource, 'file');
  await symlink(courseTarget, courseSource, process.platform === 'win32' ? 'junction' : 'dir');
  // The demo workspace ships two courses. The legacy check asserts that the
  // linked profile still discovers exactly three, so the third one is created
  // here instead of depending on whatever the demo folder happens to contain.
  const legacyExtra = path.join(legacyDir, '我的学习/学科/Python/02-旧课程');
  await mkdir(legacyExtra, { recursive: true });
  await writeFile(path.join(legacyExtra, '01_教学引导.md'), '# 旧课程\n\n## 第一轮\n\n### 问题 1\n\n旧的学习内容。');
  await writeFile(path.join(legacyDir, '.steps2great.json'), JSON.stringify({ version: 1, skill: 'steps2great' }));
  const legacyWorkspace = await ctx.workspaceRegistry.create(legacyDir, 'STG 旧版链接验收');
  const genericDir = path.join(run, 'code-repository');
  await mkdir(genericDir);
  await writeFile(path.join(genericDir, 'README.md'), '# Generic code repository — never show in learning');
  const generic = await ctx.workspaceRegistry.create(genericDir, '不应出现在学习页的代码仓库');
  // webServer.getOrigin() arrived after 0.2.0; the isolated profile always
  // listens on plain loopback HTTP, so compose the same origin from the
  // public host/port getters when the convenience method is absent.
  const origin = typeof ctx.webServer.getOrigin === 'function'
    ? ctx.webServer.getOrigin()
    : `http://${ctx.webServer.host === '0.0.0.0' ? '127.0.0.1' : ctx.webServer.host}:${ctx.webServer.port}`;
  const endpoint = `${origin}/api/stg-learning/workspace?workspaceId=${encodeURIComponent(workspace.id)}`;
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { headers: { Origin: 'https://invalid.example' } })).status, 403);
  checks.push('real HTTP carrier rejects missing authentication and foreign Origin');
  const exchange = await fetch(ctx.connection.authenticatedUrl(origin + '/'), { redirect: 'manual' });
  assert.ok([302, 303].includes(exchange.status), 'Token exchange must redirect to a clean URL');
  const cookie = exchange.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie);
  const response = await fetch(endpoint, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const overview = await response.json();
  assert.equal(overview.ok, true, JSON.stringify(overview));
  assert.ok(overview.data.current?.guidePath, JSON.stringify(overview));
  checks.push('authenticated real Host returns registered demo course');
  const library = await fetch(`${origin}/api/stg-learning/learning`, { headers: { Cookie: cookie } }).then(r => r.json());
  assert.deepEqual(library.data.items.map(item => item.workspaceId).sort(), [workspace.id, initialWorkspace.id, legacyWorkspace.id].sort());
  assert.equal((await fetch(`${origin}/api/stg-learning/workspace?workspaceId=${generic.id}`, { headers: { Cookie: cookie } })).status, 409);
  checks.push('learning library excludes unrelated real DSH workspaces and refuses their identities');
  const legacy = await fetch(`${origin}/api/stg-learning/workspace?workspaceId=${legacyWorkspace.id}`, { headers: { Cookie: cookie } }).then(r => r.json());
  assert.equal(legacy.ok, true); assert.equal(legacy.data.profile.path, '00_学习档案.md');
  assert.equal(legacy.data.courses.length, 3); assert.equal(legacy.data.current.courseId, '01-列表与切片');
  checks.push('authenticated official Host recognizes a legacy linked profile and discovers canonical junction-backed course');
  const browserEnvironment = { ...process.env, STG_NATIVE_URL: ctx.connection.authenticatedUrl(origin + '/'), STG_NATIVE_OUTPUT: output, STG_NATIVE_RUN: run, STG_NATIVE_WORKSPACE: workspace.id };
  delete browserEnvironment.ELECTRON_RUN_AS_NODE;
  const require = createRequire(import.meta.url);
  const electron = process.env.STG_ELECTRON_PATH || (() => { try { return require('electron'); } catch { return undefined; } })();
  assert.equal(typeof electron, 'string', 'Set STG_ELECTRON_PATH to a local Electron executable.');
  const child = spawn(electron, [path.join(root, 'scripts', 'verify-native-browser.cjs')], { cwd: workspaceDir, env: browserEnvironment, stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  assert.equal(code, 0, 'Native browser acceptance failed');
  const browser = JSON.parse(await readFile(path.join(output, 'browser-result.json'), 'utf8'));
  assert.equal(browser.ok, true);
  checks.push(...browser.checks);
  const state = JSON.parse(await readFile(path.join(workspaceDir, '.stg-desk', 'workbench.json'), 'utf8'));
  const sessionIds = Object.values(state.courseSessions || {});
  assert.equal(new Set(sessionIds).size, 1, 'One course should use one mentor Session');
  const catalog = await ctx.sessionSkillCatalog.list({ sessionId: sessionIds[0] }, new AbortController().signal);
  assert.ok(catalog.skills.some(skill => skill.name === 'steps2great-skill'), 'Packaged teaching Skill is absent from the native Session catalog');
  checks.push('real mentor Session catalog includes packaged Steps2Great teaching Skill');
  const sessions = await ctx.sessionController.list({}, new AbortController().signal);
  const mentors = sessions.items.filter(session => session.projections?.values?.agentPreset === 'stg-learning-mentor');
  const initialState = JSON.parse(await readFile(path.join(initialDir, '.stg-desk', 'workbench.json'), 'utf8'));
  const legacyState = JSON.parse(await readFile(path.join(legacyDir, '.stg-desk', 'workbench.json'), 'utf8'));
  const legacyIds = Object.values(legacyState.courseSessions || {});
  assert.equal(new Set(legacyIds).size, 1, 'Opening the legacy course should prepare exactly one adjacent teacher');
  // Entering each existing course now opens its teacher automatically. The
  // legacy workspace is visited too; check identities, not just a total count.
  const expectedMentors = [sessionIds[0], initialState.courseSessions._workspace, legacyIds[0]];
  assert.equal(new Set(expectedMentors).size, 3, 'Independent learning workspaces must not share a teacher Session');
  assert.deepEqual(mentors.map(session => session.sessionId).sort(), expectedMentors.sort(), 'Each visited learning workspace must have exactly its own teacher, without duplicates');
  assert.ok(sessions.items.every(session => session.blank && !session.running), 'Acceptance must leave every Session unsent');
  checks.push('repeated full native conversation/document transitions keep one mentor per learning workspace');
  checks.push('all real Sessions remain blank and idle; no prompt or model reply is fabricated');
  success = true;
  await unlink(path.join(output, 'failure.txt')).catch(error => { if (error.code !== 'ENOENT') throw error; });
} catch (error) {
  console.error(error);
  await writeFile(path.join(output, 'failure.txt'), error.stack || String(error));
} finally {
  await ctx?.fiber.dispose();
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ ok: success, date: new Date().toISOString(), dsh: runtimeVersion, checks, modelSent: false, packageDir, run }, null, 2));
  console.log(JSON.stringify({ ok: success, checks }));
  process.exit(success ? 0 : 1);
}
