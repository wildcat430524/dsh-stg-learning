// Deliberately data-only: no expressions, URLs, HTML, or generated code.
export function validateTeachingVisual(value) {
  const text = (v, max = 400) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!value || typeof value !== 'object' || value.version !== 1 || !text(value.title, 100) || !text(value.summary, 600)) return null;
  if (!['steps', 'bars'].includes(value.type) || !Array.isArray(value.items) || value.items.length < 2 || value.items.length > 12) return null;
  if (!value.items.every(item => item && text(item.label, 80) && text(item.detail) && (value.type !== 'bars' || (typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0 && item.value <= 1e12)))) return null;
  if (value.type === 'bars' && (!text(value.unit, 40) || !text(value.source, 200))) return null;
  return { version: 1, type: value.type, title: value.title, summary: value.summary,
    ...(value.type === 'bars' ? { unit: value.unit, source: value.source } : {}),
    items: value.items.map(item => ({ label: item.label, detail: item.detail, ...(value.type === 'bars' ? { value: item.value } : {}) })) };
}

export function extractTeachingVisuals(text) {
  if (typeof text !== 'string' || text.length > 200000) return [];
  const results = [];
  // Require complete, standalone markers; unfinished streams never become UI.
  const pattern = /^<!--stg-visual\s*\n([\s\S]*?)\n-->[ \t]*$/gm;
  for (const match of text.matchAll(pattern)) {
    let fence = null;
    for (const line of text.slice(0, match.index).split('\n')) {
      const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!delimiter) continue;
      if (!fence) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = null;
    }
    if (fence) continue;
    if (results.length === 3) break;
    if (match[1].length > 14000) continue;
    try { const data = validateTeachingVisual(JSON.parse(match[1])); if (data) results.push(data); } catch { /* The adjacent explanation remains readable. */ }
  }
  return results;
}

export const VISUAL_PENDING_TEXT = '图示生成中…';
/**
 * Display text for one rendered text node while an answer streams. An
 * unfinished marker becomes a short placeholder; a finished valid marker is
 * removed because the diagram renders below the answer. An invalid finished
 * marker stays readable. Returns the input unchanged when nothing applies.
 */
export function maskTeachingVisualText(text) {
  if (typeof text !== 'string' || !text.includes('<!--stg-visual')) return text;
  let output = '', rest = text;
  for (let start = rest.indexOf('<!--stg-visual'); start >= 0; start = rest.indexOf('<!--stg-visual')) {
    output += rest.slice(0, start);
    const end = rest.indexOf('-->', start);
    if (end < 0) return output + VISUAL_PENDING_TEXT;
    const marker = rest.slice(start, end + 3);
    const body = marker.slice('<!--stg-visual'.length, -3).trim();
    let valid = false;
    try { valid = Boolean(validateTeachingVisual(JSON.parse(body))); } catch { /* Keep it readable. */ }
    if (!valid) output += marker;
    rest = rest.slice(end + 3);
  }
  return output + rest;
}

export const TEACHING_VISUAL_PROTOCOL = `当前STG支持回答末尾的本地交互图解。只有步骤/处理过程或数值对比明显帮助理解时使用，简单问答不配图。先用自然语言把关键点讲清，文字本身必须能独立理解，再附一个独立的HTML注释（不要包代码围栏）：
<!--stg-visual
{"version":1,"type":"steps","title":"处理过程","summary":"选择一步查看解释。","items":[{"label":"输入","detail":"说明输入。"},{"label":"输出","detail":"说明结果。"}]}
-->
type只允许steps或bars；items为2至12项，每项label和detail都是纯文本。bars每项另有非负有限数字value，并在顶层提供unit和source；模拟数据的source明确写“示意数据”，不能编造真实统计。title不超过100字、summary600字、label80字、detail400字。不要在数据内写HTML、URL、脚本、注释结束符或表达式。图解随本轮回答结束后显示，点选项目在本地切换解释，无需学生再发送消息；不声称支持拖拽实验、任意函数或当前协议没有的图种。不能生成合适数据就只用文字或表格。`;
