import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** One persistent indicator, measured in layout coordinates: never scale its corners. */
export function SlidingIndicator({ value, selector, variant = 'line' }) {
  const marker = useRef(null), previous = useRef(value);
  useLayoutEffect(() => {
    const element = marker.current, bar = element?.parentElement;
    if (!bar) return;
    const selected = bar.querySelector(selector);
    let frame;
    const measure = () => {
      if (!selected) { element.dataset.ready = 'false'; return; }
      const bounds = selected.getBoundingClientRect(), parent = bar.getBoundingClientRect();
      element.style.left = `${bounds.left - parent.left + bar.scrollLeft - bar.clientLeft}px`;
      element.style.width = `${bounds.width}px`;
      element.dataset.ready = 'true';
    };
    if (previous.current !== value && selected) {
      const bounds = selected.getBoundingClientRect(), parent = bar.getBoundingClientRect();
      // Move only this horizontal navigation strip, never the document or editor.
      if (bounds.left < parent.left) bar.scrollLeft -= parent.left - bounds.left + 8;
      else if (bounds.right > parent.right) bar.scrollLeft += bounds.right - parent.right + 8;
    }
    previous.current = value;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(bar);
    if (selected) observer.observe(selected);
    bar.addEventListener('scroll', schedule, { passive: true });
    return () => { observer.disconnect(); bar.removeEventListener('scroll', schedule); cancelAnimationFrame(frame); };
  }, [value, selector]);
  return <span ref={marker} className={`stgw-sliding-indicator stgw-indicator-${variant}`} data-ready="false" aria-hidden="true"/>;
}

/** Animate an existing reading surface only on navigation, not typing or polling. */
export function useReadingTransition(surface, location, ready) {
  const previous = useRef(location), pending = useRef(false), animation = useRef(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (previous.current !== location) pending.current = true;
    previous.current = location;
    animation.current?.cancel();
    if (!ready || !pending.current) return;
    pending.current = false;
    // Query again at the action boundary: media changes can precede their event
    // delivery in a background renderer or immediately after an OS setting change.
    if (!reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches && surface.current?.animate) animation.current = surface.current.animate(
      [{ opacity: 0.72, translate: '0 4px' }, { opacity: 1, translate: '0 0' }],
      { duration: 160, easing: 'cubic-bezier(.2,.9,.22,1)' },
    );
    return () => animation.current?.cancel();
  }, [location, ready, reduced, surface]);
}

export function SaveState({ saving, dirty }) {
  return <span className="stgw-save-state" data-dirty={dirty} data-state={saving ? 'saving' : dirty ? 'dirty' : 'saved'} role="status">
    {saving ? <span className="stgw-spinner" aria-hidden="true"/> : dirty ? <i className="stgw-draft-dot" aria-hidden="true"/> : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path className="stgw-save-check" d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    {saving ? '正在保存…' : dirty ? '草稿未保存' : '已保存'}
  </span>;
}

export function ReadingSkeleton({ label = '正在读取文档…' }) {
  return <div className="stgw-reading-skeleton" role="status" aria-label={label}>
    <div className="stgw-skeleton-eyebrow"/><div className="stgw-skeleton-title"/><div className="stgw-skeleton-file"/>
    <div className="stgw-skeleton-heading"/><div className="stgw-skeleton-line"/><div className="stgw-skeleton-line"/><div className="stgw-skeleton-line stgw-skeleton-short"/>
    <span className="stgw-sr">{label}</span>
  </div>;
}
