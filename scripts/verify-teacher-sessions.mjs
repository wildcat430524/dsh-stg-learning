import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cp, mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Isolated acceptance for the teacher conversation switcher. It reuses the
// official runtime cache and a fresh credential-free profile, never the user's
// profile, learning data, model settings or running tasks. No model request is
// ever issued: this script only creates blank Sessions and inspects drafts.
const root = fileURLToPath(new URL('..', import.meta.url));
const packageDir = process.env.STG_NATIVE_PACKAGE_DIR ? path.resolve(process.env.STG_NATIVE_PACKAGE_DIR) : root;
const output = process.env.STG_NATIVE_OUTPUT_DIR ? path.resolve(process.env.STG_NATIVE_OUTPUT_DIR) : path.join(root, 'artifacts', 'teacher-sessions-20261029');
await mkdir(output, { recursive: true });
const run = await mkdtemp(path.join(output, 'run-'));
const home = path.join(run, 'home');
const profileDir = path.join(home, 'profiles', 'stg-acceptance');
const workspaceDir = path.join(run, 'learning');
await mkdir(path.join(profileDir, 'node_modules'), { recursive: true });
await cp(path.join(root, 'demo', 'StepsToGreat'), workspaceDir, { recursive: true });
await writeFile(path.join(workspaceDir, '.steps2great.json'), JSON.stringify({ version: 1, skill: 'steps2great' }));
await symlink(packageDir, path.join(profileDir, 'node_modules', 'dsh-stg-learning'), process.platform === 'win32' ? 'junction' : 'dir');
await writeFile(path.join(profileDir, 'package.json'), JSON.stringify({
  name: 'stg-session-acceptance', private: true,
  dependencies: { 'dsh-stg-learning': `file:${packageDir.replaceAll('\\', '/')}` },
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-stg-learning'] } },
}, null, 2));
await writeFile(path.join(profileDir, 'cordis.patch.yml'), `- id: web-runtime
  config:
    openBrowser: false
    printUrl: false
    surfaceContext: false
`);
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
  checks.push(`official DSH ${runtimeVersion} profile boots with the STG mentor preset`);

  const workspace = await ctx.workspaceRegistry.create(workspaceDir, 'STG 对话切换验收');
  const otherDir = path.join(run, 'other-learning');
  await cp(path.join(root, 'demo', 'StepsToGreat'), otherDir, { recursive: true });
  await writeFile(path.join(otherDir, '.steps2great.json'), JSON.stringify({ version: 1, skill: 'steps2great' }));
  const otherWorkspace = await ctx.workspaceRegistry.create(otherDir, 'STG 另一学习空间');
  // A real teacher Session in another learning space: it must never appear in
  // this space's switcher, and switching here must not bind it.
  const foreign = await ctx.sessionController.create({ workspaceId: otherWorkspace.id, agentPreset: 'stg-learning-mentor' });
  const foreignId = foreign.sessionId;
  assert.ok(foreignId);
  checks.push('isolated fixture prepared a teacher conversation in a second learning space');

  const origin = typeof ctx.webServer.getOrigin === 'function'
    ? ctx.webServer.getOrigin()
    : `http://${ctx.webServer.host === '0.0.0.0' ? '127.0.0.1' : ctx.webServer.host}:${ctx.webServer.port}`;
  const exchange = await fetch(ctx.connection.authenticatedUrl(origin + '/'), { redirect: 'manual' });
  assert.ok([302, 303].includes(exchange.status), 'Token exchange must redirect to a clean URL');
  const cookie = exchange.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie);
  const library = await fetch(`${origin}/api/stg-learning/learning`, { headers: { Cookie: cookie } }).then(r => r.json());
  assert.deepEqual(library.data.items.map(item => item.workspaceId).sort(), [workspace.id, otherWorkspace.id].sort());
  checks.push('authenticated learning library exposes exactly the two isolated learning spaces');

  // A synthetic transcript in this profile proves that a new conversation never
  // clears or inherits history and that the old chat is still reachable. It is
  // appended directly to the isolated Session log; no model is invoked.
  let seeded = false;
  ctx.connection.fetch.register({ path: '/api/stg-qa/seed', methods: ['POST'], requestBody: 'buffered', fetch: async () => {
    if (seeded) return Response.json({ ok: true, alreadySeeded: true });
    const state = JSON.parse(await readFile(path.join(workspaceDir, '.stg-desk', 'workbench.json'), 'utf8'));
    const sessionId = Object.values(state.courseSessions || {})[0];
    const session = ctx.sessions.get(sessionId);
    if (!session) return Response.json({ ok: false, error: 'isolated teacher session is not live' }, { status: 409 });
    session.append('turn/start', { turn: 1 });
    session.append('step/start', { turn: 1, step: 1 });
    session.append('user/message', { id: 'stg-qa-user-1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '旧对话的第一个问题（隔离测试）' }] }, { surfaceOp: 'append' });
    session.append('assistant/message', { turn: 1, step: 1, stream: [], message: { id: 'stg-qa-assistant-1', role: 'assistant', source: { kind: 'model', provider: 'synthetic-fixture', model: 'no-model-request' }, content: [{ type: 'text', text: 'STG会话切换旧历史：这里只验证界面保留，不是模型回复。' }] } }, { surfaceOp: 'append' });
    session.append('step/end', { turn: 1, step: 1 });
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
    await ctx.sessions.flush(session);
    seeded = true;
    return Response.json({ ok: true, sessionId, synthetic: true });
  }});

  const browserEnvironment = {
    ...process.env,
    STG_NATIVE_URL: ctx.connection.authenticatedUrl(origin + '/'),
    STG_NATIVE_OUTPUT: output,
    STG_NATIVE_RUN: run,
    STG_NATIVE_WORKSPACE: workspace.id,
    STG_NATIVE_WORKSPACE_TITLE: 'STG 对话切换验收',
    STG_NATIVE_OTHER_SESSION: foreignId,
    STG_NATIVE_OTHER_TITLE: 'STG 另一学习空间',
  };
  delete browserEnvironment.ELECTRON_RUN_AS_NODE;
  const require = createRequire(import.meta.url);
  const electron = process.env.STG_ELECTRON_PATH || (() => { try { return require('electron'); } catch { return undefined; } })();
  assert.equal(typeof electron, 'string', 'Set STG_ELECTRON_PATH to a local Electron executable.');
  const child = spawn(electron, [process.env.STG_NATIVE_BROWSER_SCRIPT ? path.resolve(process.env.STG_NATIVE_BROWSER_SCRIPT) : path.join(root, 'scripts', 'verify-teacher-sessions-browser.cjs')], { cwd: workspaceDir, env: browserEnvironment, stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  assert.equal(code, 0, 'Teacher session browser acceptance failed');
  const browser = JSON.parse(await readFile(path.join(output, 'browser-result.json'), 'utf8'));
  assert.equal(browser.ok, true, JSON.stringify(browser.errors));
  checks.push(...browser.checks);

  // Host-side truth: the Session list and workbench binding, independent of
  // what the browser rendered.
  const sessions = await ctx.sessionController.list({}, new AbortController().signal);
  const inSpace = sessions.items.filter(item => item.projections?.values?.agentPreset === 'stg-learning-mentor' && workspace.sessionIds.includes(item.sessionId));
  assert.equal(inSpace.length, 3, `expected the original plus two created teacher conversations, found ${inSpace.length}`);
  assert.equal(new Set(inSpace.map(item => item.sessionId)).size, 3);
  assert.equal(inSpace.some(item => item.sessionId === foreignId), false);
  checks.push('the host holds exactly three distinct teacher conversations in this space; only the original carries the synthetic fixture transcript');
  assert.ok(sessions.items.some(item => item.sessionId === foreignId), 'the other-space teacher stays in its own space');
  assert.equal(workspace.sessionIds.includes(foreignId), false);
  // The original carries only the synthetic fixture transcript; the two
  // conversations the picker created must still be blank, and nothing may be
  // running or sending a request.
  const created = inSpace.filter(item => item.sessionId !== browser.originalSessionId);
  assert.equal(created.length, 2);
  assert.ok(created.every(item => item.blank), 'created conversations must still be blank');
  assert.ok(sessions.items.every(item => !item.running), 'no Session may be running after this acceptance');
  checks.push('the two conversations the picker created are still blank and every Session is idle; nothing was sent');
  const state = JSON.parse(await readFile(path.join(workspaceDir, '.stg-desk', 'workbench.json'), 'utf8'));
  const bound = state.courseSessions?.[Object.keys(state.courseSessions || {})[0]];
  assert.equal(bound, browser.finalSessionId, 'the course binding follows the conversation selected last');
  checks.push('course binding is the conversation selected last, so later questions use it instead of the old one');
  assert.equal(Object.values(state.courseSessions || {}).includes(foreignId), false);
  assert.ok([browser.originalSessionId, browser.newSessionId].includes(bound));
  checks.push('cross-space teacher conversation never entered this space list, draft storage or course binding');

  // The plugin's "移出" path relies on the Host's recoverable archive, so the
  // contract it depends on is verified here against the real controller: the
  // transcript and its workspace slot survive, the archive set carries the id,
  // another space's conversation is untouched, and unarchive restores it.
  const workspaces = ctx.get('workspaceController');
  const registry = ctx.get('workspaceRegistry');
  // The Host-side controller takes a request object (`{ sessionId }`), unlike the
  // client-side convenience face the plugin consumes. Both are the same archive.
  assert.equal(typeof workspaces?.archiveSession, 'function', 'This Host exposes no recoverable session archive');
  assert.equal(typeof workspaces?.unarchiveSession, 'function', 'This Host exposes no session unarchive');
  assert.deepEqual(registry.archivedSessionIds, [], 'the isolated profile must start with an empty archive set');
  const target = browser.newSessionId;
  const archivedSet = await workspaces.archiveSession({ sessionId: target });
  assert.deepEqual(archivedSet.archivedSessionIds, [target], 'archiving returns the complete resulting archive set');
  assert.ok(registry.archivedSessionIds.includes(target), 'archiving must add exactly the named Session to the archive set');
  assert.equal(registry.archivedSessionIds.includes(foreignId), false, 'archiving must not touch another space');
  // The Host keeps the accounting slot: an archived conversation is hidden from
  // grouping surfaces, not deleted from the Workspace or its transcript.
  const workspaceAfter = registry.list().find(item => item.id === workspace.id);
  assert.ok(workspaceAfter?.sessionIds?.includes(target), 'an archived Session keeps its workspace slot');
  const stillListed = await ctx.get('sessionController').list({}, new AbortController().signal);
  assert.ok(stillListed.items.some(item => item.sessionId === target), 'an archived Session is still a real Session');
  checks.push('the real Host archives a teacher conversation recoverably: archive set updated, workspace slot and Session retained');
  await workspaces.unarchiveSession({ sessionId: target });
  assert.equal(registry.archivedSessionIds.includes(target), false, 'unarchive must drop the id again');
  await workspaces.unarchiveSession({ sessionId: target });
  assert.equal(registry.archivedSessionIds.includes(target), false, 'a repeated unarchive is idempotent');
  checks.push('the real Host restores the conversation, and a repeated restore is idempotent');
  // A refusal names its reason instead of silently succeeding: an unknown id is
  // refused before any archive is written.
  const refused = await workspaces.archiveSession({ sessionId: 'session-that-does-not-exist' }).then(() => null, error => error);
  assert.ok(refused, 'archiving an unknown Session must be refused');
  assert.equal(registry.archivedSessionIds.includes('session-that-does-not-exist'), false);
  checks.push('an unknown Session is refused and leaves the archive set unchanged');

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
