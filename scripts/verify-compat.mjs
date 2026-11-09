import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERIFIED_DSH_VERSIONS } from '../src/compat.js';

// Reuses separately installed official hosts; never installs a runtime or
// opens the user's DSH profile. Each native check creates its own fixture.
const root = fileURLToPath(new URL('..', import.meta.url));
const runtimes = process.env.STG_COMPAT_RUNTIMES;
const output = process.env.STG_COMPAT_OUTPUT;
assert.ok(runtimes && path.isAbsolute(runtimes), 'Set STG_COMPAT_RUNTIMES to an absolute runtime-cache path.');
assert.ok(output && path.isAbsolute(output), 'Set STG_COMPAT_OUTPUT to a fresh absolute evidence path.');
await mkdir(output, { recursive: true });
const versions = process.argv.slice(2);
const results = [];
for (const version of versions.length ? versions : VERIFIED_DSH_VERSIONS) {
  assert.ok(VERIFIED_DSH_VERSIONS.includes(version), `Unsupported acceptance target: ${version}`);
  const anchor = path.join(runtimes, version, 'package.json');
  const host = JSON.parse(await readFile(path.join(runtimes, version, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
  assert.equal(host.version, version, 'Runtime-cache version mismatch');
  const destination = path.join(output, version);
  const log = createWriteStream(path.join(output, `${version}.log`), { flags: 'wx' });
  const env = { ...process.env, STG_NATIVE_RUNTIME_ANCHOR: anchor, STG_NATIVE_OUTPUT_DIR: destination };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, [path.join(root, 'scripts/verify-native.mjs')], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  await new Promise(resolve => log.end(resolve));
  const evidence = JSON.parse(await readFile(path.join(destination, 'verification.json'), 'utf8'));
  results.push({ version, ok: code === 0 && evidence.ok && evidence.dsh === version, checks: evidence.checks.length, evidence: path.join(destination, 'verification.json') });
  await writeFile(path.join(output, 'matrix.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results.at(-1)));
}
assert.ok(results.every(result => result.ok), 'Some native compatibility targets failed; see matrix.json and per-version logs.');
