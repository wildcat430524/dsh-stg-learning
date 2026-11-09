const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', path.join(process.env.STG_NATIVE_RUN, 'browser'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const checks = [], errors = [];
  const w = new BrowserWindow({ width: 1440, height: 960, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const js = code => Promise.race([w.webContents.executeJavaScript(code, true), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Renderer did not answer: ' + code.slice(0, 100))), 10000); timer.unref(); })]);
  const wait = async expression => { const until = Date.now() + 45000; while (Date.now() < until) { if (await js(expression)) return; await new Promise(resolve => setTimeout(resolve, 120)); } throw Error('Native UI condition failed: ' + expression); };
  const click = async label => js(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)throw Error('Missing action '+${JSON.stringify(label)});e.click();})()`);
  const dismissPreview = async () => {
    await js("(()=>{const dialog=[...document.querySelectorAll('[role=dialog]')].find(e=>e.textContent.includes('开始使用'));dialog?.querySelector('button[aria-label=关闭]')?.click();})()");
    // 0.2.0 hosts open a first-run API-key dialog in a profile with no model
    // configured. "Later" only closes it; this acceptance never stores a key.
    await js("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='稍后配置'||e.getAttribute('aria-label')==='稍后配置');b?.click();})()");
    await wait("!document.body.textContent.includes('正在加载模型')");
    if (await js("document.body.textContent.includes('预览版说明')")) {
      await wait("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='继续'&&!e.disabled)");
      await click('继续');
      await wait("!document.body.textContent.includes('预览版说明')");
    }
  };
  const shot = async name => { await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); await js("document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).forEach(a=>a.finish())"); await js("(()=>{const s=document.createElement('style');s.id='stg-qa-settled-frame';s.textContent='.stgw-root *,.stgj-root *,.stgw-onboarding *{animation:none!important;transition:none!important}';document.head.append(s)})()"); await fs.writeFile(path.join(process.env.STG_NATIVE_OUTPUT, name + '.png'), (await w.webContents.capturePage(undefined,{stayAwake:true})).toPNG());await js("document.getElementById('stg-qa-settled-frame')?.remove()"); };
  w.webContents.on('console-message', event => { if (event.level === 'error' && !event.message.includes('favicon')) { const message = event.message.replace(/token=[^\s&]+/g, 'token=[redacted]'); errors.push(message); console.error('Renderer: ' + message); } });
  const deadline = setTimeout(() => { console.error('Native browser acceptance exceeded 120 seconds.'); app.exit(1); }, 120000);
  let ok = false;
  try {
    await w.loadURL(process.env.STG_NATIVE_URL);
    await wait("document.body.textContent.includes('学习')");
    await dismissPreview();
    await click('学习');
    await wait("!!document.querySelector('.stgw-library')");
    await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await wait("!!document.querySelector('[data-sidebar-collapsed]')");
    checks.push('entering learning collapses the actual DSH host sidebar');
    await click('打开侧边栏'); await wait("!document.querySelector('[data-sidebar-collapsed]')");
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await js("!!document.querySelector('[data-sidebar-collapsed]')"), false);
    checks.push('manual sidebar reopening remains respected while learning is open');
    await new Promise(resolve => setTimeout(resolve, 350));
    await dismissPreview();
    assert.equal(await js("document.querySelectorAll('.stgw-library-options article').length"), 2);
    assert.equal(await js("!!document.querySelector('.stgw-workspace-select')"), false);
    assert.equal(await js("document.querySelector('.stgw-library').textContent.includes('不应出现在学习页的代码仓库')"), false);
    checks.push('native learning home has exactly new/import setup paths and only recognized learning spaces');
    await shot('native-learning-library');
    await js("[...document.querySelectorAll('.stgw-learning-space')].find(e=>e.querySelector('strong')?.textContent==='STG 隔离验收').click()");
    await wait("!!document.querySelector('.stgj-root')");
    assert.equal(await js("!!document.querySelector('.stgw-mentor')"), false);
    await wait("!!document.querySelector('.stgw-lesson-title')");
    assert.equal(await js("!!document.querySelector('.stgj-tabs')||!!document.querySelector('.stgj-welcome')||!!document.querySelector('.stgj-statusline')"), false);
    checks.push('existing learning opens the current course directly without an overview screen');
    // Default position is the recorded current round (第一轮 in 01_教学引导.md),
    // even though the saved workbench state pointed at a historical round file
    // in answer view. The round menu check mark must agree with the open file.
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
    assert.equal(await js("document.querySelector('.stgw-file-label').textContent.includes('第二轮')"), false);
    assert.equal(await js("!!document.querySelector('.stgw-round-trigger')"), true);
    await click('切换本课教学轮次');await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    // A real named current round remains selected even when its file is also
    // the teaching entry; this must not silently become "教学总入口".
    await wait("document.querySelector('.stgw-round-menu [aria-checked=true]')");
    assert.equal(await js("document.querySelector('.stgw-round-menu [aria-checked=true]')?.textContent.trim()"), '第一轮');
    await js("document.querySelector('.stgw-round-menu')?.hidePopover()");
    await wait("!document.querySelector('.stgw-round-menu:popover-open')");
    checks.push('real DSH opens the current recorded round by default, not the stale historical round or answer view, and the menu check mark matches');
    assert.equal(await js("!!document.querySelector('.stgw-outline')||!!document.querySelector('.stgw-resizer')||!!document.querySelector('button[aria-label=展开学习目录]')"), false);
    assert.deepEqual(await js("[...document.querySelectorAll('.stgw-page-tabs button[aria-pressed]')].map(e=>e.textContent)"), ['教学引导', '学生回答', '当前章节进度', '总体进度']);
    checks.push('native learning has no directory sidebar and uses STG Desk style horizontal document/progress tabs');
    // Direct editing in the real DSH shell: the teaching body is editable on
    // open, exactly like STG Desk, with no pencil/eye gate or mode switch.
    await wait("!!document.querySelector('.stgw-rich .visual-document')");
    assert.equal(await js("document.querySelector('.visual-document').getAttribute('contenteditable')"),'true');
    assert.equal(await js("[...document.querySelectorAll('button')].some(e=>/编辑完整文档|结束编辑|查看排版/.test((e.getAttribute('aria-label')||'')+e.textContent))"),false);
    assert.equal(await js("!!document.querySelector('.stgw-editor-tools,.stgw-editor-switch,.stgw-editor-heading')"),false);
    await js("window.__nativeEditor=document.querySelector('.visual-document')");
    await js("(()=>{const body=window.__nativeEditor;const p=[...body.querySelectorAll('p')].find(e=>e.textContent.includes('索引'));const range=document.createRange();range.selectNodeContents(p);range.collapse(false);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);body.focus();})()");
    await js("document.execCommand('insertText',false,' 原生就地编辑')");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    assert.equal(await js("window.__nativeEditor===document.querySelector('.visual-document')&&document.activeElement.classList.contains('visual-document')"),true);
    await js("window.__nativeEditor.dispatchEvent(new KeyboardEvent('keydown',{key:'z',code:'KeyZ',ctrlKey:true,bubbles:true,cancelable:true}))");
    await wait("!document.querySelector('.visual-document').textContent.includes('原生就地编辑')");
    await js("document.execCommand('insertText',false,' 原生保存')");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    await js("document.querySelector('.stgw-root').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='saved'");
    checks.push('official DSH host edits the teaching body directly with the shared editor, keeps focus/undo and saves via Ctrl+S');
    assert.equal(await js("!!document.querySelector('.stgw-lesson-heading select,.stgw-lesson-heading .stgw-round-trigger')"),false);
    await click('切换课程');await wait("!!document.querySelector('.stgw-course-menu:popover-open')");
    await wait("document.activeElement?.getAttribute('aria-label')==='搜索学习课程'");
    await shot('native-course-menu');
    await js("(()=>{const e=document.querySelector('.stgw-course-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'旧课程');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await wait("document.querySelectorAll('.stgw-course-results [role=option]').length===1");
    await js("document.querySelector('.stgw-course-results [role=option]').click()");await wait("document.querySelector('.stgw-lesson-title')?.textContent.includes('旧课程')");
    await click('切换课程');await wait("!!document.querySelector('.stgw-course-menu:popover-open')");
    await js("[...document.querySelectorAll('.stgw-course-results [role=option]')].find(e=>e.textContent.includes('列表与切片')).click()");await wait("document.querySelector('.stgw-lesson-title')?.textContent.includes('列表与切片')");
    checks.push('official DSH course popover searches grouped courses, switches a historical course and returns to the current course without a native select');

    // A new unauthenticated test profile may mount its welcome dialog after the course render.
    await js("new Promise(r=>setTimeout(r,700))");await dismissPreview();
    await wait("!document.querySelector('[role=dialog]:not([popover])')");
    // Flush the initial current-round scroll before testing a scroll-dismissed menu.
    await js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
    await js("new Promise(r=>setTimeout(r,150))");
    await shot('native-workbench-before-round');
    await click('切换本课教学轮次');await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    await wait("document.activeElement?.getAttribute('role')==='menuitemradio'");
    assert.equal(await js("document.querySelector('.stgw-round-trigger').getAttribute('aria-expanded')"),'true');
    await shot('native-round-menu');
    await js("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
    await wait("!document.querySelector('.stgw-round-menu:popover-open')");
    assert.equal(await js("!!document.querySelector('.stgj-root')&&document.activeElement.classList.contains('stgw-round-trigger')"),true);
    await click('切换本课教学轮次');await wait("document.activeElement?.getAttribute('role')==='menuitemradio'");
    await js("[...document.querySelectorAll('.stgw-round-menu button')].find(e=>e.textContent.includes('第二轮')).click()");
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('第二轮_教学引导')");
    await click('学生回答');await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('本轮暂无作答记录')");
    assert.match(await js("document.querySelector('.stgw-round-trigger').textContent"), /第二轮/);
    await click('教学引导');await wait("document.querySelector('.stgw-file-label')?.textContent.includes('第二轮_教学引导')");
    checks.push('real DSH renders the left round menu and keeps the same historical round between the teaching and answer panels');
    // Leaving and re-entering the learning space defaults back to the recorded
    // current round instead of keeping the last browsed historical round.
    await click('返回学习空间');
    await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await js("[...document.querySelectorAll('.stgw-learning-space')].find(e=>e.querySelector('strong')?.textContent==='STG 隔离验收').click()");
    await wait("!!document.querySelector('.stgw-lesson-title')");
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
    assert.equal(await js("document.querySelector('.stgw-file-label').textContent.includes('第二轮')"), false);
    checks.push('re-entering the learning space in the real DSH host opens the recorded current round again');

    await click('当前章节进度'); await wait("!!document.querySelector('.stgw-progress-page')");
    await click('总体进度'); await wait("document.querySelector('.stgw-progress-page')?.getAttribute('aria-label')==='总体进度'");
    await click('教学引导'); await wait("!!document.querySelector('.stgw-lesson-title')");
    checks.push('native progress pages open original file evidence and return to the same course');
    assert.equal(await js("!!document.querySelector('.stgw-workspace-select')"), false);
    checks.push('real DSH sidebar opens native learning page with demo course');
    await shot('native-workbench');
    await click('作答');
    await wait("document.querySelectorAll('.stgw-question textarea').length===2");
    await js("[...document.querySelectorAll('.stgw-question textarea')].forEach((e,i)=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,i?'fruits[2:4] → 橙子、葡萄':'索引 1 是香蕉，2 是橙子；右边界 3 不包含。');e.dispatchEvent(new Event('input',{bubbles:true}));})");
    await click('保存并准备评估');
    await wait("!document.querySelector('.stgj-root')&&document.querySelectorAll('[aria-label=发送消息]').length===1");
    await wait("document.body.textContent.includes('请求已放入 DSH 输入框')");
    await dismissPreview();
    const composer = "[...document.querySelectorAll('textarea,[contenteditable=true]')].filter(e=>e.getBoundingClientRect().height>0).map(e=>e.value??e.innerText).join('\\n')";
    assert.match(await js(composer), /我已保存本轮作答/);
    checks.push('answers save through authenticated Host and assessment moves to the actual full native main conversation');
    assert.equal(await js("document.querySelectorAll('[aria-label=发送消息]').length"), 1);
    await shot('native-mentor');
    assert.equal(await js("!!document.querySelector('.stgw-mentor')||!!document.querySelector('.stgw-native-session')"), false);
    await wait("[...document.querySelectorAll('.stgw-native-return')].some(e=>e.textContent.trim()==='学习内容')");
    await click('学习内容');
    await wait("!!document.querySelector('.stgw-lesson-title')");
    await wait("!!document.querySelector('[data-sidebar-collapsed]')");
    checks.push('reentering learning closes a previously manually expanded host sidebar again');
    checks.push('native conversation dock returns directly to the same course documents');
    if (!await js("!!document.querySelector('.stgt-teacher')")) await click('老师');
    await wait("!!document.querySelector('.stgj-root')&&!!document.querySelector('.stgt-teacher')&&document.querySelectorAll('[aria-label=发送消息]').length===1");
    assert.match(await js(composer), /我已保存本轮作答/);
    checks.push('teacher opens beside the lesson using the original native Session and unsent draft');
    assert.equal(await js("document.querySelectorAll('style[data-plugin=stg-editor]').length"), 1);
    assert.equal(await js("!!document.querySelector('.stgt-layouts')"), false);
    assert.equal(await js("[...document.querySelectorAll('.stgw-doc-actions button')].some(e=>e.textContent.trim()==='老师')"), false);
    assert.equal(await js("document.querySelectorAll('[aria-label=发送消息]').length"), 1);
    assert.equal((await js(composer)).split('我已保存本轮作答').length - 1, 1);
    checks.push('only one native composer exists and the prepared request is inserted exactly once');
    await click('阅读');await wait("!!document.querySelector('.visual-document p')");
    assert.equal(await js("parseFloat(getComputedStyle(document.querySelector('.visual-document')).fontSize)>=15"), true);
    assert.equal(await js("parseFloat(getComputedStyle(document.querySelector('.visual-document pre')).paddingLeft)>=16"), true);
    // The reader design joins the code toolbar and the block into ONE panel
    // (src/editor/editor.css: `.edh-code-tools + pre { border-top: 0 }`), so the
    // panel's top edge is carried by whichever element is on top: the toolbar
    // when the block has one, the block itself otherwise.
    assert.equal(await js("(()=>{const pre=document.querySelector('.visual-document pre');const tools=pre?.previousElementSibling?.classList?.contains('edh-code-tools')?pre.previousElementSibling:null;const top=tools||pre;if(!top)return 'no-code-panel';const preStyle=getComputedStyle(pre);const topStyle=getComputedStyle(top);return tools? (preStyle.borderTopStyle==='none'&&topStyle.borderTopStyle==='solid'?'solid':`toolbar:${topStyle.borderTopStyle},pre:${preStyle.borderTopStyle}`) : preStyle.borderTopStyle;})()"), 'solid');
    assert.equal(await js("getComputedStyle(document.querySelector('.edh-code-language-label')).display"), 'none');
    checks.push('distributed native CSS loads once and renders STG Desk sized text and bordered code with a single language control');
    await js("(()=>{window.__teacherEditor=document.querySelector('.visual-document');const bounds=document.querySelector('.stgw-scroll').getBoundingClientRect();const p=[...document.querySelectorAll('.visual-document p')].find(e=>{const r=e.getBoundingClientRect();return e.textContent.trim()&&r.top>bounds.top+20&&r.bottom<bounds.bottom-40;});const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r);window.__teacherQuote=s.toString();document.querySelector('.stgw-scroll').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));})()");
    await wait("!!document.querySelector('.stgt-selection')");
    await shot('native-selection-teacher');
    const quoted = await js('window.__teacherQuote');
    await click('在旁边问老师');
    await wait("!document.querySelector('.stgt-selection') && document.querySelector('.stgt-chat').textContent.includes('老师，这里我没理解')");
    assert.equal(await js("document.querySelector('.visual-document')===window.__teacherEditor"), true);
    assert.ok((await js(composer)).includes(quoted));
    assert.equal(await js("document.querySelectorAll('[aria-label=发送消息]').length"), 1);
    assert.equal(await js("!!document.querySelector('.stgj-root')"), true);
    checks.push('selection stages a bounded local question beside the lesson without navigation, editor remount or a second composer');
    await shot('native-teacher-question');
    // A labelled DOM fixture tests selection mechanics only, not model output.
    await js("(()=>{const root=document.querySelector('.stgt-quote-surface');const p=document.createElement('p');p.id='stg-quote-test-message';p.textContent='隔离测试消息：切片不包含右边界。';p.style.cssText='padding:12px;flex:none';root.prepend(p);const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))})()");
    await wait("!!document.querySelector('.stgt-quote-surface .stgt-selection')");
    await click('添加到提问');
    await wait("!document.querySelector('.stgt-quote-surface .stgt-selection')");
    assert.match(await js(composer), /隔离测试消息：切片不包含右边界/);
    await js("document.getElementById('stg-quote-test-message').remove()");
    await js("(()=>{const e=document.querySelector('.stgt-chat [contenteditable=true]');const r=document.createRange();r.selectNodeContents(e);getSelection().removeAllRanges();getSelection().addRange(r);e.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))})()");
    assert.equal(await js("!!document.querySelector('.stgt-quote-surface .stgt-selection')"),false);
    await js("getSelection().removeAllRanges()");
    checks.push('teacher text selection fixture quotes into the same native composer while composer text never triggers a quote toolbar');

    await js("window.__nativeTeacherInput=document.querySelector('.stgt-chat [contenteditable=true]');void 0");
    assert.equal(await js("(()=>{let node=window.__nativeTeacherInput;while(node&&!node.classList.contains('stgt-chat')){if(getComputedStyle(node).maxHeight==='180px')return true;node=node.parentElement;}return false;})()"), true, 'Long native drafts must scroll inside a bounded composer, leaving space for the conversation');
    const teacherDraft = "document.querySelector('.stgt-chat [contenteditable=true]').textContent";
    const retainedTeacherDraft = await js(teacherDraft);
    for (const [label, mode] of [['切换为浮窗','float'],['固定到侧边','split'],['切换为浮窗','float']]) {
      await click(label);
      assert.equal(await js("document.querySelector('.stgt-frame').dataset.teacherLayout"), mode);
      assert.equal(await js("document.querySelector('.stgt-chat [contenteditable=true]')===window.__nativeTeacherInput&&document.querySelector('.visual-document')===window.__teacherEditor"), true);
      assert.equal(await js(teacherDraft), retainedTeacherDraft);
      assert.equal(await js("document.querySelectorAll('[aria-label=发送消息]').length"), 1);
    }
    checks.push('floating and sidebar layouts preserve the real native composer node, its draft and the lesson editor');
    assert.equal(await js("(()=>{const r=document.querySelector('.stgt-reading').getBoundingClientRect(),f=document.querySelector('.stgt-frame').getBoundingClientRect();return Math.abs(r.right-f.right)<1&&Math.abs(r.width-f.width)<1})()"),true);
    const resizeStart=await js("(()=>{const r=document.querySelector('.stgt-resize-se').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()");
    w.webContents.sendInputEvent({type:'mouseMove',...resizeStart});
    w.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...resizeStart});
    for(let i=1;i<=8;i++){w.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:resizeStart.x-Math.round(75*i/8),y:resizeStart.y-Math.round(175*i/8)});await new Promise(r=>setTimeout(r,20));}
    w.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:resizeStart.x-75,y:resizeStart.y-175});
    await wait("document.querySelector('.stgt-teacher').getBoundingClientRect().height<400");
    assert.equal(await js("document.querySelector('.stgt-chat [contenteditable=true]')===window.__nativeTeacherInput&&document.querySelector('.visual-document')===window.__teacherEditor"),true);
    assert.equal(await js(teacherDraft),retainedTeacherDraft);
    const compactControls=await js("(()=>{const p=document.querySelector('.stgt-teacher').getBoundingClientRect();return [...document.querySelectorAll('.stgt-chat button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent,inside:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1}})})()");
    assert.ok(compactControls.some(e=>e.label==='发送消息'));assert.ok(compactControls.every(e=>e.inside),JSON.stringify(compactControls));
    assert.equal(await js("(()=>{let n=window.__nativeTeacherInput;while(n&&!n.classList.contains('stgt-chat')){if(getComputedStyle(n).maxHeight==='88px')return true;n=n.parentElement}return false})()"),true);
    await shot('native-compact-resize');checks.push('full-width floating reader and compact resized native composer keep all visible actions inside the panel and preserve the draft');
    await click('收起老师');await wait("!document.querySelector('.stgt-teacher')");
    if (!await js("!!document.querySelector('.stgt-teacher')")) await click('老师');await wait("!!document.querySelector('.stgt-teacher')&&document.querySelectorAll('[aria-label=发送消息]').length===1");
    assert.match(await js(composer), /老师，这里我没理解/);
    await click('回到 DSH 主对话');await wait("!document.querySelector('.stgj-root')&&document.querySelectorAll('[aria-label=发送消息]').length===1");
    await wait("!document.querySelector('[data-sidebar-collapsed]')");
    checks.push('returning to the DSH main conversation automatically restores the actual left sidebar');
    await click('收起侧边栏');await wait("!!document.querySelector('[data-sidebar-collapsed]')");
    await js('new Promise(r=>setTimeout(r,300))');assert.equal(await js("!!document.querySelector('[data-sidebar-collapsed]')"),true);
    checks.push('manual sidebar closure after returning to chat is respected');
    assert.match(await js(composer), /老师，这里我没理解/);
    await wait("[...document.querySelectorAll('.stgw-native-return')].some(e=>e.textContent.trim()==='学习内容')");
    await click('学习内容');await wait("!!document.querySelector('.stgw-lesson-title')");
    await wait("!!document.querySelector('[data-sidebar-collapsed]')");
    checks.push('returning to learning with a closed host sidebar never toggles it open');
    checks.push('closing, reopening, expanding and returning preserve the same course and native question draft');
    await shot('native-restored');
    await click('返回学习空间');
    await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await js("[...document.querySelectorAll('.stgw-learning-space')].find(e=>e.querySelector('strong')?.textContent==='STG 初始化验收').click()");
    await wait("!!document.querySelector('#stgj-start-brief')");
    assert.equal(await js("!!document.querySelector('.stgw-lesson-title')"), false);
    checks.push('fresh learning starts with a calm guide instead of exposing the raw profile template');
    await shot('native-learning-start');
    await click('帮我理清目标');
    await js("(()=>{const e=document.querySelector('#stgj-start-brief');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'我想用 Python 处理表格，每天30分钟');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click('和老师聊聊');
    await wait("!document.querySelector('.stgj-root')&&document.body.textContent.includes('请求已放入 DSH 输入框')");
    assert.match(await js(composer), /帮我理清目标/); assert.match(await js(composer), /每天30分钟/);
    assert.equal(await js("document.querySelectorAll('[aria-label=发送消息]').length"), 1);
    checks.push('explicit clarification preference and student brief are staged in the full native initialization conversation without submission');
    await shot('native-initial-conversation');
    await click('学习内容'); await wait("!!document.querySelector('.stgj-root')");
    await click('返回学习空间'); await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await js("[...document.querySelectorAll('.stgw-learning-space')].find(e=>e.querySelector('strong')?.textContent==='STG 旧版链接验收').click()");
    await wait("!!document.querySelector('.stgj-root')");
    await wait("document.querySelector('.stgw-lesson-title')?.textContent.includes('列表与切片')");
    assert.equal(await js("document.querySelectorAll('.stgw-mentor').length"), 0);
    checks.push('native learning page opens a legacy junction-backed course without migration or copied student records');
    await shot('native-legacy-learning');
    assert.deepEqual(errors, [], 'Native browser logged errors');
    ok = true;
  } catch (error) {
    errors.push(error.stack || String(error));
    console.error(error);
    console.error('Native body: ' + await js('document.body.innerText').catch(() => 'unavailable'));
    await shot('native-failure').catch(() => {});
  } finally {
    await fs.writeFile(path.join(process.env.STG_NATIVE_OUTPUT, 'browser-result.json'), JSON.stringify({ ok, checks, errors }, null, 2));
    clearTimeout(deadline);
    w.destroy();
    app.exit(ok ? 0 : 1);
  }
}).catch(error => { console.error(error); app.exit(1); });
