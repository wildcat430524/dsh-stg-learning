import React, { useEffect, useId, useRef, useState } from 'react';
import { SlidingIndicator } from './Motion.jsx';
import { CoursePicker } from './CoursePicker.jsx';
import { Icon } from './Navigation.jsx';
import { Markdown } from './Markdown.jsx';
import { teachingChoices, progressExcerpt } from './lesson-navigation.js';
import { roundToken } from '../round.js';

export function LessonAccessBar({ courses, course, currentCourseId, path, roundId, progressPage, onCourse, onGuide, onRound, onAnswer, onProgress }) {
  if (!courses.length) return null;
  const teachingActive = !progressPage && (path === course?.guidePath || course?.rounds?.some(item => item.path === path));
  return <nav className="stgw-document-access" aria-label="教学、回答和进度页面">
    <span className="stgw-access-label">学习页面</span>
    <div className="stgw-page-tabs">
      {course && <TeachingRoundPicker key={course.id} course={course} path={path} roundId={roundId} onSelect={onRound}/>}
      {(course?.guidePath || course?.rounds?.some(item => item.path !== course.answerPath)) && <button aria-pressed={!!teachingActive} onClick={onGuide}>教学引导</button>}
      {course?.answerPath && <button aria-pressed={!progressPage && path === course.answerPath} onClick={onAnswer}>学生回答</button>}
      <button aria-pressed={progressPage === 'chapter'} onClick={() => onProgress('chapter')}>当前章节进度</button>
      <button aria-pressed={progressPage === 'overall'} onClick={() => onProgress('overall')}>总体进度</button>
      <SlidingIndicator value={`${course?.id}|${path}|${progressPage || ''}`} selector="[aria-pressed=true]"/>
    </div>
    {courses.length > 1 && <CoursePicker courses={courses} course={course} currentCourseId={currentCourseId} onSelect={onCourse}/>}
  </nav>;
}

