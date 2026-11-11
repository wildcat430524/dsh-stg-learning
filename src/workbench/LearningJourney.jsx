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
      try { const result = await api.workspace({ workspaceId: workspace.workspaceId }, { signal: abort.signal }); if (!abort.signal.aborted) { setOverview(result); setError(''); } }
      catch (failure) { if (!abort.signal.aborted) setError(failure.message); }
      finally { pending = false; if (!abort.signal.aborted) setLoading(false); }
    };
    void refresh(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [api, workspace.workspaceId]);
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
    try { await mentor.onContinue?.(journey.context); }
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
  const plan = deriveOpeningPlan({ savedSessionId: journey.savedSessionId, savedAvailable: journey.savedSessionId ? (mentor.isSavedAvailable?.(journey.savedSessionId) ?? true) : true, brief: setup.brief, mode: setup.mode });
  // The document owns request feedback and retry. Preserve rejection so it
  // cannot clear the selected quote or announce success after a failed handoff.
  const documentsMentor = { visible: !!mentor.visible, busy: mentor.busy, error: mentor.error, onAsk: mentor.onAsk, onToggle: request => { void mentor.onConnect?.(request)?.catch(failure => { if (mounted.current) setError(failure.message); }); } };
  return <section className="stgj-root" aria-label="StepsToGreat 学习旅程">
    <style>{journeyCSS}{experienceCSS}</style>
    <header className="stgj-header"><button aria-label="返回学习空间" onClick={onOpenLibrary}><Icon name="back" size={15}/><span className="stgj-library-text">学习空间</span></button><span className="stgj-divider"/><div className="stgj-brand"><Icon name="book" size={18}/><div><strong title={workspace.path}>{workspace.title}</strong><small>StepsToGreat · 你的学习旅程</small></div></div>
      {!hasCourse && !loading && journey.phase !== 'clarify' && <nav className="stgj-tabs" role="tablist" aria-label="学习主视图"><button role="tab" aria-selected={!showDocuments} aria-controls="stgj-conversation" id="stgj-tab-conversation" onClick={() => choosePane('conversation')}><Icon name="chat" size={14}/>和老师聊聊</button><button role="tab" aria-selected={showDocuments} aria-controls="stgj-documents" id="stgj-tab-documents" onClick={() => choosePane('documents')}><Icon name="file" size={14}/>学习内容</button></nav>}
      <div className="stgj-header-actions">{onManageSessions && <button aria-label="管理学习会话" title="管理学习会话" onClick={onManageSessions}><Icon name="history" size={15}/></button>}{onBack && <button aria-label="返回 DSH 对话" title="返回 DSH 对话" onClick={onBack}><Icon name="arrow" size={15}/></button>}</div>
    </header>
    {!hasCourse && <div className="stgj-statusline"><i className="stgj-status-dot"/><span>{journey.phaseLabel}</span><span className="stgj-stage-description">先认识你，再决定怎么学</span></div>}
    {(error || mentor.error) && <div className="stgj-error" role="alert">{error || mentor.error}</div>}
    <div className="stgj-body">
      {!showDocuments && <div id="stgj-conversation" role={journey.phase === 'clarify' ? 'region' : 'tabpanel'} aria-label={journey.phase === 'clarify' ? '开始学习' : undefined} aria-labelledby={journey.phase === 'clarify' ? undefined : 'stgj-tab-conversation'} className="stgj-conversation">
        {loading ? <div className="stgj-loading" role="status">正在读取学习记录…</div> : <div className="stgj-welcome-scroll"><div className="stgj-welcome"><div className="stgj-eyebrow"><Icon name="chat" size={16}/>{journey.phase === 'clarify' ? '一个轻松的开始' : '从上次的停点继续'}</div><h1>{journey.phase === 'clarify' ? '先聊聊，你想学会什么？' : '你的导师与学习记录，都在这里。'}</h1><p className="stgj-welcome-intro">{journey.phase === 'clarify' ? '说说你想解决的问题，老师会和你一起找到起点。' : '学习记录已保留，回到老师身边，接着上次的思路聊。'}</p>
          <fieldset className="stgj-kickoff"><legend>{journey.phase === 'clarify' ? '这次，怎么开始' : '继续你的学习'}</legend>
            {journey.phase === 'clarify' && <><div className="stgj-mode-options" role="group" aria-label="开始方式"><button aria-pressed={setup.mode === 'direct'} onClick={() => updateSetup({ mode: 'direct' })}>直接开始</button><button aria-pressed={setup.mode === 'clarify'} onClick={() => updateSetup({ mode: 'clarify' })}>帮我理清目标</button></div><label htmlFor="stgj-start-brief">你想学的主题，或眼前想解决的一件事 <small>（可以留空）</small></label><textarea id="stgj-start-brief" value={setup.brief} maxLength={2000} onChange={event => updateSetup({ brief: event.target.value })} placeholder="例如：我想用 Python 处理工作表格，但还不知道该从哪里开始。"/><p className="stgj-kickoff-note">{plan.startNote}</p></>}
            {journey.phase === 'clarify' && plan.stale && <p className="stgj-kickoff-note stgj-kickoff-stale" role="status">{plan.staleNote}</p>}
            {journey.phase === 'clarify' && plan.canContinue ? <><div className="stgj-saved-choice" role="group" aria-label="继续原对话，或用新主题重新开始">
              <button className="stgj-primary" disabled={mentor.busy || !overview} onClick={resumeSaved}><Icon name="chat" size={15}/>{mentor.busy ? '正在打开…' : '继续原对话'}<Icon name="arrow" size={14}/></button>
              <span>{plan.continueHint}</span>
            </div>
            <details className="stgj-restart">
              <summary>用新主题重新开始</summary>
              <p className="stgj-kickoff-note">{plan.openingNote}</p>
              <label htmlFor="stgj-new-brief">新的主题，或想先解决的一件事 <small>（可留空，让老师先问）</small></label>
              <textarea id="stgj-new-brief" value={setup.brief} maxLength={2000} onChange={event => updateSetup({ brief: event.target.value })} placeholder="例如：这次先弄明白分数通分。"/>
              <div className="stgj-kickoff-actions"><button className="stgj-secondary" disabled={mentor.busy || !overview} onClick={restart}><Icon name="refresh" size={15}/>{mentor.busy ? '正在新建…' : '用这个主题重新开始'}</button><span>{plan.restartHint}</span></div>
            </details></> : journey.phase === 'clarify' ? <div className="stgj-kickoff-actions"><button className="stgj-primary" disabled={mentor.busy || !overview} onClick={start}><Icon name="chat" size={15}/>{mentor.busy ? '正在连接导师…' : '和老师聊聊'}<Icon name="arrow" size={14}/></button><span>{setup.brief.trim() ? '打开后，由你检查并发送' : '打开后，由你发送第一句话'}</span></div> : null}
          </fieldset>
          <p className="stgj-footnote">{journey.savedSessionId ? '还没有课程。先继续和老师聊，第一课准备好后会显示在这里。' : '暂时没有目标也没关系，可以先和老师聊聊。'}</p>
        </div></div>}
      </div>}
      {(hasCourse || (journey.phase !== 'clarify' && openedDocuments)) && <div className="stgj-documents" id="stgj-documents" role={hasCourse ? undefined : 'tabpanel'} aria-label={hasCourse ? '当前课程' : undefined} aria-labelledby={hasCourse ? undefined : 'stgj-tab-documents'} hidden={!showDocuments}><Workbench api={api} workspaceId={workspace.workspaceId} workspaces={workspaces} embedded mentor={documentsMentor} onOpenSession={onOpenSession} renderDocumentEditor={renderDocumentEditor}/></div>}
    </div>
  </section>;
}
