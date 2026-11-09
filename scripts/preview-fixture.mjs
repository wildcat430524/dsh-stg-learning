import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createWorkbenchService} from '../src/host/service.js';
import {createWorkbenchHandler} from '../src/bridge.js';
import {createLearningSpacesService} from '../src/host/learning-spaces.js';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function startPreviewFixture(){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'stg-workbench-ui-'));
  const root=path.join(temp,'demo'),empty=path.join(temp,'empty');
  await fs.cp(path.join(project,'demo','StepsToGreat'),root,{recursive:true});await fs.mkdir(empty);
  const courseDir = '我的学习/学科/Python/01-列表与切片';
  await fs.mkdir(path.join(root,'我的学习/学科/Python/02-旧课程：面向真实问题的数据处理与可视化实践——长课程标题换行验证'),{recursive:true});
  await fs.writeFile(path.join(root,'我的学习/学科/Python/02-旧课程：面向真实问题的数据处理与可视化实践——长课程标题换行验证/01_教学引导.md'),'# 旧课程\n\n## 第一轮\n\n### 问题 1\n\n旧的学习内容。');
  // Rounds carry enough preamble that the round-heading anchor must actually
  // scroll the editable body; this is checked after direct editing too.
  const preamble = Array.from({length: 14}, (_, i) => `第 ${i + 1} 段铺垫：这一轮的场景说明与回顾。`).join('\n\n');
  for (const name of ['第二轮','第三轮']) await fs.writeFile(path.join(root,`${courseDir}/${name}_教学引导.md`),`# ${name}教学\n\n${preamble}\n\n## ${name}\n\n### 问题 1\n\n本轮引导。`);
  await fs.writeFile(path.join(root,'.steps2great.json'),JSON.stringify({version:1,skill:'steps2great'}));
  // Inline-edit coverage: formulas, a relative document link, a local image and
  // a preserved metadata block all live in the same teaching document that the
  // visual editor mounts directly.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
  await fs.writeFile(path.join(root,`${courseDir}/qa.png`),png);
  await fs.appendFile(path.join(root,`${courseDir}/01_教学引导.md`),'\n## 编辑覆盖\n\n行内公式 $x^2$ 与独立公式：\n\n$$\na^2+b^2=c^2\n$$\n\n[返回学习档案](../../../00-学习档案.md)\n\n![像素点](qa.png)\n\n<!-- 导师私有备注 -->\n');

  const entries=[{id:'demo',path:root,title:'Python 学习'},{id:'code',path:empty,title:'不应显示的普通工作区'}],choices=[];
  const registry={get:id=>entries.find(w=>w.id===id),list:()=>entries,create:async(directory,title)=>{const entry={id:`new-${entries.length}`,path:directory,title};entries.push(entry);return entry;}};
  const learning=createLearningSpacesService({registry,pickDirectory:async()=>{if(!choices.length)throw Error('No fixture picker choice queued');return choices.shift();}});
  const service={...createWorkbenchService({resolveWorkspace:learning.resolveWorkspace,learningOnly:true}),...learning};
  const handler=createWorkbenchHandler(service);
  const server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/api/stg-learning/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const response=await handler(new Request(url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const allowed={'/':'preview.html','/preview.html':'preview.html','/preview.js':'preview.js','/preview.css':'preview.css'};
    const filename=allowed[url.pathname];if(!filename){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',filename.endsWith('.js')?'application/javascript; charset=utf-8':filename.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await fs.readFile(path.join(project,'artifacts',filename)));
  }catch(error){res.writeHead(500);res.end(error.message);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/`,root,empty,temp,choices,entries,service,close:async()=>{await new Promise(resolve=>server.close(resolve));const resolved=path.resolve(temp);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('stg-workbench-ui-'))throw Error('Refused fixture cleanup');await fs.rm(resolved,{recursive:true,force:true});}};
}
