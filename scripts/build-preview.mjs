import { build } from 'esbuild';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
await build({entryPoints:['scripts/preview.jsx'],bundle:true,platform:'browser',target:'chrome130',jsx:'automatic',outfile:'artifacts/preview.js'});
await writeFile('artifacts/preview.html','<!doctype html><html lang="zh"><head><meta charset="UTF-8"><title>DSH 学习插件 · 界面验收（虚构数据）</title></head><body><div id="root"></div><script src="preview.js"></script></body></html>');