export function TeachingRoundPicker({ course, path, roundId, onSelect }) {
  const menuId = useId();
  const menu = useRef(null), trigger = useRef(null), initialEdge = useRef(null);
  const [open, setOpen] = useState(false);
  const choices = teachingChoices(course);
  const choiceIdentity = choices.map(item => `${item.id}:${item.path}`).join('\n');
  const selected = choices.find(item => item.id === roundId);
  const close = (restoreFocus = false) => {
    menu.current?.hidePopover();
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };
  const placeAndFocus = (edge) => {
    const popup = menu.current, button = trigger.current;
    if (!popup || !button) return;
    const anchor = button.getBoundingClientRect();
    // Top-layer popover avoids clipping by the horizontally scrollable page tabs.
    popup.style.maxHeight = `${Math.max(80, Math.max(innerHeight - anchor.bottom - 20, anchor.top - 20))}px`;
    const bounds = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - bounds.width - 12))}px`;
    popup.style.top = `${Math.max(12, anchor.bottom + bounds.height + 8 > innerHeight - 12 ? anchor.top - bounds.height - 8 : anchor.bottom + 8)}px`;
    setOpen(true);
    const items = [...popup.querySelectorAll('[role=menuitemradio]')];
    (edge === 'last' ? items.at(-1) : edge === 'first' ? items[0] : items.find(item => item.getAttribute('aria-checked') === 'true') || items[0])?.focus({ preventScroll: true });
  };
  const show = edge => {
    initialEdge.current = edge;
    if (menu.current?.matches(':popover-open')) placeAndFocus(edge);
    else trigger.current?.click(); // Native invoker association also preserves pointer toggle after keyboard opening.
  };
  useEffect(() => { close(); }, [path, roundId, choiceIdentity]);
  useEffect(() => {
    const popup = menu.current, button = trigger.current;
    if (!popup || !button) return;
    // The host supplies React 18, which does not dispatch React's onToggle for
    // popovers. Use DOM events and the native invoker attribute in both runtimes.
    button.setAttribute('popovertarget', menuId);
    const toggle = event => {
      setOpen(event.newState === 'open');
      if (event.newState === 'open') placeAndFocus(initialEdge.current);
      initialEdge.current = null;
    };
    popup.addEventListener('toggle', toggle);
    const resize = () => close();
    // Close on real scrolling intent only. A programmatic scroll (restoring the
    // reading position or landing on the recorded round heading) also fires
    // `scroll`; treating that as a close request would dismiss a menu the reader
    // just opened. Wheel and touch are unambiguous user gestures.
    const scroll = event => { if (!menu.current?.contains(event.target)) close(); };
    window.addEventListener('resize', resize);
    document.addEventListener('wheel', scroll, { capture: true, passive: true });
    document.addEventListener('touchmove', scroll, { capture: true, passive: true });
    return () => { popup.removeEventListener('toggle', toggle); window.removeEventListener('resize', resize); document.removeEventListener('wheel', scroll, true); document.removeEventListener('touchmove', scroll, true); };
  }, [!!choices.length, menuId]);
  if (!choices.length) return null;
  const items = [{ id: '', title: '教学总入口' }, ...choices];
  return <>
    <button ref={trigger} type="button" className="stgw-round-trigger" aria-label="切换本课教学轮次" aria-haspopup="menu" aria-controls={menuId} aria-expanded={open}
      title={selected?.title || '教学总入口'} aria-description={selected?.title || '教学总入口'}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp' ? 'last' : 'first'); } }}>
      <span>{roundToken(selected?.title) || selected?.title || '教学总入口'}</span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <div ref={menu} id={menuId} popover="auto" role="menu" aria-label="本课教学轮次" className="stgw-round-menu"
      onKeyDown={event => {
        if (event.isComposing) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
        if (event.key === 'Tab') { close(); return; }
        const buttons = [...menu.current.querySelectorAll('[role=menuitemradio]')];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : null;
        if (next !== null) { event.preventDefault(); buttons[next]?.focus(); }
      }}>
      <div className="stgw-round-menu-heading" role="presentation"><span>教学轮次</span><small>{course.title}</small></div>
      {items.map((item, index) => {
        const checked = (selected?.id || '') === item.id;
        return <React.Fragment key={item.id}>{index === 1 && <div role="separator" className="stgw-round-divider"/>}<button type="button" role="menuitemradio" aria-checked={checked} tabIndex={-1} onClick={() => { close(true); onSelect(item.id ? item : null); }}>
          <span className="stgw-round-mark" aria-hidden="true"><Icon name={index ? "file" : "book"} size={13}/></span><span className="stgw-round-label">{item.title}</span><span className="stgw-round-check" aria-hidden="true">{checked && <Icon name="check" size={14}/>}</span>
        </button></React.Fragment>;
      })}
    </div>
  </>;
}

export function LearningProgressPage({ kind, data, course, workspaceId, onOpenProfile, onNavigate }) {
  const title = kind === 'chapter' ? '当前章节进度' : '总体进度';
  const otherCourse = kind === 'chapter' && data?.current?.courseId !== course?.id;
  const excerpt = otherCourse ? '' : progressExcerpt(data?.profile?.content, kind);
  return <section className="stgw-progress-page" aria-label={title}>
    <small>{kind === 'chapter' ? course?.title : '已记录的学习进度'}</small><h1>{title}</h1>
    <p className="stgw-progress-summary">{otherCourse ? '非当前课程，具体记录请查看该课的教学与回答。' : data?.progress?.[kind] || '尚未记录'}</p>
    {excerpt ? <Markdown content={excerpt} path={data.profile.path} workspaceId={workspaceId} onOpenDocument={onNavigate}/> : <p className="stgw-muted">暂无更多进度记录，导师更新文件后会自动刷新。</p>}
    {data?.profile?.path && <button className="stgw-outline-button" onClick={onOpenProfile}>打开完整学习档案</button>}
  </section>;
}

export const lessonNavigationCSS = `
.stgw-document-access{display:flex;align-items:center;gap:12px;min-width:0;min-height:50px;padding:8px 24px;border-bottom:1px solid var(--stgw-line);background:var(--stgw-soft);flex-shrink:0}.stgw-access-label{font-size:10px;color:var(--stgw-faint);white-space:nowrap}.stgw-page-tabs{display:flex;gap:5px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:thin}.stgw-root .stgw-page-tabs button{flex-shrink:0;white-space:nowrap;font-size:12px;padding:7px 11px;border:1px solid transparent;border-radius:7px;color:var(--stgw-muted)}.stgw-root .stgw-page-tabs button[aria-pressed=true]{border-color:var(--stgw-line);background:var(--stgw-bg);color:var(--stgw-ink)}.stgw-course-picker{max-width:220px;min-width:0;background:var(--stgw-bg);color:var(--stgw-muted);border:1px solid var(--stgw-line);border-radius:7px;padding:6px 9px;font:12px system-ui;overflow:hidden;text-overflow:ellipsis}.stgw-lesson-heading{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px}.stgw-lesson-heading .stgw-lesson-title{margin:5px 0!important}.stgw-progress-page{max-width:960px;margin:auto;padding:35px 40px 60px}.stgw-progress-page>small{color:var(--stgw-faint)}.stgw-progress-page>h1{font-size:25px;font-weight:550;margin:10px 0 20px}.stgw-progress-summary{padding:14px 17px;border:1px solid var(--stgw-line);border-radius:8px;color:var(--stgw-muted);font-size:13px}.stgw-progress-page .stgw-markdown{margin:24px 0}.stgw-root select:focus-visible{outline:2px solid var(--stgw-accent);outline-offset:2px}@media(max-width:700px){.stgw-document-access{padding:8px 14px;gap:7px;flex-wrap:wrap}.stgw-access-label{display:none}.stgw-course-picker{max-width:180px}.stgw-root .stgw-page-tabs button{font-size:11px;padding:6px 9px}.stgw-progress-page{padding:25px 22px 45px}}

