// Isolated, dependency-free regression pass for the reader without Electron.
// It drives the same preview fixture with headless local Chrome and checks the
// behaviours the desktop acceptance also relies on: one persistent editor and
// composer across layout changes, drafts that survive view switches, a real
// answer write, the recorded round menu, and switching to the second Python
// course. Model replies are never requested or fabricated.
//
//   node scripts/verify-reader-cdp.mjs [outputDir]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startPreviewFixture } from './preview-fixture.mjs';
import { launchChrome, connectCdp } from './chrome-cdp.mjs';

const output = path.resolve(process.argv[2] || 'artifacts/reader-python-20261028/regression');
await mkdir(output, { recursive: true });
const fixture = await startPreviewFixture();
const chrome = await launchChrome({ width: 1440, height: 960 });
let cdp, failure;
const checks = [], errors = [], evidence = { url: fixture.url, checks, errors };
const settle = () => cdp.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,200))))');
const click = label => cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>(e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)})&&e.getClientRects().length);if(!b)throw Error('Missing button: '+${JSON.stringify(label)});b.click();})()`);
const shot = async name => { await settle(); await cdp.screenshot(path.join(output, `${name}.png`)); };
// A popover trigger is a toggle: if an earlier focus/blur closed it between the
// click and the assertion, one retry opens it again without hiding a real fault.
const openPopover = async (label, selector) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await click(label);
    try {
      await cdp.waitFor(`!!document.querySelector(${JSON.stringify(selector)})`, { timeout: 3000 });
      return;
    } catch {
      if (attempt === 1) throw Error(`Popover did not open: ${label}`);
    }
  }
};
try {
  cdp = await connectCdp(chrome.target.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: fixture.url }); await loaded;
  await cdp.waitFor("!!document.querySelector('.visual-document')&&!!document.querySelector('.stgt-teacher')", { timeout: 30000 });
  await settle();

  // 1) Persistent editor/composer across dock and float; quoted draft survives.
  await cdp.evaluate("(()=>{window.__editor=document.querySelector('.visual-document');window.__composer=document.querySelector('.stgt-teacher textarea');window.__panel=document.querySelector('.stgt-teacher');return true})()");
  await cdp.evaluate("(()=>{const e=document.querySelector('.stgt-teacher textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'草稿：先保留这句话');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
  for (const [label, mode] of [['切换为浮窗', 'float'], ['固定到侧边', 'split']]) {
    await click(label);
    await cdp.waitFor(`document.querySelector('.stgt-frame').dataset.teacherLayout===${JSON.stringify(mode)}`);
    await cdp.waitFor("document.querySelector('.stgt-teacher')?.dataset.morph!=='animating'");
    const same = await cdp.evaluate("document.querySelector('.visual-document')===window.__editor&&document.querySelector('.stgt-teacher textarea')===window.__composer&&document.querySelector('.stgt-teacher')===window.__panel");
    if (!same) throw Error('Editor, composer or panel node was replaced by the layout change');
    if (await cdp.evaluate("document.querySelector('.stgt-teacher textarea').value") !== '草稿：先保留这句话') throw Error('Teacher draft was lost');
  }
  checks.push('dock/float keeps the same editor, composer and panel nodes and preserves the draft');
  await shot('layout-float');

  // 2) Real direct edit, dirty state, and a save that lands on disk.
  const overview = await fixture.service.workspace({ workspaceId: 'demo' });
  await cdp.evaluate("(()=>{window.__editorNode=document.querySelector('.visual-document');const b=window.__editorNode;const p=[...b.querySelectorAll('p')].find(e=>e.textContent.includes('列表用方括号'));const text=p.lastChild;const r=document.createRange();r.setStart(text,text.length);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);b.focus();return true})()");
  await cdp.evaluate("(()=>document.execCommand('insertText',false,'（可编辑）'))()");
  await cdp.waitFor("document.querySelector('.stgw-save-state')?.dataset.state==='dirty'");
  if (!await cdp.evaluate("window.__editorNode===document.querySelector('.visual-document')")) throw Error('Editing recreated the editor');
  await cdp.evaluate("(()=>{document.querySelector('.stgw-root').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));return true})()");
  await cdp.waitFor("document.querySelector('.stgw-save-state')?.dataset.state==='saved'");
  const savedGuide = await fixture.service.read({ workspaceId: 'demo', path: overview.current.guidePath });
  if (!savedGuide.content.includes('（可编辑）')) throw Error('Direct edit was not written to the workspace file');
  checks.push('direct editing keeps the live editor and writes the saved document to disk');

  // 3) Answer draft survives navigation; save appends without inventing mastery.
  await click('作答');
  await cdp.waitFor("document.querySelectorAll('.stgw-question textarea').length===2");
  await cdp.evaluate("(()=>{const e=document.querySelectorAll('.stgw-question textarea')[0];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'索引从 0 开始，右边界 2 不包含。');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
  await click('当前章节进度');
  await cdp.waitFor("!!document.querySelector('.stgw-progress-page')");
  await click('学生回答');
  await cdp.waitFor("document.querySelectorAll('.stgw-question textarea').length===2");
  if (!/右边界 2 不包含/.test(await cdp.evaluate("document.querySelector('.stgw-question textarea').value"))) throw Error('Answer draft was lost across view navigation');
  await click('保存作答');
  await cdp.waitFor("document.querySelector('.stgw-save-state')?.textContent==='已保存'");
  const answerFile = await fixture.service.read({ workspaceId: 'demo', path: overview.current.answerPath });
  if (!answerFile.content.includes('右边界 2 不包含')) throw Error('Answer save did not append to the answer document');
  if (!/\*\*学生作答 ·/.test(answerFile.content)) throw Error('Answer save did not use the recorded attempt format');
  checks.push('unsaved answer survives view switches and saving appends the original attempt');
  await shot('answer-view');

  // 4) Recorded round menu still opens the round file.
  await click('教学引导');
  await cdp.waitFor("document.querySelector('.stgw-file-label')?.textContent.includes('01_教学引导.md')");
  await openPopover('切换本课教学轮次','.stgw-round-menu:popover-open');
  await cdp.evaluate("(()=>{[...document.querySelectorAll('.stgw-round-menu button')].find(e=>e.textContent.includes('第二轮')).click();return true})()");
  await cdp.waitFor("document.querySelector('.stgw-file-label')?.textContent.includes('第二轮_教学引导')");
  await click('学生回答');
  await cdp.waitFor("document.querySelector('#stgw-view-panel')?.textContent.includes('本轮暂无作答记录')");
  await click('教学引导');
  await cdp.waitFor("document.querySelector('.stgw-file-label')?.textContent.includes('第二轮_教学引导')");
  checks.push('the recorded round menu opens its round document and keeps that round across panels');

  // 5) The second Python course is selectable and shows the negative-index lesson.
  await openPopover('切换课程','.stgw-course-menu:popover-open');
  await cdp.evaluate("(()=>{const e=document.querySelector('.stgw-course-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'负数索引');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
  await cdp.waitFor("document.querySelectorAll('.stgw-course-results [role=option]').length===1");
  await cdp.evaluate("(()=>{document.querySelector('.stgw-course-results [role=option]').click();return true})()");
  await cdp.waitFor("document.querySelector('.stgw-lesson-title')?.textContent.includes('负数索引')");
  await cdp.waitFor("document.querySelector('.visual-document h1')?.textContent.includes('负数索引')");
  if (!/fruits\[-1\]/.test(await cdp.evaluate("document.querySelector('.visual-document').textContent"))) throw Error('Negative-index course did not render its lesson');
  checks.push('course switching reaches the separate negative-index lesson');
  await shot('negative-index');

  // 6) The preview's sample reply is explicitly labelled and never claims a model reply.
  await click('看看对话排版');
  await cdp.waitFor("!!document.querySelector('.stgt-example')");
  const label = await cdp.evaluate("document.querySelector('.stgt-example-label')?.textContent||''");
  if (!/预设内容，非模型回复/.test(label)) throw Error('Preview sample is not labelled as preset content');
  checks.push('preview sample conversation is labelled as preset, not model output');
  await shot('preview-sample');

  evidence.ok = true;
  evidence.checks = checks;
  await writeFile(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: true, checks, errors }, null, 2));
} catch (error) {
  failure = error;
  await cdp?.screenshot(path.join(output, 'failure.png')).catch(() => {});
  evidence.ok = false; evidence.error = error.stack; evidence.checks = checks;
  await writeFile(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2));
  console.error(error);
} finally {
  cdp?.close(); await chrome.close(); await fixture.close();
  process.exit(failure ? 1 : 0);
}
