import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SlidingIndicator } from './Motion.jsx';
import { basename, flattenFiles, learningDocumentLabel } from './model.js';

const paths = {
  book: <><path d="M12 6C9 4 5 4 3 5v14c3-1 6-1 9 1m0-14c3-2 7-2 9-1v14c-3-1-6-1-9 1V6Z"/></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  chat: <path d="M20 11.5a8.5 8.5 0 0 1-11 8L4 21l1.5-5A8.5 8.5 0 1 1 20 11.5Z"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
  save: <><path d="M18 21H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2h12l4 4v11a3 3 0 0 1-3 3Z"/><path d="M7 3v6h9V3M7 21v-8h10v8"/></>,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5"/><path d="M12 7v5l3 2"/></>,
  edit: <><path d="m14 5 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z"/></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6m-5 4a8 8 0 0 0 14 5l3-3m0 6v-6h-6"/></>,
  arrow: <path d="m9 5 7 7-7 7"/>,
  back: <path d="m14 6-6 6 6 6M8 12h13"/>,
  send: <><path d="m3 3 18 9-18 9 4-9Z"/><path d="M7 12h14"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  formula: <><path d="M5 4h13M5 20h13M8 4 5 20"/><path d="m14 9 4 6m0-6-4 6"/></>,
};
export function Icon({ name, size = 16, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.file}</svg>; }

export function Outline({ courses, tree, courseId, path, roundId, current, workspace, open, query, onQuery, onNavigate, onCourse, onClose }) {
  const [expanded, setExpanded] = useState(() => new Set([courseId]));
  const [browseAll, setBrowseAll] = useState(false);
  const focused = Boolean(courseId && courses.some(course => course.id === courseId)) && !browseAll && !query.trim();
  const visibleCourses = focused ? courses.filter(course => course.id === courseId) : courses;
  useEffect(() => { if (courseId) setExpanded(previous => new Set([...previous, courseId])); }, [courseId]);
  const groups = useMemo(() => {
    const grouped = new Map(), term = query.trim().toLowerCase();
    for (const course of visibleCourses) {
      if (term && ![course.title, course.subject, course.directory, course.guidePath, course.answerPath, ...course.rounds.map(r => r.title)].join(' ').toLowerCase().includes(term)) continue;
      if (!grouped.has(course.subject)) grouped.set(course.subject, []);
      grouped.get(course.subject).push(course);
    }
    return [...grouped];
  }, [courses, courseId, focused, query]);
  const knownFiles = new Set(courses.flatMap(c => [c.guidePath, c.answerPath, ...c.rounds.map(r => r.path)]));
  const files = focused ? [] : flattenFiles(tree).filter(f => query ? `${f.path} ${f.name}`.toLowerCase().includes(query.toLowerCase()) : !knownFiles.has(f.path));
  return <aside className="stgw-outline" data-open={open} aria-label="课程与资料目录">
    <div className="stgw-outline-head">{focused ? '当前课程' : '学习目录'}<span className="stgw-spacer"/><span>{visibleCourses.length || ''}</span><button className="stgw-icon stgw-outline-close" aria-label="关闭目录" onClick={onClose}><Icon name="close"/></button></div>
    {!!courseId && <div style={{ padding: '0 14px 8px' }}><button className="stgw-outline-button" onClick={() => { setBrowseAll(!browseAll); onQuery(''); }}>{browseAll ? '返回当前课程' : '全部课程'}</button></div>}
    <label className="stgw-outline-search"><Icon name="search" size={14}/><input aria-label="搜索课程与资料" placeholder="搜索课程与资料" value={query} onChange={e => onQuery(e.target.value)}/>{query && <button className="stgw-icon" aria-label="清空搜索" onClick={() => onQuery('')}><Icon name="close" size={12}/></button>}</label>
    <div className="stgw-outline-scroll">
      {groups.map(([subject, rows]) => <section className="stgw-tree-group" key={subject}><div className="stgw-tree-label">{subject}</div>{rows.map(course => {
        const isExpanded = expanded.has(course.id) || !!query;
        const links = [{ path: course.guidePath, title: '教学文档', type: 'guide', key: 'guide' }, { path: course.answerPath, title: '学生回答', type: 'answer', key: 'answer' }, ...course.rounds.map(r => ({ path: r.path, title: r.title, type: 'round', roundId: r.id, key: r.id }))].filter(f => f.path);
        return <div key={course.id}><div className="stgw-course-row" data-active={courseId === course.id}><button className="stgw-course-toggle" aria-label={`${isExpanded ? '收起' : '展开'}${course.title}`} aria-expanded={isExpanded} onClick={() => setExpanded(previous => { const next = new Set(previous); next.has(course.id) ? next.delete(course.id) : next.add(course.id); return next; })}><Icon name="arrow" size={11} style={{ transform: isExpanded ? 'rotate(90deg)' : undefined }}/></button><button className="stgw-course-name" onClick={() => { onCourse(course); setBrowseAll(false); onQuery(''); }}><span>{course.title}</span>{current?.courseId === course.id && <i className="stgw-current-dot" title="文档记录的当前课程"/>}</button></div>{isExpanded && <div className="stgw-course-files">{links.map(file => {
          const isActive = path === file.path && (file.type === 'round' ? roundId === file.roundId : !roundId);
          return <button className="stgw-tree-file" data-active={isActive} aria-current={isActive ? 'page' : undefined} key={`${file.type}:${file.key}`} onClick={() => onNavigate(file.path, course.id, file.type === 'answer' ? 'answer' : 'read', file.roundId)}><Icon name={file.type === 'answer' ? 'edit' : 'file'} size={12}/><span>{file.title}</span>{file.roundId && file.roundId === (course.currentRoundId || current?.roundId) && <small>当前</small>}</button>;
        })}</div>}</div>;
      })}</section>)}
      {!!files.length && <section className="stgw-tree-group"><div className="stgw-tree-label">{query ? '匹配的文档' : '学习档案与资料'}</div>{files.map(file => <button key={file.path} className="stgw-tree-file" data-active={file.path === path} title={file.path} onClick={() => onNavigate(file.path)}><Icon name="file" size={12}/><span>{learningDocumentLabel(file.path)}{query && file.path !== file.name && <small style={{ display: 'block', margin: 0 }}>{file.path}</small>}</span></button>)}</section>}
      {!groups.length && !files.length && <div className="stgw-muted" style={{ padding: '12px 9px', fontSize: 11 }}>{query ? '没有匹配的课程或资料' : '尚未发现学习文档'}</div>}
    </div>
    <div className="stgw-outline-footer" title={workspace?.path}>{workspace?.title || basename(workspace?.path) || '当前工作区'}<br/>学习事实保存在工作区文档中</div>
  </aside>;
}

