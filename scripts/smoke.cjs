// Runs this plugin's UI in an isolated Electron fixture; no user DSH/lesson data.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');
app.setPath('userData',path.join(os.tmpdir(),'dsh-stg-plugin-smoke-'+Date.now()));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const w=new BrowserWindow({width:1200,height:870,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const errors=[];w.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message);});
  const external=[];w.webContents.setWindowOpenHandler(({url})=>{external.push(url);return {action:'deny'};});
  const evalJS=code=>w.webContents.executeJavaScript(code,true);
  try{
    await w.loadFile(path.join(__dirname,'../artifacts/preview.html'));
    while(!await evalJS("!!document.querySelector('.stgl-card')"))await new Promise(r=>setTimeout(r,60));
    assert.equal(await evalJS("document.querySelectorAll('.stgl-card').length"),2);
    const originalURL=w.webContents.getURL();
    const expectedLinks=[
      ['.stgl-download','https://github.com/wildcat430524/STG-Desk'],
      ['.stgl-resource:first-child a:first-child','https://github.com/wildcat430524/StepsToGreat/archive/refs/heads/main.zip'],
      ['.stgl-resource:first-child a:last-child','https://github.com/wildcat430524/StepsToGreat'],
      ['.stgl-resource:last-child a:first-child','https://github.com/wildcat430524/STG-Desk/releases/latest'],
      ['.stgl-resource:last-child a:last-child','https://github.com/wildcat430524/STG-Desk']
    ];
    await evalJS("window.hostLinkClicks=0;document.addEventListener('click',e=>{if(e.target.closest('a'))window.hostLinkClicks++;})");
    for(const [selector,url] of expectedLinks){
      assert.equal(await evalJS(`document.querySelector(${JSON.stringify(selector)}).href`),url);
      await evalJS(`document.querySelector(${JSON.stringify(selector)}).click()`);
      assert.equal(external.at(-1),url);
      assert.equal(w.webContents.getURL(),originalURL);
    }
    assert.equal(await evalJS('window.hostLinkClicks'),0);
    assert.equal(await evalJS("document.querySelector('.stgl-badge').textContent"),'当前对话');
    await evalJS("document.querySelector('.stgl-pin').click()");
    assert.equal(await evalJS("document.querySelector('.stgl-pin').getAttribute('aria-pressed')"),'true');
    await evalJS("document.querySelector('.stgl-workspace-meta button[aria-pressed]').click()");
    assert.equal(await evalJS("JSON.parse(localStorage.getItem('dsh-stg-learning.v1')).workspaces.w1.enabled"),true);
    await evalJS("document.querySelectorAll('.stgl-tabs button')[2].click()");
    assert.equal(await evalJS("document.querySelectorAll('.stgl-card').length"),0);
    assert.equal(await evalJS("document.querySelector('.stgl-empty h2').textContent"),'没有符合条件的会话');
    await evalJS("document.querySelectorAll('.stgl-tabs button')[0].click()");
    await evalJS("document.querySelector('.stgl-only-pin').click()");
    assert.equal(await evalJS("document.querySelectorAll('.stgl-card').length"),1);
    await evalJS("document.querySelector('.stgl-only-pin').click()");
    await fs.mkdir(path.join(__dirname,'../artifacts'),{recursive:true});
    await evalJS("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await new Promise(r=>setTimeout(r,220));
    const shot=await w.webContents.capturePage(undefined,{stayAwake:true});await fs.writeFile(path.join(__dirname,'../artifacts/learning-page.png'),shot.toPNG());
    w.setSize(420,860);await new Promise(r=>setTimeout(r,80));
    assert.equal(await evalJS("document.querySelector('.stgl-page').scrollWidth>document.querySelector('.stgl-page').clientWidth"),false);
    const narrow=await w.webContents.capturePage(undefined,{stayAwake:true});await fs.writeFile(path.join(__dirname,'../artifacts/learning-narrow.png'),narrow.toPNG());
    w.setSize(1200,870);
    const captureStyle=await w.webContents.insertCSS('.stgl-page button,.stgl-card{transition:none!important}');
    await evalJS("document.documentElement.style.setProperty('--dsw-alias-bg-base','#1b1e24');document.documentElement.style.setProperty('--dsw-alias-label-primary','#e4e8ee')");
    assert.equal(await evalJS("getComputedStyle(document.querySelector('.stgl-card')).backgroundColor"),'rgb(27, 30, 36)');
    await evalJS("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await new Promise(r=>setTimeout(r,220));
    assert.equal(await evalJS("getComputedStyle(document.querySelector('.stgl-heading-actions button')).backgroundColor"),'rgb(27, 30, 36)');
    const dark=await w.webContents.capturePage(undefined,{stayAwake:true});await fs.writeFile(path.join(__dirname,'../artifacts/learning-dark.png'),dark.toPNG());
    await w.webContents.removeInsertedCSS(captureStyle);
    await evalJS("document.querySelector('[aria-controls=\"stgl-collab\"]').click()");
    await evalJS("const input=document.querySelector('#stgl-app');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'C:/Apps/STG Desk.exe');input.dispatchEvent(new Event('input',{bubbles:true}));");
    await evalJS("document.querySelector('.stgl-config button').click()");
    assert.equal(await evalJS("window.actions.find(a=>a.launch)?.launch"),'C:/Apps/STG Desk.exe');
    await evalJS("document.querySelector('.stgl-card-bottom button').click()");
    assert.equal(await evalJS("window.actions.find(a=>a.open)?.open"),'s1');
    await evalJS("document.querySelector('.stgl-primary').click()");
    while(!await evalJS("window.actions.some(a=>a.open==='new-session')"))await new Promise(r=>setTimeout(r,30));
    w.webContents.debugger.attach('1.3');await w.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evalJS("getComputedStyle(document.querySelector('.stgl-primary')).transitionDuration"),'0s');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,externalLinks:external,evidence:['Project, ZIP and Windows download clicks open the exact external URL; learning page stays in place; host document click handler is bypassed','Ordinary native-session-shaped rows rendered; subagent hidden','Pinned and learning-workspace marks saved locally','Stage and pinned-only filters; correct empty state','Narrow layout without horizontal overflow; dark theme tokens honored','Continue invokes the original session identity','Create opens the native new-session identity','Reduced-motion honored; no renderer errors'],screenshot:'artifacts/learning-page.png'},null,2));
  }catch(e){console.error(e);process.exitCode=1;}finally{w.destroy();app.exit(process.exitCode||0);}
});
