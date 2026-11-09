// Pure decisions shared by the visual document editor. Keeping them outside the
// React component makes the "never remount while typing" rule testable without
// a browser.
//
// `current` is the editor instance retained by RichEditor:
//   { editor, path, workspaceId, source, editable }
// `source` is the exact Markdown this editor instance last produced (or the
// exact source it was created from). While the user types, onChange stores the
// new source here before React re-renders, so the incoming `content` prop equals
// `current.source` and the live editor - with its selection, history and IME
// state - is reused instead of being destroyed.

/**
 * @returns {'mount'|'remount'|'editable'|'none'}
 *   mount    no editor for this document yet
 *   remount  a different document/version must be parsed from raw Markdown
 *   editable only the read-only flag changed
 *   none     reuse the current instance untouched
 */
export function editorSync(current, { path, workspaceId, content, readOnly = false }) {
  if (!current || current.path !== path || current.workspaceId !== workspaceId) return 'mount';
  // A differing source is an external clean refresh, draft recovery or a course
  // document switch. Re-parsing is the only byte-safe way to adopt it; patching
  // HTML would re-serialize untouched Markdown.
  if (current.source !== content) return 'remount';
  if (Boolean(current.editable) !== !readOnly) return 'editable';
  return 'none';
}

/**
 * A failed parse must not be retried for every keystroke typed into the safe
 * source fallback. Retry only after moving to another document or an explicit
 * user request (which clears `failedFor`).
 */
export function shouldAttemptMount(failedFor, { path, workspaceId }) {
  return !failedFor || failedFor.path !== path || failedFor.workspaceId !== workspaceId;
}
