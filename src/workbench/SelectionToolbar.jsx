import React, { useCallback, useEffect, useRef } from 'react';
import { autoUpdate, computePosition, flip, hide, inline, offset, shift } from '@floating-ui/dom';
import { rangeConnected, rangeClientRects, rangeVisibleIn, virtualAnchor } from './selection-anchor.js';
import { Icon } from './Navigation.jsx';

/**
 * The quote toolbar is positioned against the live Range, not against pixels
 * captured once. @floating-ui/dom owns the placement (flip above when the
 * selection sits near the bottom, shift inside the viewport) and re-runs it on
 * reading-surface scroll, window resize, container resize and layout shift.
 * A stale async placement can never win: every computation carries a sequence
 * token that the effect bumps on cleanup or on a newer selection.
 */
export function SelectionToolbar({ anchor, viewport, busy, asking, onAsk, onDismiss, onError }) {
  const node = useRef(null);
  const update = useCallback(() => {
    const floating = node.current, range = anchor?.range;
    if (!floating || !range) return;
    const reference = virtualAnchor(range);
    let sequence = 0, frame = 0, disposed = false;
    const place = () => {
      const token = ++sequence;
      computePosition(reference, floating, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [inline(), offset(8), flip({ padding: 8, boundary: viewport.current }), shift({ padding: 8, boundary: viewport.current }), hide({ strategy: 'referenceHidden' })],
      }).then(({ x, y, middlewareData }) => {
        if (disposed || token !== sequence) return;
        // `hide()` reports a reference fully clipped by its overflow ancestor
        // (the reading scroller); the extra range check covers detached or
        // collapsed ranges the middleware cannot see. Position is still written
        // so a selection that scrolls back into view reappears in place.
        const hidden = Boolean(middlewareData.hide?.referenceHidden)
          || !rangeConnected(range) || !rangeVisibleIn(rangeClientRects(range), viewport?.current?.getBoundingClientRect?.());
        floating.style.left = `${x}px`;
        floating.style.top = `${y}px`;
        floating.dataset.hidden = hidden ? 'true' : 'false';
        floating.dataset.placed = 'true';
        floating.style.visibility = hidden ? 'hidden' : 'visible';
      }).catch(() => { if (!disposed && token === sequence) onError?.('选段工具条暂时无法定位，请重新选择原文。'); });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
    const stop = autoUpdate(reference, floating, schedule, { ancestorScroll: true, ancestorResize: true, elementResize: true, layoutShift: true });
    place();
    return () => { disposed = true; sequence++; cancelAnimationFrame(frame); stop(); };
  }, [anchor, viewport, onError]);
  useEffect(update, [update]);
  return <div ref={node} className="stgw-selection stgt-selection" role="toolbar" aria-label="选段提问" aria-busy={asking || busy} data-asking={asking ? 'true' : 'false'} data-placed="false" data-hidden="false" onMouseDown={event => event.preventDefault()}>
    <button type="button" title="把选中的原文加到导师输入框" disabled={asking || busy} onClick={() => onAsk?.('quote')}>添加到提问</button>
    <button type="button" title="使用完整 DSH 会话问老师这句话" disabled={asking || busy} onClick={() => onAsk?.('quick')}><Icon name="chat" size={13}/>在旁边问老师</button>
    {asking ? <span className="stgw-selection-status" role="status">正在准备…</span> : null}
    <button type="button" className="stgw-icon" aria-label="取消选段" title="取消选段（Esc）" onClick={() => onDismiss?.()}><Icon name="close" size={12}/></button>
  </div>;
}
