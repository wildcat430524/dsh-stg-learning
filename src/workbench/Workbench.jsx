import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { workbenchCSS } from './style.js';
import { coursePickerCSS } from './CoursePicker.jsx';
import { experienceCSS } from './experience-style.js';
import { SaveState, ReadingSkeleton, useReadingTransition } from './Motion.jsx';
import { SelectionToolbar } from './SelectionToolbar.jsx';
import { readSelection } from './selection-anchor.js';
import { learningLibraryCSS } from './LearningLibrary.jsx';
import { Markdown, SectionBoundary } from './Markdown.jsx';
import { Icon, Empty, ViewTabs } from './Navigation.jsx';
import { LessonAccessBar, LearningProgressPage, lessonNavigationCSS } from './LessonNavigation.jsx';
import { answerRoundMarkdown } from './lesson-navigation.js';
import { ConflictDialog, HistoryDialog } from './Dialogs.jsx';
import { acceptSave, answersToSave, asText, basename, courseLocation, createCheckRunner, createRequestGate, currentQuestions, draftKey, draftRecord, hasChanges, initialLocation, newDocumentEntry, normalizeCourses, operationId, readDraft, readableDate, reconcileExternal, recoverEntryDraft, saveDraft, titleOf } from './model.js';
import { roundKey } from '../round.js';

