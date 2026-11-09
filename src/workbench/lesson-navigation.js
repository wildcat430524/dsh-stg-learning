import MarkdownIt from 'markdown-it';
import { roundKey } from '../round.js';
const parser = new MarkdownIt({ html: true });

/**
 * Menu entries for the teaching document. The teaching entry file itself is
 * already represented by the "教学总入口" row, so a pseudo round whose id is
 * exactly that file and has no round title is folded into that row instead of
 * being listed twice. A named current round is not a pseudo-round even if it
 * is also the guide file. Real same-file rounds (`#round=` anchors, recorded from
 * headings) and independent round files stay selectable; historical rounds are
 * never removed or disabled.
 */
export function teachingChoices(course) {
  const seen = new Set();
  return (course?.rounds || []).filter(round => {
    if (!round?.id || !round.path || seen.has(round.id)) return false;
    seen.add(round.id);
    if (round.id === course.guidePath && round.path === course.guidePath && !roundKey(round.title)) return false;
    return true;
  });
}

export function answerRoundMarkdown(snapshot, key) {
  if (!key || !snapshot) return '';
  const records = (snapshot.records?.rounds || []).filter(record => roundKey(record.round) === key);
  if (records.length) return records.map(record => record.content.trim()).join('\n\n');
  // Legacy documents can identify a round in the question parser without a
  // dedicated round section. Use the original slices, including saved answers.
  return (snapshot.questions?.questions || [])
    .filter(question => roundKey(question.round) === key)
    .map(question => snapshot.content.slice(question.start, question.end).trim())
    .join('\n\n');
}

/** Extract original evidence sections; never manufacture a progress record. */
export function progressExcerpt(content, kind) {
  if (typeof content !== 'string' || !content) return '';
  const lines = content.split('\n'), headings = [], match = kind === 'chapter' ? /🚦|当前交接/ : /📊|掌握|📚|课次.*索引/;
  const tokens = parser.parse(content, {});
  for (let i = 0; i < tokens.length; i++) if (tokens[i].type === 'heading_open' && tokens[i].level === 0 && tokens[i].map) headings.push({ line: tokens[i].map[0], level: Number(tokens[i].tag.slice(1)), title: tokens[i + 1]?.content || '' });
  const ranges = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (!match.test(heading.title)) continue;
    const end = headings.slice(i + 1).find(next => next.level <= heading.level)?.line ?? lines.length;
    if (!ranges.some(range => heading.line >= range.start && heading.line < range.end)) ranges.push({ start: heading.line, end });
  }
  return ranges.map(({ start, end }) => lines.slice(start, end).join('\n').trim()).join('\n\n');
}
