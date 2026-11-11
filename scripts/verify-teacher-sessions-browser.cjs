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
  const js = code => Promise.race([w.webContents.executeJavaScript(code, true), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Renderer did not answer: ' + code.slice(0, 120))), 12000); timer.unref(); })]);
  const wait = async (expression, limit = 45000) => { const until = Date.now() + limit; while (Date.now() < until) { if (await js(expression)) return; await new Promise(resolve => setTimeout(resolve, 120)); } throw Error('Native UI condition failed: ' + expression); };
  const click = async label => js(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)throw Error('Missing action '+${JSON.stringify(label)});e.click();})()`);
  const shot = async name => {
    // A captured frame can lag the latest paint, so settle real time before
    // capturing: animations finished, style applied, and one more layout pass.
    await js("document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).forEach(a=>a.finish())");
    await js("(()=>{const s=document.createElement('style');s.id='stg-qa-settled-frame';s.textContent='.stgw-root *,.stgj-root *,.stgt-frame *{animation:none!important;transition:none!important}';document.head.append(s)})()");
    await js('new Promise(r=>setTimeout(r,420))');
    await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    await fs.writeFile(path.join(process.env.STG_NATIVE_OUTPUT, name + '.png'), (await w.webContents.capturePage(undefined, { stayAwake: true })).toPNG());
    await js("document.getElementById('stg-qa-settled-frame')?.remove()");
  };
  const dismissPreview = async () => {
    await js("(()=>{const dialog=[...document.querySelectorAll('[role=dialog]')].find(e=>e.textContent.includes('开始使用'));dialog?.querySelector('button[aria-label=关闭]')?.click();})()");
    await js("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='稍后配置'||e.getAttribute('aria-label')==='稍后配置');b?.click();})()");
    await wait("!document.body.textContent.includes('正在加载模型')");
    if (await js("document.body.textContent.includes('预览版说明')")) {
      await wait("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='继续'&&!e.disabled)");
      await click('继续');
      await wait("!document.body.textContent.includes('预览版说明')");
    }
  };
  const composerSelector = ".stgt-chat [contenteditable=true]";
  const composerText = "[...document.querySelectorAll('.stgt-chat textarea,.stgt-chat [contenteditable=true]')].filter(e=>e.getBoundingClientRect().height>0).map(e=>e.value??e.innerText).join('\\n')";
  /** Focus the real composer and type a draft there; the host may re-show a modal after boot. */
  const typeDraft = async text => {
    for (let attempt = 0; attempt < 8; attempt++) {
      await dismissPreview();
      const focused = await js(`(()=>{const e=document.querySelector(${JSON.stringify(composerSelector)});if(!e)return false;e.focus();return document.activeElement===e})()`);
      if (!focused) { await new Promise(r => setTimeout(r, 300)); continue; }
      await js(`(()=>{const e=document.querySelector(${JSON.stringify(composerSelector)});document.execCommand('insertText',false,${JSON.stringify(text)});})()`);
      for (let waitFor = 0; waitFor < 12; waitFor++) {
        if ((await js(composerText)).includes(text)) return;
        await new Promise(r => setTimeout(r, 120));
      }
    }
    throw Error('Could not stage a draft in the native teacher composer');
  };
  const openSwitcher = async () => {
    // The menu closes itself whenever the archive confirmation opens, so a
    // reopened menu can race the previous close; retry the invoker instead of
    // assuming one click is enough.
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      if (await js("!!document.querySelector('.stgt-session-menu:popover-open')")) return;
      await js("document.querySelector('.stgt-session-trigger')?.click()");
      await new Promise(r => setTimeout(r, 150));
    }
    const state = await js(`(()=>{const m=document.querySelector('.stgt-session-menu'),t=document.querySelector('.stgt-session-trigger');return JSON.stringify({menu:!!m,trigger:!!t,open:m?.matches(':popover-open')??null,openAttr:m?.getAttribute('popover')??null,dialog:!!document.querySelector('.stga-dialog'),teacher:!!document.querySelector('.stgt-teacher'),body:document.body.innerText.slice(0,180)});})()`);
    throw Error('Could not open the teacher conversation switcher: ' + state);
  };
  const closeSwitcher = async () => {
    await js("document.querySelector('.stgt-session-menu')?.hidePopover()");
    await wait("!document.querySelector('.stgt-session-menu:popover-open')");
  };
  const listedSessions = () => js("[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].map(e=>e.dataset.sessionId)");
  const currentSession = () => js("document.querySelector('.stgt-session-trigger')?.dataset.session || ''");
  w.webContents.on('console-message', event => {
    if (event.level === 'error' && !event.message.includes('favicon')) {
      const message = event.message.replace(/token=[^\s&]+/g, 'token=[redacted]');
      errors.push(message); console.error('Renderer: ' + message);
    }
  });
  const deadline = setTimeout(() => { console.error('Teacher session acceptance exceeded 180 seconds.'); app.exit(1); }, 180000);
  let ok = false;
  let result = {};
  try {
    await w.loadURL(process.env.STG_NATIVE_URL);
    await wait("document.body.textContent.includes('学习')");
    await dismissPreview();
    await click('学习');
    await wait("document.querySelectorAll('.stgw-learning-space').length===2");
    assert.equal(await js(`document.querySelector('.stgw-library').textContent.includes(${JSON.stringify(process.env.STG_NATIVE_OTHER_TITLE)})`), true);
    await js(`[...document.querySelectorAll('.stgw-learning-space')].find(e=>e.querySelector('strong')?.textContent===${JSON.stringify(process.env.STG_NATIVE_WORKSPACE_TITLE)}).click()`);
    await wait("!!document.querySelector('.stgj-root')");
    await wait("!!document.querySelector('.stgt-chat textarea,.stgt-chat [contenteditable=true]')");
    await new Promise(r => setTimeout(r, 900)); await dismissPreview();
    await wait("!!document.querySelector('.stgt-session-trigger')");
    const originalSessionId = await currentSession();
    assert.ok(originalSessionId, 'the current teacher conversation must identify itself');
    checks.push('opening the course shows one teacher conversation in the header switcher');

    // Park an unsent draft in the original conversation. Only a draft is
    // staged: nothing is submitted, so no model request can start.
    await typeDraft('原来的草稿别丢');
    await wait(`(${composerText}).includes('原来的草稿别丢')`);
    // The seeded transcript belongs to this same isolated Session. It proves a
    // new conversation never clears the old history and old chats stay reachable.
    const seeded = await js("fetch('/api/stg-qa/seed',{method:'POST'}).then(r=>r.json())");
    assert.equal(seeded.ok, true, JSON.stringify(seeded));
    await wait("document.body.textContent.includes('STG会话切换旧历史')");
    assert.equal(await js("document.body.textContent.includes('旧对话的第一个问题（隔离测试）')"), true);
    checks.push('the original conversation keeps its existing chat history and unsent draft');
    await js("window.__teacherEditor=document.querySelector('.visual-document')||null");
    await openSwitcher();
    const firstList = await listedSessions();
    assert.deepEqual(firstList, [originalSessionId], 'only this space\'s current teacher conversation is listed');
    assert.equal(await js("document.querySelector('.stgt-session-menu').textContent.includes('新对话')"), true);
    assert.equal(await js(`document.querySelector('.stgt-session-menu').textContent.includes(${JSON.stringify(process.env.STG_NATIVE_OTHER_TITLE)})`), false);
    assert.equal(await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].some(e=>e.dataset.sessionId===${JSON.stringify(process.env.STG_NATIVE_OTHER_SESSION)})`), false);
    checks.push('the switcher lists only teacher conversations of the current learning space');
    await shot('teacher-session-menu');
    // Double press the new-conversation row: one blank Session, and a
    // conversation that is genuinely distinct from the existing one.
    await js("document.querySelector('.stgt-session-new').click();document.querySelector('.stgt-session-new')?.click()");
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session && document.querySelector('.stgt-session-trigger').dataset.session!==${JSON.stringify(originalSessionId)}`);
    const newSessionId = await currentSession();
    assert.notEqual(newSessionId, originalSessionId);
    await wait("!document.querySelector('.stgt-session-menu:popover-open')");
    assert.equal(await js(composerText), '', 'a new conversation must start empty, not reuse the old draft');
    // A brand-new conversation must not show the old chat's history at all.
    assert.equal(await js("document.body.textContent.includes('STG会话切换旧历史')"), false, 'a new conversation must not inherit the old transcript');
    assert.equal(await js("document.body.textContent.includes('旧对话的第一个问题（隔离测试）')"), false);
    await shot('teacher-session-new');
    await wait("document.querySelectorAll('[aria-label=发送消息]').length===1");
    checks.push('new conversation is a distinct blank Session, does not clear the old history and sends nothing');

    // The original conversation is still listed and its draft comes back.
    await openSwitcher();
    const afterCreate = await listedSessions();
    assert.deepEqual([...afterCreate].sort(), [newSessionId, originalSessionId].sort());
    assert.equal(await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(newSessionId)}).getAttribute('aria-checked')`), 'true');
    await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(originalSessionId)}).click()`);
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session===${JSON.stringify(originalSessionId)}`);
    await wait(`(${composerText}).includes('原来的草稿别丢')`);
    await wait("document.body.textContent.includes('STG会话切换旧历史')", 15000);
    checks.push('switching back restores the original conversation, its chat history and its native draft');

    // Switching forward to the blank conversation keeps it empty; the editor
    // node survives every switch (no remount of the lesson body).
    await openSwitcher();
    await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(newSessionId)}).click()`);
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session===${JSON.stringify(newSessionId)}`);
    assert.equal(await js(composerText), '');
    if (await js("!!window.__teacherEditor")) assert.equal(await js("document.querySelector('.visual-document')===window.__teacherEditor"), true);
    checks.push('switching between conversations keeps the same lesson editor node (no remount)');

    // Switching on the original conversation is not a switch at all.
    await openSwitcher();
    const disabledCurrent = await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(newSessionId)}).disabled`);
    assert.equal(disabledCurrent, true);
    await closeSwitcher();
    checks.push('the current conversation is marked and cannot be re-selected');

    // Layout compatibility: sidebar and floating teacher keep the switcher and
    // never remount the composer/editor.
    await js("window.__teacherInput=document.querySelector('.stgt-chat [contenteditable=true]')");
    for (const [label, mode] of [['切换为浮窗', 'float'], ['固定到侧边', 'split']]) {
      await click(label);
      assert.equal(await js("document.querySelector('.stgt-frame').dataset.teacherLayout"), mode);
      assert.equal(await js("!!document.querySelector('.stgt-session-trigger')"), true);
      // A first-run dialog can appear late and auto-dismiss a top-layer popover;
      // clear it, reopen the switcher and capture the settled frame.
      await dismissPreview();
      await openSwitcher();
      assert.deepEqual((await listedSessions()).sort(), [newSessionId, originalSessionId].sort());
      await shot('teacher-session-' + mode);
      assert.equal(await js("!!document.querySelector('.stgt-session-menu:popover-open')"), true, 'the menu stays open while capturing');
      await closeSwitcher();
    }
    assert.equal(await js("document.querySelector('.stgt-chat [contenteditable=true]')===window.__teacherInput"), true, 'layout changes keep the same composer node');
    checks.push('the switcher works in the docked sidebar and the floating teacher without remounting the composer');
    await click('切换为浮窗');

    // Every remaining switch happens between real, distinct Sessions.
    await typeDraft('空白对话里的草稿');
    const before = await js(composerText);
    await openSwitcher();
    await js(`(()=>{const b=[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(originalSessionId)});if(!b)throw Error('missing original row');b.click()})()`);
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session===${JSON.stringify(originalSessionId)}`);
    await wait(`(${composerText}).includes('原来的草稿别丢')`);
    checks.push('each conversation keeps its own draft: switching never merges or drops either text');

    await openSwitcher();
    await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(newSessionId)}).click()`);
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session===${JSON.stringify(newSessionId)}`);
    await wait(`(${composerText}).includes('空白对话里的草稿')`);
    checks.push('a draft typed in the new conversation is restored after switching away and back');

    // Rapid double activation of "new conversation" from the floating panel:
    // one click is in flight, the second must join it instead of minting another.
    const beforeThird = (await listedSessions()).length;
    await openSwitcher();
    await js("document.querySelector('.stgt-session-new').click();document.querySelector('.stgt-session-new')?.click()");
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session!==${JSON.stringify(newSessionId)}`);
    const thirdSessionId = await currentSession();
    assert.notEqual(thirdSessionId, newSessionId);
    assert.notEqual(thirdSessionId, originalSessionId);
    await closeSwitcher();
    await openSwitcher();
    const afterThird = await listedSessions();
    assert.equal(afterThird.length, beforeThird + 1, 'a double press must add exactly one conversation');
    await closeSwitcher();
    checks.push('a double press on new conversation adds exactly one blank Session, not two');
    await openSwitcher();
    await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(newSessionId)}).click()`);
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session===${JSON.stringify(newSessionId)}`);
    await wait(`(${composerText}).includes('空白对话里的草稿')`, 8000);
    assert.equal(await js(composerText), before);
    checks.push('creating another conversation leaves the existing drafts exactly as they were');

    await closeSwitcher();
    await click('收起老师');
    await wait("!document.querySelector('.stgt-teacher')");
    await click('老师');
    await wait("!!document.querySelector('.stgt-teacher')&&!!document.querySelector('.stgt-session-trigger')");
    assert.equal(await currentSession(), newSessionId);
    await wait(`(${composerText}).includes('空白对话里的草稿')`, 8000);
    checks.push('collapsing and reopening the teacher keeps the selected conversation and its draft');
    await click('回到 DSH 主对话');
    await wait("!document.querySelector('.stgj-root')");
    await wait("[...document.querySelectorAll('.stgw-native-return')].some(e=>e.textContent.trim()==='学习内容')");
    await click('学习内容');
    await wait("!!document.querySelector('.stgt-session-trigger')");
    assert.equal(await currentSession(), newSessionId);
    checks.push('full native main-conversation round trip keeps the selected teacher conversation');
    await shot('teacher-session-restored');

    // The recoverable archive, end to end through the real UI. The target is the
    // conversation that is *not* open: the ticket requires that removing another
    // conversation keeps the current one, its history and its draft untouched.
    // Put the conversation that owns the history and the draft back on screen
    // first, so both really have to survive the archive of the other one.
    await openSwitcher();
    await js(`[...document.querySelectorAll('.stgt-session-menu [data-session-id]')].find(e=>e.dataset.sessionId===${JSON.stringify(originalSessionId)}).click()`);
    await wait(`document.querySelector('.stgt-session-trigger')?.dataset.session===${JSON.stringify(originalSessionId)}`);
    await wait("document.body.textContent.includes('STG会话切换旧历史')", 15000);
    await openSwitcher();
    const listedBefore = await listedSessions();
    const openBefore = await currentSession();
    const victim = listedBefore.find(id => id !== openBefore);
    assert.ok(victim, 'a second conversation must exist before testing the archive');
    const draftBefore = await js(composerText);
    assert.match(draftBefore, /原来的草稿别丢/, 'the fixture must carry the draft it is about to protect');
    // Cancel first: nothing may leave the list and no Host call may happen.
    await js(`[...document.querySelectorAll('.stgt-session-row')].find(r=>r.querySelector('[data-session-id]')?.dataset.sessionId===${JSON.stringify(victim)}).querySelector('.stgt-session-remove').click()`);
    await wait("!!document.querySelector('.stga-dialog')");
    // The wording must not promise a permanent delete; it explains that the
    // transcript is kept and the Host offers no irreversible delete at all.
    const dialogText = await js("document.querySelector('.stga-dialog').textContent");
    assert.equal(/已永久删除|永久删除成功|无法恢复/.test(dialogText), false, 'the dialog must not claim a permanent, unrecoverable delete');
    assert.match(dialogText, /保留/, 'the dialog must say the conversation is kept');
    assert.match(dialogText, /恢复/, 'the dialog must point at restoring it');
    await js("[...document.querySelectorAll('.stga-dialog button')].find(e=>e.textContent.trim()==='取消').click()");
    await wait("!document.querySelector('.stga-dialog')");
    assert.equal(await js("document.querySelector('.stga-dialog')"), null);
    await openSwitcher();
    assert.deepEqual([...(await listedSessions())].sort(), [...listedBefore].sort(), 'cancelling must leave every conversation listed');
    checks.push('the archive confirmation cancels without removing or archiving anything');

    // Confirm: only the named conversation leaves the live list.
    await js(`[...document.querySelectorAll('.stgt-session-row')].find(r=>r.querySelector('[data-session-id]')?.dataset.sessionId===${JSON.stringify(victim)}).querySelector('.stgt-session-remove').click()`);
    await wait("!!document.querySelector('.stga-dialog')");
    await js("[...document.querySelectorAll('.stga-dialog button')].find(e=>e.textContent.trim()==='移出对话').click()");
    await wait("!document.querySelector('.stga-dialog')");
    await new Promise(resolve => setTimeout(resolve, 600));
    // Removing somebody else must not close, switch or empty the open panel.
    assert.equal(await js("!!document.querySelector('.stgt-teacher')"), true, 'the open teacher panel must survive archiving another conversation');
    assert.equal(await currentSession(), openBefore, 'archiving another conversation must not change the open one');
    assert.equal(await js(composerText), draftBefore, 'the open draft must survive archiving another conversation');
    assert.equal(await js("document.body.textContent.includes('STG会话切换旧历史')"), true, 'the open history must survive');
    await openSwitcher();
    const listedAfterArchive = await listedSessions();
    assert.equal(listedAfterArchive.includes(victim), false, 'the archived conversation must leave the live list');
    assert.equal(listedAfterArchive.includes(openBefore), true, 'archiving one conversation must not disturb the other');
    assert.equal(await js("document.querySelector('.stgt-session-menu').textContent.includes('已移出')"), true);
    checks.push('confirming archives exactly one other conversation, leaving the open one, its history and its draft intact');

    // Restore it from the "已移出" shelf; the same Session comes back.
    await js("[...document.querySelectorAll('.stgt-session-archived-toggle')][0].click()");
    await wait("!!document.querySelector('.stgt-session-restore')");
    assert.equal(await js("document.querySelectorAll('.stgt-session-restore').length>0"), true);
    await js("document.querySelector('.stgt-session-restore').click()");
    await new Promise(resolve => setTimeout(resolve, 700));
    await openSwitcher();
    const listedAfterRestore = await listedSessions();
    assert.equal(listedAfterRestore.includes(victim), true, 'restoring must put the same conversation back in the live list');
    checks.push('the same conversation returns to the live list through the recoverable archive');
    await closeSwitcher();
    await shot('teacher-session-archive');
    assert.deepEqual(errors, [], 'Native browser logged errors');
    result = { originalSessionId, newSessionId, finalSessionId: await currentSession() };
    ok = true;
  } catch (error) {
    errors.push(error.stack || String(error));
    console.error(error);
    console.error('Native body: ' + await js('document.body.innerText').catch(() => 'unavailable'));
    await shot('teacher-session-failure').catch(() => {});
    result = { originalSessionId: await currentSession().catch(() => ''), newSessionId: null, finalSessionId: null };
  } finally {
    await fs.writeFile(path.join(process.env.STG_NATIVE_OUTPUT, 'browser-result.json'), JSON.stringify({ ok, checks, errors, ...result }, null, 2));
    clearTimeout(deadline);
    w.destroy();
    app.exit(ok ? 0 : 1);
  }
}).catch(error => { console.error(error); app.exit(1); });