function storage() { try { return globalThis.localStorage; } catch { return null; } }
function errorMessage(error) { return asText(error?.message) || (typeof error === 'string' ? error : '操作未完成，请重试。'); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function Workbench(props) {
  const items = Array.isArray(props.workspaces) ? props.workspaces : [];
  const [selected, setSelected] = useState(props.workspaceId || items[0]?.workspaceId || '');
  useEffect(() => { if (props.workspaceId) setSelected(props.workspaceId); }, [props.workspaceId]);
  const target = items.some(w => w.workspaceId === selected) ? selected : items[0]?.workspaceId || '';
  const choose = id => { setSelected(id); props.onWorkspaceChange?.(id); };
  return <WorkspaceWorkbench key={target} {...props} workspaceId={target} workspaces={items} onWorkspaceChange={choose}/>;
}

function WorkspaceWorkbench({ embedded = false, api, workspaces, workspaceId, onWorkspaceChange, onOpenLibrary, onBack, mentor = {}, onOpenSession, onManageSessions, renderDocumentEditor }) {
  const root = useRef(null), reader = useRef(null), scroll = useRef(null), editorApi = useRef(null);
  const [data, setData] = useState(null), [loading, setLoading] = useState(!!workspaceId), [workspaceError, setWorkspaceError] = useState('');
  const [courseId, setCourseId] = useState(''), [path, setPath] = useState(''), [view, setView] = useState('read'), [selectedRoundId, setSelectedRoundId] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false), [documentError, setDocumentError] = useState(''), [notice, setNotice] = useState('');
  const [selection, setSelection] = useState(null), [editorReady, setEditorReady] = useState(false);
  const [progressPage, setProgressPage] = useState(null);
  const [width, setWidth] = useState(1400), [conflict, setConflict] = useState(null), [externalUpdate, setExternalUpdate] = useState(null), [history, setHistory] = useState(null), [asking, setAsking] = useState(false), [refreshing, setRefreshing] = useState(false);
  const [, repaint] = useState(0);
  const entries = useRef(new Map()), mounted = useRef(true), gate = useRef(createRequestGate()), workspaceGate = useRef(createRequestGate()), historyGate = useRef(createRequestGate());
  const active = useRef({ path: '', courseId: '', view: 'read' }), stateWrites = useRef(Promise.resolve()), scrollPositions = useRef(new Map()), storageWarning = useRef(false), startup = useRef(false);
  // Latest check bodies; the runners keep one request in flight and never drop
  // an explicit click that arrives during a background check.
  const checkDocumentNow = useRef(null), refreshWorkspaceNow = useRef(null);
  const documentRunner = useRef(null), workspaceRunner = useRef(null);
  if (!documentRunner.current) documentRunner.current = createCheckRunner(options => checkDocumentNow.current?.(options));
  if (!workspaceRunner.current) workspaceRunner.current = createCheckRunner(options => refreshWorkspaceNow.current?.(options));
  const askPending = useRef(false);
  const compact = width < 1120, narrow = width < 800, mobile = width < 570;
  const courses = useMemo(() => normalizeCourses(data?.courses), [data]);
  const course = courses.find(c => c.id === courseId) || null, entry = entries.current.get(path), snapshot = entry?.snapshot;
  const selectedRound = course?.rounds.find(item => item.id === selectedRoundId);
  const round = course ? selectedRound?.title || asText(snapshot?.questions?.round) || course.rounds.find(r => r.path === path)?.title || '' : '';
  const selectedRoundKey = roundKey(selectedRound?.title);
  const answerView = view !== 'read' && !!course;
  const answerMissing = answerView && !course.answerPath;
  const scopedAnswer = answerView && path === course.answerPath && !!selectedRoundKey;
  const questionRoundKey = roundKey(snapshot?.questions?.round);
  const recordedRoundId = course?.currentRoundId;
  // The host appends answers only to the current question set. A legacy answer
  // document with no round markers can still belong to the recorded current round.
  const worksheetMatches = questionRoundKey ? questionRoundKey === selectedRoundKey
    : !snapshot?.records?.hasRounds && selectedRoundId === recordedRoundId;
  const roundArchive = scopedAnswer && (!worksheetMatches || (!!recordedRoundId && selectedRoundId !== recordedRoundId));
  const readOnlyAnswer = answerMissing || roundArchive;
  const roundAnswer = useMemo(() => scopedAnswer ? answerRoundMarkdown(snapshot, selectedRoundKey) : '', [scopedAnswer, snapshot, selectedRoundKey]);
  const questions = currentQuestions(snapshot);
  const scrollKey = JSON.stringify([path, view, selectedRoundId]);
  useReadingTransition(scroll, `${path}|${view}|${progressPage || ''}|${selectedRoundId}`, !!(!loading && (progressPage || (!documentLoading && snapshot))));
  const context = { course, document: snapshot || null, round };
  active.current = { path, courseId, view, roundId: selectedRoundId };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; gate.current.cancel(); workspaceGate.current.cancel(); historyGate.current.cancel(); }; }, []);
  useEffect(() => {
    const element = root.current;
    const measure = () => { const next = element?.getBoundingClientRect().width; if (next) setWidth(next); };
    measure();
    if (typeof ResizeObserver !== 'undefined') { const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect(); }
    window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => {
    if (!workspaceId) return;
    const token = workspaceGate.current.next();
    setLoading(true); setWorkspaceError('');
    Promise.resolve().then(() => api.workspace({ workspaceId })).then(result => {
      if (!mounted.current || !workspaceGate.current.current(token)) return;
      setData(result); const initial = initialLocation(result); setCourseId(initial.courseId); setPath(initial.path); setView(initial.view); setSelectedRoundId(initial.roundId || ''); startup.current = true;
    }).catch(error => { if (mounted.current && workspaceGate.current.current(token)) setWorkspaceError(errorMessage(error)); }).finally(() => { if (mounted.current && workspaceGate.current.current(token)) setLoading(false); });
  }, [api, workspaceId]);

  const mutate = useCallback((targetPath, change, persist = false, previousVersion) => {
    const previous = entries.current.get(targetPath);
    const next = typeof change === 'function' ? change(previous) : change;
    if (!next) return;
    entries.current.set(targetPath, next);
    if (persist && !saveDraft(storage(), workspaceId, targetPath, next, previousVersion) && !storageWarning.current) {
      storageWarning.current = true; if (mounted.current) setNotice('浏览器草稿存储不可用。当前内容仍保留在本页，请及时保存到工作区。');
    }
    if (mounted.current) repaint(value => value + 1);
    return next;
  }, [workspaceId]);

  useEffect(() => {
    setSelection(''); setDocumentError('');
    if (!path) { setDocumentLoading(false); return; }
    const token = gate.current.next();
    const cached = entries.current.get(path);
    setDocumentLoading(!cached);
    Promise.resolve().then(() => api.read({ workspaceId, path })).then(result => {
      if (!mounted.current || !gate.current.current(token)) return;
      const latest = entries.current.get(path);
      if (latest) {
        if (latest.saving || latest.snapshot.version !== cached?.snapshot.version || latest.snapshot.version === result.version) return;
        if (hasChanges(latest)) setConflict({ id: operationId(), path, server: result, error: '' });
        else mutate(path, { ...newDocumentEntry(result), recovery: latest.recovery });
        return;
      }
      const next = newDocumentEntry(result);
      next.recovery = readDraft(storage(), workspaceId, path, result.version);
      if (next.recovery && next.recovery.content === result.content && !Object.values(next.recovery.answers).some(v => typeof v === 'string' && v.trim()) && !next.recovery.orphanAnswers?.length) next.recovery = null;
      mutate(path, next);
    }).catch(error => { if (mounted.current && gate.current.current(token)) { if (cached) setNotice(`磁盘文档暂未更新：${errorMessage(error)}`); else setDocumentError(errorMessage(error)); } }).finally(() => { if (mounted.current && gate.current.current(token)) setDocumentLoading(false); });
    return () => gate.current.cancel();
  }, [api, workspaceId, path, mutate]);

  useEffect(() => {
    if (!scroll.current) return;
    if (progressPage) { scroll.current.scrollTop = 0; return; }
    if (!path || !snapshot) return;
    scroll.current.scrollTop = scrollPositions.current.get(scrollKey) || 0;
  }, [scrollKey, !!snapshot, progressPage]);
  useEffect(() => {
    if (progressPage || !selectedRoundId || !snapshot || view !== 'read') return;
    if (selectedRound?.path !== path) return;
    const title = selectedRound.title.trim(), deadline = performance.now() + 10000;
    let frame = 0, attempts = 0;
    const locate = () => {
      // The teaching body is the same Tiptap surface as STG Desk, so the round
      // heading is a live editor node, not a `.stgw-markdown` child. The visual
      // editor mounts in its own effect, so retry for the first frames instead
      // of concluding "no heading" before it exists.
      const root = reader.current;
      const headings = [...(root?.querySelectorAll('.stgw-rich .visual-document :is(h1,h2,h3,h4,h5,h6),.stgw-rich .visual-preserved,.stgw-markdown :is(h1,h2,h3,h4,h5,h6)') || [])];
      const heading = headings.find(node => node.textContent?.trim() === title) || headings.find(node => node.textContent?.includes(title));
      if (heading) { heading.scrollIntoView({ block: 'start', behavior: 'auto' }); return; }
      if (++attempts < 300 && performance.now() < deadline) frame = requestAnimationFrame(locate);
    };
    frame = requestAnimationFrame(locate);
    return () => cancelAnimationFrame(frame);
  }, [selectedRoundId, selectedRound?.path, selectedRound?.title, path, view, !!snapshot, progressPage]);

  function rememberState(patch) {
    if (!startup.current || !api.updateState) return;
    stateWrites.current = stateWrites.current.catch(() => {}).then(() => api.updateState({ workspaceId, patch })).catch(error => {
      if (mounted.current) setNotice(`阅读位置暂未写入工作区：${errorMessage(error)}`);
    });
  }
  function navigate(nextPath, nextCourseId, nextView, nextRoundId) {
    if (!nextPath) return;
    if (scroll.current && !progressPage) scrollPositions.current.set(scrollKey, scroll.current.scrollTop);
    const belongs = courses.find(c => [c.guidePath, c.answerPath, ...c.rounds.map(r => r.path)].includes(nextPath));
    const id = nextCourseId ?? belongs?.id ?? courseId, mode = nextView || 'read';
    if (nextRoundId == null && belongs?.id === id) {
      if (nextPath === belongs.answerPath) nextRoundId = id === courseId ? selectedRoundId : belongs.currentRoundId;
      else if (id === courseId && nextPath === selectedRound?.path) nextRoundId = selectedRoundId;
      else if (nextPath !== belongs.guidePath) {
        const owners = belongs.rounds.filter(item => item.path === nextPath);
        if (owners.length === 1) nextRoundId = owners[0].id;
      }
    }
    setProgressPage(null); setCourseId(id); setPath(nextPath); setView(mode); setSelectedRoundId(nextRoundId || ''); setSelection(null); setNotice(''); setConflict(null); setExternalUpdate(null); setHistory(null); historyGate.current.cancel();
    rememberState({ ...(id ? { lastCourseId: id } : {}), lastDocumentPath: nextPath, lastView: mode });
  }
  // Switching course follows the same rule as entering learning: the recorded
  // current round, then its teaching entry. Historical rounds stay reachable
  // through the round menu, they are just not the default.
  function selectCourse(next) { const target = courseLocation(next); navigate(target.path || next.guidePath || next.rounds[0]?.path || next.answerPath, next.id, 'read', target.roundId); }
  function openProgress(kind) {
    if (scroll.current && !progressPage) scrollPositions.current.set(scrollKey, scroll.current.scrollTop);
    setProgressPage(kind);
  }
  function openGuide() {
    navigate(selectedRound?.path || course?.guidePath || path, courseId, 'read', selectedRoundId);
  }
  function changeView(next) {
    if (next === view && !progressPage) return;
    if (next === 'read') openGuide();
    else navigate(course?.answerPath || path, courseId, next, selectedRoundId);
  }
  function selectRound(item) {
    const mode = progressPage ? 'read' : view;
    const guide = item?.path || course.guidePath || course.answerPath;
    navigate(mode === 'read' ? guide : course.answerPath || guide, courseId, mode, item?.id || '');
  }
  function changeContent(content) { if (selection) setSelection(null); mutate(path, previous => previous && ({ ...previous, content, error: '' }), true); }
  function changeAnswer(id, text) { mutate(path, previous => previous && ({ ...previous, answers: { ...previous.answers, [id]: text }, error: '' }), true); }

  async function obtainConflict(targetPath, error) {
    if (!mounted.current || active.current.path !== targetPath) return;
    const id = operationId();
    setConflict({ id, path: targetPath, server: null, error: error?.code === 'VERSION_CONFLICT' ? '' : errorMessage(error) });
    try {
      const server = await api.read({ workspaceId, path: targetPath });
      if (mounted.current) setConflict(previous => previous?.id === id ? { ...previous, server } : previous);
    } catch (readError) { if (mounted.current) setConflict(previous => previous?.id === id ? { ...previous, error: errorMessage(readError) } : previous); }
  }
  async function mutateDocument(kind, targetPath, payload, submittedContent, submittedAnswers = []) {
    const original = entries.current.get(targetPath);
    if (!original || original.saving) return null;
    const retry = original.retry;
    const request = { workspaceId, path: targetPath, expectedVersion: original.snapshot.version, ...payload };
    const id = retry?.kind === kind && same(retry.request, request) ? retry.operationId : operationId();
    mutate(targetPath, previous => ({ ...previous, saving: true, error: '', retry: { kind, request, operationId: id } }));
    try {
      const result = await api[kind]({ ...request, operationId: id });
      if (!mounted.current) return result;
      mutate(targetPath, previous => ({ ...acceptSave(previous, { content: submittedContent, answers: submittedAnswers }, result), retry: null, recovery: null }), true, original.snapshot.version);
      setExternalUpdate(previous => previous?.path === targetPath ? null : previous);
      setNotice(hasChanges(entries.current.get(targetPath)) ? '本次内容已保存，保存期间的新改动仍保留为草稿。' : '已保存到工作区。');
      return result;
    } catch (error) {
      if (mounted.current) {
        mutate(targetPath, previous => ({ ...previous, saving: false, error: errorMessage(error) }));
        if (error?.code === 'VERSION_CONFLICT' || error?.status === 409) await obtainConflict(targetPath, error);
      }
      return null;
    }
  }
  async function saveSource(targetPath = path) {
    const current = entries.current.get(targetPath);
    if (!current || current.saving) return null;
    if (current.content === current.snapshot.content) return current.snapshot;
    return mutateDocument('save', targetPath, { content: current.content }, current.content);
  }
  async function saveAll(targetPath = path) {
    if (readOnlyAnswer) return null;
    let current = entries.current.get(targetPath);
    if (!current || current.saving) return null;
    if (current.content !== current.snapshot.content && !(await saveSource(targetPath))) return null;
    current = entries.current.get(targetPath);
    if (!Object.values(current.answers).some(v => typeof v === 'string' && v.trim())) return current.snapshot;
    try {
      const answers = answersToSave(current.answers, current.snapshot);
      return mutateDocument('answer', targetPath, { answers }, current.content, answers);
    } catch (error) { mutate(targetPath, previous => ({ ...previous, error: errorMessage(error) })); return null; }
  }
  async function ask(intent, selectedText = '') {
    if (!mentor.onAsk || askPending.current || mentor.busy || !snapshot) return;
    askPending.current = true;
    const quoted = asText(selectedText);
    setAsking(true); setNotice('');
    const targetPath = path, targetCourse = course, targetRound = round, targetRoundId = selectedRoundId;
    try {
      let document = snapshot;
      if (intent === 'assess') {
        document = await saveAll(targetPath);
        if (!document) return;
        const latest = entries.current.get(targetPath);
        if (hasChanges(latest)) { setNotice('保存期间还有新改动。请先保存这些改动，再准备导师评估。'); return; }
      }
      if (!mounted.current || active.current.path !== targetPath || active.current.roundId !== targetRoundId) return;
      await mentor.onAsk({ intent, course: targetCourse, document, round: targetRound, ...(quoted ? { selection: quoted } : {}) });
      if (mounted.current) {
        setSelection(null);
        setNotice(intent === 'assess' ? '评估请求已准备。请在导师会话中检查后发送。' : '问题已放入老师窗口，检查后再发送。');
      }
    } catch (error) { if (mounted.current) setNotice(errorMessage(error)); }
    finally { askPending.current = false; if (mounted.current) setAsking(false); }
  }
  function reloadFromConflict() {
    if (!conflict?.server) return;
    const old = entries.current.get(conflict.path);
    if (old && hasChanges(old)) saveDraft(storage(), workspaceId, conflict.path, old);
    mutate(conflict.path, { ...newDocumentEntry(conflict.server), recovery: old && hasChanges(old) ? { ...draftRecord(old), outdated: true } : null });
    setConflict(null); setExternalUpdate(null); setNotice('已读取磁盘版本。原草稿仍可从上方提示恢复。');
  }
  function recoverDraft() {
    const recovery = entry?.recovery;
    if (!recovery) return;
    mutate(path, recoverEntryDraft, true);
    setNotice(recovery.outdated ? '已恢复旧版本草稿。请与最新文档核对后保存；原始文件尚未修改。' : '草稿已恢复，保存后会写入工作区。');
  }
  function dismissDraft() {
    try { if (entry?.recovery) storage()?.removeItem(entry.recovery.key || draftKey(workspaceId, path, entry.recovery.version)); } catch { /* The draft stays recoverable if storage fails. */ }
    mutate(path, previous => ({ ...previous, recovery: null }));
  }
  function checkDocument(options) { return documentRunner.current(options); }
  async function checkDocumentBody({ quiet = false } = {}) {
    const targetPath = active.current.path, previous = entries.current.get(targetPath);
    if (!targetPath || !previous || previous.saving) return;
    try {
      const result = await api.read({ workspaceId, path: targetPath });
      if (!mounted.current || active.current.path !== targetPath) return;
      const latest = entries.current.get(targetPath);
      if (latest.saving || latest.snapshot.version !== previous.snapshot.version) return;
      const update = reconcileExternal(latest, result);
      if (update.action === 'same') { setExternalUpdate(previous => previous?.path === targetPath ? null : previous); if (!quiet) setNotice('当前文档已是磁盘上的最新版本。'); return; }
      if (update.action === 'retain') {
        if (quiet) setExternalUpdate(previous => previous?.path === targetPath && previous.server?.version === result.version ? previous : { path: targetPath, server: result });
        else setConflict({ id: operationId(), path: targetPath, server: result, error: '' });
      } else if (update.action === 'replace') { mutate(targetPath, update.entry); setExternalUpdate(previous => previous?.path === targetPath ? null : previous); if (!quiet) setNotice('已读取导师或其他窗口的最新修改。'); }
    } catch (error) { if (!quiet && mounted.current) setNotice(errorMessage(error)); }
  }
  checkDocumentNow.current = checkDocumentBody;
  const checkDocumentRef = useRef(checkDocument); checkDocumentRef.current = checkDocument;

  function refreshWorkspace(options) {
    // Show progress at once, even while a background check finishes first.
    if (!options?.quiet && workspaceId) setRefreshing(true);
    return workspaceRunner.current(options);
  }
  async function refreshWorkspaceBody({ quiet = false } = {}) {
    if (!workspaceId) return;
    if (!quiet) setRefreshing(true); const token = workspaceGate.current.next();
    try {
      const result = await api.workspace({ workspaceId });
      if (!mounted.current || !workspaceGate.current.current(token)) return;
      setData(previous => same(previous, result) ? previous : result); setWorkspaceError('');
      if (!active.current.path) { const initial = initialLocation(result); setCourseId(initial.courseId); setPath(initial.path); setView(initial.view); setSelectedRoundId(initial.roundId || ''); startup.current = true; }
      else if (!quiet) await checkDocument();
    } catch (error) { if (!quiet && mounted.current) { if (!data) setWorkspaceError(errorMessage(error)); else setNotice(errorMessage(error)); } }
    finally { if (mounted.current) { if (!quiet) setRefreshing(false); setLoading(false); } }
  }
  refreshWorkspaceNow.current = refreshWorkspaceBody;
  const refreshWorkspaceRef = useRef(refreshWorkspace); refreshWorkspaceRef.current = refreshWorkspace;
  useEffect(() => {
    if (!workspaceId) return;
    const foreground = () => document.visibilityState !== 'hidden' && mounted.current && startup.current;
    const inspectDocument = () => { if (foreground()) void checkDocumentRef.current({ quiet: true }); };
    const inspectWorkspace = () => { if (foreground()) void refreshWorkspaceRef.current({ quiet: true }); };
    const resume = () => { inspectDocument(); inspectWorkspace(); };
    const documentTimer = window.setInterval(inspectDocument, 5000), workspaceTimer = window.setInterval(inspectWorkspace, 15000);
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(documentTimer); clearInterval(workspaceTimer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [workspaceId]);
  async function openHistory() {
    if (!snapshot) return;
    const targetPath = path, token = historyGate.current.next();
    setHistory({ path: targetPath, items: [], loading: true, preview: null });
    try {
      const result = await api.history({ workspaceId, path: targetPath });
      if (mounted.current && historyGate.current.current(token)) setHistory(previous => ({ ...previous, items: Array.isArray(result.items) ? result.items : [], loading: false }));
    } catch (error) { if (mounted.current && historyGate.current.current(token)) setHistory(previous => ({ ...previous, loading: false, error: errorMessage(error) })); }
  }
  function closeHistory() { historyGate.current.cancel(); setHistory(null); }
  async function selectHistory(id) {
    const targetPath = history?.path, token = historyGate.current.next();
    setHistory(previous => ({ ...previous, selectedId: id, preview: null, previewLoading: true, error: '' }));
    try {
      const result = await api.historyRead({ workspaceId, path: targetPath, id });
      if (mounted.current && historyGate.current.current(token)) setHistory(previous => ({ ...previous, preview: result.content, previewLoading: false }));
    } catch (error) { if (mounted.current && historyGate.current.current(token)) setHistory(previous => ({ ...previous, previewLoading: false, error: errorMessage(error) })); }
  }
  async function restoreHistory() {
    if (!history?.selectedId || history.restoring) return;
    const targetPath = history.path, old = entries.current.get(targetPath), id = history.selectedId, token = historyGate.current.next();
    if (!old || old.saving) return;
    setHistory(previous => ({ ...previous, restoring: true, error: '' }));
    if (hasChanges(old)) saveDraft(storage(), workspaceId, targetPath, old);
    mutate(targetPath, previous => ({ ...previous, saving: true }));
    try {
      const result = await api.restore({ workspaceId, path: targetPath, id, expectedVersion: old.snapshot.version, operationId: operationId() });
      if (!mounted.current) return;
      const latest = entries.current.get(targetPath), editedDuringRestore = latest.content !== old.content || !same(latest.answers, old.answers);
      if (editedDuringRestore) mutate(targetPath, { ...latest, snapshot: result, saving: false, error: '' }, true);
      else mutate(targetPath, { ...newDocumentEntry(result), recovery: hasChanges(old) ? { ...draftRecord(old), outdated: true } : null });
      if (historyGate.current.current(token)) closeHistory();
      if (active.current.path === targetPath) setNotice(editedDuringRestore ? '历史版本已恢复到磁盘，恢复期间的改动仍保留为草稿。' : '历史版本已恢复，恢复前的文件已备份。');
    } catch (error) {
      if (!mounted.current) return;
      mutate(targetPath, previous => ({ ...previous, saving: false }));
      if (historyGate.current.current(token)) setHistory(previous => previous && ({ ...previous, restoring: false, error: errorMessage(error) }));
      if (error?.code === 'VERSION_CONFLICT' || error?.status === 409) { if (historyGate.current.current(token)) closeHistory(); await obtainConflict(targetPath, error); }
    }
  }

  function captureSelection() {
    const next = readSelection(window.getSelection?.(), reader.current);
    if (!next) { setSelection(null); return; }
    // A new range replaces the previous anchor outright: the toolbar's
    // sequence token discards any pending placement for the old selection.
    setSelection(next);
  }
  const clearSelection = useCallback(() => setSelection(null), []);
  const selectionError = useCallback(message => { setSelection(null); setNotice(message); }, []);
  useEffect(clearSelection, [path, view, progressPage, clearSelection]);
  useEffect(() => {
    // A toolbar anchored to a Range must not outlive the nodes it measured.
    if (!selection) return;
    const drop = event => {
      const target = event.target;
      if (target?.closest?.('.stgt-selection')) return;
      if (target?.closest?.('.stgw-rich,.visual-document')) return;
      clearSelection();
    };
    const onSelectionChange = () => {
      if (document.activeElement?.closest?.('.stgt-selection')) return;
      const live = window.getSelection?.();
      if (!live || live.isCollapsed || !reader.current?.contains(live.anchorNode) || !reader.current.contains(live.focusNode)) clearSelection();
    };
    document.addEventListener('pointerdown', drop, true);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => { document.removeEventListener('pointerdown', drop, true); document.removeEventListener('selectionchange', onSelectionChange); };
  }, [!!selection, clearSelection]);
  const workspace = data?.workspace || workspaces.find(w => w.workspaceId === workspaceId);
  const profilePath = asText(data?.profile?.path), dirty = hasChanges(entry);
  const mentorVisible = !!mentor.visible;
  const recordBlocks = snapshot?.records?.blocks;
  const courseTitle = path === profilePath ? '学习档案' : course?.title || titleOf(path) || '学习工作台';

  return <section className="stgw-root" ref={root} aria-label="STG 学习工作台" data-stg-workbench="" data-testid="stg-workbench" data-compact={compact} data-narrow={narrow} data-mobile={mobile} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.isComposing && !event.nativeEvent?.isComposing) { event.preventDefault(); event.stopPropagation(); if (!progressPage) saveAll(); }
    else if (event.key === 'Escape' && !history && !conflict) { if (selection) { event.stopPropagation(); setSelection(null); } }
  }}>
    <style>{workbenchCSS}{learningLibraryCSS}{lessonNavigationCSS}{experienceCSS}{coursePickerCSS}</style>
    <header className="stgw-header">{onOpenLibrary ? <button title="返回 StepsToGreat 学习空间" onClick={onOpenLibrary}><Icon name="book" size={15}/>学习空间</button> : <span className="stgw-header-label">学习</span>}<span className="stgw-header-divider"/><span className="stgw-space-title" title={workspace?.path}>{workspace?.title || basename(workspace?.path)}</span><span className="stgw-spacer"/>{onManageSessions && <button className="stgw-session-link" title="管理课程关联的 DSH 会话" onClick={onManageSessions}><Icon name="history" size={14}/><span className="stgw-action-label">学习会话</span></button>}{onBack && <button className="stgw-icon stgw-header-back" title="返回 DSH 对话" aria-label="返回 DSH 对话" onClick={onBack}><Icon name="back"/></button>}</header>
    {!workspaceId ? <Empty title="选择你的学习工作区">在 DSH 中添加 StepsToGreat 或已有课程文件夹。教学、作答和学习记录会直接保存在这个文件夹中。</Empty> : loading ? <div className="stgw-skeleton" role="status" aria-label="正在读取学习工作区"><span/><span/><span/><span/><div className="stgw-loading-label">正在恢复课程与文档记录…</div></div> : workspaceError && !data ? <Empty title="工作区暂时无法读取" actions={<button className="stgw-outline-button" onClick={refreshWorkspace}>重新读取</button>}>{workspaceError}</Empty> : <div className="stgw-layout">
      <main className="stgw-main">
        <LessonAccessBar courses={courses} course={course} currentCourseId={data?.current?.courseId} path={path} roundId={selectedRoundId} progressPage={progressPage} onRound={selectRound} onCourse={next => next && selectCourse(next)} onGuide={openGuide} onAnswer={() => changeView('answer')} onProgress={openProgress}/>
        <div className="stgw-main-tools">{!progressPage ? <ViewTabs view={view} onChange={changeView}/> : <span className="stgw-muted">学习进度</span>}<div className="stgw-doc-actions">{!progressPage && snapshot && !readOnlyAnswer && <><SaveState saving={entry.saving} dirty={dirty}/>{view === 'read' && editorReady && editorApi.current && <button className="stgw-icon" title="在光标处插入公式" aria-label="插入公式" onClick={() => editorApi.current?.insertFormula?.()}><Icon name="formula" size={15}/></button>}<button className="stgw-icon" title="文档历史" aria-label="查看文档历史" onClick={openHistory}><Icon name="history" size={15}/></button><button className="stgw-icon" title="保存所有改动（Ctrl+S）" aria-label="保存所有改动" aria-busy={!!entry.saving} disabled={entry.saving || !dirty} onClick={() => saveAll()}><Icon name={entry.saving ? "refresh" : "save"} className={entry.saving ? "stgw-spinning" : undefined} size={15}/></button></>}<button className="stgw-icon" title="刷新课程与磁盘文档" aria-label="刷新课程与磁盘文档" aria-busy={refreshing} disabled={refreshing} onClick={refreshWorkspace}><Icon name="refresh" className={refreshing ? "stgw-spinning" : undefined} size={14}/></button>{mentor.onToggle && !mentorVisible && <button className={mentorVisible ? 'stgw-selected' : ''} aria-expanded={mentorVisible} title="打开身边的老师" onClick={() => mentor.onToggle(context)}><Icon name="chat" size={15}/><span className="stgw-save-label">老师</span></button>}</div></div>
        {notice && <div className="stgw-note" role="status"><div>{notice}</div><button className="stgw-icon" aria-label="关闭提示" onClick={() => setNotice('')}><Icon name="close" size={13}/></button></div>}
        {!readOnlyAnswer && entry?.error && <div className="stgw-note" data-tone="error" role="alert"><div>{entry.error}</div></div>}
        {!readOnlyAnswer && externalUpdate?.path === path && <div className="stgw-note" data-tone="warning" role="status"><div><p>导师或其他窗口更新了这份文档。你的草稿与作答已保留。</p><div className="stgw-note-actions"><button className="stgw-outline-button" onClick={() => setConflict({ ...externalUpdate, id: operationId(), error: '' })}>对照最新内容</button></div></div></div>}
        {!readOnlyAnswer && !!entry?.orphanAnswers?.length && <div className="stgw-note" data-tone="warning" role="status"><div><p>题目在保存时发生变化，以下作答仍然保留。请复制到对应的新题目或完整文档后，再关闭提示。</p>{entry.orphanAnswers.map((answer, index) => <details className="stgw-previous" key={index}><summary>{asText(answer.round)} · {asText(answer.title) || '待归属作答'}</summary><textarea readOnly aria-label={`保留的作答 ${index + 1}`} value={answer.text} style={{ width: '100%', minHeight: 100 }}/></details>)}<button className="stgw-outline-button" onClick={() => mutate(path, previous => ({ ...previous, orphanAnswers: [] }), true)}>已取回这些作答，关闭提示</button></div></div>}
        {!courses.length && !loading && <section className="stgw-start-guide" aria-label="初始学习引导"><strong>学习空间已就绪，先和导师确定学习目标。</strong><p>完整框架和初始档案已准备好。接下来依次完成目标交流 → 摸底 → 学习路线 → 第一课。课程和掌握程度以真实教学记录为准。</p>{mentor.onAsk && <button disabled={mentor.busy} onClick={() => mentor.onAsk({ ...context, intent: 'initialize' })}><Icon name="chat" size={14}/>准备初始学习交流</button>}</section>}
        {!readOnlyAnswer && entry?.recovery && <div className="stgw-note" data-tone="warning" role="status"><div><p>{entry.recovery.outdated ? '发现来自旧版本的未保存草稿。恢复前请留意导师的最新修改。' : '上次离开时有未保存的草稿。'}<span className="stgw-muted"> {readableDate(entry.recovery.updatedAt)}</span></p><div className="stgw-note-actions"><button className="stgw-outline-button" onClick={recoverDraft}>恢复草稿</button><button onClick={dismissDraft}>忽略此草稿</button></div></div></div>}
        <div className="stgw-scroll" data-reading={!progressPage && view === 'read'} ref={scroll} id="stgw-view-panel" role={progressPage ? 'region' : 'tabpanel'} aria-label={progressPage ? (progressPage === 'chapter' ? '当前章节进度' : '总体进度') : undefined} aria-labelledby={progressPage ? undefined : `stgw-view-${view}`} tabIndex={0} onMouseUp={captureSelection} onKeyUp={event => { if (event.key === 'Shift' || event.key === 'Escape') captureSelection(); }}>
          {progressPage ? <LearningProgressPage kind={progressPage} data={data} course={course} workspaceId={workspaceId} onOpenProfile={() => navigate(profilePath, courseId, 'read')} onNavigate={navigate}/> : documentLoading ? <ReadingSkeleton/> : documentError ? <Empty title="这份文档暂时无法打开" actions={<button className="stgw-outline-button" onClick={() => { const currentPath = path; setPath(''); requestAnimationFrame(() => { if (mounted.current) setPath(currentPath); }); }}>重新读取文档</button>}>{documentError}</Empty> : !snapshot ? <Empty title={courses.length ? '选择一份课程文档' : '从当前工作区开始学习'} actions={<>{mentor.onAsk && <button className="stgw-outline-button" onClick={() => mentor.onToggle?.(context)}><Icon name="chat" size={14}/>打开学习导师</button>}<button onClick={refreshWorkspace}>重新扫描课程</button></>}>{courses.length ? '从顶部打开教学与回答，或在左侧选择轮次。' : '这里会识别已有的教学、学生回答与学习档案。你可以在原生导师会话中开始一门课程，生成文档后刷新工作台。'}</Empty> : <div className="stgw-content" ref={reader}>
            <header className="stgw-reader-header">
              <div className="stgw-lesson-eyebrow"><span>{course?.subject || (path === profilePath ? '个人学习档案' : '学习资料')}</span>{round && <><span> / </span><span className="stgw-round-tag">{round}</span></>}{course && data?.current?.courseId === courseId && <span>· 当前课程</span>}</div>
              <div className="stgw-lesson-heading"><h1 className="stgw-lesson-title">{courseTitle}</h1></div>
              {!embedded && <p className="stgw-lesson-context">{readOnlyAnswer ? '查看这一轮留存的作答。' : view === 'answer' ? '用自己的话表达理解，再把这一轮交给导师。' : view === 'review' ? '沿着原始作答与导师反馈，回看理解是怎样改变的。' : asText(data?.current?.nextAction) || '沿着教学内容继续，把不确定的地方交给导师。'}</p>}
              {!answerMissing && <div className="stgw-file-label"><Icon name="file" size={12}/><span title={path}>{path}</span><button onClick={() => checkDocument()} title="检查外部修改">检查更新</button></div>}
            </header>
            {readOnlyAnswer ? roundAnswer ? <>
              <div className="stgw-review-intro">本轮作答记录 · 只读</div>
              <Markdown content={roundAnswer} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/>
              {view === 'review' && mentor.onAsk && <div className="stgw-review-actions"><button className="stgw-outline-button" disabled={asking || mentor.busy} onClick={() => ask('review')}>请导师带我复习</button></div>}
            </> : <Empty title="本轮暂无作答记录">{answerMissing ? '这门课还没有学生回答文档。' : '学生回答文档中没有识别到这一轮的题目或作答。'}</Empty>
            : view === 'read' ? renderDocumentEditor ? <SectionBoundary resetKey={path} label="编辑器暂时无法显示，已保留下方完整 Markdown 源文。" fallback={<SourceEditor content={entry.content} path={path} onChange={changeContent}/>}>{renderDocumentEditor({ content: entry.content, path, workspaceId, onChange: changeContent, onOpenDocument: navigate, onEditorReady: api => { editorApi.current = api; if (mounted.current) setEditorReady(!!api); }, readOnly: false })}</SectionBoundary> : <SectionBoundary resetKey={`${path}:${snapshot.version}`} fallback={<pre>{entry.content}</pre>}><Markdown content={entry.content} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/></SectionBoundary> : view === 'answer' ? <><div className="stgw-review-intro">{questions.length ? `${round || '当前轮'} · ${questions.length} 道题。每次保存追加一份新作答，原始尝试与导师栏目完整保留。` : '这份文档尚未识别到 1–3 道当前轮题目。你可以阅读原文，或直接编辑完整文档。'}</div>{questions.length ? questions.map((question, index) => <SectionBoundary key={question.id} resetKey={`${path}:${snapshot.version}`} label="这道题暂时无法排版，请在完整文档中作答。"><Question question={question} index={index} text={asText(entry.answers[question.id])} onChange={text => changeAnswer(question.id, text)} path={path} workspaceId={workspaceId} onNavigate={navigate}/></SectionBoundary>) : <Markdown content={roundAnswer || entry.content} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/>}
              <div className="stgw-answer-footer"><p>草稿留在本页。保存后写入学生回答；评估请求需在原生会话中确认发送。</p><button className="stgw-outline-button" aria-busy={!!entry.saving} disabled={entry.saving || !dirty} onClick={() => saveAll()}>{entry.saving ? <><span className="stgw-spinner" aria-hidden="true"/>正在保存…</> : '保存作答'}</button>{mentor.onAsk && <button className="stgw-primary" disabled={entry.saving || asking || mentor.busy} onClick={() => ask('assess')}><Icon name="send" size={13}/>{asking ? '正在准备…' : '保存并准备评估'}</button>}</div><details className="stgw-record" style={{ marginTop: 28 }}><summary>完整原文与导师栏目<small>包含所有轮次</small></summary><div className="stgw-record-body"><Markdown content={entry.content} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/></div></details></> : view === 'review' ? <><div className="stgw-review-intro">以下按文件原有顺序呈现作答与导师反馈。掌握状态以文档中的评估为准。</div>{roundAnswer ? <Markdown content={roundAnswer} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/> : Array.isArray(recordBlocks) && recordBlocks.some(block => block.kind !== 'preamble') && entry.content === snapshot.content ? recordBlocks.filter(block => typeof block.content === 'string' && block.content.trim()).map((block, index) => <details className="stgw-record" key={`${block.start}:${index}`} open={block.kind === 'final' || index === recordBlocks.length - 1}><summary>{asText(block.title) || (block.kind === 'preamble' ? '文档说明' : '作答记录')}<small>{block.kind === 'final' ? '导师复评与解析' : block.kind === 'round' ? '原始作答 · 导师反馈' : '原文'}</small></summary><div className="stgw-record-body"><Markdown content={block.content} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/></div></details>) : <Markdown content={entry.content} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/>}{mentor.onAsk && <div className="stgw-review-actions"><button className="stgw-outline-button" disabled={asking || mentor.busy} onClick={() => ask('review')}>请导师带我复习</button><button className="stgw-primary" disabled={asking || mentor.busy} onClick={() => ask('continue')}>准备下一步学习</button></div>}</> : <SectionBoundary resetKey={`${path}:${snapshot.version}`} fallback={<pre>{entry.content}</pre>}><Markdown content={entry.content} path={path} workspaceId={workspaceId} onOpenDocument={navigate}/></SectionBoundary>}
            <div className="stgw-bottom-hint"><Icon name="check" size={12}/><span>{dirty && !readOnlyAnswer ? '仍有草稿未写入文件' : '内容来自工作区文件'} · 学习状态以导师记录为准</span>{mentor.onAsk && <button disabled={asking || mentor.busy} onClick={() => ask('ask')}><Icon name="chat" size={13}/>问导师</button>}</div>
            {Array.isArray(data?.warnings) && !!data.warnings.length && <details className="stgw-previous"><summary>工作区读取提示（{data.warnings.length}）</summary><ul>{data.warnings.map((warning, index) => <li key={index}>{asText(warning?.message) || asText(warning)}</li>)}</ul></details>}
          </div>}
        </div>
        {selection && mentor.onAsk && <SelectionToolbar anchor={selection} viewport={scroll} busy={mentor.busy} asking={asking} onAsk={intent => ask(intent, selection.text)} onDismiss={clearSelection} onError={selectionError}/>}
      </main>
    </div>}
    {conflict && <ConflictDialog conflict={conflict} entry={entries.current.get(conflict.path)} onClose={() => setConflict(null)} onReload={reloadFromConflict} onRetry={() => obtainConflict(conflict.path, {})}/>}
    {history && <HistoryDialog history={history} entry={entries.current.get(history.path)} workspaceId={workspaceId} onClose={closeHistory} onSelect={selectHistory} onRestore={restoreHistory}/>}
  </section>;
}

function SourceEditor({ content, path, onChange }) { return <textarea className="stgw-source" aria-label={`Markdown 完整文档：${basename(path)}`} value={content} spellCheck={false} onChange={event => onChange(event.target.value)}/>; }
function Question({ question, index, text, onChange, path, workspaceId, onNavigate }) {
  const id = `stgw-answer-${question.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return <section className="stgw-question" aria-label={question.title}><div className="stgw-question-heading"><span className="stgw-question-number">{String(index + 1).padStart(2, '0')}</span><h2>{question.title}</h2></div><Markdown content={question.prompt} path={path} workspaceId={workspaceId} onOpenDocument={onNavigate}/>{question.answer.value && <details className="stgw-previous"><summary>查看上一次作答</summary><pre>{question.answer.value}</pre></details>}<label className="stgw-answer-label" htmlFor={id}>这一轮，我的回答<span>{text.length ? `${text.length} 字` : '支持代码与 Markdown'}</span></label><textarea id={id} value={text} placeholder="用自己的话写下思路、理由或代码…" onChange={event => onChange(event.target.value)} spellCheck={false}/></section>;
}
