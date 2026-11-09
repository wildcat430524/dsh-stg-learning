import { animate } from 'motion/mini';

const EASE = [0.2, 0.9, 0.22, 1];
const DURATION = 0.32;

export function prefersReducedMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
}

/** Hidden renderers never tick WAAPI, so animating there would paint a stale frame. */
function hiddenRenderer() {
  try { return globalThis.document?.visibilityState === 'hidden'; } catch { return false; }
}

/** Notify on preference changes so a running morph can settle immediately. */
export function watchReducedMotion(change) {
  try {
    const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return () => {};
    const listener = () => change(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  } catch { return () => {}; }
}

function writeNarrow(element) {
  element.style.left = '';
  element.style.top = '';
  element.style.width = '';
  element.style.height = '';
}

/**
 * Drive one DOM node through a geometry morph with motion/mini.
 *
 * motion/mini's animate() is a thin, MIT-licensed wrapper over the Web
 * Animations API. Calling it again for the same element/property first stops
 * the previous animation and commits its current value, so a repeated toggle,
 * a drag start or a resize never continues a stale keyframe. Only
 * left/top/width/height are written - the conversation text is laid out, never
 * scaled - and the node itself is never recreated.
 */
export function createPanelMorph(element) {
  let controls = null, disposed = false;

  function stop() {
    const current = controls;
    controls = null;
    try { current?.stop?.(); } catch { /* An already-finished animation is inert. */ }
  }

  function write(detail) {
    if (!element) return;
    if (detail.narrow) { writeNarrow(element); return; }
    element.style.left = `${detail.left}px`;
    element.style.top = `${detail.top}px`;
    element.style.width = `${detail.panelWidth}px`;
    element.style.height = `${detail.panelHeight}px`;
  }

  function apply(detail, { animate: shouldAnimate = false } = {}) {
    if (disposed || !element) return;
    stop();
    if (detail.narrow) {
      writeNarrow(element);
      element.dataset.morph = 'instant';
      return;
    }
    if (!shouldAnimate || prefersReducedMotion() || hiddenRenderer()) {
      write(detail);
      element.dataset.morph = 'instant';
      return;
    }
    element.dataset.morph = 'animating';
    // No explicit `from` values: motion/mini resolves them from computed style
    // after the previous animation has committed its current value.
    controls = animate(element, {
      left: `${detail.left}px`,
      top: `${detail.top}px`,
      width: `${detail.panelWidth}px`,
      height: `${detail.panelHeight}px`,
    }, { duration: DURATION, ease: EASE });
    const current = controls;
    Promise.resolve(current?.finished).then(() => {
      if (controls !== current) return;
      controls = null;
      if (!disposed && element) { write(detail); element.dataset.morph = 'settled'; }
    }).catch(() => {});
  }

  return {
    apply,
    /** Immediate write; used for the first frame, drag tracking and resize. */
    snap(detail) { apply(detail, { animate: false }); },
    /** Cancel an in-flight morph and jump to its destination. */
    settle(detail) { if (detail) apply(detail, { animate: false }); else stop(); },
    cancel: stop,
    get running() { return Boolean(controls); },
    dispose() { disposed = true; stop(); if (element) { writeNarrow(element); } },
  };
}
