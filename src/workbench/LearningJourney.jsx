import { experienceCSS } from './experience-style.js';
import React, { useEffect, useRef, useState } from 'react';
import { Workbench } from './Workbench.jsx';
import { Icon } from './Navigation.jsx';
import { deriveJourney, deriveOpeningPlan, normalizeSetup, readSetup, saveSetup } from './journey-model.js';
import { journeyCSS } from './journey-style.js';

function storage() { try { return globalThis.localStorage; } catch { return null; } }

const paneKey = id => `stg-learning.pane.v1:${id}`;
function readPane(id) { try { return storage()?.getItem(paneKey(id)) === 'documents' ? 'documents' : 'conversation'; } catch { return 'conversation'; } }

/** The guide opens DSH's own main conversation; documents never contain a chat pane. */
export function LearningJourney({ api, workspace, workspaces, mentor = {}, onOpenLibrary, onBack, onManageSessions, onOpenSession, renderDocumentEditor }) {
  const [pane, setPane] = useState(() => readPane(workspace.workspaceId)), [openedDocuments, setOpenedDocuments] = useState(() => readPane(workspace.workspaceId) === 'documents');
  const [overview, setOverview] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [loadError, setLoadError] = useState(''), [reload, setReload] = useState(0);
  const [setup, setSetup] = useState(() => readSetup(storage(), workspace.workspaceId));
  const mounted = useRef(true);
  const journey = deriveJourney(overview);
  const hasCourse = Boolean(journey.course), showDocuments = hasCourse || (journey.phase !== 'clarify' && pane === 'documents');
  const teacherStarted = useRef(false);
  useEffect(() => {
    if (!hasCourse || teacherStarted.current || !mentor.onConnect) return;
    teacherStarted.current = true;
    // Opening the native companion creates/reuses a Session, never sends a turn.
    Promise.resolve(mentor.onConnect({ course: journey.course })).catch(failure => { if (mounted.current) setError(failure.message); });
  }, [hasCourse, mentor.onConnect]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const abort = new AbortController(); let pending = false;
    const refresh = async () => {
      if (pending || abort.signal.aborted) return;
      pending = true;
      try { const result = await api.workspace({ workspaceId: workspace.workspaceId }, { signal: abort.signal }); if (!abort.signal.aborted) { setOverview(result); setLoadError(''); } }
      catch (failure) { if (!abort.signal.aborted) setLoadError(failure.message); }
      finally { pending = false; if (!abort.signal.aborted) setLoading(false); }
    };
    void refresh(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [api, workspace.workspaceId, reload]);
  function choosePane(next) { if (next === 'documents') setOpenedDocuments(true); setPane(next); try { storage()?.setItem(paneKey(workspace.workspaceId), next); } catch { /* Optional navigation memory. */ } }
  function updateSetup(patch) { const next = normalizeSetup({ ...setup, ...patch }); setSetup(next); saveSetup(storage(), workspace.workspaceId, next); }
  async function ask(request) {
    try { await mentor.onAsk?.(request); } catch (failure) { if (mounted.current) setError(failure.message); }
  }
  async function start() {
    setError('');
    if (journey.phase === 'clarify') await ask({ ...journey.context, intent: 'initialize', setup });
    else { try { await mentor.onConnect?.(journey.context); } catch (failure) { if (mounted.current) setError(failure.message); } }
  }
  /**
   * Reopen the conversation already bound to this course. It stages nothing:
   * the original chat, binding and any hand-written draft are exactly as left.
   */
  async function resumeSaved() {
    setError('');
    try { await mentor.onContinue?.(journey.context, journey.savedSessionId); }
    catch (failure) { if (mounted.current) setError(failure.message); }
  }
  /**
   * Start a new conversation from the edited topic. This is the only action
   * that applies the setup fields while a saved conversation exists; the old
   * Session, its history and its draft are left untouched.
   */
  async function restart() {
    setError('');
    try { await mentor.onRestart?.({ ...journey.context, intent: 'initialize', setup }); }
    catch (failure) { if (mounted.current) setError(failure.message); }
  }
  const savedAvailable = journey.savedSessionId && mentor.isSavedAvailable ? mentor.isSavedAvailable(journey.savedSessionId) : true;
  const plan = deriveOpeningPlan({ savedSessionId: journey.savedSessionId, savedAvailable, brief: setup.brief, mode: setup.mode });
  const opening = journey.phase === 'clarify';
  const openingFields = <>
    <label htmlFor="stgj-start-brief">想学的主题或要解决的问题 <small>选填</small></label>
    <textarea id="stgj-start-brief" value={setup.brief} maxLength={2000} onChange={event => updateSetup({ brief: event.target.value })} placeholder="例如：我想用 Python 处理表格，先学怎么读入数据。"/>
    <div className="stgj-mode-options" role="group" aria-label="老师怎么帮你">
      <button aria-pressed={setup.mode === 'direct'} onClick={() => updateSetup({ mode: 'direct' })}>按主题学</button>
      <button aria-pressed={setup.mode === 'clarify'} onClick={() => updateSetup({ mode: 'clarify' })}>帮我理清目标</button>
    </div>
    <p className="stgj-kickoff-note" aria-live="polite">{plan.startNote}</p>
  </>;
  // The document owns request feedback and retry. Preserve rejection so it
  // cannot clear the selected quote or announce success after a failed handoff.
  const documentsMentor = { visible: !!mentor.visible, busy: mentor.busy, error: mentor.error, onAsk: mentor.onAsk, onToggle: request => { void mentor.onConnect?.(request)?.catch(failure => { if (mounted.current) setError(failure.message); }); } };
  return <section className="stgj-root" aria-label="StepsToGreat 学习旅程">
    <style>{journeyCSS}{experienceCSS}</style>
    <header className="stgj-header"><button aria-label="返回学习空间" onClick={onOpenLibrary}><Icon name="back" size={15}/><span className="stgj-library-text">学习空间</span></button><span className="stgj-divider"/><div className="stgj-brand"><Icon name="book" size={18}/><div><strong title={workspace.path}>{workspace.title}</strong><small>StepsToGreat · 你的学习旅程</small></div></div>
      {!hasCourse && !loading && journey.phase !== 'clarify' && <nav className="stgj-tabs" role="tablist" aria-label="学习主视图"><button role="tab" aria-selected={!showDocuments} aria-controls="stgj-conversation" id="stgj-tab-conversation" onClick={() => choosePane('conversation')}><Icon name="chat" size={14}/>和老师聊聊</button><button role="tab" aria-selected={showDocuments} aria-controls="stgj-documents" id="stgj-tab-documents" onClick={() => choosePane('documents')}><Icon name="file" size={14}/>学习内容</button></nav>}
      <div className="stgj-header-actions">{onManageSessions && <button aria-label="管理学习会话" title="管理学习会话" onClick={onManageSessions}><Icon name="history" size={15}/></button>}{onBack && <button aria-label="返回 DSH 对话" title="返回 DSH 对话" onClick={onBack}><Icon name="arrow" size={15}/></button>}</div>
    </header>
    {!hasCourse && !opening && <div className="stgj-statusline"><i className="stgj-status-dot"/><span>{journey.phaseLabel}</span></div>}
    {loadError && <div className="stgj-error" role="alert">{loadError} <button type="button" onClick={() => { setLoadError(''); if (!overview) setLoading(true); setReload(value => value + 1); }}>重试</button></div>}
    {(error || mentor.error) && <div className="stgj-error" role="alert">{error || mentor.error}</div>}
    <div className="stgj-body">
      {!showDocuments && <div id="stgj-conversation" role={journey.phase === 'clarify' ? 'region' : 'tabpanel'} aria-label={journey.phase === 'clarify' ? '开始学习' : undefined} aria-labelledby={journey.phase === 'clarify' ? undefined : 'stgj-tab-conversation'} className="stgj-conversation">
        {loading || plan.checking ? <div className="stgj-loading" role="status">{loading ? '正在读取学习记录…' : '正在查找上次的对话…'}</div> : overview && <div className="stgj-welcome-scroll"><div className="stgj-welcome">
          {opening && plan.canContinue ? <>
            <h1>接着上次学</h1>
            <p className="stgj-welcome-intro">{plan.continueHint}</p>
            <div className="stgj-kickoff stgj-resume">
              <button className="stgj-primary" disabled={mentor.busy} onClick={resumeSaved}><Icon name="chat" size={16}/>{mentor.busy ? '正在打开…' : '继续原对话'}</button>
              <details className="stgj-restart">
                <summary>用新主题另开对话</summary>
                <p className="stgj-restart-note">{plan.openingNote}</p>
                {openingFields}
                <div className="stgj-kickoff-actions"><button className="stgj-secondary" disabled={mentor.busy} onClick={restart}>{mentor.busy ? '正在打开…' : '打开新对话'}</button><span>草稿可编辑，由你发送。</span></div>
              </details>
            </div>
          </> : opening ? <>
            <h1>你想学什么？</h1>
            {plan.stale && <p className="stgj-kickoff-note stgj-kickoff-stale" role="status">{plan.staleNote}</p>}
            <div className="stgj-kickoff stgj-new-opening">
              {openingFields}
              <div className="stgj-kickoff-actions"><button className="stgj-primary" disabled={mentor.busy} onClick={plan.stale ? restart : start}><Icon name="chat" size={16}/>{mentor.busy ? '正在打开…' : plan.stale ? '打开新对话' : '和老师聊聊'}</button><span>草稿可编辑，由你发送。</span></div>
            </div>
          </> : <>
            <h1>继续你的学习</h1>
            <p className="stgj-welcome-intro">学习记录已保留。</p>
            <div className="stgj-kickoff"><button className="stgj-primary" disabled={mentor.busy} onClick={start}><Icon name="chat" size={16}/>{mentor.busy ? '正在打开…' : '和老师聊聊'}</button></div>
          </>}
        </div></div>}
      </div>}
      {(hasCourse || (journey.phase !== 'clarify' && openedDocuments)) && <div className="stgj-documents" id="stgj-documents" role={hasCourse ? undefined : 'tabpanel'} aria-label={hasCourse ? '当前课程' : undefined} aria-labelledby={hasCourse ? undefined : 'stgj-tab-documents'} hidden={!showDocuments}><Workbench api={api} workspaceId={workspace.workspaceId} workspaces={workspaces} embedded mentor={documentsMentor} onOpenSession={onOpenSession} renderDocumentEditor={renderDocumentEditor}/></div>}
    </div>
  </section>;
}
