// Isolated visual capture of the real workbench preview. Starts the normal
// preview fixture (temporary copy of demo/StepsToGreat), drives a headless local
// Chrome over CDP and writes screenshots plus computed-style evidence. It never
// opens the user's desktop, browser profile or installed DSH.
//
//   node scripts/capture-reader-visual.mjs [outputDir]
//
// STG_CHROME_PATH can point at another Chromium executable.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startPreviewFixture } from './preview-fixture.mjs';
import { launchChrome, connectCdp } from './chrome-cdp.mjs';

const output = path.resolve(process.argv[2] || 'artifacts/reader-python-20261028/current');
await mkdir(output, { recursive: true });

const fixture = await startPreviewFixture();
const chrome = await launchChrome({ width: 1600, height: 1000 });
let cdp, failure;
const evidence = { url: fixture.url, capturedAt: new Date().toISOString(), screenshots: [], metrics: {}, checks: [] };
const settle = () => cdp.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,260))))');
const top = () => cdp.evaluate("(()=>{const s=document.querySelector('.stgw-scroll');if(s)s.scrollTop=0;})()");
const shot = async (name) => { await settle(); await cdp.screenshot(path.join(output, `${name}.png`)); evidence.screenshots.push(`${name}.png`); };
async function tab(shift = false) {
  const event = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 };
  await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'rawKeyDown' });
  await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
}
const revealCode = () => cdp.evaluate("(()=>{const s=document.querySelector('.stgw-scroll'),t=document.querySelector('.edh-code-tools');if(!s||!t)return false;s.scrollTop=Math.max(0,t.offsetTop-80);return true})()");
const measure = () => cdp.evaluate(`(()=>{
  const q = s => document.querySelector(s), cs = e => e ? getComputedStyle(e) : null, rect = e => e ? e.getBoundingClientRect() : null;
  const scroll = q('.stgw-scroll'), content = q('.stgw-content'), doc = q('.visual-document');
  const h1 = q('.visual-document h1');
  const h2 = q('.visual-document h2'), h3 = q('.visual-document h3'), p = q('.visual-document p');
  const pre = q('.visual-document pre'), code = q('.visual-document pre code'), tools = q('.edh-code-tools');
  const select = q('.edh-code-language'), copy = q('.edh-code-copy'), table = q('.visual-document table');
  const root = q('.stgw-root'), frame = q('.stgt-frame'), teacher = q('.stgt-teacher');
  const r = e => { const b = rect(e); return b ? { width: Math.round(b.width), height: Math.round(b.height), left: Math.round(b.left), top: Math.round(b.top) } : null; };
  return {
    theme: document.documentElement.dataset.theme || 'light',
    viewport: { width: innerWidth, height: innerHeight },
    root: r(root), content: r(content), teacher: r(teacher), pre: r(pre), tools: r(tools), select: r(select),
    pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    frameOverflow: frame ? frame.scrollWidth > frame.clientWidth + 1 : null,
    colors: {
      scroll: cs(scroll)?.backgroundColor, content: cs(content)?.backgroundColor,
      paper: cs(doc)?.backgroundColor, ink: cs(p)?.color, heading: cs(h2)?.color,
      pre: cs(pre)?.backgroundColor, code: cs(code)?.color, string: cs(pre?.querySelector('.hljs-string'))?.color,
      tools: cs(tools)?.backgroundColor, select: cs(select)?.color, copy: cs(copy)?.color,
      teacher: cs(teacher)?.backgroundColor, frame: cs(frame)?.backgroundColor,
      border: cs(pre)?.borderTopColor
    },
    type: {
      docFamily: cs(doc)?.fontFamily, docSize: cs(doc)?.fontSize, docLine: cs(doc)?.lineHeight,
      h1Size: cs(h1)?.fontSize, h1Weight: cs(h1)?.fontWeight,
      h2Size: cs(h2)?.fontSize, h2Weight: cs(h2)?.fontWeight, h3Size: cs(h3)?.fontSize, h3Weight: cs(h3)?.fontWeight,
      bodySize: cs(p)?.fontSize, codeFamily: cs(code)?.fontFamily, codeSize: cs(code)?.fontSize,
      selectFont: cs(select)?.fontSize, selectHeight: cs(select)?.height
    },
    surfaces: {
      preRadius: cs(pre)?.borderTopLeftRadius, preBottomRadius: cs(pre)?.borderBottomLeftRadius, preBorderWidth: cs(pre)?.borderTopWidth,
      preBottomBorder: cs(pre)?.borderBottomWidth,
      toolsRadius: cs(tools)?.borderTopLeftRadius, toolsBottomRadius: cs(tools)?.borderBottomLeftRadius,
      toolsBorderBottom: cs(tools)?.borderBottomWidth, toolsBorderTop: cs(tools)?.borderTopWidth,
      gapBetweenToolsAndCode: pre && tools ? Math.round(pre.getBoundingClientRect().top - tools.getBoundingClientRect().bottom) : null,
      selectBorder: cs(select)?.borderTopWidth, selectRadius: cs(select)?.borderTopLeftRadius,
      tableRadius: q('.visual-document .tableWrapper') ? cs(q('.visual-document .tableWrapper'))?.borderTopLeftRadius : null
    },
    contentWidth: content ? Math.round(content.getBoundingClientRect().width) : null,
    measure: r(doc)?.width,
    text: {
      h2: h2?.textContent, h3: h3?.textContent, firstParagraph: p?.textContent,
      code: code?.textContent?.slice(0, 160), language: select?.selectedOptions?.[0]?.textContent,
      copy: copy?.textContent, tableText: table?.textContent?.replace(/\\s+/g, ' ').slice(0, 120)
    }
  };
})()`);
const click = label => cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>(e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)})&&e.getClientRects().length);if(!b)throw Error('Missing button: '+${JSON.stringify(label)});b.click();})()`);
// Mirror the host's own dark switch (`body[data-ds-dark-theme]`) instead of a
// preview-only class, so the screenshots prove the selector the real DSH sets.
const theme = async value => { await cdp.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(value)};if(${JSON.stringify(value === 'dark')})document.body.setAttribute('data-ds-dark-theme','');else document.body.removeAttribute('data-ds-dark-theme')`); await settle(); };
const luminance = color => {
  const [r, g, b] = color.match(/\d+/g).slice(0, 3).map(channel => {
    const value = Number(channel) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (foreground, background) => {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};

try {
  cdp = await connectCdp(chrome.target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: fixture.url });
  await loaded;
  await cdp.waitFor("!!document.querySelector('.visual-document')&&!!document.querySelector('.stgt-teacher')", { timeout: 30000 });
  await settle();
  await top();

  evidence.metrics.desktopLight = await measure();
  await shot('desktop-light');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.visual-document pre code' });
  evidence.metrics.codeFonts = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  await cdp.evaluate("document.querySelector('.stgw-file-label button').focus()");
  await tab();
  await cdp.waitFor("document.activeElement.matches('.visual-document:focus-visible')");
  evidence.metrics.editorFocus = await cdp.evaluate("getComputedStyle(document.activeElement).outlineStyle");
  await shot('editor-keyboard-focus');
  await tab(true);
  await cdp.waitFor("document.activeElement.matches('.stgw-file-label button:focus-visible')");
  evidence.metrics.controlFocus = await cdp.evaluate("getComputedStyle(document.activeElement).outlineStyle");
  await cdp.evaluate("document.activeElement.blur()");
  await revealCode();
  await shot('desktop-light-code');
  await top();
  await theme('dark');
  evidence.metrics.desktopDark = await measure();
  await shot('desktop-dark');
  await revealCode();
  await shot('desktop-dark-code');
  await top();
  await theme('light');

  await click('切换为浮窗');
  await cdp.waitFor("document.querySelector('.stgt-frame')?.dataset.teacherLayout==='float'");
  await cdp.waitFor("document.querySelector('.stgt-teacher')?.dataset.morph!=='animating'");
  await top();
  evidence.metrics.floatLight = await measure();
  await shot('float-light');
  await click('固定到侧边');
  await cdp.waitFor("document.querySelector('.stgt-frame')?.dataset.teacherLayout==='split'");
  await cdp.waitFor("document.querySelector('.stgt-teacher')?.dataset.morph!=='animating'");

  await cdp.viewport(440, 1000, { dark: false });
  await cdp.waitFor("document.querySelector('.stgw-root')?.dataset.mobile==='true'");
  await top();
  evidence.metrics.narrowLight = await measure();
  await shot('narrow-light');
  await theme('dark');
  evidence.metrics.narrowDark = await measure();
  await shot('narrow-dark');

  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp.waitFor("matchMedia('(prefers-reduced-motion: reduce)').matches");
  evidence.metrics.reducedMotion = await cdp.evaluate(`(()=>{
    const root=document.querySelector('.stgw-root');
    return {
      indicator: getComputedStyle(document.querySelector('.stgw-sliding-indicator')).transitionDuration,
      rootAnimations: root.getAnimations().length,
      courseMenuAnimation: getComputedStyle(document.querySelector('.stgw-round-menu')||root).animationName
    };
  })()`);

  const m = evidence.metrics;
  const checks = evidence.checks;
  const expect = (condition, label) => { if (!condition) throw Error('Visual expectation failed: ' + label); checks.push(label); };
  expect(m.desktopLight.colors.content === 'rgb(252, 251, 247)', 'reading column paints the warm ivory surface');
  expect(m.desktopLight.type.h1Weight === '600', 'the lesson h1 uses weight 600, matching the section hierarchy');
  expect(m.desktopLight.type.docFamily.includes('Microsoft YaHei UI') && m.desktopLight.type.docFamily.includes('PingFang SC'), 'the edit node names the Chinese system sans stack explicitly');
  expect(m.desktopLight.type.docSize === '16px', 'body copy is 16px');
  expect(Number.parseFloat(m.desktopLight.type.docLine) >= 28, 'body line-height is at least 1.75');
  expect(m.desktopLight.type.h2Weight === '600' && m.desktopLight.type.h3Weight === '600', 'section headings use weight 600, not heavy bold');
  expect(m.desktopLight.type.codeSize === '14px', 'code is 14px');
  expect(m.desktopLight.type.codeFamily.includes('Cascadia Mono') && m.desktopLight.type.codeFamily.includes('Noto Sans SC'), 'code specifies a monospace face and an explicit Chinese sans fallback');
  expect(luminance(m.desktopLight.colors.pre) > .7 && luminance(m.desktopDark.colors.pre) < .2, 'light and dark themes have their own code surfaces');
  for (const mode of ['desktopLight', 'desktopDark']) {
    const { colors } = m[mode];
    expect(contrast(colors.code, colors.pre) >= 4.5 && contrast(colors.string, colors.pre) >= 4.5, `${mode} code and syntax have readable contrast`);
    expect(contrast(colors.select, colors.tools) >= 4.5 && contrast(colors.copy, colors.tools) >= 4.5, `${mode} code controls have readable contrast`);
  }
  expect(m.editorFocus === 'none' && m.controlFocus === 'solid', 'keyboard entry leaves the editable document unframed and still shows focus on controls');
  expect(m.desktopLight.surfaces.preBottomRadius === '12px' && m.desktopLight.surfaces.preBottomBorder === '1px', 'code block bottom uses a 12px radius and a hairline');
  expect(m.desktopLight.surfaces.toolsRadius === '12px' && m.desktopLight.surfaces.toolsBottomRadius === '0px', 'code toolbar shares the block radius only on its top corners');
  expect(m.desktopLight.surfaces.gapBetweenToolsAndCode === 0, 'code toolbar and block join without a seam');
  expect(m.desktopLight.surfaces.preRadius === '0px' && m.desktopLight.surfaces.preBorderWidth === '0px', 'joined code panel has no inner rounded corners or duplicate top border');
  expect(Number.parseFloat(m.desktopLight.tools.height) <= 36, 'code toolbar stays low');
  expect(Number.parseFloat(m.desktopLight.select.height) <= 28, 'language control stays lightweight, not a full-size form field');
  expect(m.desktopLight.measure >= 680 && m.desktopLight.measure <= 740, 'the actual text measure stays near 720px');
  expect(m.desktopDark.colors.content !== m.desktopLight.colors.content, 'dark theme paints its own paper surface');
  expect(m.narrowDark.pageOverflow === false && m.narrowDark.frameOverflow === false, 'narrow dark layout has no horizontal overflow');
  expect(m.reducedMotion.rootAnimations === 0, 'reduced motion produces no running animations');

  // Rendered copy must be this round's Python lesson, never a static "demo" claim.
  expect(/fruits/.test(m.desktopLight.text.code || ''), 'the real rendered code is the Python list/slice example');
  evidence.ok = true;
  await writeFile(path.join(output, 'visual-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: true, output, checks, metrics: m }, null, 2));
} catch (error) {
  failure = error;
  await cdp?.screenshot(path.join(output, 'failure.png')).catch(() => {});
  await writeFile(path.join(output, 'visual-evidence.json'), JSON.stringify({ ...evidence, ok: false, error: error.stack }, null, 2));  console.error(error);
} finally {
  cdp?.close();
  await chrome.close();
  await fixture.close();
  process.exit(failure ? 1 : 0);
}
