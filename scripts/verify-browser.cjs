const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const project=path.resolve(__dirname,'..');
const output=process.env.STG_BROWSER_OUTPUT_DIR||path.join(project,'artifacts');
const scratch=path.join(os.tmpdir(),'stg-workbench-electron-'+process.pid+'-'+Date.now());
app.setPath('userData',scratch);app.disableHardwareAcceleration();
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  const {startPreviewFixture}=await import(pathToFileURL(path.join(__dirname,'preview-fixture.mjs')));
  const fixture=await startPreviewFixture();
  const w=new BrowserWindow({width:1320,height:920,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  let failed=false;
  const errors=[],checks=[];w.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('favicon'))errors.push(event.message);});
  const js=code=>w.webContents.executeJavaScript(code,true);
  const wait=async expression=>{const until=Date.now()+15000;while(Date.now()<until){if(await js(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('UI condition failed: '+expression);};
  const click=async text=>{const found=await js(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)});if(!el)return false;el.click();return true})()`);assert.ok(found,'Missing button '+text);};
  const chooseFirstRound=async()=>{
    await click('切换本课教学轮次');
    await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    await js("[...document.querySelectorAll('.stgw-round-menu [role=menuitemradio]')].find(e=>e.textContent.includes('第一轮')).click()");
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
  };
  const input=async(selector,value)=>js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing input');const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const shot=async name=>{await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await js('new Promise(r=>setTimeout(r,240))');await js("document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).forEach(a=>a.finish())"); await js("(()=>{const s=document.createElement('style');s.id='stg-qa-settled-frame';s.textContent='.stgw-root *,.stgj-root *,.stgw-onboarding *{animation:none!important;transition:none!important}';document.head.append(s)})()"); await fs.writeFile(path.join(output,name+'.png'),(await w.webContents.capturePage(undefined,{stayAwake:true})).toPNG());await js("document.getElementById('stg-qa-settled-frame')?.remove()");};
  try{
    await w.loadURL(fixture.url);await wait("!!document.querySelector('.stgw-lesson-title')");assert.equal(await js("!!document.querySelector('.stgj-tabs')||!!document.querySelector('.stgj-welcome')||!!document.querySelector('.stgj-statusline')"),false);checks.push('existing learning opens the current course directly without overview tabs or duplicated status banner');
    assert.match(await js('document.body.textContent'),/列表与切片/);checks.push('restore current course from real demo profile');
    assert.equal(await js("!!document.querySelector('.stgw-outline')||!!document.querySelector('.stgw-resizer')||!!document.querySelector('button[aria-label=展开学习目录]')"),false);checks.push('learning has no internal directory sidebar, drawer, resizer or toggle');
    assert.deepEqual(await js("[...document.querySelectorAll('.stgw-page-tabs button[aria-pressed]')].map(e=>e.textContent)"),['教学引导','学生回答','当前章节进度','总体进度']);checks.push('STG Desk style horizontal document and progress access replaces the tree');
    await click('当前章节进度');await wait("document.querySelector('.stgw-progress-page')?.getAttribute('aria-label')==='当前章节进度'");await click('总体进度');await wait("document.querySelector('.stgw-progress-page')?.textContent.includes('掌握表')");await click('教学引导');await wait("!!document.querySelector('.stgw-lesson-title')");checks.push('chapter and overall progress use original file evidence and return to teaching');
    assert.equal(await js("!!document.querySelector('select.stgw-course-picker')"),false);
    await shot('workbench-before-course');
    await click('切换课程');await wait("!!document.querySelector('.stgw-course-menu:popover-open')");await wait("document.activeElement?.getAttribute('aria-label')==='搜索学习课程'");
    await shot('course-menu-light');await input('.stgw-course-search input','旧课程');
    await wait("document.querySelectorAll('.stgw-course-results [role=option]').length===1");
    await js("document.querySelector('.stgw-course-results [role=option]').click()");await wait("document.querySelector('.stgw-lesson-title')?.textContent.includes('旧课程')");
    await click('当前章节进度');assert.equal(await js("document.querySelector('.stgw-progress-summary').textContent.includes('非当前课程')"),true);
    await click('切换课程');await wait("!!document.querySelector('.stgw-course-menu:popover-open')");
    await input('.stgw-course-search input','没有这门课');await wait("!!document.querySelector('.stgw-course-no-results')");await click('清空搜索');await wait("document.querySelectorAll('.stgw-course-results [role=option]').length===3");
    await js("[...document.querySelectorAll('.stgw-course-results [role=option]')].find(e=>e.textContent.includes('列表与切片')).click()");await wait("document.querySelector('.stgw-lesson-title')?.textContent.includes('列表与切片')");
    checks.push('searchable grouped course popover replaces native select and historical progress never borrows current-course state');

    assert.equal(await js("!!document.querySelector('.stgw-lesson-heading select,.stgw-lesson-heading .stgw-round-trigger')"),false);
    assert.equal(await js("!!document.querySelector('.stgw-page-tabs > .stgw-round-trigger:first-child')"),true);
    await click('切换本课教学轮次');await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    await wait("document.activeElement?.getAttribute('role')==='menuitemradio'");
    assert.equal(await js("document.activeElement?.getAttribute('aria-checked')"),'true');
    await shot('round-menu-light');
    const toggle=await js("(()=>{const r=document.querySelector('.stgw-round-trigger').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()");
    w.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...toggle});w.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...toggle});await wait("!document.querySelector('.stgw-round-menu:popover-open')");
    await click('切换本课教学轮次');await wait("document.activeElement?.getAttribute('role')==='menuitemradio'");

    await js("[...document.querySelectorAll('.stgw-round-menu button')].find(e=>e.textContent.includes('第二轮')).click()");await wait("document.querySelector('.stgw-file-label')?.textContent.includes('第二轮_教学引导')");
    assert.equal(await js("!!document.querySelector('.stgw-round-menu:popover-open')"),false);
    // The selected course.rounds entry is titled 第二轮教学 and identifies the
    // whole file. Its later 第二轮 subheading is beyond a deliberate preamble.
    await wait("(()=>{const h=[...document.querySelectorAll('.visual-document :is(h1,h2,h3,h4,h5,h6)')].find(e=>e.textContent.trim()==='第二轮教学');if(!h)return false;const s=document.querySelector('.stgw-scroll').getBoundingClientRect(),r=h.getBoundingClientRect();return r.top>=s.top-8&&r.top<=s.top+32&&r.bottom<=s.bottom+8})()");
    checks.push('round selection scrolls the selected round document heading into view in the editable Tiptap body');
    await click('切换本课教学轮次');await wait("document.activeElement?.getAttribute('role')==='menuitemradio'&&document.activeElement.textContent.includes('第二轮')");
    await js("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}))");
    assert.equal(await js("document.activeElement.textContent.includes('第三轮')"),true);
    await js("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}))");
    assert.equal(await js("document.activeElement.textContent.includes('教学总入口')"),true);
    await js("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
    await wait("!document.querySelector('.stgw-round-menu:popover-open')");assert.equal(await js("document.activeElement.classList.contains('stgw-round-trigger')"),true);
    await js("document.querySelector('.stgw-round-trigger').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}))");
    await wait("document.activeElement?.getAttribute('role')==='menuitemradio'&&document.activeElement.textContent.includes('第三轮')");
    w.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...toggle});w.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...toggle});await wait("!document.querySelector('.stgw-round-menu:popover-open')");
    checks.push('top teaching navigation hosts a styled round menu with checked selection, keyboard navigation and Escape focus restoration');
    await click('切换本课教学轮次');await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    const outside=await js("(()=>{const r=document.querySelector('.stgw-lesson-title').getBoundingClientRect();return {x:Math.round(r.left+10),y:Math.round(r.top+10)}})()");
    w.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...outside});w.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...outside});await wait("!document.querySelector('.stgw-round-menu:popover-open')");
    assert.match(await js("document.querySelector('.stgw-file-label').textContent"), /第二轮_教学引导/);
    await chooseFirstRound();checks.push('round selection opens recorded documents and light dismissal closes without changing the selected document');await shot('workbench-light');
    await js("window.__topIndicator=document.querySelector('.stgw-page-tabs .stgw-sliding-indicator');window.__readingSurface=document.querySelector('.stgw-scroll')");
    assert.equal(await js("getComputedStyle(window.__topIndicator).transitionProperty.includes('left')&&getComputedStyle(window.__topIndicator).transitionDuration.includes('0.22s')"),true);
    await click('总体进度');await wait("!!document.querySelector('.stgw-progress-page')");
    await js("new Promise(r=>setTimeout(r,250))");
    assert.equal(await js("window.__topIndicator===document.querySelector('.stgw-page-tabs .stgw-sliding-indicator')&&window.__readingSurface===document.querySelector('.stgw-scroll')"),true);
    await shot('workbench-progress');
    await wait("(()=>{const a=document.querySelector('.stgw-page-tabs [aria-pressed=true]').getBoundingClientRect(),b=window.__topIndicator.getBoundingClientRect();return Math.abs(a.left-b.left)<2&&Math.abs(a.width-b.width)<2})()");
    const progressGeometry=await js("(()=>{const r=document.querySelector('.stgw-progress-page').getBoundingClientRect();return {left:r.left,width:r.width,padding:getComputedStyle(document.querySelector('.stgw-progress-page')).paddingLeft}})()");
    await click('教学引导');await wait("!!document.querySelector('.stgw-content')");
    assert.deepEqual(await js("(()=>{const r=document.querySelector('.stgw-content').getBoundingClientRect();return {left:r.left,width:r.width,padding:getComputedStyle(document.querySelector('.stgw-content')).paddingLeft}})()"),progressGeometry);
    checks.push('navigation moves one persistent left-width indicator while reading and progress share the same surface and column geometry');
    await js("window.__originalFetch=window.fetch;window.fetch=(url,init)=>Promise.resolve().then(()=>String(url).includes('/document?')?new Promise(r=>setTimeout(r,750)):null).then(()=>window.__originalFetch(url,init));void 0");
    await click('切换本课教学轮次');await wait("!!document.querySelector('.stgw-round-menu:popover-open')");await js("[...document.querySelectorAll('.stgw-round-menu button')].find(e=>e.textContent.includes('第三轮')).click()");
    await wait("!!document.querySelector('.stgw-reading-skeleton')");
    assert.equal(await js("document.querySelector('.stgw-reading-skeleton').getAttribute('role')==='status'&&!document.querySelector('.stgw-reading-skeleton').textContent.includes('%')"),true);
    assert.equal(await js("getComputedStyle(document.querySelector('.stgw-reading-skeleton')).maxWidth"),'896px');await shot('workbench-reading-loading');
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('第三轮_教学引导')");await js("window.fetch=window.__originalFetch;delete window.__originalFetch");await chooseFirstRound();;
    checks.push('slow document loading shows an aligned structural skeleton without invented percentage or mastery');
    w.webContents.debugger.attach('1.3');await w.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await wait("matchMedia('(prefers-reduced-motion: reduce)').matches");await js("new Promise(r=>setTimeout(r,80))");await click('总体进度');await wait("!!document.querySelector('.stgw-progress-page')");
    assert.equal(await js("getComputedStyle(window.__topIndicator).transitionDuration"),'0s');
    assert.equal(await js("document.querySelector('.stgw-scroll').getAnimations().length"),0);
    await click('教学引导');await wait("!!document.querySelector('.stgw-content')");await w.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});w.webContents.debugger.detach();
    checks.push('reduced-motion disables indicator transitions and script-driven document animation');

    console.log('Available actions: '+await js("JSON.stringify([...document.querySelectorAll('button')].map(e=>e.getAttribute('aria-label')||e.textContent.trim()).filter(Boolean))"));
    await click('作答');await wait("document.querySelectorAll('.stgw-question textarea').length===2");
    await js("window.__answerNode=document.querySelector('.stgw-question textarea');window.__answerNode.focus()");
    await input('.stgw-question textarea','索引 1 是香蕉，2 是橙子；右边界 3 不包含。');
    assert.equal(await js("window.__answerNode===document.querySelector('.stgw-question textarea')&&document.activeElement===window.__answerNode"),true);
    checks.push('typing keeps the original textarea and focus rather than remounting a field for motion');
    await js("(()=>{const el=document.querySelectorAll('.stgw-question textarea')[1];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'fruits[2:4] → 橙子、葡萄');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    const beforeProgress=await fixture.service.workspace({workspaceId:'demo'});const originalAnswer=await fixture.service.read({workspaceId:'demo',path:beforeProgress.current.answerPath});await click('当前章节进度');await wait("!!document.querySelector('.stgw-progress-page')");await js("document.querySelector('.stgw-root').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");assert.equal((await fixture.service.read({workspaceId:'demo',path:beforeProgress.current.answerPath})).content,originalAnswer.content);await click('学生回答');await wait("document.querySelectorAll('.stgw-question textarea').length===2");assert.match(await js("document.querySelector('.stgw-question textarea').value"),/右边界 3 不包含/);checks.push('progress switching preserves unsaved answers and Ctrl+S on progress never saves the hidden document');
    await js("window.__originalFetch=window.fetch;window.fetch=(url,init)=>Promise.resolve().then(()=>String(url).includes('/answers')?new Promise(r=>setTimeout(r,650)):null).then(()=>window.__originalFetch(url,init));void 0");
    await click('保存作答');await wait("document.querySelector('.stgw-save-state')?.dataset.state==='saving'");
    assert.equal(await js("document.querySelector('.stgw-answer-footer button[aria-busy=true]').disabled"),true);
    assert.equal(await js("document.querySelector('.stgw-save-state').textContent"),'正在保存…');await shot('workbench-saving');
    await wait("document.querySelector('.stgw-save-state')?.textContent==='已保存'");await js("window.fetch=window.__originalFetch;delete window.__originalFetch");checks.push('saving visibly locks its action and shows success only after the real file write response');
    const overview=await fixture.service.workspace({workspaceId:'demo'});const answer=await fixture.service.read({workspaceId:'demo',path:overview.current.answerPath});
    assert.match(answer.content,/右边界 3 不包含/);assert.match(answer.content,/fruits\[2:4\]/);assert.equal((answer.content.match(/\*\*学生作答 ·/g)||[]).length,2);checks.push('current 2 answers append to file without mastery mutation');
    await shot('workbench-answer');await click('复习');await js("document.querySelectorAll('.stgw-record').forEach(e=>e.open=true)");await wait("document.body.textContent.includes('右边界 3 不包含')");checks.push('original student answers available in review history');
    // Answer/review surfaces stay read-only: only the teaching body is editable.
    assert.equal(await js("!!document.querySelector('.stgw-rich,.visual-document')"),false);
    await click('阅读');await wait("!!document.querySelector('.stgw-lesson-title')");
    // Direct editing: the teaching body is the same Tiptap surface on open.
    await wait("!!document.querySelector('.stgw-rich .visual-document')");
    assert.equal(await js("document.querySelector('.visual-document').getAttribute('contenteditable')"),'true');
    assert.equal(await js("[...document.querySelectorAll('button')].some(e=>/编辑完整文档|结束编辑|查看排版/.test((e.getAttribute('aria-label')||'')+e.textContent))"),false);
    assert.equal(await js("!!document.querySelector('.stgw-editor-tools,.stgw-editor-switch,.stgw-editor-heading')"),false);
    assert.deepEqual(await js("[...document.querySelectorAll('.stgw-main-tools button')].map(e=>e.textContent.trim()).filter(t=>t==='富文本'||t==='Markdown'||t==='可见即所得')"),[]);
    checks.push('opening the teaching document mounts the shared Tiptap body directly with no pencil/eye switch, mode pair or resident formatting bar');
    const original=await fixture.service.read({workspaceId:'demo',path:overview.current.guidePath});
    assert.equal((await fixture.service.read({workspaceId:'demo',path:overview.current.guidePath})).content,original.content);
    assert.match(await js("document.querySelector('.visual-document').textContent"),/x\^2|a\^2|x2/);
    assert.equal(await js("!!document.querySelector('.visual-document .visual-math')&&!!document.querySelector('.visual-document .visual-math-block')"),true);
    assert.equal(await js("!!document.querySelector('.visual-document .visual-preserved')"),true);
    assert.equal(await js("!!document.querySelector('.visual-document img')"),true);
    checks.push('mounting alone rewrites nothing and formulas, preserved metadata and local images render in place');
    // In-place interactions kept from the source editor: formula dialog on
    // double-click / toolbar, and the code language + copy widget.
    assert.equal(await js("!!document.querySelector('.visual-document .edh-code-tools select.edh-code-language')&&!!document.querySelector('.visual-document .edh-code-tools .edh-code-copy')"),true);
    await js("(()=>{const m=document.querySelector('.visual-document .visual-math');m.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));})()");
    await wait("!!document.querySelector('.stgw-math-dialog[open]')");
    assert.match(await js("document.querySelector('.stgw-math-dialog').textContent"),/编辑公式/);
    await click('取消');await wait("!document.querySelector('.stgw-math-dialog[open]')");
    await click('插入公式');await wait("!!document.querySelector('.stgw-math-dialog[open]')");
    assert.match(await js("document.querySelector('.stgw-math-dialog').textContent"),/插入公式/);
    await click('取消');await wait("!document.querySelector('.stgw-math-dialog[open]')");
    assert.equal((await fixture.service.read({workspaceId:'demo',path:overview.current.guidePath})).content,original.content);
    checks.push('formula double-click and code language/copy stay available in place without a resident formatting bar');
    await js("window.__formulaEditor=document.querySelector('.visual-document')");
    await js("(()=>{const body=document.querySelector('.visual-document');const p=[...body.querySelectorAll('p')].find(e=>e.textContent.includes('索引'));const last=p.lastChild;const range=document.createRange();range.setStart(last,last.length);range.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);body.focus();})()");
    const mathBefore=await js("document.querySelectorAll('.visual-document .visual-math').length");await click('插入公式');await wait("!!document.querySelector('.stgw-math-dialog[open]')");
    await input('.stgw-math-dialog textarea','z + 1');
    await click('应用公式');await wait("document.querySelectorAll('.visual-document .visual-math').length>"+mathBefore);
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    await js("document.querySelector('.stgw-root').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='saved'");
    const withFormula=await fixture.service.read({workspaceId:'demo',path:original.path});
    assert.match(withFormula.content,/\$z \+ 1\$/);
    assert.equal(await js("window.__formulaEditor===document.querySelector('.visual-document')"),true);
    checks.push('inserted formula is written back through the live editor without a remount');

    // ProseMirror groups adjacent transactions issued within its newGroupDelay
    // (500 ms default) into ONE undo event. The formula insertion and the typing
    // below are separate user actions, so let the group close before typing;
    // otherwise a single Ctrl+Z legitimately removes both edits at once and the
    // byte comparison would test history grouping instead of text editing.
    await js("new Promise(r=>setTimeout(r,650))");
    await js("window.__editorNode=document.querySelector('.visual-document');window.__editorText=window.__editorNode.textContent");
    await js("(()=>{const body=document.querySelector('.visual-document');const p=[...body.querySelectorAll('p')].find(e=>e.textContent.includes('索引'));const text=p.lastChild;const range=document.createRange();range.setStart(text,text.length);range.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);body.focus();})()");
    assert.equal(await js("document.activeElement.classList.contains('visual-document')"),true);
    await js("document.execCommand('insertText',false,' 就地编辑')");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    assert.equal(await js("window.__editorNode===document.querySelector('.visual-document')&&document.activeElement.classList.contains('visual-document')"),true);
    assert.equal(await js("window.__editorNode.textContent.includes('就地编辑')"),true);
    assert.equal((await fixture.service.read({workspaceId:'demo',path:overview.current.guidePath})).content,withFormula.content);
    await js("document.querySelector('.visual-document').dispatchEvent(new KeyboardEvent('keydown',{key:'z',code:'KeyZ',ctrlKey:true,bubbles:true,cancelable:true}))");
    await wait("!document.querySelector('.visual-document').textContent.includes('就地编辑')");
    assert.equal(await js("window.__editorNode===document.querySelector('.visual-document')"),true);
    checks.push('native editor undo restores the text without recreating the editor or losing its history');
    await js("document.execCommand('insertText',false,' 来自工作台的编辑。')");
    await wait("document.querySelector('.visual-document').textContent.includes('来自工作台的编辑。')");
    await js("document.querySelector('.stgw-root').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='saved'");
    const saved=await fixture.service.read({workspaceId:'demo',path:overview.current.guidePath});
    assert.match(saved.content,/来自工作台的编辑。/);assert.equal(saved.content.replace(' 来自工作台的编辑。',''),withFormula.content);

    // Relative document links stay editable text and follow on Ctrl+click.
    await js("(()=>{const a=[...document.querySelectorAll('.visual-document a')].find(e=>e.textContent.includes('学习档案'));a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));})()");
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('00-学习档案.md')");
    checks.push('Ctrl+click on a relative document link navigates without turning links into edit traps');
    await click('教学引导');await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
    await wait("!!document.querySelector('.stgw-rich .visual-document')");

    // External edit during a local draft keeps both sides.
    await js("(()=>{const body=document.querySelector('.visual-document');const p=body.querySelector('p');const range=document.createRange();range.selectNodeContents(p);range.collapse(false);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);body.focus();})()");
    await js("document.execCommand('insertText',false,' 本地草稿。')");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    await fixture.service.save({workspaceId:'demo',path:original.path,content:saved.content+'\n\n导师在外部更新。',expectedVersion:saved.version,operationId:'external-editor'});
    await click('保存所有改动');await wait("document.querySelector('.stgw-dialog[role=dialog]')?.textContent.includes('导师在外部更新')");
    assert.match(await js('document.body.textContent'),/本地草稿/);assert.match(await js('document.body.textContent'),/导师在外部更新/);checks.push('external write conflict keeps both versions');await shot('workbench-conflict');
    console.log('Conflict actions: '+await js("JSON.stringify([...document.querySelectorAll('.stgw-dialog[role=dialog] button')].map(e=>e.textContent.trim()))"));
    await click('采用磁盘版本');await wait("!document.querySelector('.stgw-dialog[role=dialog]')");
    await wait("document.querySelector('.visual-document')?.textContent.includes('导师在外部更新')");
    assert.equal(await js("!!document.querySelector('.stgw-editor-source')"),false);
    checks.push('conflict adopts the disk version in the visual body while offering draft recovery');await click('忽略此草稿');
    await wait("!document.body.textContent.includes('上次离开时有未保存的草稿')");
    await js("document.documentElement.dataset.theme='dark'");await shot('workbench-dark');
    w.setSize(420,860);await wait("document.querySelector('.stgw-root').dataset.mobile==='true'");assert.equal(await js("document.documentElement.scrollWidth>document.documentElement.clientWidth"),false);checks.push('420px layout fits without page overflow');await shot('workbench-narrow');
    await click('切换本课教学轮次');await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    assert.equal(await js("(()=>{const r=document.querySelector('.stgw-round-menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),true);
    await shot('round-menu-narrow-dark');
    await js("document.querySelector('.stgw-round-menu').hidePopover()");checks.push('round popover escapes tab clipping and stays within the 420px dark viewport');
    await click('切换课程');await wait("!!document.querySelector('.stgw-course-menu:popover-open')");
    assert.equal(await js("(()=>{const r=document.querySelector('.stgw-course-menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),true);await shot('course-menu-narrow-dark');
    await js("document.querySelector('.stgw-course-search input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");await wait("document.activeElement?.getAttribute('role')==='option'");
    await js("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");await wait("!document.querySelector('.stgw-course-menu:popover-open')");assert.equal(await js("document.activeElement.getAttribute('aria-label')"),'切换课程');checks.push('course popover stays in the dark narrow viewport and supports keyboard focus and Escape restoration');


    w.setSize(1320,920);await wait("document.querySelector('.stgw-root').dataset.mobile==='false'");
    await click('学习空间');await wait("!!document.querySelector('.stgw-library')&&!document.querySelector('.stgw-library').getAttribute('aria-busy').includes('true')&&document.querySelectorAll('.stgw-learning-space').length===1");
    assert.equal(await js("document.querySelectorAll('.stgw-library-options article').length"),2);assert.equal(await js("!!document.querySelector('.stgw-workspace-select')"),false);
    assert.equal(await js("document.body.textContent.includes('不应显示的普通工作区')"),false);checks.push('library shows exactly new/import setup paths and excludes generic workspaces');
    await js("document.documentElement.dataset.theme='light'");await shot('learning-library-light');
    await click('新学习');await wait("!!document.querySelector('.stgw-onboarding')");assert.equal(await js("document.querySelectorAll('.stgw-onboarding input').length"),1);assert.equal(await js("!!document.querySelector('.stgw-library')"),false);checks.push('new learning opens a dedicated calm page with just one required name field');
    await click('选择位置并创建学习空间');await wait("document.querySelector('#stgw-learning-name-error')?.textContent.includes('请填写')");assert.equal(fixture.entries.length,2);
    await input('#stgw-learning-name','CON');await click('选择位置并创建学习空间');await wait("document.querySelector('#stgw-learning-name-error')?.textContent.includes('保留名称')");checks.push('new-learning page explains empty or reserved names without reaching the host picker');
    await input('#stgw-learning-name','浏览器新学习');await shot('new-learning-light');await js("document.documentElement.dataset.theme='dark'");await shot('new-learning-dark');w.setSize(420,860);await new Promise(r=>setTimeout(r,200));assert.equal(await js("document.documentElement.scrollWidth>document.documentElement.clientWidth"),false);await shot('new-learning-narrow');w.setSize(1320,920);await js("document.documentElement.dataset.theme='light'");checks.push('dedicated new-learning page supports light/dark theme and 420px layout');
    fixture.choices.push(null);await click('选择位置并创建学习空间');await wait("document.body.textContent.includes('已取消')");assert.equal(await js("document.querySelector('#stgw-learning-name').value"),'浏览器新学习');
    await assert.rejects(fs.stat(path.join(fixture.temp,'浏览器新学习')),{code:'ENOENT'});assert.equal(fixture.entries.length,2);checks.push('cancelled new-learning chooser makes no user folder or workspace');
    fixture.choices.push(fixture.temp);await click('选择位置并创建学习空间');await wait("!!document.querySelector('#stgj-start-brief')");assert.equal(await js("!!document.querySelector('.stgw-lesson-title')"),false);
    assert.equal(fixture.entries.length,3);assert.match(await fs.readFile(path.join(fixture.temp,'浏览器新学习','AGENTS.md'),'utf8'),/StepsToGreat/);checks.push('new-learning UI builds full standalone folder and opens initial learning guidance with no auto-send');await shot('learning-initial');
    await click('帮我理清目标');await input('#stgj-start-brief','我想学 Python，每天30分钟');await click('和老师聊聊');await wait("!!document.querySelector('.fixture-native')");assert.match(await js("document.querySelector('.fixture-native textarea').value"),/帮我理清目标/);assert.match(await js("document.querySelector('.fixture-native textarea').value"),/每天30分钟/);assert.equal(await js("!!document.querySelector('.stgw-mentor')"),false);checks.push('selected clarification and brief prepare a draft in a separate full-canvas native-conversation fixture');await click('学习内容');await wait("!!document.querySelector('.stgj-root')");
    await click('学习空间');await wait("document.querySelectorAll('.stgw-learning-space').length===2");
    fixture.choices.push(fixture.empty);await click('导入已有 StepsToGreat 文件夹');await wait("document.querySelector('[role=alert]')?.textContent.includes('请选择 StepsToGreat')");assert.equal(fixture.entries.length,3);checks.push('invalid import stays on library and does not register arbitrary folders');
    fixture.choices.push(null);await click('导入已有 StepsToGreat 文件夹');await wait("document.body.textContent.includes('已取消')");assert.equal(fixture.entries.length,3);checks.push('cancelled import preserves existing learning spaces');
    fixture.choices.push(fixture.root);await click('导入已有 StepsToGreat 文件夹');await wait("!!document.querySelector('.stgw-lesson-title')");assert.equal(fixture.entries.length,3);checks.push('import reuses existing learning identity and restores its saved course');
    await click('学习空间');await wait("document.querySelectorAll('.stgw-learning-space').length===2");
    await js("document.documentElement.dataset.theme='dark'");await shot('learning-library-dark');w.setSize(420,860);await new Promise(r=>setTimeout(r,250));assert.equal(await js("document.documentElement.scrollWidth>document.documentElement.clientWidth"),false);await shot('learning-library-narrow');checks.push('learning library supports dark theme and narrow layout without overflow');
    assert.equal(errors.length,0,errors.join('\n'));
    await fs.writeFile(path.join(output,'browser-verification.json'),JSON.stringify({ok:true,checks,errors},null,2));console.log(JSON.stringify({ok:true,checks}));
  }catch(error){failed=true;await shot('workbench-failure').catch(()=>{});await fs.writeFile(path.join(output,'browser-verification.json'),JSON.stringify({ok:false,checks,errors,error:error.stack},null,2));console.error(error);}
  finally{w.destroy();await fixture.close();const resolved=path.resolve(scratch);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('stg-workbench-electron-'))await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:150}).catch(()=>{});app.exit(failed?1:0);}
}).catch(error=>{console.error(error);app.exit(1);});
