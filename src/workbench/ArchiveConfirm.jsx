import React, { useEffect, useRef } from 'react';
import { ARCHIVE_ACTIVE_NOTE, ARCHIVE_KEEP_NOTE } from '../session-archive.js';

/**
 * Title-based confirmation in front of the Host's recoverable archive.
 *
 * The dialog names the exact conversation, says plainly that nothing is
 * permanently deleted, and only the confirm button can call the Host. Cancel,
 * Escape and a failed request all leave the conversation exactly where it was.
 * It is shared by the teacher switcher and the learning-session manager so
 * both "delete" entries behave identically.
 */
export function ArchiveConfirm({ request, busy = false, error = '', onCancel, onConfirm }) {
  const dialog = useRef(null), cancelButton = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => cancelButton.current?.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(frame); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <div className="stga-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onCancel?.(); }}>
    <section ref={dialog} className="stga-dialog" role="dialog" aria-modal="true" aria-label="移出这段老师对话？" tabIndex={-1} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel?.(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled)')];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <h2>移出这段老师对话？</h2>
      <p className="stga-target">“{request?.label || '这段老师对话'}”</p>
      <p className="stga-note">{ARCHIVE_KEEP_NOTE}</p>
      <p className="stga-note">{ARCHIVE_ACTIVE_NOTE}</p>
      {error && <p className="stga-error" role="alert">{error}</p>}
      <div className="stga-actions">
        <button ref={cancelButton} type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button type="button" className="stga-confirm" disabled={busy} onClick={onConfirm}>{busy ? '正在移出…' : '移出对话'}</button>
      </div>
    </section>
  </div>;
}

export const archiveConfirmCSS = `
/* The confirmation covers whichever surface opened it (the teacher panel or
   the learning-session page); tokens fall back so both contexts can share it. */
.stga-backdrop{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;background:#0b162333;backdrop-filter:blur(2px)}
.stga-dialog{--stga-ink:var(--teacher-ink,var(--stgl-ink,#27303d));--stga-line:var(--teacher-line,var(--stgl-line,#e6e9ef));--stga-paper:var(--teacher-paper,var(--stgl-panel,#fff));--stga-wash:var(--teacher-wash,#f3f6fb);--stga-muted:var(--teacher-muted,#5f6a79);--stga-danger:var(--dsw-alias-state-error-primary,#b44);display:flex;flex-direction:column;gap:9px;width:min(360px,100%);max-height:100%;overflow:auto;padding:18px 19px 15px;box-sizing:border-box;border:1px solid var(--stga-line);border-radius:13px;background:var(--stga-paper);color:var(--stga-ink);box-shadow:0 18px 50px #10213a2e;outline:0;font:12px/1.65 "Segoe UI Variable Text","Microsoft YaHei",system-ui,sans-serif}
.stga-dialog *{box-sizing:border-box}
.stga-dialog h2{margin:0;font-size:14px;font-weight:600;line-height:1.5}
.stga-target{margin:0;padding:8px 10px;border-radius:8px;background:var(--stga-wash);font-size:12px;line-height:1.55;overflow-wrap:anywhere}
.stga-note{margin:0;font-size:11px;line-height:1.7;color:var(--stga-muted)}
.stga-error{margin:0;font-size:11px;line-height:1.65;color:var(--stga-danger)}
.stga-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
.stga-actions button{width:auto;min-height:30px;padding:5px 12px;border:1px solid var(--stga-line);border-radius:7px;background:transparent;color:var(--stga-ink);font:12px/1.45 inherit;cursor:pointer}
.stga-actions button:hover:not(:disabled){border-color:var(--teacher-accent,var(--stgl-accent,#4779dc));color:var(--teacher-accent,var(--stgl-accent,#4779dc))}
.stga-actions button:focus-visible{outline:2px solid var(--teacher-accent,var(--stgl-accent,#4779dc));outline-offset:1px}
.stga-actions button:disabled{opacity:.55;cursor:default}
.stga-actions button.stga-confirm{border-color:transparent;background:var(--stga-danger);color:#fff}
.stga-actions button.stga-confirm:hover:not(:disabled){background:color-mix(in srgb,var(--stga-danger) 88%,#000);color:#fff}
@media(forced-colors:active){.stga-dialog{border-color:CanvasText}}
`;
