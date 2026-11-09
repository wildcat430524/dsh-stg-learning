import React, { useId, useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import katex from 'katex';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import { localDocumentPath } from './model.js';
import { studyMarkers } from './study-markers.js';

for (const [name, language] of Object.entries({ javascript, typescript, python, json, bash, css, xml })) hljs.registerLanguage(name, language);
const md = new MarkdownIt({ html: false, linkify: true, typographer: false, highlight(code, language) {
  return language && hljs.getLanguage(language) ? hljs.highlight(code, { language, ignoreIllegals: true }).value : '';
} }).use(studyMarkers);
// Native MathML keeps mathematics accessible and avoids injecting global font CSS
// into DSH. Raw document HTML is always treated as text.
md.inline.ruler.after('escape', 'stgw_math', (state, silent) => {
  const start = state.pos;
  if (state.src[start] !== '$' || state.src[start + 1] === '$' || /\s/.test(state.src[start + 1] || '')) return false;
  let end = start + 1;
  while ((end = state.src.indexOf('$', end)) !== -1 && state.src[end - 1] === '\\') end++;
  if (end < 0 || /\s/.test(state.src[end - 1]) || /\d/.test(state.src[end + 1] || '')) return false;
  if (!silent) { const token = state.push('stgw_math', 'math', 0); token.content = state.src.slice(start + 1, end); }
  state.pos = end + 1;
  return true;
});
md.renderer.rules.stgw_math = (tokens, index) => katex.renderToString(tokens[index].content, { throwOnError: false, trust: false, output: 'mathml' });
md.block.ruler.before('fence', 'stgw_math_block', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
  if (!line.startsWith('$$')) return false;
  if (silent) return true;
  let content, next;
  if (line.length > 4 && line.endsWith('$$')) { content = line.slice(2, -2); next = start + 1; }
  else {
    let closing = start + 1;
    while (closing < end && state.src.slice(state.bMarks[closing], state.eMarks[closing]).trim() !== '$$') closing++;
    if (closing === end) return false;
    content = [line.slice(2), state.getLines(start + 1, closing, state.blkIndent, false)].join('\n'); next = closing + 1;
  }
  const token = state.push('stgw_math_block', 'math', 0); token.block = true; token.content = content; token.map = [start, next]; state.line = next;
  return true;
});
md.renderer.rules.stgw_math_block = (tokens, index) => `<div class="stgw-math">${katex.renderToString(tokens[index].content, { throwOnError: false, trust: false, output: 'mathml', displayMode: true })}</div>`;
const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index], destination = token.attrGet('src') || '';
  const local = localDocumentPath(env.path, destination);
  if (local) token.attrSet('src', `./api/stg-learning/asset?workspaceId=${encodeURIComponent(env.workspaceId)}&path=${encodeURIComponent(local)}`);
  else if (!/^https?:\/\//i.test(destination)) return `<span class="stgw-missing-image">[${md.utils.escapeHtml(token.content || '图片地址不可用')}]</span>`;
  token.attrSet('loading', 'lazy'); token.attrSet('referrerpolicy', 'no-referrer');
  return defaultImage(tokens, index, options, env, self);
};
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index], href = token.attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) { token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener noreferrer'); }
  else if (href.startsWith('#')) token.attrSet('href', `#${env.id}-${href.slice(1)}`);
  else {
    const local = localDocumentPath(env.path, href);
    if (local && /\.(md|markdown|txt)$/i.test(local)) { token.attrSet('href', '#'); token.attrSet('data-stgw-path', local); }
    else token.attrSet('href', '#');
  }
  return self.renderToken(tokens, index, options);
};
md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const title = tokens[index + 1]?.content || '';
  const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
  const count = env.slugs.get(slug) || 0; env.slugs.set(slug, count + 1);
  tokens[index].attrSet('id', `${env.id}-${slug}${count ? `-${count}` : ''}`);
  return self.renderToken(tokens, index, options);
};

export function Markdown({ content = '', path = '', workspaceId = '', onOpenDocument, className = '' }) {
  const id = useId().replace(/:/g, '');
  const result = useMemo(() => {
    try {
      const html = md.render(typeof content === 'string' ? content : '', { path, workspaceId, id, slugs: new Map() });
      return { html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true, mathMl: true }, ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object'], FORBID_ATTR: ['style'] }) };
    } catch { return { error: true }; }
  }, [content, path, workspaceId, id]);
  if (result.error) return <div className="stgw-render-fallback"><p role="status">此段内容无法排版，以下保留完整原文。</p><pre>{content}</pre></div>;
  return <div className={`stgw-markdown ${className}`} onClick={event => {
    const anchor = event.target.closest?.('a');
    if (!anchor || !event.currentTarget.contains(anchor)) return;
    const local = anchor.getAttribute('data-stgw-path');
    if (local) { event.preventDefault(); onOpenDocument?.(local); }
    else if (anchor.getAttribute('href')?.startsWith('#')) {
      event.preventDefault();
      const target = [...event.currentTarget.querySelectorAll('[id]')].find(node => node.id === anchor.getAttribute('href').slice(1));
      target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }} dangerouslySetInnerHTML={{ __html: result.html }} />;
}

export class SectionBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  componentDidUpdate(previous) { if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: false }); }
  render() { return this.state.error ? <div className="stgw-inline-error" role="alert">{this.props.label || '此区域暂时无法显示。'}<button onClick={() => this.setState({ error: false })}>重新显示</button>{this.props.fallback}</div> : this.props.children; }
}
