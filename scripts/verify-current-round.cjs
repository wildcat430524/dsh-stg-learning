// Focused Electron acceptance for "entering learning opens the recorded current
// round". Isolated fixture only: no real learning data, no model request.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const project = path.resolve(__dirname, '..');
const output = process.env.STG_ROUND_OUTPUT_DIR || path.join(project, 'artifacts', 'current-round-20261019');
const scratch = path.join(os.tmpdir(), 'stg-current-round-electron-' + process.pid + '-' + Date.now());
app.setPath('userData', scratch);
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const sha = async file => {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
};

app.whenReady().then(async () => {
  await fs.mkdir(output, { recursive: true });
  const { startCurrentRoundFixture } = await import(pathToFileURL(path.join(__dirname, 'current-round-fixture.mjs')).href);
  const fixture = await startCurrentRoundFixture();
  const w = new BrowserWindow({ width: 1320, height: 920, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const errors = [], checks = [];
  w.webContents.on('console-message', event => { if (event.level === 'error' && !event.message.includes('favicon')) errors.push(event.message); });
  const js = code => w.webContents.executeJavaScript(code, true);
  const wait = async (expression, timeout = 20000) => { const until = Date.now() + timeout; while (Date.now() < until) { if (await js(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw Error('UI condition failed: ' + expression); };
  const click = async text => { const found = await js(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)});if(!el)return false;el.click();return true})()`); assert.ok(found, 'Missing button ' + text); };
  const openSpace = async title => { await wait(`[...document.querySelectorAll('.stgw-learning-space strong')].some(e=>e.textContent===${JSON.stringify(title)})`, 15000); const opened = await js(`(()=>{const el=[...document.querySelectorAll('.stgw-learning-space')].find(e=>e.querySelector('strong')?.textContent===${JSON.stringify(title)});if(!el)return false;el.click();return true})()`); assert.ok(opened, 'Missing learning space ' + title); };
  const shot = async name => { await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); await js('new Promise(r=>setTimeout(r,200))'); await js("document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).forEach(a=>a.finish())"); await fs.writeFile(path.join(output, name + '.png'), (await w.webContents.capturePage(undefined, { stayAwake: true })).toPNG()); };
  const checkedRound = async () => { await click('切换本课教学轮次'); await wait("!!document.querySelector('.stgw-round-menu:popover-open')"); const value = await js("document.querySelector('.stgw-round-menu [aria-checked=true]')?.textContent.trim()||''"); await js("document.querySelector('.stgw-round-menu')?.hidePopover()"); return value; };
  const chooseRound = async title => {
    await click('切换本课教学轮次');
    await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    await click(title);
    await wait("!document.querySelector('.stgw-round-menu:popover-open')");
  };
  const setDraft = value => js(`(() => {
    const input = document.querySelector('.stgw-question textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const headingInView = async title => js(`(()=>{const h=[...document.querySelectorAll('.visual-document :is(h1,h2,h3,h4,h5,h6)')].find(e=>e.textContent.trim()===${JSON.stringify(title)});if(!h)return false;const s=document.querySelector('.stgw-scroll').getBoundingClientRect(),r=h.getBoundingClientRect();return r.top>=s.top-8&&r.bottom<=s.bottom+8})()`);
  const waitHeading = async (title, note) => { try { await wait(headingInViewExpression(title), 12000); } catch { throw Error(note || ('Heading did not reach the reading viewport: ' + title)); } };
  const headingInViewExpression = title => `(()=>{const h=[...document.querySelectorAll('.visual-document :is(h1,h2,h3,h4,h5,h6)')].find(e=>e.textContent.trim()===${JSON.stringify(title)});if(!h)return false;const s=document.querySelector('.stgw-scroll').getBoundingClientRect(),r=h.getBoundingClientRect();return r.top>=s.top-8&&r.bottom<=s.bottom+8})()`;
  let failed = false;
  try {
    const sameGuide = path.join(fixture.temp, 'same-file', '我的学习/学科/Java/10-多轮定位/01_教学引导.md');
    const sameAnswer = path.join(fixture.temp, 'same-file', '我的学习/学科/Java/10-多轮定位/01_学生回答.md');
    const independentSecond = path.join(fixture.temp, 'independent', '我的学习/学科/Java/11-独立轮次/第2轮_教学引导.md');
    const before = { sameGuide: await sha(sameGuide), sameAnswer: await sha(sameAnswer), independentSecond: await sha(independentSecond) };

    await w.loadURL(fixture.url);
    // The preview harness enters the first fixture workspace directly, which is
    // exactly the "enter learning" path under test.
    await wait("!!document.querySelector('.stgw-lesson-title')", 30000);

    // 1) Same-file multi-round guide: the recorded round (第三轮) is the default,
    //    even though the saved workbench state pointed at the answer view. The
    //    preview harness mounts the first workspace directly, which is exactly
    //    the "enter learning" path under test.
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
    await wait("!!document.querySelector('.stgw-rich .visual-document')");
    assert.equal(await js("document.querySelector('.visual-document').getAttribute('contenteditable')"), 'true');
    assert.equal(await js("document.querySelector('.stgw-page-tabs button[aria-pressed=true]')?.textContent"), '教学引导');
    assert.equal(await checkedRound(), '第三轮');
    await waitHeading('第三轮', 'the recorded round heading must actually be in view');
    checks.push('same-file multi-round guide opens the recorded current round document, check mark and heading position');
    await shot('01-same-file-current-round');

    assert.equal(await js("document.querySelector('.stgw-page-tabs').firstElementChild.className"), 'stgw-round-trigger');
    assert.equal(await js("document.querySelector('.stgw-round-trigger').textContent"), '第三轮');
    await click('作答');
    await wait("!!document.querySelector('.stgw-question textarea')");
    await setDraft('第三轮未保存的回答');
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    await chooseRound('第一轮');
    await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('第一轮原答')");
    assert.equal(await js("document.querySelector('[role=tab][aria-selected=true]').textContent"), '作答');
    assert.equal(await checkedRound(), '第一轮');
    const archive = await js("document.querySelector('#stgw-view-panel').textContent");
    assert.match(archive, /第一轮独有的题面/);
    assert.match(archive, /第一轮反馈/);
    assert.doesNotMatch(archive, /第二轮原答|第三轮未保存的回答/);
    assert.equal(await js("!!document.querySelector('.stgw-question textarea,[aria-label=保存所有改动]')"), false);
    await js("document.querySelector('.stgw-root').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");
    await shot('06-history-answer');
    await click('复习');
    await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('第一轮反馈')");
    assert.equal(await checkedRound(), '第一轮');
    await click('阅读');
    await waitHeading('第一轮');
    await click('学生回答');
    await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('第一轮原答')");
    await click('教学引导');
    await waitHeading('第一轮');
    await click('作答');
    await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('第一轮原答')");
    await chooseRound('第三轮');
    await wait("document.querySelector('.stgw-question textarea')?.value==='第三轮未保存的回答'");
    await click('阅读');
    await waitHeading('第三轮');
    checks.push('left picker shares the round across read, answer and review; history is scoped and read-only and the current answer draft survives');

    // 2) Manual history selection stays possible and is not reverted by refresh
    //    or the background timers; an unsaved draft survives.
    await click('切换本课教学轮次'); await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    await js("[...document.querySelectorAll('.stgw-round-menu button')].find(e=>e.textContent.includes('第一轮')).click()");
    await wait("!document.querySelector('.stgw-round-menu:popover-open')");
    await waitHeading('第一轮', 'manual history round must be positioned too');
    assert.equal(await checkedRound(), '第一轮');
    await js("(()=>{const body=document.querySelector('.visual-document');const p=[...body.querySelectorAll('p')].find(e=>e.textContent.includes('第一轮的问题'));if(!p)throw Error('missing round paragraph');const range=document.createRange();range.selectNodeContents(p);range.collapse(false);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);body.focus();})()");
    await js("document.execCommand('insertText',false,'（手写草稿）')");
    await wait("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
    await click('刷新课程与磁盘文档');
    await new Promise(r => setTimeout(r, 900));
    assert.equal(await checkedRound(), '第一轮');
    assert.match(await js("document.querySelector('.visual-document').textContent"), /手写草稿/);
    checks.push('manual historical round and its draft survive an explicit workspace refresh');

    // 3) Background polling (15 s workspace interval + 5 s document interval)
    //    must not steal the reader back to the current round.
    await js("window.dispatchEvent(new Event('focus'))");
    await new Promise(r => setTimeout(r, 16000));
    assert.equal(await checkedRound(), '第一轮');
    assert.match(await js("document.querySelector('.visual-document').textContent"), /手写草稿/);
    checks.push('background workspace polling never snaps a manual history selection back to the current round or drops the draft');
    await shot('02-manual-history-with-draft');

    // 4) Leaving learning and re-entering opens the current round again, while
    //    the unsaved draft from the previous visit is offered for recovery.
    await click('返回学习空间');
    await wait("!!document.querySelector('.stgw-library')");
    await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await openSpace('同文件多轮 · 当前第三轮');
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
    await wait("!!document.querySelector('.stgw-rich .visual-document')");
    await new Promise(r => setTimeout(r, 400));
    assert.equal(await checkedRound(), '第三轮');
    await waitHeading('第三轮');
    assert.match(await js('document.body.textContent'), /上次离开时有未保存的草稿/);
    checks.push('re-entering learning defaults to the recorded current round again and still offers the preserved draft');
    await shot('03-reentry-current-round-draft');

    // 5) Independent round files: the profile round (第二轮) loads its own real
    //    file, not the newer 第3轮 file named by the stale state.
    await click('返回学习空间');
    await wait("!!document.querySelector('.stgw-library')");
    await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await openSpace('独立文件轮次 · 当前第二轮');
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('第2轮_教学引导.md')");
    await wait("!!document.querySelector('.stgw-rich .visual-document')");
    await new Promise(r => setTimeout(r, 500));
    assert.equal(await js("document.querySelector('.stgw-file-label').textContent.includes('第3轮')"), false);
    assert.match(await checkedRound(), /第2轮/);
    assert.equal(await js("document.querySelector('.visual-document').textContent.includes('第3轮内容')"), false);
    // The loaded round file really is the current-round teaching document.
    assert.match(await js("document.querySelector('.visual-document').textContent"), /第2轮内容/);
    await waitHeading('第2轮');
    await click('学生回答');
    await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('第二轮原答')");
    assert.doesNotMatch(await js("document.querySelector('#stgw-view-panel').textContent"), /第一轮原答|待作答/);
    await click('教学引导');
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('第2轮_教学引导.md')");
    checks.push('independent round files load the recorded round file itself, not the stale last-browsed file');
    await shot('04-independent-round-file');

    // 6) No explicit round and no scanned evidence: safe degrade to the teaching
    //    entry with "教学总入口" checked, and recorded rounds stay selectable.
    await click('返回学习空间');
    await wait("!!document.querySelector('.stgw-library')");
    await wait("document.querySelectorAll('.stgw-learning-space').length===3");
    await openSpace('无明确轮次 · 教学入口降级');
    await wait("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
    await wait("!!document.querySelector('.stgw-rich .visual-document')");
    assert.equal(await checkedRound(), '教学总入口');
    await waitHeading('多轮定位课');
    await click('切换本课教学轮次'); await wait("!!document.querySelector('.stgw-round-menu:popover-open')");
    const choices = await js("[...document.querySelectorAll('.stgw-round-menu [role=menuitemradio]')].map(e=>({text:e.textContent.trim(),disabled:e.disabled,checked:e.getAttribute('aria-checked')}))");
    assert.ok(choices.length >= 4, 'teaching entry plus recorded rounds must remain in the menu');
    assert.ok(choices.every(row => row.disabled === false), 'history entries must not be disabled');
    await js("document.querySelector('.stgw-round-menu')?.hidePopover()");
    checks.push('without a clear current round learning degrades to the teaching entry and keeps every recorded round selectable');
    await shot('05-safe-degrade-teaching-entry');
    await chooseRound('第一轮');
    await click('作答');
    await wait("document.querySelector('#stgw-view-panel')?.textContent.includes('本轮暂无作答记录')");
    assert.doesNotMatch(await js("document.querySelector('#stgw-view-panel').textContent"), /没有轮次标记/);
    assert.equal(await checkedRound(), '第一轮');
    checks.push('a selected round without matching answer material never falls back to an unscoped question set');

    // 7) Reading and direct editing never wrote the fixture documents.
    assert.equal(await sha(sameGuide), before.sameGuide);
    assert.equal(await sha(sameAnswer), before.sameAnswer);
    assert.equal(await sha(independentSecond), before.independentSecond);
    checks.push('default current-round positioning and draft recovery wrote no learning file bytes');
    assert.deepEqual(errors, [], 'Renderer logged errors');
    const result = { ok: true, checks, errors, fixtureOnly: true, checkedAt: new Date().toISOString() };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    failed = true;
    await shot('failure').catch(() => {});
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ ok: false, checks, errors, error: error.stack }, null, 2));
    console.error(error);
  } finally {
    w.destroy();
    await fixture.close().catch(() => {});
    const resolved = path.resolve(scratch);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('stg-current-round-electron-')) await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }).catch(() => {});
    app.exit(failed ? 1 : 0);
  }
}).catch(error => { console.error(error); app.exit(1); });
