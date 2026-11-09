/** Hide only standalone STG bookkeeping markers in reading, never source/code. */
export function studyMarkers(md) {
  md.block.ruler.before('paragraph', 'stgw_study_marker', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
    if (!/^<!--\s*s2g-goal-view:(?:start|end)\s*-->\s*$/.test(line)) return false;
    if (!silent) state.line = start + 1;
    return true;
  }, { alt: ['paragraph'] });
}
