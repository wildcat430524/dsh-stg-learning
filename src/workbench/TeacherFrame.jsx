import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Navigation.jsx';
import { clampPanelOffset, floatReserve, layoutOffset, panelGeometry, readTeacherLayout, readTeacherSize, resizePanel, LAYOUT_KEY, SIZE_KEY } from './teacher-geometry.js';
import { createPanelMorph, watchReducedMotion } from './teacher-morph.js';

export function TeacherWelcome() {
  return <div className="stgt-welcome"><span className="stgt-welcome-mark" aria-hidden="true"><Icon name="chat" size={24}/></span><h2>哪里还没想明白？</h2><p>选中一句话问我，<br/>或者直接说说你的想法。</p></div>;
}
function WindowActionIcon({ floating = false }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">{floating ? <><rect x="8" y="8" width="13" height="12" rx="2"/><path d="M16 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1"/></> : <><path d="M14 3h7v7M21 3l-9 9"/><path d="M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></>}</svg>;
}
function storage() { try { return globalThis.localStorage; } catch { return undefined; } }

/**
 * The teacher panel is one node in both layouts. Toggling only changes the
 * target geometry; the node is never unmounted, so the native conversation,
 * its composer and its draft survive the move. Dragging (float, wide) writes
 * the offset directly and cancels any running morph so it tracks the pointer.
 */
