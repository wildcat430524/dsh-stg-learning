import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Navigation.jsx';

/** A flat course collection, grouped by subject; not a cascading workspace picker. */
export function CoursePicker({ courses, course, currentCourseId, onSelect }) {
  const id = useId(), trigger = useRef(null), popup = useRef(null), search = useRef(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase();
  const visible = courses.filter(item => !term || `${item.title} ${item.subject || ''}`.toLocaleLowerCase().includes(term));
  const groups = new Map();
  for (const item of visible) { const key = item.subject || '课程'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
  const close = (restoreFocus = false) => { popup.current?.hidePopover(); setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); };
  const place = () => {
    const menu = popup.current, anchor = trigger.current?.getBoundingClientRect();
    if (!menu?.matches(':popover-open') || !anchor) return;
    menu.style.maxHeight = `${Math.max(80, Math.min(480, Math.max(innerHeight - anchor.bottom - 20, anchor.top - 20)))}px`;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, innerWidth - bounds.width - 12))}px`;
    menu.style.top = `${Math.max(12, anchor.bottom + bounds.height + 8 > innerHeight - 12 ? anchor.top - bounds.height - 8 : anchor.bottom + 8)}px`;
  };
  useEffect(() => { close(); }, [course?.id]);
  useEffect(() => {
    const menu = popup.current, button = trigger.current;
    if (!menu || !button) return;
    button.setAttribute('popovertarget', id);
    const toggle = event => {
      const opened = event.newState === 'open'; setOpen(opened);
      if (opened) { setQuery(''); place(); search.current?.focus({ preventScroll: true }); }
    };
    const scroll = event => { if (!menu.contains(event.target)) close(); };
    const resize = () => close();
    menu.addEventListener('toggle', toggle);
    document.addEventListener('scroll', scroll, true); window.addEventListener('resize', resize);
    const observer = new ResizeObserver(place); observer.observe(menu);
    return () => { observer.disconnect(); menu.removeEventListener('toggle', toggle); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize); };
  }, [id]);
  return <>
    <button ref={trigger} className="stgw-course-picker" type="button" aria-label="切换课程" aria-describedby={`${id}-value`} aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
      title={course?.title} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!popup.current?.matches(':popover-open')) trigger.current.click(); else search.current?.focus(); } }}>
      <Icon name="book" size={13}/><span id={`${id}-value`}>{course?.title || '选择课程'}</span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <div ref={popup} id={id} className="stgw-course-menu" popover="auto" role="dialog" aria-label="切换学习课程" onKeyDown={event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (event.key === 'Tab') { close(true); return; }
      const options = [...popup.current.querySelectorAll('[role=option]')], index = options.indexOf(document.activeElement), inSearch = document.activeElement === search.current;
      if (inSearch && event.key === 'Enter' && options.length) { event.preventDefault(); options[0].click(); return; }
      const next = event.key === 'ArrowDown' ? (index + 1) % options.length : event.key === 'ArrowUp' ? (inSearch ? options.length - 1 : (index - 1 + options.length) % options.length) : !inSearch && event.key === 'Home' ? 0 : !inSearch && event.key === 'End' ? options.length - 1 : null;
      if (next !== null && options.length) { event.preventDefault(); options[next]?.focus({ preventScroll: true }); options[next]?.scrollIntoView({ block: 'nearest' }); }
    }}>
      <div className="stgw-course-menu-heading"><strong>课程</strong><span>{courses.length} 门</span></div>
      <label className="stgw-course-search"><Icon name="search" size={14}/><input ref={search} type="search" aria-label="搜索学习课程" placeholder="搜索课程或学科" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <div className="stgw-course-results" role="listbox" aria-label="可选学习课程">{[...groups].map(([subject, items]) => <div key={subject} role="group" aria-label={subject}>
        <div className="stgw-course-group-label" aria-hidden="true">{subject}</div>
        {items.map(item => <button type="button" role="option" aria-selected={item.id === course?.id} tabIndex={-1} key={item.id} onClick={() => { close(true); onSelect(item); }}>
          <span className="stgw-course-option-title">{item.title}</span>{item.id === currentCourseId && <small>正在学</small>}<span className="stgw-course-option-check" aria-hidden="true">{item.id === course?.id && <Icon name="check" size={14}/>}</span>
        </button>)}
      </div>)}</div>
      {!visible.length && <div className="stgw-course-no-results" role="status">没有找到课程<button onClick={() => { setQuery(''); search.current?.focus(); }}>清空搜索</button></div>}
      <div className="stgw-course-menu-footnote">{term ? `找到 ${visible.length} 门课程 · ` : ''}↑ ↓ 选择 · Enter 打开</div>
    </div>
  </>;
}

export const coursePickerCSS = `
.stgw-root button.stgw-course-picker{display:inline-flex;align-items:center;gap:8px;min-width:0;max-width:220px;height:30px;min-height:30px;padding:5px 9px;background:transparent;border:1px solid var(--stgw-line);border-radius:8px;color:var(--stgw-muted);font-size:11px}
.stgw-course-picker>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stgw-course-picker[aria-expanded=true]{background:var(--stgw-soft)!important;color:var(--stgw-ink)!important}.stgw-course-picker>svg:last-child{transition:rotate 140ms}.stgw-course-picker[aria-expanded=true]>svg:last-child{rotate:180deg}
.stgw-root .stgw-course-menu{position:fixed;inset:auto;margin:0;padding:0;box-sizing:border-box;width:min(352px,calc(100vw - 24px));max-height:480px;overflow:hidden;border:1px solid var(--stgw-line);border-radius:12px;background:var(--stgw-bg);color:var(--stgw-ink);box-shadow:0 12px 38px #00000018,0 2px 6px #00000008;font-family:inherit}
.stgw-course-menu:popover-open{display:flex;flex-direction:column;animation:stgw-pop-in 140ms cubic-bezier(.2,.9,.22,1)}.stgw-course-menu::backdrop{background:transparent}
.stgw-course-menu-heading{display:flex;align-items:center;justify-content:space-between;padding:15px 16px 12px;flex-shrink:0}.stgw-course-menu-heading strong{font-size:13px;font-weight:550}.stgw-course-menu-heading>span{font-size:10px;color:var(--stgw-faint)}
.stgw-course-search{display:flex;align-items:center;gap:8px;margin:0 10px 8px;padding:0 10px;min-height:34px;border:1px solid var(--stgw-line);border-radius:8px;background:var(--stgw-soft);color:var(--stgw-faint);flex-shrink:0}
.stgw-root .stgw-course-search input{width:100%;padding:7px 0;border:0!important;outline:none!important;background:transparent;font:inherit;font-size:12px;line-height:1.5;box-shadow:none}.stgw-course-search:focus-within{border-color:var(--stgw-accent);box-shadow:0 0 0 2px var(--stgw-active)}
.stgw-course-results{overflow-y:auto;min-height:0;flex:1;padding:0 6px 6px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable}
.stgw-course-group-label{font-size:10px;font-weight:500;color:var(--stgw-faint);padding:11px 10px 6px}
.stgw-root .stgw-course-results button[role=option]{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:10px;text-align:left;white-space:normal;border:0;border-radius:7px;background:transparent;color:var(--stgw-muted);font-size:12px;line-height:1.5}
.stgw-root .stgw-course-results button[role=option]:is(:hover,:focus-visible){background:var(--stgw-soft);outline:0;box-shadow:inset 0 0 0 1px var(--stgw-line);color:var(--stgw-ink)}
.stgw-root .stgw-course-results button[aria-selected=true]{background:var(--stgw-active);color:var(--stgw-accent)}.stgw-course-option-title{flex:1;min-width:0;overflow-wrap:anywhere}.stgw-course-results small{font-size:9px;font-weight:400;padding:2px 5px;border-radius:4px;color:var(--stgw-accent);background:var(--stgw-active);white-space:nowrap}.stgw-course-option-check{width:14px;flex-shrink:0}
.stgw-course-menu-footnote{padding:9px 16px;border-top:1px solid var(--stgw-line);font-size:10px;color:var(--stgw-faint);flex-shrink:0}.stgw-course-no-results{padding:24px 16px;text-align:center;color:var(--stgw-faint);font-size:12px}.stgw-root .stgw-course-no-results button{display:block;margin:8px auto 0;color:var(--stgw-accent)}
@media(max-width:700px){.stgw-root button.stgw-course-picker{margin:0 0 8px auto;max-width:100%}}
`;
