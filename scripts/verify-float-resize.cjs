const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/float-resize-20261026/resize');
app.setPath('userData',path.join(os.tmpdir(),`stg-resize-${Date.now()}`));app.disableHardwareAcceleration();app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 await fs.mkdir(output,{recursive:true});
 const {startTeacherFixture}=await import(pathToFileURL(path.join(__dirname,'teacher-fixture.mjs'))),fixture=await startTeacherFixture();
 const file=path.join(fixture.root,fixture.course,'01_教学引导.md'),before=await fs.readFile(file,'utf8');
 const w=new BrowserWindow({width:1440,height:960,show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const js=c=>Promise.race([w.webContents.executeJavaScript(c,true),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Renderer stalled: '+c.slice(0,180))),10000);t.unref()})]),checks=[],errors=[];
 w.webContents.on('console-message',e=>{if(e.level==='error'&&!e.message.includes('favicon'))errors.push(e.message)});
 const wait=async c=>{const end=Date.now()+12000;while(Date.now()<end){if(await js(c))return;await new Promise(r=>setTimeout(r,40))}throw Error('Timeout: '+c)};
 const click=label=>js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click()})()`);
 const settled=()=>wait("document.querySelector('.stgt-teacher')?.dataset.morph!=='animating'");
 const shot=async name=>{await new Promise(r=>setTimeout(r,100));await fs.writeFile(path.join(output,name+'.png'),(await w.webContents.capturePage(undefined,{stayAwake:true})).toPNG())};
 const rect=()=>js("(()=>{const r=document.querySelector('.stgt-teacher').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()");
 const full="(()=>{const r=document.querySelector('.stgt-reading').getBoundingClientRect(),f=document.querySelector('.stgt-frame').getBoundingClientRect();return Math.abs(r.right-f.right)<1&&Math.abs(r.width-f.width)<1})()";
 const identity="document.querySelector('.visual-document')===window.__editor&&document.querySelector('.stgt-teacher textarea')===window.__composer&&document.querySelector('.stgt-teacher')===window.__panel";
 const contained="(()=>{const p=document.querySelector('.stgt-teacher').getBoundingClientRect(),f=document.querySelector('.stgt-frame').getBoundingClientRect();return p.left>=f.left-1&&p.top>=f.top-1&&p.right<=f.right+1&&p.bottom<=f.bottom+1})()";
 async function drag(selector,dx,dy){
  const start=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  w.webContents.sendInputEvent({type:'mouseMove',...start});w.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...start});
  for(let i=1;i<=8;i++){w.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:Math.round(start.x+dx*i/8),y:Math.round(start.y+dy*i/8)});await new Promise(r=>setTimeout(r,16))}
  w.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(start.x+dx),y:Math.round(start.y+dy)});await js('new Promise(r=>requestAnimationFrame(r))');
 }
 let failure;
 try{
  await w.loadURL(fixture.url);await wait("!!document.querySelector('.stgt-teacher')&&!!document.querySelector('.visual-document')");
  assert.equal(await js("document.querySelector('.stgt-frame').dataset.teacherLayout"),'split');
  await js("localStorage.setItem('stg-teacher.layout.v1','float');void 0");await w.loadURL(fixture.url);await wait("!!document.querySelector('.stgt-teacher')&&!!document.querySelector('.visual-document')");
  assert.equal(await js("document.querySelector('.stgt-frame').dataset.teacherLayout"),'split');
  assert.equal(await js("(()=>{const r=document.querySelector('.stgt-reading').getBoundingClientRect(),p=document.querySelector('.stgt-teacher').getBoundingClientRect();return Math.abs(r.right-p.left)<1})()"),true);
  await shot('default-sidebar');checks.push('fresh and upgraded preferences default to a flush sidebar with no unused gutter');
  await js("window.__editor=document.querySelector('.visual-document');window.__composer=document.querySelector('.stgt-teacher textarea');window.__panel=document.querySelector('.stgt-teacher');void 0");
  await click('切换为浮窗');await settled();assert.equal(await js(full),true);assert.equal(await js(identity),true);await shot('fullwidth-float');checks.push('floating restores the entire reading surface without replacing the editor or composer');assert.equal(await js("(()=>{const p=document.querySelector('.stgt-teacher').getBoundingClientRect();const hit=b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left<p.right&&r.right>p.left&&r.top<p.bottom&&r.bottom>p.top};const named=t=>[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()===t);const targets=[...named('检查更新'),...named('复制代码').slice(0,1)];return targets.length===2&&!targets.some(hit)})()"),true,'default floating teacher must not cover the check-update or first copy-code button');checks.push('default floating teacher leaves the reading controls uncovered');
  await js("(()=>{const p=[...document.querySelectorAll('.visual-document p')].find(e=>e.textContent.includes('边界本身不包含在结果里'));const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);document.querySelector('.stgw-scroll').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));})()");
  await wait("document.querySelector('.stgt-selection')?.dataset.placed==='true'");await click('在旁边问老师');await wait("document.querySelector('.stgt-teacher textarea').value.includes('边界本身不包含在结果里')");
  const draft=await js("document.querySelector('.stgt-teacher textarea').value");
  await drag('.stgt-resize-se',-75,-170);const small=await rect();assert.ok(small.width<=365&&small.height<=400,JSON.stringify(small));assert.equal(await js(identity),true);
  assert.ok(await js("getComputedStyle(document.querySelector('.stgt-welcome h2')).fontSize==='17px'"));
  assert.ok(await js("document.querySelector('.stgt-teacher textarea').getBoundingClientRect().height<=90"));await shot('compact');checks.push('real pointer shrinking activates compact typography and input spacing at window size');
  await click('看看对话排版');assert.ok(await js("document.querySelector('.stgt-example').clientHeight>90"));await shot('compact-conversation');await click('回到提问');checks.push('compact conversation keeps a usable scrolling message area and composer');
  await drag('.stgt-resize-sw',-160,150);const large=await rect();assert.ok(large.width>500&&large.height>500);assert.equal(await js(contained),true);await shot('large');checks.push('corner resizing grows the panel while preserving its opposite edge and viewport bounds');
  await drag('.stgt-header',-60,30);await drag('.stgt-resize-e',-30,0);assert.equal(await js(contained),true);assert.equal(await js(identity),true);checks.push('drag then edge resize retains the same panel and stays within the frame');
  const retained=await rect();await click('固定到侧边');await settled();await click('切换为浮窗');await settled();const returned=await rect();assert.ok(Math.abs(returned.width-retained.width)<1&&Math.abs(returned.height-retained.height)<1);assert.equal(await js("document.querySelector('.stgt-teacher textarea').value"),draft);checks.push('docking and floating restore the selected size and quoted draft');
  const prior=await rect();await js("document.querySelector('.stgt-resize-se').focus();void 0");w.webContents.sendInputEvent({type:'keyDown',keyCode:'Left'});w.webContents.sendInputEvent({type:'keyUp',keyCode:'Left'});await wait(`document.querySelector('.stgt-teacher').getBoundingClientRect().width<${prior.width-10}`);checks.push('focused resize grip supports keyboard sizing');
  await click('固定到侧边');await settled();await click('切换为浮窗');await drag('.stgt-resize-sw',-30,-30);await settled();assert.equal(await js(contained),true);assert.equal(await js(identity),true);checks.push('resizing interrupts an active morph without remounting or leaving stale geometry');
  w.setSize(1000,650);await wait('innerWidth<1100');await wait(contained);assert.equal(await js(full),true);checks.push('viewport shrink clamps the floating panel and preserves full-width reading');
  await click('切换明暗');await wait("document.documentElement.dataset.theme==='dark'");await shot('compact-dark');
  await click('收起老师');await wait("!document.querySelector('.stgt-teacher')");assert.equal(await js(full),true);await click('老师');await wait("!!document.querySelector('.stgt-teacher')");assert.equal(await js("document.querySelector('.stgt-teacher textarea').value"),draft);checks.push('closing restores full width; reopening retains draft and dark theme');
  await js("document.querySelector('.stgt-frame').style.width='850px';void 0");await wait("document.querySelector('.stgt-teacher').dataset.wide==='false'");assert.equal(await js("getComputedStyle(document.querySelector('.stgt-teacher')).position"),'relative');assert.ok(await js("document.querySelector('.stgt-teacher').getBoundingClientRect().height>200"));await js("document.querySelector('.stgt-frame').style.width='';void 0");checks.push('a narrow learning region uses the bottom sheet even when the outer viewport is wide');
  w.setSize(440,900);await wait('innerWidth<500');await wait("document.querySelector('.stgt-teacher').dataset.wide==='false'");assert.equal(await js("getComputedStyle(document.querySelector('.stgt-resize-se')).display"),'none');assert.ok(await js("document.querySelector('.stgt-frame').scrollWidth<=document.querySelector('.stgt-frame').clientWidth+1"));await shot('narrow-dark');checks.push('narrow layout uses a bottom sheet and hides unavailable resize handles');
  assert.equal(await fs.readFile(file,'utf8'),before);assert.deepEqual(errors,[]);checks.push('course file remains unchanged and no browser errors occur');
 }catch(e){failure=e;await shot('failure')}
 const result={ok:!failure,checks,errors,error:failure?.stack};await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));w.destroy();await fixture.close();app.exit(failure?1:0);
}).catch(e=>{console.error(e);app.exit(1)});