.stgw-root .stgw-page-tabs .stgw-round-trigger{display:flex;align-self:center;align-items:center;gap:6px;min-height:28px;max-width:40%;padding:4px 8px;border:1px solid var(--stgw-line);border-radius:6px;background:var(--stgw-paper);font-size:11px;color:var(--stgw-muted)}
.stgw-round-trigger span{min-width:0;overflow:hidden;text-overflow:ellipsis}.stgw-round-trigger svg{flex-shrink:0}
.stgw-root .stgw-round-trigger:hover,.stgw-root .stgw-page-tabs .stgw-round-trigger[aria-expanded=true]{background:var(--stgw-bg);color:var(--stgw-ink);border-color:var(--stgw-line)}
.stgw-round-trigger svg{transition:transform .15s}.stgw-round-trigger[aria-expanded=true] svg{transform:rotate(180deg)}
.stgw-root .stgw-round-menu{position:fixed;inset:auto;margin:0;padding:6px;width:min(320px,calc(100vw - 24px));box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--stgw-line);border-radius:13px;background:var(--stgw-bg);color:var(--stgw-ink);box-shadow:0 10px 40px #00000018,0 2px 8px #0000000a;font-family:inherit;scrollbar-width:thin}
.stgw-round-menu::backdrop{background:transparent}
.stgw-round-menu-heading{display:flex;flex-direction:column;gap:4px;padding:9px 10px 13px;font-size:12px;font-weight:600;letter-spacing:.02em}
.stgw-round-menu-heading small{font-size:11px;font-weight:400;color:var(--stgw-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0}
.stgw-root .stgw-round-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:9px 10px;text-align:left;white-space:normal;border:0;border-radius:7px;background:transparent;color:var(--stgw-muted);font:12px/1.5 system-ui}
.stgw-root .stgw-round-menu button:hover,.stgw-root .stgw-round-menu button:focus-visible{background:var(--stgw-soft);color:var(--stgw-ink);outline:0;box-shadow:inset 0 0 0 1px var(--stgw-line)}
.stgw-root .stgw-round-menu button[aria-checked=true]{background:var(--stgw-active);color:var(--stgw-accent)}
.stgw-round-mark{flex-shrink:0;width:24px;font-size:10px;font-variant-numeric:tabular-nums;opacity:.7;text-align:center}
.stgw-round-label{flex:1;min-width:0;overflow-wrap:anywhere}.stgw-round-check{width:14px;font-size:13px;flex-shrink:0}.stgw-round-divider{height:1px;background:var(--stgw-line);margin:5px 10px}
@media(prefers-reduced-motion:reduce){.stgw-round-trigger svg{transition:none}}
`;
