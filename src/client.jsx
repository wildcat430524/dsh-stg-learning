import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { normalizeMetadata, learningSessions, currentSessionId } from './model.js';
import { css } from './style.js';
import { applyNative } from './native.js';
import { RichEditor } from './editor/RichEditor.jsx';
import { createWorkbenchApi } from './api.js';
import { createTeacherArchiveController } from './teacher-sessions.js';
import { STG_PRESET } from './native-protocol.js';
import { ArchiveConfirm, archiveConfirmCSS } from './workbench/ArchiveConfirm.jsx';
import { archiveFailureMessage, archiveTitle } from './session-archive.js';
import 'katex/dist/katex.css';

const KEY = 'dsh-stg-learning.v1';
const APP_KEY = 'dsh-stg-learning.app.v1';
const WORKSPACE_KEY = 'stg-learning.space.v2';
const STG_PROJECT = 'https://github.com/wildcat430524/STG-Desk';
const STEPS_PROJECT = 'https://github.com/wildcat430524/StepsToGreat';
function ProjectLink({ href, children, ...props }) {
  // Keep host click handlers from treating an external link as an internal route.
  // The browser/Electron still performs the anchor's normal new-window action.
  return <a {...props} href={href} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{children}</a>;
}
function readMetadata() { try { return normalizeMetadata(JSON.parse(localStorage.getItem(KEY))); } catch { return normalizeMetadata(null); } }
function useSource(source) {
  const store = useMemo(() => ({ subscribe: f => source.subscribe(f), get: () => source.getSnapshot() }), [source]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
function BookIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6Z"/></svg>;
}
function SessionCard({ row, update, open, showPath, onArchive, archiving = false }) {
  const [course, setCourse] = useState(row.course);
  const d = new Date(row.updatedAt);
  const when = Number.isNaN(d.getTime()) || d.getTime() <= 0 ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const title = archiveTitle({ ...row, label: row.title });
  return <article className={'stgl-card' + (row.current ? ' stgl-current' : '')}>
    <div className="stgl-card-top"><span className="stgl-card-meta">{row.current ? <span className="stgl-badge">当前对话</span> : <time>{when || '尚未开始'}</time>}</span><div className="stgl-card-actions"><button className={'stgl-pin ' + (row.pinned ? 'stgl-pinned' : '')} title={row.pinned?'取消置顶':'置顶会话'} aria-label={`${row.pinned?'取消置顶':'置顶'}：${row.title}`} aria-pressed={row.pinned} onClick={() => update(row.id, { pinned: !row.pinned })}><svg width="15" height="15" viewBox="0 0 24 24" fill={row.pinned?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg></button><button className="stgl-archive" disabled={archiving} title={`移出“${title}”（可恢复）`} aria-label={`移出对话：${title}`} onClick={() => onArchive?.(row)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/></svg></button></div></div>
    <h2 title={row.title}>{row.title}</h2>{showPath&&<div className="stgl-path" title={row.cwd}>{row.cwd}</div>}
    <div className="stgl-fields"><label><span>关联课程</span><input aria-label={`${row.title}的课程`} placeholder="填写课程名称" value={course} maxLength={200} onChange={e => {setCourse(e.target.value);update(row.id,{course:e.target.value});}}/></label><label><span>学习标记</span><select aria-label={`${row.title}的学习标记`} value={row.stage} onChange={e => update(row.id, {stage: e.target.value})}><option value="learning">学习中</option><option value="review">待复习</option><option value="done">已结束</option></select></label></div>
    <div className="stgl-card-bottom"><span className="stgl-stage"><i aria-hidden="true"/>{({learning:'学习中',review:'待复习',done:'已结束'})[row.stage]}</span><button onClick={() => open(row.id)}>继续对话 <span aria-hidden="true">↗</span></button></div>
  </article>;
}
export function LearningPanel({ services }) {
  const sessions = useSource(services.sessions.list), workspaces = useSource(services.workspaces.list);
  const [learningIds, setLearningIds] = useState([]);
  useEffect(() => {
    const abort = new AbortController();
    services.api.library({}, { signal: abort.signal }).then(result => { if (!abort.signal.aborted) setLearningIds((result.items || []).map(w => w.workspaceId)); }).catch(error => { if (!abort.signal.aborted) { setLearningIds([]); setNotice(error.message); } });
    return () => abort.abort();
  }, [services, workspaces.items]);
  const [metadata, setMetadata] = useState(readMetadata), [selected, setSelected] = useState(() => { try { return localStorage.getItem(WORKSPACE_KEY) || ''; } catch { return ''; } }), [query, setQuery] = useState('');
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [app, setApp] = useState(() => { try { return localStorage.getItem(APP_KEY) || ''; } catch { return ''; } });
  const [stageFilter,setStageFilter]=useState('all'),[pinnedOnly,setPinnedOnly]=useState(false),[showCollab,setShowCollab]=useState(false);
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const items = (workspaces.items || []).filter(w => learningIds.includes(w.workspaceId)), enabled = items;
  const currentWorkspace = items.find(w => w.sessionIds?.includes(currentSessionId(sessions)));
  const targetId = items.some(w => w.workspaceId === selected) ? selected : '';
  function selectWorkspace(id) { setSelected(id); try { localStorage.setItem(WORKSPACE_KEY,id); } catch { setNotice('工作区选择未保存。'); } }
  const workspace = items.find(w => w.workspaceId === targetId);
  const visible = targetId === '*' ? enabled : workspace ? [workspace] : [];
  const allRows = [...new Map(visible.flatMap(w => learningSessions({sessions,workspaces,workspaceId:w.workspaceId,metadata,query})).map(r=>[r.id,r])).values()].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.updatedAt??-Infinity)-(a.updatedAt??-Infinity));
  const rows=allRows.filter(r=>(stageFilter==='all'||r.stage===stageFilter)&&(!pinnedOnly||r.pinned));
  // The manager lists the same teacher conversations as the switcher and uses
  // the same recoverable archive; it never deletes a transcript permanently.
  // Each row is archived against the space that actually owns it, so the "all
  // spaces" filter cannot hand a row to the wrong workspace's coordinator.
  const ownerOf = useMemo(() => {
    const map = new Map();
    for (const space of visible) for (const row of learningSessions({ sessions, workspaces, workspaceId: space.workspaceId, metadata })) if (!map.has(row.id)) map.set(row.id, space.workspaceId);
    return map;
  }, [sessions, workspaces, visible, metadata]);
  const archivedRows = [...new Map(visible.flatMap(w => learningSessions({sessions,workspaces,workspaceId:w.workspaceId,metadata,query,archivedOnly:true})).map(r=>[r.id,r])).values()].sort((a,b)=>(b.updatedAt??-Infinity)-(a.updatedAt??-Infinity));
  const [archiveState, setArchiveState] = useState({ request: null, busy: false, error: '', status: '' });
  const [showArchived, setShowArchived] = useState(false);
  const rowsRef = useRef(allRows); rowsRef.current = allRows;
  // The controller outlives renders, so the row→space lookup must be a ref that
  // always holds this render's answer instead of the map captured on mount.
  const ownerRef = useRef(ownerOf); ownerRef.current = ownerOf;
  const archive = useRef(null);
  if (!archive.current) archive.current = createTeacherArchiveController({
    archiveSession: request => services.archive({ ...request, knownSessionIds: rowsRef.current.map(row => row.id) }),
    restoreSession: request => services.restore(request),
    getWorkspaceId: row => ownerRef.current.get(row?.id) || '',
    onChange: patch => setArchiveState(current => ({ ...current, ...patch })),
  });
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
      const result = await services.sessions.create({workspaceId:workspace.workspaceId,agentPreset:'stg-learning-mentor'});
      if(result?.ok===false)throw Error(result.error?.message||'无法创建会话。');
      const id = typeof result==='string'?result:result?.value?.sessionId||result?.sessionId;
      if(!id)throw Error('宿主没有返回有效的会话。');
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
    <header className="stgl-heading"><div><div className="stgl-eyebrow"><BookIcon size={15}/> STG LEARNING</div><h1>学习会话</h1><p className="stgl-subtitle">整理课程与对话，从上次的进度继续。</p></div><div className="stgl-heading-actions"><ProjectLink className="stgl-download" href={STG_PROJECT} title="打开 STG Desk 项目主页，查看介绍和下载">STG Desk 项目 ↗</ProjectLink><button aria-expanded={showCollab} aria-controls="stgl-collab" onClick={()=>setShowCollab(!showCollab)}>STG 协作 ↗</button><button onClick={()=>services.layout.selectPanel(null)}>返回对话</button></div></header>
    {notice && <div role="status" className="stgl-notice">{notice}</div>}
    <section className="stgl-resources" aria-label="项目与下载">
      <article className="stgl-resource"><div className="stgl-resource-heading"><BookIcon/><h2>StepsToGreat</h2><span>学习文件夹</span></div><p>下载导师协议，解压后在 DSH 中添加这个文件夹，开始学习。</p><div className="stgl-resource-links"><ProjectLink href={`${STEPS_PROJECT}/archive/refs/heads/main.zip`}>下载 StepsToGreat ZIP ↓</ProjectLink><ProjectLink href={STEPS_PROJECT}>项目主页 ↗</ProjectLink></div></article>
      <article className="stgl-resource"><div className="stgl-resource-heading"><BookIcon/><h2>STG Desk</h2><span>Windows 工作台</span></div><p>阅读教学、编辑文档和作答。下载便携版后，导入同一个学习文件夹。</p><div className="stgl-resource-links"><ProjectLink href={`${STG_PROJECT}/releases/latest`}>下载 Windows 便携版 ↗</ProjectLink><ProjectLink href={STG_PROJECT}>项目主页 ↗</ProjectLink></div></article>
    </section>
    {showCollab&&<section id="stgl-collab" className="stgl-config"><h2>与 STG Desk 一起学习</h2><p>在 STG 中导入相同文件夹并选择同一个 DSH 会话，即可继续同步对话。</p><label className="stgl-time" htmlFor="stgl-app">STG Desk 应用路径（可选）</label><div className="stgl-toolbar"><input id="stgl-app" placeholder="STG Desk.exe 的完整路径" value={app} onChange={e=>setApp(e.target.value)} onBlur={()=>{try{localStorage.setItem(APP_KEY,app.trim());}catch{setNotice('应用路径未保存。');}}}/><button disabled={busy||!app.trim()} onClick={launch}>打开 STG Desk ↗</button></div></section>}
    <section className="stgl-controls" aria-label="会话筛选"><div className="stgl-toolbar"><span className="stgl-workspace-label">{workspace?.title || '请先打开一个学习空间'}</span><button onClick={()=>services.layout.selectPanel('stg-learning')}>返回学习工作台</button><input className="stgl-search" aria-label="搜索学习会话" placeholder="搜索会话或课程…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="stgl-primary" disabled={busy||!workspace} onClick={create}>＋ 新会话</button></div>
    {workspace&&<div className="stgl-workspace-meta"><span className="stgl-time" title={workspace.path}>{workspace.path}</span><span>StepsToGreat 学习空间</span></div>}</section>
    <div className="stgl-filterbar"><div className="stgl-tabs" role="group" aria-label="学习标记筛选">{[['all','全部'],['learning','学习中'],['review','待复习'],['done','已结束']].map(([id,label])=><button key={id} aria-pressed={stageFilter===id} className={stageFilter===id?'active':''} onClick={()=>setStageFilter(id)}>{label}<span>{allRows.filter(r=>id==='all'||r.stage===id).length}</span></button>)}</div><button className={'stgl-only-pin'+(pinnedOnly?' active':'')} aria-pressed={pinnedOnly} onClick={()=>setPinnedOnly(!pinnedOnly)}>只看置顶</button></div>
    <div className="stgl-count" aria-live="polite">{rows.length} 个会话{query?' · 搜索结果':''}<span>置顶优先 · 最近活跃</span></div>
    {archiveState.error && <div role="alert" className="stgl-notice stgl-notice-error">{archiveState.error}</div>}
    {archiveState.status && !archiveState.error && <div role="status" className="stgl-notice">{archiveState.status}</div>}
    {rows.length?<div className="stgl-grid">{rows.map(row=><SessionCard key={row.id} row={row} update={update} open={open} showPath={targetId==='*'} onArchive={()=>archive.current.ask({id:row.id,label:row.title,workspaceId:ownerOf.get(row.id)})} archiving={archiveState.busy}/>)}</div>:<div className="stgl-empty"><BookIcon size={28}/><h2>{query||stageFilter!=='all'||pinnedOnly?'没有符合条件的会话':items.length?'开始一段新的学习':'先添加学习工作区'}</h2><p>{query||stageFilter!=='all'||pinnedOnly?'试试其他关键词，或调整上方筛选。':items.length?'在这个工作区新建会话，记录课程中的问题和想法。':'在 DSH 左侧添加你的学习文件夹，再回到这里。'}</p>{workspace&&!query&&stageFilter==='all'&&!pinnedOnly&&<button disabled={busy} onClick={create}>＋ 新学习会话</button>}</div>}
    <section className="stgl-archived" aria-label="已移出的会话">
      <button className="stgl-archived-toggle" aria-expanded={showArchived} onClick={()=>setShowArchived(!showArchived)}>已移出{archivedRows.length?`（${archivedRows.length}）`:''}<span>移出的对话仍保留，可在这里恢复；本机 DSH 没有永久删除接口。</span></button>
      {showArchived&&(!archivedRows.length?<p className="stgl-archived-empty" role="status">没有已移出的对话。移出后可在这里恢复。</p>:<ul className="stgl-archived-list">{archivedRows.map(row=><li key={row.id}><span title={row.title}>{row.title}</span><button disabled={archiveState.busy} onClick={()=>{void archive.current.restore({id:row.id,label:row.title,workspaceId:ownerOf.get(row.id)});}}>恢复</button></li>)}</ul>)}
    </section>
    <p className="stgl-note">课程和阶段仅用于个人整理，不修改学习档案。</p>
  </div>
  {archiveState.request && <ArchiveConfirm request={archiveState.request} busy={archiveState.busy} error={archiveState.error} onCancel={()=>archive.current.cancel()} onConfirm={()=>{void archive.current.confirm();}}/>}
  </section>;
}
export const inject = ['slots','sessions','workspaces','uiWorkspace','layout','remote','uiSession','conversation'];
export function apply(ctx) {
  const handoff = applyNative(ctx,{renderDocumentEditor:props=><RichEditor {...props}/>,onManageSessions:()=>ctx.layout.selectPanel('stg-learning-sessions')});
  ctx.effect(() => { const style=document.createElement('style');style.dataset.plugin='dsh-stg-learning';style.textContent=css+archiveConfirmCSS;document.head.append(style);return()=>style.remove(); },'stg-learning: scoped styles');
  const services={api:createWorkbenchApi(),sessions:ctx.sessions,workspaces:ctx.workspaces,uiWorkspace:ctx.uiWorkspace,layout:ctx.layout,remote:ctx.remote,archive:handoff.archive,restore:handoff.restore};
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'stg-learning-sessions',inject:()=>({services})},LearningPanel));
}
