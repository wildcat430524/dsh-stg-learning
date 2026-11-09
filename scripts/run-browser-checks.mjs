import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));process.chdir(root);
await import('./build-preview.mjs');
let electron=process.env.STG_ELECTRON_PATH;
if(!electron){try{electron=createRequire(import.meta.url)('electron');}catch{}}
if(typeof electron!=='string'||!existsSync(electron))throw Error('Set STG_ELECTRON_PATH to a local Electron executable for isolated browser acceptance.');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,[path.join(root,'scripts','verify-browser.cjs')],{cwd:root,env,stdio:'inherit',windowsHide:true});
process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