export function Resizer({ label, value, min, max, direction = 1, onChange }) {
  const cleanup = useRef(null);
  useEffect(() => () => cleanup.current?.(), []);
  return <div className="stgw-resizer" role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} tabIndex={0} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    onChange(event.key === 'Home' ? min : event.key === 'End' ? max : Math.min(max, Math.max(min, value + (event.key === 'ArrowRight' ? 16 : -16) * direction)));
  }} onPointerDown={event => {
    if (event.button !== 0) return;
    event.preventDefault(); cleanup.current?.();
    const start = event.clientX, original = value;
    const move = e => onChange(Math.min(max, Math.max(min, original + (e.clientX - start) * direction)));
    const up = () => cleanup.current?.();
    const scope = event.currentTarget.closest('.stgw-root'), previousCursor = scope?.style.cursor;
    if (scope) scope.style.cursor = 'col-resize';
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up, { once: true }); document.addEventListener('pointercancel', up, { once: true });
    cleanup.current = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); if (scope) scope.style.cursor = previousCursor || ''; cleanup.current = null; };
  }}/>
}

export function Empty({ title, children, actions, icon = 'book' }) { return <div className="stgw-empty"><div className="stgw-empty-icon"><Icon name={icon} size={23}/></div><h2>{title}</h2><p>{children}</p>{actions && <div className="stgw-empty-actions">{actions}</div>}</div>; }

export function ViewTabs({ view, onChange }) {
  const tabs = [['read', '阅读'], ['answer', '作答'], ['review', '复习']];
  return <div className="stgw-tabs" role="tablist" aria-label="学习视图">{tabs.map(([id, title], index) => <button key={id} role="tab" aria-selected={view === id} aria-controls="stgw-view-panel" id={`stgw-view-${id}`} tabIndex={view === id ? 0 : -1} onClick={() => onChange(id)} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    onChange(tabs[next][0]); event.currentTarget.parentNode.children[next]?.focus();
  }}>{title}</button>)}<SlidingIndicator value={view} selector="[role=tab][aria-selected=true]" variant="pill"/></div>;
}
