/**
 * One geometry model for the teacher panel. Both the floating card and the
 * docked sidebar are the same absolutely-positioned node, so a layout change
 * is an ordinary width/height/left/top interpolation in the same container
 * (never a scale of the conversation text and never a remount).
 *
 * 901px is the existing wide-layout boundary: below it the panel becomes the
 * bottom sheet and the morph is skipped because both layouts are identical.
 */
export const WIDE_MIN_WIDTH = 901;
export const FLOAT_DEFAULT = { width: 420, height: 560 };
export const FLOAT_MIN = { width: 360, height: 380 };
export const LAYOUT_KEY = 'stg-teacher.layout.v2';
export const SIZE_KEY = 'stg-teacher.size.v2';
const finite = (v, fallback) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;

export function readTeacherLayout(storage) {
  try { return storage?.getItem(LAYOUT_KEY) === 'float' ? 'float' : 'split'; } catch { return 'split'; }
}
export function readTeacherSize(storage) {
  try { const value = JSON.parse(storage?.getItem(SIZE_KEY)); return { width: finite(value?.width, FLOAT_DEFAULT.width), height: finite(value?.height, FLOAT_DEFAULT.height) }; }
  catch { return { ...FLOAT_DEFAULT }; }
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

export function panelGeometry({ layout = 'split', width = 0, height = 0, floatingSize = FLOAT_DEFAULT } = {}) {
  const frameWidth = Math.max(0, Math.round(Number(width) || 0));
  const frameHeight = Math.max(0, Math.round(Number(height) || 0));
  if (frameWidth < WIDE_MIN_WIDTH) {
    return { narrow: true, left: 0, top: 0, panelWidth: frameWidth, panelHeight: frameHeight, readingWidth: frameWidth, margin: 0 };
  }
  const compact = frameWidth <= 1100;
  const panelWidth = compact ? 352 : 416, margin = compact ? 14 : 16;
  const readingWidth = Math.max(0, frameWidth - panelWidth);
  if (layout === 'split') {
    return { narrow: false, left: frameWidth - panelWidth, top: 0, panelWidth, panelHeight: frameHeight, readingWidth, margin };
  }
  const top = 16;
  const floatWidth = Math.min(Math.max(FLOAT_MIN.width, finite(floatingSize.width, FLOAT_DEFAULT.width)), Math.max(1, frameWidth - 16));
  const panelHeight = Math.min(Math.max(FLOAT_MIN.height, finite(floatingSize.height, FLOAT_DEFAULT.height)), Math.max(1, frameHeight - 16));
  return {
    narrow: false,
    left: Math.max(0, frameWidth - 16 - floatWidth),
    top,
    panelWidth: floatWidth,
    panelHeight,
    readingWidth: frameWidth,
    margin,
  };
}

/** Keep a dragged panel inside the frame with an 8px visual gutter. */
/**
 * Right-side space the reading surface reserves for a floating panel, so the
 * content column and its controls are not hidden under it. Backgrounds stay
 * full width; only padding changes. Returns 0 when docked, narrow, dragged
 * well away from the right edge, or when too little reading width would remain.
 */
export const FLOAT_READING_MIN = 560;
export function floatReserve(panel, offset, frameWidth) {
  if (!panel || panel.narrow || panel.readingWidth !== frameWidth) return 0;
  const left = panel.left + (Math.round(Number(offset?.x) || 0));
  if (left < frameWidth / 2) return 0;
  const reserve = Math.max(0, Math.round(frameWidth - left + 12));
  return frameWidth - reserve >= FLOAT_READING_MIN ? reserve : 0;
}

export function clampPanelOffset(offset, panel, frame) {
  const x = Math.round(Number(offset?.x) || 0), y = Math.round(Number(offset?.y) || 0);
  if (!panel || panel.narrow) return { x: 0, y: 0 };
  const minX = 8 - panel.left, maxX = frame.width - 8 - (panel.left + panel.panelWidth);
  const minY = 8 - panel.top, maxY = frame.height - 8 - (panel.top + panel.panelHeight);
  return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
}

/**
 * The docked layout pins the panel to the right edge and full height, so any
 * drag offset becomes meaningless - and a leftover offset would push a
 * full-height panel past the bottom of the frame.
 */
export function layoutOffset(layout, offset) {
  if (layout === 'split') return { x: 0, y: 0 };
  return { x: Math.round(Number(offset?.x) || 0), y: Math.round(Number(offset?.y) || 0) };
}

/** Resize from an edge while keeping its opposite edge stationary. */
export function resizePanel(rect, direction, dx, dy, frame) {
  let left = rect.left, top = rect.top, right = rect.left + rect.width, bottom = rect.top + rect.height;
  const minWidth = Math.min(FLOAT_MIN.width, frame.width - 16), minHeight = Math.min(FLOAT_MIN.height, frame.height - 16);
  if (direction.includes('e')) right = clamp(right + dx, left + minWidth, frame.width - 8);
  if (direction.includes('w')) left = clamp(left + dx, 8, right - minWidth);
  if (direction.includes('s')) bottom = clamp(bottom + dy, top + minHeight, frame.height - 8);
  if (direction.includes('n')) top = clamp(top + dy, 8, bottom - minHeight);
  return { left, top, width: right - left, height: bottom - top };
}
