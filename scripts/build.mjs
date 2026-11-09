import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
const result = await build({ entryPoints: ['src/client.jsx'], bundle: true, write: false, outfile:'client.js',
  metafile:true,
  format: 'cjs', platform: 'browser', target: 'chrome130', jsx: 'automatic',
  loader:{'.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl'},
  external: ['react', 'react/jsx-runtime'], legalComments: 'inline' });
await mkdir('lib', { recursive: true });
const js = result.outputFiles.find(f => f.path.endsWith('.js')) || result.outputFiles[0];
let css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
const sheet=postcss.parse(css);
sheet.walkRules(rule=>{
  if(rule.selector.includes('.katex'))rule.selectors=rule.selectors.map(selector=>`:where([data-stg-workbench], .stgw-rich) ${selector}`);
});
css=sheet.toString().replace(/KaTeX_/g,'STGKaTeX_');
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-stg-learning",factory:(require)=>{const module={exports:{}};const exports=module.exports;\n${js.text}\nconst __apply=module.exports.apply;const __styledApply=ctx=>{ctx.effect(()=>{const s=document.createElement('style');s.dataset.plugin='stg-editor';s.textContent=${JSON.stringify(css)};document.head.append(s);return()=>s.remove();},'stg-editor: scoped CSS');return __apply(ctx);};\nreturn {...module.exports,apply:__styledApply};}});\n`);
console.log(`Built native STG workbench (${Math.round(js.contents.length/1024)} KiB JS, ${Math.round(css.length/1024)} KiB scoped editor CSS).`);
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/build-meta.json',JSON.stringify(result.metafile,null,2));
await import('./collect-notices.mjs');
