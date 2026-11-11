/**
 * Opening copy shared by the guide and the staged native draft.
 *
 * The page must never promise a different start from the text that actually
 * lands in the composer, so both sides call these functions instead of keeping
 * two paraphrases. Nothing here sends a message or records progress.
 */
export const EMPTY_START_BRIEF = '我想开始学习，还没确定具体目标。';

export const DIRECT_START_NOTE = '按你写的直接开始：有问题先解答，有任务先给第一步；需要时才举例，信息不足就只问一个必要的问题。';
export const CLARIFY_START_NOTE = '一次聊一个问题，老师给建议，由你决定。';
export const EMPTY_DIRECT_NOTE = '还没写主题也没关系，老师会先问一个最要紧的问题。';
export const SAVED_OPENING_NOTE = '原来的对话和草稿都保留。这里改过的主题只在“用新主题重新开始”时使用。';
export const SAVED_OPENING_DIRTY = '主题已修改：只有“用新主题重新开始”会应用它；“继续原对话”不会改动原来的对话。';
export const SAVED_OPENING_STALE = '上次保存的对话已不在这个学习空间；打开后会开始一段新的对话。';
export const SAVED_CONTINUE_HINT = '继续保留原对话和输入内容。';
export const SAVED_RESTART_HINT = '新建一段对话，旧对话和草稿都不动。';
export const SAVED_RESTART_EMPTY = '不写主题也可以：老师会先问一个最要紧的问题，再一起定起点。';

/** Trim the learner's own words; fall back only when they truly wrote nothing. */
export function normalizeStart(setup) {
  const brief = typeof setup?.brief === 'string' ? setup.brief.trim().slice(0, 2000) : '';
  return { brief, text: brief || EMPTY_START_BRIEF };
}

/** The explicit "help me clarify" option stays its own path. */
export function clarifyStartDirection() {
  return '请帮我理清目标，一次聊一个问题，给我建议，由我决定。';
}

/**
 * A direct start uses what the learner already supplied. A concrete question is
 * answered first, a task gets its first step, and a bare topic is taught from a
 * sensible first step. Examples are optional; the single question is reserved
 * for information that actually decides where to begin.
 */
export function directStartDirection(brief) {
  return brief
    ? '请直接接着上面的内容开始，不用再确认。有具体问题先解答，有任务先给出第一步，只给了主题就结合我说的基础讲合适的第一步；需要时再举例，不要固定用故事或算术题开场，也不用先考我。只有缺少决定从哪里开始的信息时，才问我一个必要的问题。'
    : '请先问我一个最要紧的问题，帮我确定从哪里开始；如果已经能从我的回答看出方向，就直接给出第一步。';
}
