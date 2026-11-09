import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SelectionToolbar } from './SelectionToolbar.jsx';
import { readSelection } from './selection-anchor.js';

const EXCLUDED = 'input,textarea,[contenteditable="true"],button,[role="toolbar"],[role="menu"],.stgt-welcome';
export function readTeacherSelection(selection, surface) {
  const anchor = readSelection(selection, surface);
  if (!anchor) return null;
  // Never quote a draft, controls or a selection spanning into the composer.
  for (const element of surface.querySelectorAll(EXCLUDED)) {
    if (anchor.range.intersectsNode(element)) return null;
  }
  return anchor;
}

/** Borrows the resident native conversation; no extra editor or Session. */
export function TeacherSelection({ children, sessionId, onAsk }) {
  const surface = useRef(null), pending = useRef(false), mounted = useRef(true);
  const [anchor, setAnchor] = useState(null), [asking, setAsking] = useState(false), [error, setError] = useState('');
  const dismiss = useCallback(() => setAnchor(null), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { dismiss(); setError(''); }, [sessionId, dismiss]);
  useEffect(() => {
    if (!anchor) return;
    const drop = event => { if (!event.target?.closest?.('.stgt-selection')) dismiss(); };
    const changed = () => { if (!document.activeElement?.closest?.('.stgt-selection') && !readTeacherSelection(window.getSelection(), surface.current)) dismiss(); };
    document.addEventListener('pointerdown', drop, true);
    document.addEventListener('selectionchange', changed);
    return () => { document.removeEventListener('pointerdown', drop, true); document.removeEventListener('selectionchange', changed); };
  }, [anchor, dismiss]);
  function capture(event) {
    if (event.target?.closest?.('.stgt-selection')) return;
    setAnchor(readTeacherSelection(window.getSelection(), surface.current)); setError('');
  }
  async function ask(intent) {
    if (pending.current || !anchor) return;
    pending.current = true; setAsking(true); setError('');
    try { await onAsk(intent, anchor.text); if (mounted.current) dismiss(); }
    catch (failure) { if (mounted.current) setError(failure.message || '未能添加选段，请重试。'); }
    finally { pending.current = false; if (mounted.current) setAsking(false); }
  }
  return <div className="stgt-quote-surface" ref={surface} onMouseUp={capture} onKeyUp={event => { if (event.key === 'Shift') capture(event); if (event.key === 'Escape' && anchor) { event.stopPropagation(); dismiss(); } }}>
    <style>{`.stgt-quote-surface{height:100%;min-height:0;display:flex;flex:1;flex-direction:column}.stgt-quote-surface>.stgt-selection{flex:none}.stgt-quote-surface .stgt-selection button{font:12px system-ui;color:inherit;border:0;background:transparent;cursor:pointer}.stgt-quote-error{padding:8px 12px;font-size:12px;color:var(--dsw-alias-state-error-primary,#b44)}`}</style>
    {children}
    {error && <p className="stgt-quote-error" role="alert">{error}</p>}
    {anchor && <SelectionToolbar anchor={anchor} viewport={surface} asking={asking} onAsk={ask} onDismiss={dismiss} onError={message => { dismiss(); setError(message); }}/>} 
  </div>;
}
