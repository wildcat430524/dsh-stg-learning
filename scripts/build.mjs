import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['src/client.jsx'], bundle: true, write: false,
  format: 'cjs', platform: 'browser', target: 'chrome130', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'], legalComments: 'inline' });
await mkdir('lib', { recursive: true });
const js = result.outputFiles.find(f => f.path.endsWith('.js')) || result.outputFiles[0];
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-stg-learning",factory:(require)=>{const module={exports:{}};const exports=module.exports;\n${js.text}\nreturn module.exports;}});\n`);
