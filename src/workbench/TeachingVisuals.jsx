import React, { useLayoutEffect, useRef, useState } from 'react';
import { extractTeachingVisuals } from '../teaching-visual.js';

const choices = new Map();
function Diagram({ data, identity }) {
  const signature = identity + JSON.stringify(data);
  const [selected, setSelected] = useState(() => choices.get(signature) || 0);
  const select = index => { setSelected(index); choices.delete(signature); choices.set(signature, index); if (choices.size > 128) choices.delete(choices.keys().next().value); };
  const max = Math.max(1, ...data.items.map(item => item.value || 0));
  return <figure className="stgt-diagram" aria-label={data.title}>
    <figcaption><strong>{data.title}</strong><p>{data.summary}</p></figcaption>
    <div className="stgt-diagram-items" role="group" aria-label="选择查看说明">
      {data.items.map((item, i) => <button key={i} type="button" aria-pressed={selected === i} onClick={() => select(i)}>
        <span className="stgt-diagram-label">{data.type === 'steps' && <span className="stgt-diagram-number">{i + 1}</span>}{item.label}</span>
        {data.type === 'bars' && <><span className="stgt-diagram-track" aria-hidden="true"><span style={{ width: `${item.value / max * 100}%` }}/></span><span>{item.value} {data.unit}</span></>}
      </button>)}
    </div>
    <p className="stgt-diagram-detail" aria-live="polite">{data.items[selected].detail}</p>
    {data.type === 'steps' && <nav aria-label="图解步骤"><button disabled={selected === 0} onClick={() => select(selected - 1)}>上一步</button><span>{selected + 1} / {data.items.length}</span><button disabled={selected === data.items.length - 1} onClick={() => select(selected + 1)}>下一步</button></nav>}
    {data.source && <small>{data.source}</small>}
  </figure>;
}

export function TeachingVisuals({ turn, seq, sessionId }) {
  const surface = useRef(null);
  const closing = turn?.data?.get('turn-tail')?.closing;
  const text = closing?.blocks?.filter(block => block.kind === 'text').map(block => block.text).join('\n') || '';
  const diagrams = extractTeachingVisuals(text);
  useLayoutEffect(() => {
    if (!diagrams.length || !surface.current) return;
    // Finalized native Markdown escapes HTML comments into text nodes. Remove
    // only exact validated markers from the adjacent assistant's presentation.
    // Keep every node in place and restore on unload; durable text is untouched.
    const markers = [...text.matchAll(/^<!--stg-visual\s*\n[\s\S]*?\n-->[ \t]*$/gm)].filter(match => extractTeachingVisuals(match[0]).length).map(match => match[0]);
    const row = surface.current.closest('[data-chat-flow-kind="turn-tail"]');
    const previous = row?.previousElementSibling;
    if (previous?.dataset.chatFlowKind !== 'assistant-step' || previous.dataset.chatTurn !== row.dataset.chatTurn) return;
    const walker = document.createTreeWalker(previous, NodeFilter.SHOW_TEXT);
    const changed = [];
    while (walker.nextNode()) {
      const node = walker.currentNode, original = node.data;
      const display = markers.reduce((value, marker) => value.replace(marker, ''), original);
      if (display !== original) { node.data = display; changed.push({ node, original, display }); }
    }
    return () => changed.forEach(({ node, original, display }) => { if (node.data === display) node.data = original; });
  }, [text]);
  if (!diagrams.length) return null;
  return <div className="stgt-diagrams" ref={surface}><style>{`
    .stgt-diagram{margin:16px 0;min-width:0;padding:16px;border:1px solid var(--stgw-line,var(--dsw-alias-border-l3,#dfe3ea));border-radius:12px;color:var(--stgw-ink,var(--dsw-alias-label-primary,#202632));background:var(--stgw-paper,var(--dsw-alias-bg-base,#fff));font:inherit;overflow-wrap:anywhere}
    .stgt-diagram strong{font-size:15px}.stgt-diagram p{line-height:1.65;font-size:13px;margin:8px 0 12px}.stgt-diagram-items{display:grid;gap:6px}
    .stgt-diagram button{font:inherit;font-size:13px;color:inherit;cursor:pointer;border:1px solid transparent;background:transparent;border-radius:7px;padding:8px;text-align:left;min-width:0;overflow-wrap:anywhere}
    .stgt-diagram-items>button{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.stgt-diagram-items>button[aria-pressed=true]{border-color:var(--stgw-accent,#6286d8);background:var(--stgw-active,var(--dsw-alias-interactive-bg-hover,#eef3ff))}
    .stgt-diagram button:focus-visible{outline:2px solid var(--stgw-accent,#4675d1);outline-offset:2px}.stgt-diagram-label{display:flex;gap:8px;align-items:baseline;flex:1 1 90px}.stgt-diagram-number{font-size:11px;color:var(--stgw-faint,var(--dsw-alias-label-secondary,#667085))}
    .stgt-diagram-track{height:7px;background:color-mix(in srgb,var(--stgw-line,#e7ebf2) 70%,transparent);border-radius:4px;flex:1 1 80px;overflow:hidden}.stgt-diagram-track>span{display:block;height:100%;background:var(--stgw-accent,#6286d8)}
    .stgt-diagram .stgt-diagram-detail{padding:10px 0;border-top:1px solid var(--stgw-line,var(--dsw-alias-border-l3,#e7ebf2));margin-top:12px}.stgt-diagram nav{display:flex;justify-content:space-between;align-items:center;font-size:11px}.stgt-diagram button:disabled{opacity:.4;cursor:default}.stgt-diagram small{font-size:11px;color:var(--stgw-faint,var(--dsw-alias-label-secondary,#667085))}
  `}</style>{diagrams.map((data, i) => <Diagram key={JSON.stringify(data)} data={data} identity={`${sessionId}:${seq}:${i}:`} />)}</div>;
}
