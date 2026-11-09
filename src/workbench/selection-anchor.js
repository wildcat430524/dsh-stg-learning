/**
 * Selection anchoring helpers shared by the reading surface and the floating
 * quote toolbar. The toolbar is positioned by @floating-ui/dom against a Range
 * virtual element instead of a hand-clamped pixel pair, so multi-line
 * selections, scrolling, resizes and viewport edges all go through the same
 * geometry path.
 *
 * These functions are deliberately DOM-light so the boundary rules can be
 * unit-tested without a browser.
 */

function elementOf(node) {
  if (!node) return undefined;
  return node.nodeType === 1 ? node : node.parentElement || undefined;
}

/** Read a non-empty text selection confined to the reading surface. */
export function readSelection(selection, reader) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const anchor = selection.anchorNode, focus = selection.focusNode;
  if (!anchor || !focus || !reader?.contains?.(anchor) || !reader.contains(focus)) return null;
  let range;
  try { range = selection.getRangeAt(0); } catch { return null; }
  const text = String(selection).trim();
  if (!range || range.collapsed || !text) return null;
  // A clone keeps the anchor stable even when the browser later moves or
  // collapses the live selection (for example on a toolbar click).
  return { text, range: range.cloneRange ? range.cloneRange() : range };
}

/** Virtual element consumed by computePosition/autoUpdate. */
export function virtualAnchor(range, contextElement) {
  return {
    contextElement: contextElement || elementOf(range?.startContainer),
    getBoundingClientRect: () => range.getBoundingClientRect(),
    getClientRects: () => rangeClientRects(range),
  };
}

export function rangeClientRects(range) {
  try { return Array.from(range?.getClientRects?.() || []); } catch { return []; }
}

/** A selection is only anchored while its original nodes are still mounted. */
export function rangeConnected(range) {
  const node = range?.startContainer;
  return Boolean(node) && node.isConnected !== false;
}

/**
 * True while at least one line of the range intersects the reading viewport.
 * The range's DOM anchors survive scrolling, so the toolbar hides only when
 * every line has left the reading area and reappears when it scrolls back.
 */
export function rangeVisibleIn(rects, viewport) {
  if (!viewport) return true;
  return Array.from(rects || []).some(rect => rect && rect.right > viewport.left && rect.left < viewport.right && rect.bottom > viewport.top && rect.top < viewport.bottom);
}
