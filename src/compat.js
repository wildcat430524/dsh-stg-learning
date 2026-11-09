/**
 * DSH host compatibility facts for this plugin build.
 *
 * The npm `dsh` channel only publishes prereleases for the 0.2 line, and the
 * host evaluates `engines.dsh` with `includePrerelease: true`. A caret or
 * `>=`/`<` range would therefore also admit untested prereleases (for example
 * `0.2.1-alpha.5` or a future `0.2.2-rc.2`). Every supported version is listed
 * exactly, so a host the plugin has not been accepted on is reported as
 * incompatible instead of silently loading it.
 *
 * 0.2.1-rc.5 was added on 2026-11-01: the Windows Desktop build auto-updated
 * from rc.3 to rc.5 and rc.5 refuses to boot a bundle whose `engines.dsh` does
 * not admit the running runtime, so the absence of rc.5 here silently removed
 * the whole learning workbench (側栏「学习」入口 included) from the sidebar.
 * Bumping the claim must be paired with real acceptance on that host; do not
 * add a version here before it has been checked.
 */
export const VERIFIED_DSH_VERSIONS = Object.freeze([
  '0.2.1-rc.1',
  '0.2.1-rc.2',
  '0.2.1-rc.3',
  '0.2.1-rc.4',
  '0.2.1-rc.5',
  '0.2.2-rc.1',
]);

/** Exact disjunction kept in sync with `engines.dsh` in package.json. */
export const DSH_ENGINE_RANGE = VERIFIED_DSH_VERSIONS.join(' || ');

/**
 * Inspect the native composer action surface.
 *
 * `captureInsertion` + `insertText` are required to stage a mentor request
 * without replacing the user's selection. `persistDraft` only exists from
 * 0.2.1-rc.1; on 0.2.0 hosts the composer mirrors every committed edit to the
 * conversation store by itself, so the draft is still persisted and the
 * missing explicit call is not an error.
 */
export function inspectInputCapabilities(inputActions) {
  const actions = inputActions && typeof inputActions === 'object' ? inputActions : {};
  const missing = ['captureInsertion', 'insertText'].filter(name => typeof actions[name] !== 'function');
  return {
    ok: missing.length === 0,
    missing,
    persist: typeof actions.persistDraft === 'function' ? 'explicit' : 'host-managed',
  };
}

/** A permanent host limitation, distinct from a not-yet-ready composer. */
export function draftUnavailable({ missing }) {
  const error = new Error(`当前 DSH 版本缺少原生输入框插入能力（${missing.join('、')}），无法准备学习请求。请在原生输入框手动输入问题。`);
  error.code = 'DRAFT_UNAVAILABLE';
  return error;
}

/**
 * Persist a staged draft when the host exposes the explicit hook.
 *
 * Returns `'persisted'` after a successful explicit write, or
 * `'host-managed'` when the host persists composer edits itself. A hook that
 * exists but throws is propagated so the caller can warn without claiming the
 * draft was saved.
 */
export function persistStagedDraft(inputActions) {
  const capabilities = inspectInputCapabilities(inputActions);
  if (!capabilities.ok) throw draftUnavailable(capabilities);
  if (capabilities.persist === 'host-managed') return 'host-managed';
  inputActions.persistDraft();
  return 'persisted';
}
