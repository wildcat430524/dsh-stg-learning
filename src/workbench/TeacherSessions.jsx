import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Navigation.jsx';

/**
 * The teacher header's conversation switcher. It lives in the panel header, so
 * the same compact control works docked and floating. The menu is a top-layer
 * popover: the panel clips its own overflow and animates its geometry, and a
 * normal absolutely-positioned menu would be cut off at small sizes.
 */
export function TeacherSessionSwitcher({ sessions = [], currentId = '', busy = false, error = '', status = '', onSelect, onNew }) {
  const menuId = useId().replace(/:/g, ''), trigger = useRef(null), popup = useRef(null), firstItem = useRef(null);
  const [open, setOpen] = useState(false);
  const close = (restoreFocus = false) => { popup.current?.hidePopover(); setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); };
  const place = () => {
    const menu = popup.current, anchor = trigger.current?.getBoundingClientRect();
    if (!menu?.matches(':popover-open') || !anchor) return;
    const bounds = menu.getBoundingClientRect();
    const below = anchor.bottom + bounds.height + 10 <= innerHeight - 8;
    menu.style.maxHeight = `${Math.max(120, Math.min(420, Math.max(innerHeight - anchor.bottom - 20, anchor.top - 20)))}px`;
    menu.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${below ? anchor.bottom + 6 : Math.max(8, anchor.top - bounds.height - 6)}px`;
  };
  useEffect(() => {
    const menu = popup.current, button = trigger.current;
    if (!menu || !button) return;
    // The host supplies React 18, which does not dispatch React's onToggle for
    // popovers; use the native invoker and DOM toggle event in both runtimes.
    button.setAttribute('popovertarget', menuId);
    const toggle = event => {
      const opened = event.newState === 'open';
      setOpen(opened);
      if (opened) { place(); requestAnimationFrame(() => (firstItem.current?.focus({ preventScroll: true }), place())); }
    };
    const dismiss = event => { if (!menu.contains(event.target) && event.target !== button) close(); };
    const resize = () => close();
    menu.addEventListener('toggle', toggle);
    window.addEventListener('resize', resize);
    document.addEventListener('pointerdown', dismiss, true);
    const observer = new ResizeObserver(place); observer.observe(menu);
    return () => { observer.disconnect(); menu.removeEventListener('toggle', toggle); window.removeEventListener('resize', resize); document.removeEventListener('pointerdown', dismiss, true); };
  }, [menuId]);
  // A switched conversation or a closed teacher must not leave a stale menu.
  useEffect(() => { if (busy) close(); }, [busy]);
  const choose = (action, value) => { close(true); action?.(value); };
  return <>
    <button ref={trigger} type="button" className="stgt-session-trigger" data-session={currentId || undefined} aria-label={currentId ? '切换老师对话，或开始新对话' : '老师对话'} aria-haspopup="menu" aria-controls={menuId} aria-expanded={open}
      title="切换老师对话，或开始新对话" onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        if (popup.current?.matches(':popover-open')) firstItem.current?.focus({ preventScroll: true }); else trigger.current.click();
      }}>
      <Icon name="chat" size={17}/><strong>老师</strong><svg className="stgt-session-caret" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <div ref={popup} id={menuId} className="stgt-session-menu" popover="auto" role="menu" aria-label="老师对话" aria-busy={busy || undefined} onKeyDown={event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (event.key === 'Tab') { close(); return; }
      const items = [...popup.current.querySelectorAll('[role^=menuitem]')].filter(item => !item.disabled);
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : null;
      if (next !== null && items.length) { event.preventDefault(); items[next]?.focus({ preventScroll: true }); }
    }}>
      <div className="stgt-session-heading"><span>老师对话</span><small>只显示当前学习空间</small></div>
      <button ref={firstItem} type="button" role="menuitem" className="stgt-session-new" disabled={busy} onClick={() => choose(onNew)}>
        <span className="stgt-session-mark" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg></span>
        <span className="stgt-session-labels"><span>新对话</span><small>另开一段空白对话，旧对话保留</small></span>
      </button>
      <div role="separator" className="stgt-session-divider"/>
      <div className="stgt-session-list" role="group" aria-label="当前学习空间的老师对话">
        {sessions.map(row => <button key={row.id} type="button" role="menuitemradio" aria-checked={row.id === currentId} disabled={busy || row.id === currentId} data-session-id={row.id} className="stgt-session-option" onClick={() => choose(onSelect, row.id)} title={row.title || row.label}>
          <span className="stgt-session-mark" aria-hidden="true"><Icon name={row.blank ? 'chat' : 'history'} size={13}/></span>
          <span className="stgt-session-labels"><span>{row.label}</span><small>{row.hint}</small></span>
          <span className="stgt-session-check" aria-hidden="true">{row.id === currentId && <Icon name="check" size={14}/>}</span>
        </button>)}
        {!sessions.length && <p className="stgt-session-empty" role="status">这个学习空间还没有老师对话，先点“新对话”。</p>}
      </div>
      {(error || status || busy) && <div className={'stgt-session-foot' + (error ? ' stgt-session-foot-error' : '')} role={error ? 'alert' : 'status'}>{busy ? '正在切换，请稍候…' : error || status}</div>}
    </div>
    <span className="stgt-sr" role="status" aria-live="polite">{busy ? '正在切换老师对话' : error || status}</span>
  </>;
}

export const teacherSessionsCSS = `
/* The switcher lives inside the header, whose generic button rule sizes every
   descendant as a 32x32 icon button; the trigger and the menu rows must opt out. */
.stgt-header button.stgt-session-trigger{display:inline-flex;align-items:center;gap:7px;width:auto;height:auto;min-width:0;min-height:32px;padding:4px 7px 4px 4px;border:0;border-radius:8px;background:transparent;color:var(--teacher-ink);cursor:pointer;font:inherit}
.stgt-session-trigger>svg:first-child{color:var(--teacher-muted);flex-shrink:0}.stgt-session-trigger strong{font-size:14px;font-weight:600;white-space:nowrap}.stgt-session-caret{color:var(--teacher-muted);flex-shrink:0;transition:rotate 140ms}
.stgt-header button.stgt-session-trigger:hover,.stgt-header button.stgt-session-trigger[aria-expanded=true]{background:var(--teacher-wash);color:var(--teacher-ink)}.stgt-session-trigger[aria-expanded=true] .stgt-session-caret{rotate:180deg}
.stgt-header button.stgt-session-trigger:focus-visible{outline:2px solid var(--teacher-accent);outline-offset:-2px}
.stgt-session-menu{position:fixed;inset:auto;margin:0;padding:0;box-sizing:border-box;width:min(300px,calc(100vw - 16px));overflow:hidden;border:1px solid var(--teacher-line);border-radius:13px;background:var(--teacher-paper);color:var(--teacher-ink);box-shadow:0 14px 40px #18283f1f,0 2px 8px #18283f0d;font:12px/1.5 "Segoe UI Variable Text","Microsoft YaHei",system-ui,sans-serif}
.stgt-session-menu:popover-open{display:flex;flex-direction:column;animation:stgt-session-in 140ms cubic-bezier(.2,.9,.22,1)}.stgt-session-menu::backdrop{background:transparent}
@keyframes stgt-session-in{from{opacity:0;translate:0 -4px}to{opacity:1;translate:0 0}}
.stgt-session-heading{display:flex;flex-direction:column;gap:2px;padding:12px 14px 9px;flex-shrink:0}.stgt-session-heading>span{font-size:12px;font-weight:600}.stgt-session-heading small{font-size:10px;color:var(--teacher-muted)}
.stgt-header .stgt-session-menu button,.stgt-session-menu button{display:flex;align-items:center;gap:9px;width:100%;height:auto;min-height:38px;padding:7px 9px;border:0;border-radius:7px;background:transparent;color:var(--teacher-ink);font:inherit;text-align:left;cursor:pointer;white-space:normal}
.stgt-session-menu button:hover:not(:disabled),.stgt-session-menu button:focus-visible{background:var(--teacher-wash);outline:0;box-shadow:inset 0 0 0 1px var(--teacher-line)}
.stgt-session-menu button:focus-visible{outline:2px solid var(--teacher-accent);outline-offset:-2px;box-shadow:none}
.stgt-session-menu button:disabled{cursor:default;opacity:.55}.stgt-session-menu button[aria-checked=true]{background:color-mix(in srgb,var(--teacher-accent) 9%,var(--teacher-paper));opacity:1}
.stgt-session-new{margin:0 6px}.stgt-session-list{overflow-y:auto;min-height:0;padding:0 6px 6px;overscroll-behavior:contain;scrollbar-width:thin}
.stgt-session-divider{height:1px;margin:4px 12px 6px;background:color-mix(in srgb,var(--teacher-line) 70%,transparent)}
.stgt-session-mark{display:grid;place-items:center;width:18px;flex-shrink:0;color:var(--teacher-muted)}.stgt-session-labels{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.stgt-session-labels>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.stgt-session-labels small{font-size:10px;color:var(--teacher-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stgt-session-check{width:14px;flex-shrink:0;color:var(--teacher-accent)}.stgt-session-empty{padding:14px 12px;margin:0;font-size:11px;line-height:1.6;color:var(--teacher-muted)}
.stgt-session-foot{padding:8px 14px;border-top:1px solid color-mix(in srgb,var(--teacher-line) 65%,transparent);font-size:10px;color:var(--teacher-muted)}.stgt-session-foot-error{color:var(--dsw-alias-state-error-primary,#b44)}
.stgt-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media(prefers-reduced-motion:reduce){.stgt-session-menu:popover-open{animation:none}.stgt-session-caret{transition:none}}
@media(forced-colors:active){.stgt-session-menu{border-color:CanvasText}.stgt-session-menu button[aria-checked=true]{outline:1px solid Highlight}}
`;
