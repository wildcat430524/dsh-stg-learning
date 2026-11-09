import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.resolve(process.argv[2] || 'E:/Steps2Great-skill');
const commit = process.argv[3];
const previousCommit = '74313f99ea6300dd195c7297efcfb1529e5b03da';
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw Error('Pass the exact verified upstream commit.');
const target = path.join(root, 'skills', 'stg-mentor');
if (path.resolve(target) !== path.resolve(root, 'skills/stg-mentor')) throw Error('Unexpected destination.');
const git = args => execFileSync('git', ['-C', source, ...args], { maxBuffer: 64 * 1024 * 1024 });
const tree = ref => git(['ls-tree', '-r', '-z', '--full-tree', ref]).toString('utf8').split('\0').filter(Boolean).map(line => {
  const [header, file] = line.split('\t'); const [mode, kind, id] = header.split(' ');
  return { file, mode, kind, id };
});
const allowed = file => /^(?:references|scripts|templates|assets|docs|tests|evals|_build)\//.test(file) || ['SKILL.md', 'README.md', 'README.en.md', 'LICENSE', 'LICENSE-DOCS', 'package.json', 'CONTRIBUTING.md'].includes(file);
const previous = new Map(tree(previousCommit).map(entry => [entry.file, entry]));
const selected = tree(commit).filter(entry => allowed(entry.file));
const next = new Map(selected.map(entry => [entry.file, entry]));
for (const entry of selected) if (entry.mode !== '100644' || entry.kind !== 'blob' || entry.file.split('/').some(part => part === '..' || part === '' || part.includes('\\'))) throw Error('Unsafe source entry: ' + entry.file);
const blobHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const existing = [];
async function walk(directory, prefix = '') {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = prefix + item.name, absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw Error('Refusing vendored link: ' + file);
    if (item.isDirectory()) await walk(absolute, file + '/');
    else {
      const original = previous.get(file);
      const hash = blobHash(await fs.readFile(absolute));
      if (hash !== original?.id && hash !== next.get(file)?.id) throw Error('Unexpected local vendored modification; preserved: ' + file);
      existing.push(file);
    }
  }
}
await walk(target);
const batch = spawnSync('git', ['-C', source, 'cat-file', '--batch'], { input: Buffer.from(selected.map(entry => entry.id).join('\n') + '\n'), maxBuffer: 64 * 1024 * 1024 });
if (batch.status !== 0) throw Error('Unable to read pinned Git objects.');
let offset = 0;
const contents = selected.map(entry => {
  const end = batch.stdout.indexOf(10, offset), header = batch.stdout.subarray(offset, end).toString('ascii').split(' ');
  const size = Number(header[2]);
  if (header[0] !== entry.id || header[1] !== 'blob' || !Number.isSafeInteger(size)) throw Error('Bad Git batch response.');
  const bytes = batch.stdout.subarray(end + 1, end + 1 + size); offset = end + 1 + size + 1;
  if (blobHash(bytes) !== entry.id) throw Error('Git object fingerprint mismatch: ' + entry.file);
  return { ...entry, bytes };
});
for (const entry of contents) {
  const destination = path.join(target, entry.file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, entry.bytes);
}
const wanted = new Set(selected.map(entry => entry.file));
for (const file of existing) if (!wanted.has(file)) {
  const absolute = path.resolve(target, file);
  if (!absolute.startsWith(path.resolve(target) + path.sep)) throw Error('Unsafe obsolete path.');
  await fs.unlink(absolute); // Only previously verified, unchanged vendored files.
}
const version = JSON.parse(contents.find(entry => entry.file === 'package.json').bytes.toString('utf8')).version;
const report = { repository: 'https://github.com/wildcat430524/Steps2Great-skill', commit, previousCommit, version, files: selected.length, entries: selected.map(({ file, id }) => ({ file, gitBlob: id })) };
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
await fs.writeFile(path.join(root, 'artifacts', 'teaching-skill-source.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, version, commit, files: selected.length, removed: existing.filter(file => !wanted.has(file)).length }));
