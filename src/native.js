import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createWorkbenchApi } from './api.js';
import { LearningLibrary } from './workbench/LearningLibrary.jsx';
import { LearningJourney } from './workbench/LearningJourney.jsx';
import { TeacherFrame, TeacherWelcome } from './workbench/TeacherFrame.jsx';
import { TeacherSelection } from './workbench/TeacherSelection.jsx';
import { TeachingVisuals } from './workbench/TeachingVisuals.jsx';
import { maskTeachingVisualText } from './teaching-visual.js';
import { createMentorDraftMailbox } from './mentor-drafts.js';
import { createLearningEntryPolicy } from './learning-layout.js';
import { buildMentorDraft, createMentorCoordinator, insertMentorDraft } from './native-protocol.js';
import { createTeacherArchiveController, createTeacherDraftRegistry, createTeacherSessionSwitcher, teacherSessionRows } from './teacher-sessions.js';
import { TeacherSessionSwitcher, teacherSessionsCSS } from './workbench/TeacherSessions.jsx';
import { archiveConfirmCSS } from './workbench/ArchiveConfirm.jsx';

const h = React.createElement, identity = value => value;
const PANEL = 'stg-learning', LAST_WORKSPACE = 'stg-learning.space.v2';
const paneKey = id => `stg-learning.pane.v1:${id}`;
function storage() { try { return globalThis.localStorage; } catch { return null; } }
function rememberWorkspace(id) { try { storage()?.setItem(LAST_WORKSPACE, id); } catch { /* UI preference only. */ } }
const NATIVE_CSS = `.stgt-conversation{height:100%;min-height:0;display:flex;flex:1;flex-direction:column}.stgt-restore-error{flex:none;display:flex;align-items:center;gap:8px;margin:0;padding:8px 12px;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#b44)}.stgt-restore-error button{font:inherit;color:inherit;text-decoration:underline;border:0;background:transparent;cursor:pointer;padding:0}.stgw-native{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,inherit)}.stgw-native-status{padding:16px;font-size:13px}.stgw-native-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:4px 16px 8px}.stgw-native-return{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:8px;padding:6px 9px;background:transparent;color:inherit;font:12px system-ui;cursor:pointer}.stgw-native-return:focus-visible{outline:2px solid Highlight;outline-offset:2px}.stgw-native-handoff-note{font-size:11px;max-width:260px;line-height:1.5;color:var(--dsw-alias-label-secondary,inherit)}.stgw-native-handoff-note[role=alert]{color:var(--dsw-alias-state-error-primary,#b44)}@media(max-width:750px){.stgw-native-handoff-note{max-width:120px;font-size:10px}}`;
function BookIcon() { return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6Z' })); }

function LearningSidebarPolicy({ wide, usePanelInfo, toggleSidebar, enterPolicy }) {
  const panel = usePanelInfo(identity);
  useEffect(() => {
    // Non-Windows shells retain owner.wide during their closing animation.
    // AppFrame's committed collapsed marker prevents toggling a closed rail open.
    const collapsed = Boolean(document.querySelector('[data-sidebar-collapsed]'));
    if (enterPolicy(panel.activePanelId, wide, collapsed)) toggleSidebar();
  }, [panel.activePanelId, wide, toggleSidebar, enterPolicy]);
  return null;
}

/** Mounted above DSH's resident composer, including blank Sessions. No embedded composer exists. */
function NativeLearningAction({ sessionId, useWorkspaces, useInput, inputActions, mailbox, api, onOpenLearning, getSessionSummary }) {
  const workspaces = useWorkspaces(identity), input = useInput(identity);
  const inputRef = useRef(input); inputRef.current = input;
  const snapshot = useSyncExternalStore(mailbox.subscribe, mailbox.getSnapshot, mailbox.getSnapshot);
  const request = snapshot.pending.get(sessionId), notice = snapshot.notices.get(sessionId);
  const candidate = workspaces.items?.find(item => item.sessionIds?.includes(sessionId));
  const [validId, setValidId] = useState('');
  const applied = useRef(new Set());
  useEffect(() => {
    const abort = new AbortController(); setValidId('');
    if (candidate) api.library({}, { signal: abort.signal }).then(result => { if (!abort.signal.aborted && result.items?.some(row => row.workspaceId === candidate.workspaceId)) setValidId(candidate.workspaceId); }).catch(() => {});
    return () => abort.abort();
  }, [api, candidate?.workspaceId, candidate?.path]);
  useEffect(() => {
    if (!request || applied.current.has(request.id)) return;
    if (request.intent !== 'initialize' && (input?.phase === 'submitting' || input?.phase === 'adjudicating' || input?.phase === 'claimed')) {
      mailbox.fail(sessionId, request.id, Error('原生输入框正在处理消息或命令，未改动原草稿。请完成后重试。')); return;
    }
    const attempt = () => {
      if (mailbox.getSnapshot().pending.get(sessionId)?.id !== request.id || applied.current.has(request.id) || !inputActions) return;
      try {
        const latest = inputRef.current;
        const initialization = request.intent === 'initialize';
        const summary = getSessionSummary(sessionId);
        if (initialization && typeof summary?.blank !== 'boolean') return;
        if (!initialization && ['submitting', 'adjudicating', 'claimed'].includes(latest?.phase)) { mailbox.fail(sessionId, request.id, Error('原生输入框正在处理消息，未插入学习请求。请完成后重试。')); return; }
        const result = insertMentorDraft(inputActions, latest, request.text, { initialization, started: summary?.blank === false });
        if (!result) return;
        const message = result === 'preserved' ? '已保留你输入的内容，没有重复添加开场。可以直接修改或发送。' : result === 'resumed' ? '已回到老师对话，可以接着聊。' : undefined;
        applied.current.add(request.id); mailbox.complete(sessionId, request.id, message); inputActions.focus?.();
      } catch (failure) {
        if (failure.draftInserted || failure?.code === 'DRAFT_UNAVAILABLE') { applied.current.add(request.id); mailbox.fail(sessionId, request.id, failure); return; }
        // Only pre-insertion readiness failures may be retried.
      }
    };
    attempt(); const timer = setInterval(attempt, 150); return () => clearInterval(timer);
  }, [request?.id, inputActions, input?.phase, input?.draft]);
  if (!validId && !notice && !request) return null;
  return h('div', { className: 'stgw-native-tools' },
    validId && h('button', { className: 'stgw-native-return', onClick: () => onOpenLearning(validId), title: '返回本学习空间的课程、作答和记录' }, h(BookIcon), '学习内容'),
    (notice || request) && h('span', { className: 'stgw-native-handoff-note', role: notice?.error ? 'alert' : 'status', title: notice?.error || notice?.message || '正在准备学习请求…' }, notice?.error || notice?.message || '正在准备学习请求…'),
    notice && h('button', { className: 'stgw-native-return', 'aria-label': '关闭学习请求提示', onClick: () => mailbox.dismiss(sessionId) }, '知道了'));
}

function TeacherChatView(props) {
  const session = props.useSession(identity);
  return session.blank && !session.running
    ? h(TeacherWelcome)
    : props.renderSlot('conversation.session', { view: 'chat' });
}
function TeacherConversation({ sessionId, useSession, useConversation, useSessions, useInput, inputActions, renderFactorySlot, mailbox, draftRegistry }) {
  const session = useSession(identity), conversation = useConversation(identity);
  const input = useInput(identity);
  const summaryBlank = useSessions(s => s.byId[sessionId]?.blank);
  const blank = !conversation.activeTargets.size && (session.blank || session.awaitingFirstTurn) && !session.running;
  const settling = blank && session.openState === 'loading' && summaryBlank !== true;
  const inputRef = useRef(input); inputRef.current = input;
  const actionsRef = useRef(inputActions); actionsRef.current = inputActions;
  // This conversation's own subtree. Several teacher surfaces can coexist
  // briefly (docked/floating switch, conversation switch), so a document-wide
  // query could read another Session's composer.
  const own = useRef(null);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const streaming = Boolean(session.running);
  useEffect(() => {
    // The host shows a finished turn's diagram only after turn/end, so while
    // an answer streams its protocol marker would appear as raw text. Mask
    // rendered text nodes of this conversation only (never the composer).
    // Masked nodes are not restored when streaming stops: that would flash
    // the raw marker before the finished-turn diagram replaces it. Only the
    // DOM projection changes; the stored message text is untouched.
    const root = own.current;
    if (!streaming || !root || typeof MutationObserver === 'undefined') return;
    const maskNode = node => {
      if (!node.data.includes('<!--stg-visual') || node.parentElement?.closest('[contenteditable=true],textarea')) return;
      const display = maskTeachingVisualText(node.data);
      if (display !== node.data) node.data = display;
    };
    const scan = target => {
      if (target.nodeType === 3) { maskNode(target); return; }
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) maskNode(walker.currentNode);
    };
    scan(root);
    // Observer callbacks run before paint, so only changed nodes are masked
    // and the raw marker never reaches the screen.
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') scan(record.target);
        else record.addedNodes.forEach(scan);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [streaming, sessionId]);
  useEffect(() => {
    // The switcher flushes this exact composer before the Session is replaced
    // and restores the stashed text here; only official composer actions are
    // used, and nothing is ever submitted.
    const getDraft = () => {
      const live = inputRef.current?.draft;
      if (typeof live === 'string') return live;
      // Older hosts expose only a textarea projection; read what the user sees.
      const field = own.current?.querySelector('[contenteditable=true],textarea');
      return field ? (field.value ?? field.innerText ?? '') : '';
    };
    const unbind = draftRegistry.bind(sessionId, {
      getDraft,
      setDraft: text => actionsRef.current?.setDraft?.(text),
      persist: () => actionsRef.current?.persistDraft?.(),
      focus: () => actionsRef.current?.focus?.(),
    });
    let stopped = false;
    setRestoreFailed(false);
    const attempt = () => {
      const status = draftRegistry.restore(sessionId);
      if (status !== 'pending' && status !== 'unavailable') stopped = true;
    };
    attempt();
    const timer = setInterval(() => { if (stopped) { clearInterval(timer); return; } attempt(); }, 150);
    // The stash is kept on timeout; only report it so the text is never
    // silently stranded, and let the user try again.
    const giveUp = setTimeout(() => { clearInterval(timer); if (!stopped && draftRegistry.hasDraft(sessionId)) setRestoreFailed(true); }, 8000);
    return () => { clearInterval(timer); clearTimeout(giveUp); unbind(); };
  }, [draftRegistry, sessionId, restoreAttempt]);
  // Use the official shared Conversation, including its real composer, tools,
  // permissions and streaming. There is no second chat implementation.
  return h('div', { ref: own, className: 'stgt-conversation', 'data-session-id': sessionId },
    restoreFailed && h('p', { className: 'stgt-restore-error', role: 'alert' }, '未发送的文字没能放回输入框，它仍然保存着。',
      h('button', { type: 'button', onClick: () => setRestoreAttempt(value => value + 1) }, '重试')),
    h(TeacherSelection, { sessionId, onAsk: (intent, text) => mailbox.enqueue(sessionId, buildMentorDraft({ intent, selection: text })).ready },
      renderFactorySlot('conversation.content', { variant: 'embedded', phase: settling ? 'settling' : 'active', hero: false }, { slots: { views: TeacherChatView } })));
}

/** The learning page: courses and documents on the left, the native teacher on the right. */
function NativeWorkbench({ useWorkspaces, api, mentorSessions, draftRegistry, openSession, mailbox, selectPanel, renderDocumentEditor, onManageSessions, sessionsList, getArchivedSessionIds, SessionProvider, renderSlot }) {
  const workspaceSnapshot = useWorkspaces(identity);
  const sessionsSnapshot = useSyncExternalStore(sessionsList.subscribe, sessionsList.getSnapshot, sessionsList.getSnapshot);
  const [library, setLibrary] = useState([]), [loading, setLoading] = useState(true), [libraryError, setLibraryError] = useState(''), [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(() => { try { return storage()?.getItem(LAST_WORKSPACE) || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [switchState, setSwitchState] = useState({ busy: false, error: '', status: '' });
  const mounted = useRef(true), pending = useRef(false);
  const [teacher, setTeacher] = useState(null);
  const teacherRef = useRef(null), connectionGeneration = useRef(0), currentWorkspace = useRef('');
  // A superseded generation is released only after the new provider commits:
  // releasing while the old SessionProvider can still render would make the
  // Session adapter reject an inactive reference.
  const retired = useRef([]);
  useEffect(() => {
    const released = retired.current;
    retired.current = [];
    for (const reference of released) { try { reference.release(); } catch { /* Already released. */ } }
  }, [teacher]);
  // Sessions created from this picker may reach the workspace stream after the
  // create response; remember them per space so the row appears immediately.
  const createdIds = useRef(new Map());
  const gate = useRef(Promise.resolve());
  function exclusive(operation) {
    const next = gate.current.then(operation, operation);
    gate.current = next.catch(() => {});
    return next;
  }
  const workspaces = useMemo(() => library.map(item => ({ ...workspaceSnapshot.items?.find(row => row.workspaceId === item.workspaceId), ...item })), [library, workspaceSnapshot.items]);
  const workspace = workspaces.find(item => item.workspaceId === selected);
  currentWorkspace.current = workspace?.workspaceId || '';
  // The archive set is registry-global and lives beside (not inside) the
  // workspace rows, so the lists must depend on it directly: archiving one
  // conversation has to move that row out of the open list immediately.
  const archivedKey = (workspaceSnapshot.archivedSessionIds || getArchivedSessionIds() || []).join('\n');
  const archivedIds = archivedKey ? archivedKey.split('\n') : [];
  const sessionRows = useMemo(() => !workspace ? [] : teacherSessionRows(sessionsSnapshot, workspace, {
    archivedSessionIds: archivedIds,
    includeSessionIds: [...(createdIds.current.get(workspace.workspaceId) || [])],
    currentSessionId: teacher?.id || '',
  }), [sessionsSnapshot, workspace, teacher?.id, archivedKey]);
  const archivedRows = useMemo(() => !workspace ? [] : teacherSessionRows(sessionsSnapshot, workspace, {
    archivedSessionIds: archivedIds,
    includeSessionIds: [...(createdIds.current.get(workspace.workspaceId) || [])],
    currentSessionId: teacher?.id || '',
    archivedOnly: true,
  }), [sessionsSnapshot, workspace, teacher?.id, archivedKey]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; connectionGeneration.current++; switcher.current?.dispose(); for (const reference of retired.current.splice(0)) { try { reference.release(); } catch { /* Already released. */ } } teacherRef.current?.reference.release(); teacherRef.current = null; }; }, []);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setLibraryError('');
    api.library({}, { signal: abort.signal }).then(result => { if (!abort.signal.aborted) setLibrary(result.items || []); }).catch(failure => { if (!abort.signal.aborted) setLibraryError(failure.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [api, workspaceSnapshot.items, refresh]);
  function closeTeacher() {
    connectionGeneration.current++; switcher.current?.invalidate();
    if (teacherRef.current) retired.current.push(teacherRef.current.reference);
    teacherRef.current = null; setTeacher(null); setSwitchState({ busy: false, error: '', status: '' });
  }
  function choose(id) { closeTeacher(); setSelected(id); rememberWorkspace(id); setError(''); }
  /**
   * Removing one conversation goes through the Host's recoverable archive only:
   * the transcript and its position stay, and "已移出" restores it. The current
   * conversation is never left bound to a hidden id: after archiving the
   * selected one, the panel switches to another listed teacher (or reopens the
   * guide), while a non-current removal keeps the open conversation untouched.
   */
  const archive = useRef(null);
  // The controller outlives renders, so it must read the newest rows instead of
  // the [] captured on the very first render.
  const rowsRef = useRef(sessionRows); rowsRef.current = sessionRows;
  const [archiveState, setArchiveState] = useState({ request: null, busy: false, error: '', status: '' });
  if (!archive.current) archive.current = createTeacherArchiveController({
    /**
     * The Host hides an archived Session from every surface, and hiding the one
     * this panel is rendering tears the panel down mid-call, which is how an
     * archived id stayed wired into the view. The open conversation is released
     * first and the panel returns to the guide; archiving a conversation that is
     * not open leaves the panel, its history and its draft untouched.
     */
    archiveSession: async request => {
      const current = teacherRef.current;
      const archivingCurrent = Boolean(current) && current.id === request.sessionId;
      const workspaceId = request.workspaceId || current?.workspaceId || currentWorkspace.current;
      if (archivingCurrent) closeTeacher();
      return mentorSessions.archive({ ...request, workspaceId, knownSessionIds: rowsRef.current.map(row => row.id) });
    },
    restoreSession: request => mentorSessions.restore(request),
    getWorkspaceId: () => currentWorkspace.current,
    isLive: target => mounted.current && (!target?.workspaceId || currentWorkspace.current === target.workspaceId),
    onChange: patch => { if (mounted.current) setArchiveState(current => ({ ...current, ...patch })); },
    onRestored: () => { if (mounted.current) setRefresh(value => value + 1); },
  });
  /** The switcher commits only after the retained generation is ready and bound. */
  const switcher = useRef(null);
  if (!switcher.current) switcher.current = createTeacherSessionSwitcher({
    gate: exclusive,
    getTarget: () => teacherRef.current ? { workspaceId: teacherRef.current.workspaceId, courseId: teacherRef.current.courseId } : null,
    getCurrent: () => teacherRef.current,
    isBlank: row => Boolean(sessionsList.getSnapshot().byId[row.id]?.blank),
    hasDraft: id => draftRegistry.hasDraft(id),
    flush: id => { if (id) draftRegistry.persist(id); },
    openSession: request => mentorSessions.select(request),
    createSession: request => mentorSessions.createNew(request),
    applySession: (next, previous) => {
      if (previous && previous.id === next.id) { next.reference.release(); return; }
      // An already-wired Session in this space keeps whichever course binding
      // the current conversation had; a brand-new one is attached to it.
      const wired = { ...next, courseId: previous?.courseId || next.courseId || '_workspace' };
      createdIds.current.set(next.workspaceId, new Set([...(createdIds.current.get(next.workspaceId) || []), next.id]));
      connectionGeneration.current++;
      if (previous) retired.current.push(previous.reference);
      teacherRef.current = wired; setTeacher(wired); setError('');
    },
    isLive: target => mounted.current && currentWorkspace.current === target.workspaceId,
    onChange: patch => { if (mounted.current) setSwitchState(current => ({ ...current, ...patch })); },
  });
  async function connect(context = {}, { stage = false, inline = true } = {}) {
    return exclusive(async () => {
      if (!workspace) throw Error('学习空间尚未就绪，请重新打开。');
      if (pending.current) throw Error('导师连接正在处理中，请稍候再试。');
      pending.current = true; setBusy(true); setError('');
      let retained, ticket, ownsReference = false;
      const generation = connectionGeneration.current, workspaceId = workspace.workspaceId, courseId = context.course?.id || '_workspace';
      try {
        if (inline && teacherRef.current?.workspaceId === workspaceId && teacherRef.current?.courseId === courseId) retained = teacherRef.current;
        else { retained = await mentorSessions.acquire({ workspaceId, courseId }); ownsReference = true; }
        if (!mounted.current || generation !== connectionGeneration.current || currentWorkspace.current !== workspaceId) throw Error('学习位置已经改变，请在当前课程重新提问。');
        if (inline) {
          if (teacherRef.current !== retained) { if (teacherRef.current) retired.current.push(teacherRef.current.reference); teacherRef.current = retained; setTeacher(retained); }
          ownsReference = false;
        }
        if (stage) { ticket = mailbox.enqueue(retained.id, buildMentorDraft(context), { intent: context.intent }); ticket.ready.catch(() => {}); }
        if (!inline) { closeTeacher(); await openSession(retained.id); }
        if (ticket) await ticket.ready;
        return retained.id;
      } catch (failure) {
        if (ticket) mailbox.fail(retained.id, ticket.id, failure);
        if (mounted.current) setError(failure.message || '无法打开原生导师会话，请重试。');
        throw failure;
      } finally { if (ownsReference) retained?.reference.release(); pending.current = false; if (mounted.current) setBusy(false); }
    });
  }
  /**
   * "Start over with a new topic": the old conversation is flushed (its
   * hand-typed draft stays in its own composer), a distinct Session is created
   * through the official create/course-binding path, and only then is the new
   * opening staged for review. Nothing is sent automatically.
   */
  async function restart(context = {}) {
    return exclusive(async () => {
      if (!workspace) throw Error('学习空间尚未就绪，请重新打开。');
      if (pending.current) throw Error('导师连接正在处理中，请稍候再试。');
      pending.current = true; setBusy(true); setError('');
      const generation = connectionGeneration.current, workspaceId = workspace.workspaceId, courseId = context.course?.id || '_workspace';
      let retained, ticket;
      try {
        // Keep whatever the learner typed in the conversation they are leaving.
        try { if (teacherRef.current?.id) draftRegistry.persist(teacherRef.current.id); } catch { /* The conversation itself is untouched. */ }
        retained = await mentorSessions.createNew({ workspaceId, courseId });
        if (!mounted.current || generation !== connectionGeneration.current || currentWorkspace.current !== workspaceId) {
          retained.reference?.release?.();
          throw Error('学习位置已经改变，请在当前课程重新开始。');
        }
        ticket = mailbox.enqueue(retained.id, buildMentorDraft(context), { intent: 'initialize' });
        ticket.ready.catch(() => {});
        closeTeacher();
        await openSession(retained.id);
        await ticket.ready;
        return retained.id;
      } catch (failure) {
        if (ticket && retained) mailbox.fail(retained.id, ticket.id, failure);
        if (mounted.current) setError(failure.message || '无法新建导师对话，请重试。');
        throw failure;
      } finally {
        try { retained?.reference?.release?.(); } catch { /* Already handed off to the main conversation. */ }
        pending.current = false; if (mounted.current) setBusy(false);
      }
    });
  }
  if (workspaceSnapshot.phase !== 'ready') return h('div', { className: 'stgw-native-status', role: 'status' }, '正在读取学习空间…');
  if (!workspace) return h(LearningLibrary, { api, items: library, loading, error: libraryError, onReload: () => setRefresh(value => value + 1), onOpen: choose, onReady: item => { setLibrary(previous => [...previous.filter(row => row.workspaceId !== item.workspaceId), item]); choose(item.workspaceId); setRefresh(value => value + 1); try { storage()?.setItem(paneKey(item.workspaceId), 'conversation'); } catch { /* UI preference. */ } }, onBack: () => selectPanel(null) });
  const sessionControl = teacher && h(TeacherSessionSwitcher, {
    sessions: sessionRows, currentId: teacher.id, busy: switchState.busy,
    // Keep the error inside the menu so the visible conversation never loses
    // its place, but surface it through the panel when the menu is closed.
    error: switchState.error, status: switchState.status,
    archivedSessions: archivedRows, archiveRequest: archiveState.request, archiveBusy: archiveState.busy, archiveError: archiveState.error,
    onSelect: id => { void switcher.current.select(id); },
    onNew: () => { void switcher.current.create(); },
    onArchive: row => archive.current.ask(row),
    onArchiveConfirm: () => { void archive.current.confirm(); },
    onArchiveCancel: () => archive.current.cancel(),
    onRestore: row => { void archive.current.restore(row); },
  });
  return h('div', { className: 'stgw-native' }, h(TeacherFrame, { open: !!teacher, onClose: closeTeacher, onExpand: () => teacher && openSession(teacher.id), error: error || switchState.error, notice: switchState.status && !switchState.busy ? switchState.status : '', sessionControl, teacher: teacher && h(SessionProvider, { session: teacher.reference }, renderSlot('stg.learning.teacher', {})) }, h(LearningJourney, { key: workspace.workspaceId, api, workspace, workspaces, mentor: { visible: !!teacher, busy, error, isSavedAvailable: id => sessionRows.some(row => row.id === id), onAsk: context => connect(context, { stage: true, inline: !['initialize', 'assess'].includes(context.intent) }), onConnect: context => connect(context), onContinue: context => connect(context), onRestart: context => restart(context) }, onOpenLibrary: () => choose(''), onBack: () => selectPanel(null), onManageSessions, onOpenSession: context => connect(context), renderDocumentEditor })));
}

export function applyNative(ctx, { renderDocumentEditor, onManageSessions } = {}) {
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({ name: 'conversation.chat.turnTail', id: 'stg-teaching-visuals', order: 5 }, TeachingVisuals));
  const api = createWorkbenchApi(), mailbox = createMentorDraftMailbox(), enterPolicy = createLearningEntryPolicy();
  const draftRegistry = createTeacherDraftRegistry();
  const coordinator = createMentorCoordinator({
    api, getWorkspace: id => ctx.workspaces.list.getSnapshot().items?.find(row => row.workspaceId === id), getSessions: () => ctx.sessions.list.getSnapshot(),
    create: async options => {
      const result = await ctx.sessions.create(options);
      if (typeof result === 'string' && result) return result;
      if (!result?.ok || !result.value?.sessionId) throw Error(result?.error?.message || 'DSH 没有返回有效的导师会话标识。');
      return result.value.sessionId;
    },
    retain: id => ctx.sessions.retain(id, { source: 'stgLearning' }),
    // The Host's controller resolves `undefined` on success and throws a typed
    // error on refusal, so the call is wrapped and never read for a value.
    archive: async sessionId => { await ctx.workspaces.archiveSession(sessionId); },
    unarchive: async sessionId => { await ctx.workspaces.unarchiveSession(sessionId); },
    getArchivedSessionIds: () => ctx.workspaces.list.getSnapshot().archivedSessionIds || [],
  });
  // The switcher renders the confirmation dialog, so the dialog's own rules must
  // ship with the switcher: `teacherSessionsCSS` only overrides where it covers.
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.plugin = 'stg-learning-native'; style.textContent = NATIVE_CSS + teacherSessionsCSS + archiveConfirmCSS; document.head.append(style); return () => { mailbox.dispose(); style.remove(); }; }, 'stg-learning: native full conversation handoff');
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, children: { 'stg.learning.teacher': { kind: 'single', scope: 'session' } }, inject: () => ({ api, mailbox, draftRegistry, mentorSessions: { acquire: request => coordinator.acquire(request), select: request => coordinator.select(request), createNew: request => coordinator.createNew(request), archive: request => coordinator.archiveSession(request), restore: request => coordinator.unarchiveSession(request) }, sessionsList: ctx.sessions.list, getArchivedSessionIds: () => ctx.workspaces.list.getSnapshot().archivedSessionIds || [], openSession: id => ctx.uiWorkspace.openSession(id), selectPanel: id => ctx.layout.selectPanel(id), renderDocumentEditor, onManageSessions: onManageSessions || (() => ctx.layout.selectPanel('stg-learning-sessions')) }) }, NativeWorkbench));
  ctx.slots.inject('stg.learning.teacher', () => ctx.slots.register({ name: 'stg.learning.teacher', inject: () => ({ mailbox, draftRegistry }) }, TeacherConversation));
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'stg-learning-return', order: 20, inject: () => ({ api, mailbox, getSessionSummary: id => ctx.sessions.list.getSnapshot().byId[id], onOpenLearning: id => { rememberWorkspace(id); try { storage()?.setItem(paneKey(id), 'documents'); } catch { /* UI preference only. */ } ctx.layout.selectPanel(PANEL); } }) }, NativeLearningAction));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 35, label: () => '学习' }, BookIcon));
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'stg-learning-sidebar-policy', inject: () => ({ enterPolicy, toggleSidebar: () => ctx.layout.toggleSidebar() }) }, LearningSidebarPolicy));
  // The session manager page is a second surface over the same teacher list, so
  // it must reuse this coordinator instead of calling the Host archive directly;
  // that keeps one definition of "belongs to this space" for both entry points.
  return {
    archive: request => coordinator.archiveSession(request),
    restore: request => coordinator.unarchiveSession(request),
    getArchivedSessionIds: () => ctx.workspaces.list.getSnapshot().archivedSessionIds || [],
  };
}