export function TeacherFrame({ children, open, teacher, onClose, onExpand, error, notice, sessionControl, demo = false }) {
  const [layout, setLayout] = useState(() => readTeacherLayout(storage()));
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const frame = useRef(null), card = useRef(null), reading = useRef(null), morph = useRef(null);
  const floatingSize = useRef(readTeacherSize(storage())), resize = useRef(null);
  const drag = useRef(null), offset = useRef({ x: 0, y: 0 }), appliedLayout = useRef(null), wide = useRef(false), geometryRef = useRef(null), painted = useRef('');

  const measure = useCallback(() => panelGeometry({ layout, width: frame.current?.clientWidth || 0, height: frame.current?.clientHeight || 0, floatingSize: floatingSize.current }), [layout]);
  geometryRef.current = measure;

  function paintOffset() {
    if (card.current) card.current.style.transform = `translate(${offset.current.x}px,${offset.current.y}px)`;
  }
  function paintReading(detail) {
    const surface = reading.current;
    if (!surface) return;
    const reserve = open ? floatReserve(detail, offset.current, frame.current?.clientWidth || 0) : 0;
    if (reserve) { surface.style.setProperty('--stgt-float-reserve', `${reserve}px`); surface.dataset.floatReserve = 'true'; }
    else { surface.style.removeProperty('--stgt-float-reserve'); delete surface.dataset.floatReserve; }
    if (!open || detail.narrow) { surface.style.width = ''; return; }
    // Only the docked teacher reserves a column. A floating teacher leaves
    // the full reading surface, toolbar and scroll background available, and
    // only insets their content (see floatReserve) so nothing hides under it.
    surface.style.width = `${detail.readingWidth}px`;
  }
  function place(detail) {
    if (card.current) card.current.dataset.wide = detail.narrow ? 'false' : 'true';
    if (frame.current) frame.current.dataset.teacherNarrow = String(detail.narrow);
    wide.current = !detail.narrow;
    painted.current = JSON.stringify(detail);
    paintOffset(); paintReading(detail);
  }

  // The panel node exists only while open; the morph controller follows it.
  useLayoutEffect(() => {
    morph.current = open && card.current ? createPanelMorph(card.current) : null;
    return () => { morph.current?.dispose(); morph.current = null; };
  }, [open]);

  useLayoutEffect(() => {
    const detail = measure();
    const changing = appliedLayout.current !== null && appliedLayout.current !== layout;
    appliedLayout.current = layout;
    const size = { width: frame.current?.clientWidth || 0, height: frame.current?.clientHeight || 0 };
    // The docked layout ignores any drag: its offset is always zero, and a
    // leftover offset would push a full-height panel past the frame bottom.
    offset.current = layoutOffset(layout, clampPanelOffset(detail.narrow ? { x: 0, y: 0 } : offset.current, detail, size));
    if (offset.current.x !== position.x || offset.current.y !== position.y) setPosition(offset.current);
    place(detail);
    // A layout change morphs the already-painted node to the new geometry.
    // Mounting, reopening and resizes snap so nothing animates on entry.
    if (changing && !detail.narrow) morph.current?.apply(detail, { animate: true });
    else morph.current?.snap(detail);
  }, [layout, open]);

  useEffect(() => {
    if (!open || !frame.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    let frameRequest = 0;
    // Compare the geometry actually painted: only a real change re-paints, so
    // the observer cannot ping-pong against its own size writes. The write is
    // deferred to the next frame as well, so a size change never lands inside
    // the observer delivery and loops.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameRequest);
      frameRequest = requestAnimationFrame(() => {
        const detail = geometryRef.current();
        const size = { width: frame.current?.clientWidth || 0, height: frame.current?.clientHeight || 0 };
        const next = layoutOffset(layout, clampPanelOffset(detail.narrow ? { x: 0, y: 0 } : offset.current, detail, size));
        if (next.x === offset.current.x && next.y === offset.current.y && painted.current === JSON.stringify(detail)) return;
        // A resize must not let an old morph land on a size that no longer
        // exists; drop the drag and snap to the new geometry.
        drag.current = null; resize.current = null;
        morph.current?.cancel();
        offset.current = next;
        setPosition(next);
        place(detail); morph.current?.snap(detail);
      });
    });
    observer.observe(frame.current);
    return () => { cancelAnimationFrame(frameRequest); observer.disconnect(); };
  }, [open, layout]);

  useEffect(() => watchReducedMotion(reduced => {
    // A preference change mid-flight settles immediately instead of finishing
    // the geometric tween the user just opted out of.
    if (reduced && morph.current?.running) morph.current.snap(geometryRef.current());
  }), []);

  function move(next) {
    const detail = geometryRef.current();
    if (detail.narrow) return;
    const clamped = clampPanelOffset(next, detail, { width: frame.current?.clientWidth || 0, height: frame.current?.clientHeight || 0 });
    if (clamped.x === offset.current.x && clamped.y === offset.current.y) return;
    offset.current = clamped; setPosition(clamped); paintOffset();
  }

  function changeLayout() {
    const next = layout === 'float' ? 'split' : 'float';
    // Cancel a drag or morph in flight, then let the geometry effect read the
    // current (committed) rectangle as the new animation's start value.
    const box = card.current?.getBoundingClientRect(), bounds = frame.current?.getBoundingClientRect();
    morph.current?.cancel();
    drag.current = null; resize.current = null;
    // Fold the drag translation into layout coordinates before clearing it,
    // so docking starts where the user actually left the floating panel.
    if (box && bounds && wide.current) {
      card.current.style.left = `${box.left - bounds.left}px`;
      card.current.style.top = `${box.top - bounds.top}px`;
    }
    offset.current = { x: 0, y: 0 }; setPosition(offset.current); paintOffset();
    setLayout(next);
    try { storage()?.setItem(LAYOUT_KEY, next); } catch { /* A preference must not block the conversation. */ }
  }

  function startDrag(event) {
    if (layout !== 'float' || !wide.current || event.button !== 0 || event.target.closest('button') || event.target.closest('[popover],.stgt-session-menu,.stga-backdrop,.stga-dialog')) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = null; settleForMove(); drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: offset.current };
  }
  function dragMove(event) { const active = drag.current; if (active && event.pointerId === active.pointerId) move({ x: active.start.x + event.clientX - active.x, y: active.start.y + event.clientY - active.y }); }
  // Re-evaluate the reading inset once a move ends, never mid-drag.
  function stopDrag() { if (drag.current) { drag.current = null; paintReading(geometryRef.current()); } }
  function settleForMove() {
    if (!morph.current?.running) return;
    const box = card.current.getBoundingClientRect(), bounds = frame.current.getBoundingClientRect();
    const detail = geometryRef.current();
    morph.current.snap(detail);
    // Preserve the current on-screen grab point while resolving the target size.
    move({ x: box.left - bounds.left - detail.left, y: box.top - bounds.top - detail.top });
  }
  function keyboardMove(event) {
    if (event.target !== event.currentTarget || layout !== 'float' || !wide.current) return;
    const steps = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
    if (steps[event.key]) { event.preventDefault(); settleForMove(); move({ x: offset.current.x + steps[event.key][0], y: offset.current.y + steps[event.key][1] }); paintReading(geometryRef.current()); }
    else if (event.key === 'Home') { event.preventDefault(); morph.current?.snap(geometryRef.current()); move({ x: 0, y: 0 }); paintReading(geometryRef.current()); }
  }
  function currentRect() {
    const box = card.current.getBoundingClientRect(), bounds = frame.current.getBoundingClientRect();
    return { left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height };
  }
  function applySize(rect) {
    floatingSize.current = { width: Math.round(rect.width), height: Math.round(rect.height) };
    const detail = geometryRef.current();
    offset.current = { x: Math.round(rect.left - detail.left), y: Math.round(rect.top - detail.top) };
    setPosition(offset.current); place(detail); morph.current?.snap(detail);
  }
  function saveSize() { try { storage()?.setItem(SIZE_KEY, JSON.stringify(floatingSize.current)); } catch { /* Resizing works without persistence. */ } }
  function startResize(event, direction) {
    if (layout !== 'float' || !wide.current || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); drag.current = null; settleForMove();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = { pointerId: event.pointerId, direction, x: event.clientX, y: event.clientY, rect: currentRect() };
  }
  function resizeMove(event) {
    const active = resize.current;
    if (!active || active.pointerId !== event.pointerId) return;
    applySize(resizePanel(active.rect, active.direction, event.clientX - active.x, event.clientY - active.y, { width: frame.current.clientWidth, height: frame.current.clientHeight }));
  }
  function stopResize() { if (resize.current) { resize.current = null; saveSize(); paintReading(geometryRef.current()); } }
  function keyboardResize(event) {
    const steps = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
    if (!steps[event.key] || !wide.current) return;
    event.preventDefault(); settleForMove();
    const [dx, dy] = steps[event.key];
    // Grow leftwards so the grip works against the right viewport boundary.
    applySize(resizePanel(currentRect(), 'sw', -dx, dy, { width: frame.current.clientWidth, height: frame.current.clientHeight })); saveSize();
  }
  return <div ref={frame} className="stgt-frame" data-teacher-open={open || undefined} data-teacher-layout={layout}>
    <style>{teacherFrameCSS}</style><div className="stgt-reading" ref={reading}>{children}</div>
    {open && <aside ref={card} className="stgt-teacher" aria-label="身边的老师" data-wide="true" data-morph="instant" style={{ transform: `translate(${position.x}px,${position.y}px)` }}>
      <header className="stgt-header" tabIndex={layout === 'float' ? 0 : undefined} aria-label={layout === 'float' ? '拖动老师窗口，方向键微调，Home复位' : undefined} onPointerDown={startDrag} onPointerMove={dragMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onKeyDown={keyboardMove}>
        <div className="stgt-identity">{sessionControl || <><Icon name="chat" size={18}/><strong>老师</strong></>}{demo && <span className="stgt-caption">预览</span>}</div>
        <div className="stgt-window-actions"><button aria-label={layout === 'float' ? '固定到侧边' : '切换为浮窗'} title={layout === 'float' ? '固定到侧边' : '切换为浮窗'} aria-pressed={layout === 'split'} onClick={changeLayout}>{layout === 'float' ? <Icon name="panel" size={17}/> : <WindowActionIcon floating/>}</button>{onExpand && <button aria-label="回到 DSH 主对话" title="回到 DSH 主对话" onClick={onExpand}><WindowActionIcon/></button>}<button aria-label="收起老师" title="收起老师，保留草稿" onClick={onClose}><Icon name="close" size={17}/></button></div>
      </header>{error && <p className="stgt-error" role="alert">{error}</p>}{notice && <p className="stgt-notice" role="status">{notice}</p>}<div className="stgt-chat">{teacher}</div>{demo && <div className="stgt-footnote">未连接模型 · 仅预览交互</div>}
      {layout === 'float' && ['n','e','s','w','ne','nw','se','sw'].map(direction => <div key={direction} className={`stgt-resize stgt-resize-${direction}`} role={direction === 'se' ? 'button' : undefined} tabIndex={direction === 'se' ? 0 : undefined} aria-label={direction === 'se' ? '调整老师窗口大小，方向键调整宽高' : undefined} aria-hidden={direction !== 'se' ? true : undefined} title={direction === 'se' ? '拖动调整大小，方向键调整宽高' : undefined} onPointerDown={event => startResize(event, direction)} onPointerMove={resizeMove} onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={stopResize} onKeyDown={keyboardResize}/>)}
    </aside>}
  </div>;
}
export const teacherFrameCSS = `
.stgt-frame{--teacher-ink:var(--stgw-ink,#27303d);--teacher-muted:var(--stgw-muted,#5f6a79);--teacher-paper:var(--stgw-paper,#fff);--teacher-line:var(--stgw-line,#e6e9ef);--teacher-accent:var(--stgw-accent,#4779dc);--teacher-wash:color-mix(in srgb,var(--teacher-accent) 4%,var(--teacher-paper));position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr);height:100%;width:100%;min-height:0;min-width:0;color:var(--teacher-ink);background:var(--stgw-canvas,#f7f8fa);font-family:"Segoe UI Variable Text","Microsoft YaHei","PingFang SC","Microsoft YaHei UI",system-ui,sans-serif}
.stgt-reading{grid-column:1;grid-row:1;height:100%;min-height:0;min-width:0;overflow:hidden}
.stgt-reading[data-float-reserve] :is(.stgw-scroll,.stgj-welcome-scroll){padding-right:var(--stgt-float-reserve);box-sizing:border-box}
.stgt-reading[data-float-reserve] :is(.stgw-header,.stgw-document-access,.stgw-main-tools,.stgj-header){padding-right:calc(var(--stgt-float-reserve) + 16px)}
.stgt-teacher{position:absolute;left:0;top:0;z-index:30;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--teacher-paper);overflow:hidden;border:1px solid var(--teacher-line);box-sizing:border-box;border-radius:16px;box-shadow:0 12px 40px #18283f14,0 2px 8px #18283f08}
.stgt-teacher{container-type:size;container-name:teacher;border-radius:14px;box-shadow:0 16px 48px #18283f1a,0 2px 6px #18283f0a}
.stgt-teacher[data-morph=animating]{will-change:left,top,width,height}
.stgt-frame[data-teacher-layout=float] .stgt-header{height:44px;min-height:44px;padding:0 10px 0 16px}
.stgt-resize{position:absolute;z-index:40;touch-action:none;user-select:none}
.stgt-resize-n,.stgt-resize-s{left:14px;right:14px;height:6px;cursor:ns-resize}.stgt-resize-n{top:0}.stgt-resize-s{bottom:0}
.stgt-resize-e,.stgt-resize-w{top:14px;bottom:14px;width:6px;cursor:ew-resize}.stgt-resize-e{right:0}.stgt-resize-w{left:0}
.stgt-resize-ne,.stgt-resize-nw,.stgt-resize-se,.stgt-resize-sw{width:16px;height:16px}.stgt-resize-ne,.stgt-resize-sw{cursor:nesw-resize}.stgt-resize-nw,.stgt-resize-se{cursor:nwse-resize}
.stgt-resize-ne{right:0;top:0}.stgt-resize-nw{left:0;top:0}.stgt-resize-se{right:0;bottom:0}.stgt-resize-sw{left:0;bottom:0}
.stgt-resize-se::after{content:'';position:absolute;right:4px;bottom:4px;width:7px;height:7px;border-right:2px solid var(--teacher-muted);border-bottom:2px solid var(--teacher-muted);border-radius:0 0 2px 0;opacity:.55}
.stgt-resize-se:hover::after,.stgt-resize-se:focus-visible::after{opacity:1;border-color:var(--teacher-accent)}.stgt-resize-se:focus-visible{outline:2px solid var(--teacher-accent);outline-offset:-3px;border-radius:4px}
.stgt-teacher[data-wide=false] .stgt-resize{display:none}
.stgt-frame[data-teacher-narrow=true][data-teacher-open]{grid-template-rows:minmax(210px,1fr) minmax(280px,43%)}
.stgt-frame[data-teacher-narrow=true] .stgt-teacher{position:relative!important;left:0!important;top:0!important;width:auto!important;height:auto!important;grid-column:1;grid-row:2;transform:none!important;border-radius:14px 14px 0 0;border-width:1px 0 0;box-shadow:0 -5px 20px #18283f08}
.stgt-frame[data-teacher-layout=split] .stgt-teacher{border-radius:0;border-width:0 0 0 1px;box-shadow:none}
.stgt-header{height:52px;min-height:52px;padding:0 14px 0 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid color-mix(in srgb,var(--teacher-line) 65%,transparent);user-select:none;touch-action:none}.stgt-frame[data-teacher-layout=float] .stgt-header{cursor:grab}.stgt-frame[data-teacher-layout=float] .stgt-header:active{cursor:grabbing}
.stgt-identity,.stgt-window-actions{display:flex;gap:5px;align-items:center}.stgt-identity{gap:9px}.stgt-identity>svg{color:var(--teacher-muted)}.stgt-header strong{font-size:14px;font-weight:600}.stgt-caption{font-size:10px;color:var(--teacher-muted)}.stgt-header button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;background:transparent;color:var(--teacher-muted);cursor:pointer;border-radius:7px}.stgt-header button:hover{background:var(--teacher-wash);color:var(--teacher-ink)}.stgt-header button:active{background:color-mix(in srgb,var(--teacher-accent) 10%,var(--teacher-paper))}.stgt-header button:focus-visible,.stgt-header:focus-visible{outline:2px solid var(--teacher-accent);outline-offset:-2px}
.stgt-teacher .stgt-chat *{--dsh-composer-text-max-height:180px;--dsh-composer-side-clearance:14px}
.stgt-chat{--dsw-specific-input-major:var(--teacher-wash);--dsw-radius-panel:13px;--dsh-content-font-size:14px;flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden;position:relative;padding-bottom:10px}.stgt-chat>div{min-height:0;flex:1}.stgt-chat .stgw-native-tools{display:none}.stgt-error{font-size:12px;margin:0;padding:10px 18px;color:var(--dsw-alias-state-error-primary,#b44)}.stgt-notice{font-size:11px;line-height:1.55;margin:0;padding:8px 18px;color:var(--teacher-muted);background:var(--teacher-wash)}.stgt-footnote{text-align:center;font-size:10px;line-height:1.5;padding:0 12px 10px;color:var(--teacher-muted)}
.stgt-welcome{flex:1;min-height:90px;scrollbar-width:thin;overflow:auto;padding:38px 28px 22px;color:var(--teacher-muted);font-size:13px;line-height:1.85}.stgt-welcome-mark{color:var(--teacher-accent);display:block;margin-bottom:16px}.stgt-welcome h2{font:600 21px/1.5 "Segoe UI Variable Text","Microsoft YaHei UI",sans-serif;color:var(--teacher-ink);margin:0 0 10px}.stgt-welcome p{margin:0}
.stgt-preview-chat{display:flex;flex-direction:column;height:100%;min-height:0;padding:0 16px;box-sizing:border-box}.stgt-preview-chat .stgt-welcome{padding-left:12px}.stgt-composer{border:1px solid var(--teacher-line);background:var(--teacher-wash);border-radius:16px;padding:14px 16px 10px;flex-shrink:0}.stgt-composer:focus-within{border-color:color-mix(in srgb,var(--teacher-accent) 45%,var(--teacher-line));box-shadow:0 0 0 3px var(--teacher-wash)}.stgt-composer textarea{scrollbar-width:thin;resize:none;width:100%;box-sizing:border-box;height:88px;max-height:180px;border:0;outline:0;background:transparent;color:inherit;font:13px/1.85 "Microsoft YaHei UI",sans-serif}.stgt-composer-tools{display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--teacher-muted);padding-top:8px}.stgt-send-preview{display:grid;place-items:center;border:0;background:var(--teacher-accent);color:white;width:29px;height:29px;border-radius:50%;font-size:17px;opacity:.45}.stgt-sample-toggle{color:var(--teacher-accent);font-family:inherit;font-size:11px;border:0;background:transparent;padding:8px 0;cursor:pointer;align-self:flex-start}.stgt-example{overflow:auto;flex:1;padding:18px 12px;font-size:13px;line-height:1.9}.stgt-example-label{color:var(--teacher-muted);font-size:10px;margin-bottom:20px}.stgt-example-user{margin:0 0 25px auto;background:var(--teacher-wash);border-radius:13px 13px 3px 13px;padding:12px 16px;max-width:85%}.stgt-example-answer{margin:0 0 12px}.stgt-example-answer strong{font-weight:600}.stgt-example blockquote{margin:18px 0;padding:4px 0 4px 15px;border-left:2px solid var(--teacher-accent);color:var(--teacher-muted)}

/* The reading canvas stays a barely-tinted neutral; only the document sheet is
   white. The docked teacher shares the outer surface, so the two columns read as
   one workspace instead of two unrelated applications. */
.stgt-frame .stgw-scroll{background:var(--stgw-canvas,#f7f8fa)}.stgt-frame :is(.stgw-content,.stgw-progress-page){max-width:896px;margin:18px auto;width:100%;box-sizing:border-box;padding:clamp(24px,2.8vw,34px) clamp(24px,4.4vw,68px) 56px}.stgt-frame .stgw-lesson-title{font-size:15px;font-weight:500;letter-spacing:0}.stgt-frame .stgw-main-tools{background:var(--stgw-paper,#fff);border-bottom-color:var(--stgw-line,#e6e9ef)}
.stgw-selection.stgt-selection{position:fixed;left:0;top:0;bottom:auto;transform:none;margin:0;z-index:80;display:flex;gap:0;padding:4px;border:1px solid var(--teacher-line);background:var(--teacher-paper);border-radius:9px;box-shadow:0 6px 24px #25365b18;width:auto;max-width:calc(100vw - 20px);white-space:nowrap}.stgt-selection[data-placed=false],.stgt-selection[data-hidden=true]{visibility:hidden;pointer-events:none}.stgt-selection button{min-height:32px;padding:6px 10px;border-radius:6px;max-width:none}.stgt-selection button:nth-child(2){color:var(--teacher-accent);background:var(--teacher-wash)}.stgt-selection button:last-child{border:0;padding:5px}.stgt-selection-status{font-size:11px;color:var(--teacher-muted);padding:0 6px}
@media(max-width:900px){.stgt-frame[data-teacher-open]{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(210px,1fr) minmax(280px,43%)}.stgt-frame[data-teacher-open][data-teacher-layout=float] .stgt-reading{width:100%}.stgt-frame[data-teacher-open] .stgt-teacher{position:relative!important;left:0!important;top:0!important;width:auto!important;height:auto!important;grid-column:1;grid-row:2;min-height:0;max-height:none;transform:none!important;border-radius:14px 14px 0 0;border-width:1px 0 0;box-shadow:0 -5px 20px #18283f08}.stgt-header{height:44px;min-height:44px}.stgt-frame[data-teacher-layout=float] .stgt-header{cursor:default}.stgt-frame .stgj-header{height:42px;min-height:42px}.stgt-welcome{padding:18px 20px}.stgt-welcome h2{font-size:18px}.stgt-welcome-mark{display:none}.stgt-preview-chat{padding-inline:12px}.stgt-composer textarea{height:62px}.stgt-composer{padding:10px 12px 6px}.stgt-footnote{padding-bottom:6px}}
@container teacher (max-height:520px){
 .stgt-welcome{padding:16px 20px 12px;min-height:64px;font-size:12px;line-height:1.65}.stgt-welcome-mark{display:none}.stgt-welcome h2{font-size:17px;line-height:1.5;margin-bottom:6px}.stgt-welcome br{display:none}
 .stgt-chat{padding-bottom:8px}.stgt-chat *{--dsh-composer-text-max-height:88px!important;--dsh-composer-side-clearance:10px!important;--dsh-composer-dock-inset:0px;--dsw-radius-panel:10px}
 .stgt-preview-chat{padding:0 10px}.stgt-preview-chat .stgt-welcome{padding-left:8px}.stgt-composer{border-radius:11px;padding:10px 12px 8px}.stgt-composer textarea{height:54px;max-height:88px}.stgt-composer-tools{padding-top:4px}.stgt-footnote{font-size:9px;padding-bottom:5px}.stgt-sample-toggle{padding:4px 0}
}
@container teacher (max-width:390px){.stgt-welcome{padding-inline:16px}.stgt-chat *{--dsh-composer-side-clearance:8px!important}.stgt-example{padding-inline:6px}.stgt-header{gap:4px}.stgt-window-actions{gap:2px}}
@media(prefers-reduced-motion:no-preference){.stgt-header button{transition:background-color .15s,color .15s}.stgt-composer{transition:border-color .15s,box-shadow .15s}}
@media(prefers-reduced-motion:reduce){.stgt-teacher{transition:none!important;animation:none!important}}
@media(forced-colors:active){.stgt-teacher,.stgt-selection,.stgt-composer{border-color:CanvasText}}
`;





