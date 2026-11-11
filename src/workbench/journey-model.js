import { flattenFiles, initialLocation, normalizeCourses } from './model.js';
import { CLARIFY_START_NOTE, DIRECT_START_NOTE, EMPTY_DIRECT_NOTE, SAVED_CONTINUE_HINT, SAVED_OPENING_NOTE, SAVED_OPENING_STALE, SAVED_RESTART_EMPTY, SAVED_RESTART_HINT } from '../start-guidance.js';

export const SETUP_MODES = ['clarify', 'direct'];
export const SETUP_STEPS = [
  { id: 'clarify', title: '聊清目标', detail: '已有信息不重问，关键选择由你确认。' },
  { id: 'explore', title: '先试一个小问题', detail: '从具体场景开始，不急着读长课件。' },
  { id: 'placement', title: '找到真实起点', detail: '只补必要的摸底，够定起点就停。' },
  { id: 'plan', title: '一起确定路线', detail: '依据实际回答安排前几课。' },
];

/** Setup preferences are not a second progress record or assessment source. */
export function normalizeSetup(value) {
  return { mode: SETUP_MODES.includes(value?.mode) ? value.mode : 'direct', brief: typeof value?.brief === 'string' ? value.brief.slice(0, 2000) : '' };
}
export const setupKey = workspaceId => `stg-learning.setup.v1:${workspaceId}`;
export function readSetup(storage, workspaceId) {
  try { return normalizeSetup(JSON.parse(storage?.getItem(setupKey(workspaceId)) || 'null')); }
  catch { return normalizeSetup(null); }
}
export function saveSetup(storage, workspaceId, value) {
  try { storage?.setItem(setupKey(workspaceId), JSON.stringify(normalizeSetup(value))); } catch { /* Optional UI draft only. */ }
}

/** File existence describes available evidence, never successful completion. */
export function deriveJourney(overview) {
  const courses = normalizeCourses(overview?.courses);
  const location = overview ? initialLocation(overview) : {};
  const course = courses.find(row => row.id === location.courseId) || null;
  const files = flattenFiles(overview?.tree);
  const placement = files.find(file => /(?:^|\/)00[-_]摸底测试\.(?:md|markdown)$/i.test(file.path));
  const route = files.find(file => /(?:^|\/)00[-_]课程路线\.(?:md|markdown)$/i.test(file.path));
  const phase = course ? 'learning' : route ? 'plan' : placement ? 'placement' : 'clarify';
  const phaseLabel = { learning: '已有课程', plan: '已有路线记录', placement: '已有摸底记录', clarify: '还没有课程' }[phase];
  const courseKey = course?.id || '_workspace';
  return {
    phase, phaseLabel, course,
    context: { course, round: course?.rounds?.find(round => round.id === course.currentRoundId)?.title || '' },
    savedSessionId: overview?.state?.courseSessions?.[courseKey] || overview?.state?.courseSessions?._workspace || null,
    nextAction: phase !== 'clarify' && typeof overview?.current?.status === 'string' ? overview.current.status : '',
    placementPath: placement?.path || null, routePath: route?.path || null,
  };
}

/**
 * The opening page's explicit choice when a saved conversation already exists.
 *
 * A saved conversation is only "continue"-able while the host still lists it in
 * this Workspace; a stale binding (archived or deleted elsewhere) must not look
 * like a conversation the buttons can reopen. Restart is always available and
 * only applies the edited topic when the learner actually presses it.
 */
export function deriveOpeningPlan({ savedSessionId, savedAvailable = true, brief = '', mode = 'direct' } = {}) {
  const saved = typeof savedSessionId === 'string' && savedSessionId ? savedSessionId : '';
  const usable = Boolean(saved && savedAvailable);
  const hasBrief = typeof brief === 'string' && brief.trim() !== '';
  return {
    savedSessionId: saved,
    canContinue: usable,
    // A stale or archived binding is reported, not silently offered.
    stale: Boolean(saved && !savedAvailable),
    canRestart: true,
    continueHint: SAVED_CONTINUE_HINT,
    restartHint: mode === 'clarify' ? CLARIFY_START_NOTE : hasBrief ? SAVED_RESTART_HINT : SAVED_RESTART_EMPTY,
    openingNote: SAVED_OPENING_NOTE,
    staleNote: SAVED_OPENING_STALE,
    startNote: mode === 'clarify' ? CLARIFY_START_NOTE : hasBrief ? DIRECT_START_NOTE : EMPTY_DIRECT_NOTE,
  };
}