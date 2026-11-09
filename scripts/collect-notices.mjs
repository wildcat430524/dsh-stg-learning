import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),meta=JSON.parse(await fs.readFile(path.join(root,'artifacts/build-meta.json'),'utf8'));
const packages=new Map();
for(const input of Object.keys(meta.inputs)){
  if(!input.includes('node_modules/'))continue;
  let directory=path.dirname(path.resolve(root,input));
  while(directory!==path.dirname(directory)){
    try{const pkg=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));if(pkg.name&&pkg.version){packages.set(pkg.name,{...pkg,directory});break;}}catch{}
    directory=path.dirname(directory);
  }
}
await fs.mkdir('licenses',{recursive:true});
const rows=[];
for(const pkg of [...packages.values()].sort((a,b)=>a.name.localeCompare(b.name))){
  const slug=pkg.name.replace(/[^a-z0-9._-]/gi,'_');
  const files=(await fs.readdir(pkg.directory)).filter(name=>/^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(name));
  const links=[];
  for(const name of files){if(!(await fs.stat(path.join(pkg.directory,name))).isFile())continue;const target=`licenses/${slug}-${name}`;await fs.copyFile(path.join(pkg.directory,name),target);links.push(`[${name}](${target})`);}
  rows.push(`| ${pkg.name} | ${pkg.version} | ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license||'See package')} | ${links.join(', ')||'License in upstream package'} |`);
}
await fs.writeFile('THIRD-PARTY-NOTICES.md',`# Third-party notices\n\nSTG workbench additions are MIT. No SiYuan implementation was copied. StudyMate/WorkDSH/SiYuan were architecture and interaction references.\n\nThe editor and learning parser snapshots come from STG Desk commit 6b047b17a99d8e467a238b20500698df12d1a5a6 (MIT). See src/editor/stg/PROVENANCE.md and vendor/stg/PROVENANCE.md and their retained LICENSE files.\n\nThe packaged teaching Skill comes from Steps2Great-skill commit f8fc81cfd4305da0e627a8a0434c1d153294fc02. Its code and documentation retain their original LICENSE and LICENSE-DOCS in skills/stg-mentor/. See docs/ECOSYSTEM.md for attribution and integration boundaries.\n\nThe following packages contribute code, styles or fonts to the browser artifact. Their original notices are preserved in licenses/. DSH runtime packages installed through npm retain their own notices and are not bundled into the client.\n\n| Package | Version | License metadata | Preserved notices |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`);
console.log(`Preserved ${packages.size} bundled package license notices.`);
