import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { normalizeMetadata, learningSessions, currentSessionId } from './model.js';
import { css } from './style.js';

const KEY = 'dsh-stg-learning.v1';
const APP_KEY = 'dsh-stg-learning.app.v1';
const WORKSPACE_KEY = 'dsh-stg-learning.workspace.v1';
const STG_DOWNLOAD = 'https://github.com/wildcat430524/STG-Desk/releases/latest';
function readMetadata() { try { return normalizeMetadata(JSON.parse(localStorage.getItem(KEY))); } catch { return normalizeMetadata(null); } }
function useSource(source) {
  const store = useMemo(() => ({ subscribe: f => source.subscribe(f), get: () => source.getSnapshot() }), [source]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
function BookIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6Z"/></svg>;
}
function SessionCard({ row, update, open, showPath }) {
  const [course, setCourse] = useState(row.course);
  const d = new Date(row.updatedAt);
  const when = Number.isNaN(d.getTime()) || d.getTime() <= 0 ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return <article className={'stgl-card' + (row.current ? ' stgl-current' : '')}>
    <div className="stgl-card-top"><span className="stgl-card-meta">{row.current ? <span className="stgl-badge">当前对话</span> : <time>{when || '尚未开始'}</time>}</span><button className={'stgl-pin ' + (row.pinned ? 'stgl-pinned' : '')} title={row.pinned?'取消置顶':'置顶会话'} aria-label={`${row.pinned?'取消置顶':'置顶'}：${row.title}`} aria-pressed={row.pinned} onClick={() => update(row.id, { pinned: !row.pinned })}><svg width="15" height="15" viewBox="0 0 24 24" fill={row.pinned?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg></button></div>
    <h2 title={row.title}>{row.title}</h2>{showPath&&<div className="stgl-path" title={row.cwd}>{row.cwd}</div>}
    <div className="stgl-fields"><label><span>关联课程</span><input aria-label={`${row.title}的课程`} placeholder="填写课程名称" value={course} maxLength={200} onChange={e => {setCourse(e.target.value);update(row.id,{course:e.target.value});}}/></label><label><span>学习标记</span><select aria-label={`${row.title}的学习标记`} value={row.stage} onChange={e => update(row.id, {stage: e.target.value})}><option value="learning">学习中</option><option value="review">待复习</option><option value="done">已结束</option></select></label></div>
    <div className="stgl-card-bottom"><span className="stgl-stage"><i aria-hidden="true"/>{({learning:'学习中',review:'待复习',done:'已结束'})[row.stage]}</span><button onClick={() => open(row.id)}>继续对话 <span aria-hidden="true">↗</span></button></div>
  </article>;
}
export function LearningPanel({ services }) {
  const sessions = useSource(services.sessions.list), workspaces = useSource(services.workspaces.list);
  const [metadata, setMetadata] = useState(readMetadata), [selected, setSelected] = useState(() => { try { return localStorage.getItem(WORKSPACE_KEY) || ''; } catch { return ''; } }), [query, setQuery] = useState('');
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [app, setApp] = useState(() => { try { return localStorage.getItem(APP_KEY) || ''; } catch { return ''; } });
  const [stageFilter,setStageFilter]=useState('all'),[pinnedOnly,setPinnedOnly]=useState(false),[showCollab,setShowCollab]=useState(false);
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const items = workspaces.items || [], enabled = items.filter(w => metadata.workspaces[w.workspaceId]?.enabled);
  const currentWorkspace = items.find(w => w.sessionIds?.includes(currentSessionId(sessions)));
  const targetId = selected === '*' || items.some(w => w.workspaceId === selected) ? selected : enabled[0]?.workspaceId || currentWorkspace?.workspaceId || items[0]?.workspaceId || '';
  function selectWorkspace(id) { setSelected(id); try { localStorage.setItem(WORKSPACE_KEY,id); } catch { setNotice('工作区选择未保存。'); } }
  const workspace = items.find(w => w.workspaceId === targetId);
  const visible = targetId === '*' ? enabled : workspace ? [workspace] : [];
  const allRows = [...new Map(visible.flatMap(w => learningSessions({sessions,workspaces,workspaceId:w.workspaceId,metadata,query})).map(r=>[r.id,r])).values()].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.updatedAt??-Infinity)-(a.updatedAt??-Infinity));
  const rows=allRows.filter(r=>(stageFilter==='all'||r.stage===stageFilter)&&(!pinnedOnly||r.pinned));
  function commit(next) {
    const value = normalizeMetadata(next);
    try { localStorage.setItem(KEY, JSON.stringify(value)); metadataRef.current=value;setMetadata(value); setNotice(''); }
    catch { setNotice('学习标记未保存：本地存储不可用。原会话和学习文档未受影响。'); }
  }
  function update(id, patch) { const previous=metadataRef.current;commit({...previous,sessions:{...previous.sessions,[id]:{...previous.sessions[id],...patch}}}); }
  async function action(fn) { if (busy) return; setBusy(true); setNotice(''); try { await fn(); } catch (e) { setNotice(e?.message || '操作未完成，请重试。'); } finally { setBusy(false); } }
  function open(id) { action(() => services.uiWorkspace.openSession(id)); }
  async function create() {
    if (!workspace) return;
    await action(async () => {
      const id = await services.sessions.create({workspaceId:workspace.workspaceId});
      update(id,{course:'',stage:'learning',pinned:false});
      services.uiWorkspace.openSession(id);
    });
  }
  async function launch() {
    await action(async () => {
      const file = app.trim();
      if (!file || !/\.exe$/i.test(file)) throw Error('请先填写 STG Desk 的完整 exe 路径。');
      const result = await services.remote.session.openWorkspacePath({path:file});
      if (!result.ok) throw Error(result.error.message);
    });
  }
  useEffect(() => {
    const listener = e => { if(e.key === KEY) setMetadata(readMetadata()); };
    window.addEventListener('storage',listener); return () => window.removeEventListener('storage',listener);
  }, []);
  if (sessions.phase !== 'ready' || workspaces.phase !== 'ready') return <div className="stgl-page"><div className="stgl-loading">正在读取 DSH 工作区与会话…</div><button onClick={()=>services.layout.selectPanel(null)}>返回对话</button></div>;
  return <section className="stgl-page" aria-label="STG 学习管理"><div className="stgl-inner">
    <header className="stgl-heading"><div><div className="stgl-eyebrow"><BookIcon size={15}/> STG LEARNING</div><h1>学习会话</h1><p className="stgl-subtitle">整理课程与对话，从上次的进度继续。</p></div><div className="stgl-heading-actions"><a className="stgl-download" href={STG_DOWNLOAD} target="_blank" rel="noopener noreferrer">下载 STG Desk ↗</a><button aria-expanded={showCollab} aria-controls="stgl-collab" onClick={()=>setShowCollab(!showCollab)}>STG 协作 ↗</button><button onClick={()=>services.layout.selectPanel(null)}>返回对话</button></div></header>
    {notice && <div role="status" className="stgl-notice">{notice}</div>}
    {showCollab&&<section id="stgl-collab" className="stgl-config"><h2>与 STG Desk 一起学习</h2><p>在 STG 中导入相同文件夹并选择同一个 DSH 会话，即可继续同步对话。</p><label className="stgl-time" htmlFor="stgl-app">STG Desk 应用路径（可选）</label><div className="stgl-toolbar"><input id="stgl-app" placeholder="STG Desk.exe 的完整路径" value={app} onChange={e=>setApp(e.target.value)} onBlur={()=>{try{localStorage.setItem(APP_KEY,app.trim());}catch{setNotice('应用路径未保存。');}}}/><button disabled={busy||!app.trim()} onClick={launch}>打开 STG Desk ↗</button></div></section>}
    <section className="stgl-controls" aria-label="会话筛选"><div className="stgl-toolbar"><label className="stgl-workspace-label"><span>工作区</span><select className="stgl-workspace" aria-label="学习工作区" value={targetId} onChange={e=>selectWorkspace(e.target.value)}>{(enabled.length>0||targetId==='*')&&<option value="*">全部学习工作区</option>}{items.map(w=><option key={w.workspaceId} value={w.workspaceId}>{metadata.workspaces[w.workspaceId]?.enabled?'学习 · ':''}{w.title||w.path}</option>)}</select></label><input className="stgl-search" aria-label="搜索学习会话" placeholder="搜索会话或课程…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="stgl-primary" disabled={busy||!workspace} onClick={create}>＋ 新会话</button></div>
    {workspace&&<div className="stgl-workspace-meta"><span className="stgl-time" title={workspace.path}>{workspace.path}</span><button aria-pressed={!!metadata.workspaces[targetId]?.enabled} onClick={()=>commit({...metadata,workspaces:{...metadata.workspaces,[targetId]:{enabled:!metadata.workspaces[targetId]?.enabled}}})}>{metadata.workspaces[targetId]?.enabled?'✓ 学习工作区':'设为学习工作区'}</button></div>}</section>
    <div className="stgl-filterbar"><div className="stgl-tabs" role="group" aria-label="学习标记筛选">{[['all','全部'],['learning','学习中'],['review','待复习'],['done','已结束']].map(([id,label])=><button key={id} aria-pressed={stageFilter===id} className={stageFilter===id?'active':''} onClick={()=>setStageFilter(id)}>{label}<span>{allRows.filter(r=>id==='all'||r.stage===id).length}</span></button>)}</div><button className={'stgl-only-pin'+(pinnedOnly?' active':'')} aria-pressed={pinnedOnly} onClick={()=>setPinnedOnly(!pinnedOnly)}>只看置顶</button></div>
    <div className="stgl-count" aria-live="polite">{rows.length} 个会话{query?' · 搜索结果':''}<span>置顶优先 · 最近活跃</span></div>
    {rows.length?<div className="stgl-grid">{rows.map(row=><SessionCard key={row.id} row={row} update={update} open={open} showPath={targetId==='*'}/>)}</div>:<div className="stgl-empty"><BookIcon size={28}/><h2>{query||stageFilter!=='all'||pinnedOnly?'没有符合条件的会话':items.length?'开始一段新的学习':'先添加学习工作区'}</h2><p>{query||stageFilter!=='all'||pinnedOnly?'试试其他关键词，或调整上方筛选。':items.length?'在这个工作区新建会话，记录课程中的问题和想法。':'在 DSH 左侧添加你的学习文件夹，再回到这里。'}</p>{workspace&&!query&&stageFilter==='all'&&!pinnedOnly&&<button disabled={busy} onClick={create}>＋ 新学习会话</button>}</div>}
    <p className="stgl-note">课程和阶段仅用于个人整理，不修改学习档案。</p>
  </div></section>;
}
export const inject = ['slots','sessions','workspaces','uiWorkspace','layout','remote'];
export function apply(ctx) {
  ctx.effect(() => { const style=document.createElement('style');style.dataset.plugin='dsh-stg-learning';style.textContent=css;document.head.append(style);return()=>style.remove(); },'stg-learning: scoped styles');
  const services={sessions:ctx.sessions,workspaces:ctx.workspaces,uiWorkspace:ctx.uiWorkspace,layout:ctx.layout,remote:ctx.remote};
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'stg-learning',inject:()=>({services})},LearningPanel));
  ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'stg-learning',order:35,label:()=> '学习'},BookIcon));
}
