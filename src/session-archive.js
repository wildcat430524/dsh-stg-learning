/**
 * Honest names and messages for the Host's recoverable session archive.
 *
 * DSH 0.2.2-rc.1 exposes archive/unarchive only: there is no permanent delete
 * RPC. The UI therefore says "移出列表" and always offers the archive set back;
 * it never calls this deletion or claims the transcript is gone.
 */
export const ARCHIVE_UNAVAILABLE = '当前 DSH 版本没有提供可恢复的会话归档，无法移出老师对话。';
export const ARCHIVE_KEEP_NOTE = '对话、历史和草稿都会保留，可在“已移出”里恢复；本机 DSH 没有永久删除接口。';
export const ARCHIVE_ACTIVE_NOTE = '这段对话还在回答。移出前需要停止它当前的工作；被停止的回答不会自动继续。';

export function archiveTitle(row) {
  const title = typeof row?.label === 'string' && row.label.trim() ? row.label.trim() : typeof row?.title === 'string' ? row.title.trim() : '';
  return title || '这段老师对话';
}

export function archiveErrorCode(error) {
  return error?.rpcError?.code || error?.code || '';
}

/** A user-facing message for every archive/restore failure; never claims success. */
export function archiveFailureMessage(error) {
  const code = archiveErrorCode(error);
  if (code === 'workspace/session-active' || code === 'SESSION_ACTIVE') return '这段对话还在回答，等它结束后再移出；对话和草稿没有改动。';
  if (code === 'session/not-found' || code === 'SESSION_MISSING') return '宿主里已经找不到这段对话，可能已在别处删除；没有改动其他对话。';
  if (code === 'ARCHIVE_UNAVAILABLE') return ARCHIVE_UNAVAILABLE;
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (!message || /^workspace session archive failed:/.test(message)) return '没有移出这段对话，当前对话和草稿未变，请重试。';
  return message;
}

/**
 * The `courseSessions` patch that drops only the mappings pointing at one
 * Session. Null means "delete this key" in the workbench state writer, so no
 * other course, document or progress field is touched.
 */
export function unboundCourseSessions(courseSessions, sessionId) {
  const patch = {};
  if (!courseSessions || typeof courseSessions !== 'object' || !sessionId) return patch;
  for (const [courseId, value] of Object.entries(courseSessions)) if (value === sessionId) patch[courseId] = null;
  return patch;
}
