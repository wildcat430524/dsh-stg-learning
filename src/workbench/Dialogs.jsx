import React, { useEffect, useRef } from 'react';
import { Markdown } from './Markdown.jsx';
import { Icon, Empty } from './Navigation.jsx';
import { readableDate } from './model.js';

export function Dialog({ title, subtitle, onClose, children, footer, wide = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => { cancelAnimationFrame(frame); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <div className="stgw-modal-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} className="stgw-dialog" style={!wide ? { width: 650 } : undefined} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(node => !node.hidden && node.getClientRects().length);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  }}><header className="stgw-dialog-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><span className="stgw-spacer"/><button className="stgw-icon" aria-label="关闭窗口" onClick={onClose}><Icon name="close"/></button></header>{children}{footer && <footer className="stgw-dialog-footer">{footer}</footer>}</section></div>;
}

export function ConflictDialog({ conflict, entry, onClose, onReload, onRetry }) {
  return <Dialog title="文档已有新版本" subtitle={conflict.path} onClose={onClose} footer={<><button onClick={onClose}>保留草稿继续编辑</button>{conflict.server ? <button className="stgw-outline-button" onClick={onReload}>采用磁盘版本</button> : <button className="stgw-outline-button" onClick={onRetry}>重新读取磁盘版本</button>}</>}>
    <div className="stgw-dialog-body"><p>导师或其他窗口修改了这份文档。当前草稿和作答仍然保留，请对照后选择。采用磁盘版本后，原草稿仍可从恢复提示找回。</p>
      {conflict.error && <p role="alert">{conflict.error}</p>}
      <div className="stgw-compare"><div><h3>磁盘上的最新内容</h3><pre>{conflict.server ? conflict.server.content : '正在读取最新内容…'}</pre></div><div><h3>你的完整草稿</h3><pre>{entry?.content || ''}{Object.values(entry?.answers || {}).some(Boolean) ? `\n\n—— 尚未提交的本轮作答 ——\n${Object.entries(entry.answers).filter(([, text]) => text?.trim()).map(([id, text]) => `问题 ${id}\n${text}`).join('\n\n')}` : ''}</pre></div></div>
    </div>
  </Dialog>;
}

export function HistoryDialog({ history, entry, workspaceId, onClose, onSelect, onRestore }) {
  const selected = history.items?.find(item => item.id === history.selectedId);
  return <Dialog title="文档历史" subtitle={history.path} onClose={onClose} footer={<><span className="stgw-muted" style={{ marginRight: 'auto', fontSize: 10 }}>恢复前会备份当前文件；未保存的内容保留为草稿。</span><button onClick={onClose}>关闭</button><button className="stgw-primary" disabled={!selected || history.preview == null || history.restoring || entry?.saving} onClick={onRestore}>{history.restoring ? '正在恢复…' : '恢复此版本'}</button></>}>
    {history.error && <div className="stgw-note" data-tone="error" role="alert">{history.error}</div>}
    <div className="stgw-history-layout"><div className="stgw-history-list" aria-label="历史版本列表">{history.loading ? <p className="stgw-muted" style={{ padding: 10, fontSize: 11 }}>正在读取历史…</p> : !history.items?.length ? <p className="stgw-muted" style={{ padding: 10, fontSize: 11 }}>尚无历史版本</p> : history.items.map(item => <button key={item.id} data-active={item.id === history.selectedId} aria-pressed={item.id === history.selectedId} onClick={() => onSelect(item.id)}><span>{readableDate(item.date)}</span><small>{Number.isFinite(item.bytes) ? `${(item.bytes / 1024).toFixed(1)} KB` : item.id}</small></button>)}</div><div className="stgw-history-preview">{history.previewLoading ? <p className="stgw-muted">正在读取所选版本…</p> : history.preview != null ? <Markdown content={history.preview} path={history.path} workspaceId={workspaceId}/> : <Empty title="预览历史版本" icon="history">选择左侧版本，核对内容后再恢复。</Empty>}</div></div>
  </Dialog>;
}
