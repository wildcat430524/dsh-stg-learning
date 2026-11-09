import { experienceCSS } from './experience-style.js';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Navigation.jsx';
import { workbenchCSS } from './style.js';
import { operationId } from './model.js';
import { NewLearningWizard } from './NewLearningWizard.jsx';

export const learningLibraryCSS = `
.stgw-library{overflow:auto;display:block!important;height:100%;min-height:0}.stgw-library-inner{width:min(840px,100%);margin:auto;padding:54px 36px 30px}.stgw-library-top{display:flex;align-items:center;justify-content:space-between;gap:16px}.stgw-library-brand{display:flex;align-items:center;gap:9px;color:var(--stgw-accent);font-size:12px;letter-spacing:.08em}.stgw-library h1{font-size:30px;font-weight:550;letter-spacing:-.03em;margin:28px 0 12px}.stgw-library-intro{font-size:13px;line-height:1.9;color:var(--stgw-muted);margin:0 0 30px;max-width:560px}.stgw-library-options{display:grid;grid-template-columns:1fr 1fr;gap:18px}.stgw-library-card{border:1px solid var(--stgw-line);border-radius:14px;padding:26px;display:flex;flex-direction:column;align-items:flex-start;gap:16px;background:var(--stgw-bg)}.stgw-library-card:first-child{border-color:color-mix(in srgb,var(--stgw-accent) 32%,var(--stgw-line));background:linear-gradient(140deg,var(--stgw-active),var(--stgw-bg) 80%)}.stgw-library-symbol{width:42px;height:42px;border:1px solid var(--stgw-line);border-radius:12px;display:grid;place-items:center;color:var(--stgw-accent);background:var(--stgw-bg)}.stgw-library-card h2{font-size:18px;font-weight:550;margin:0}.stgw-library-card p{font-size:12px;color:var(--stgw-muted);line-height:1.85;margin:0;flex:1}.stgw-library-card button{margin-top:3px}.stgw-library-create{margin:20px 0 0;padding:22px;border:1px solid var(--stgw-line);border-radius:12px;background:var(--stgw-soft)}.stgw-library-create label{font-size:12px;display:block;margin-bottom:9px}.stgw-library-create input{width:min(100%,400px);border:1px solid var(--stgw-line);border-radius:7px;padding:10px 12px;background:var(--stgw-bg);color:var(--stgw-ink);font:inherit;font-size:13px}.stgw-library-create p{font-size:12px;color:var(--stgw-muted);line-height:1.8}.stgw-library-form-actions{display:flex;gap:8px;flex-wrap:wrap}.stgw-library-notice{font-size:12px;line-height:1.8;padding:13px 16px;border:1px solid var(--stgw-line);border-radius:9px;margin:20px 0;overflow-wrap:anywhere}.stgw-library-notice[data-error=true]{color:var(--stgw-danger)}.stgw-library-recent{margin-top:35px}.stgw-library-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.stgw-library-section-title h2{font-size:13px;font-weight:550}.stgw-library-recent-list{border-top:1px solid var(--stgw-line);margin-top:10px}.stgw-root .stgw-learning-space{display:flex;align-items:center;gap:14px;width:100%;padding:17px 2px;border-bottom:1px solid var(--stgw-line);border-radius:0;text-align:left;white-space:normal}.stgw-learning-space>span{min-width:0;flex:1}.stgw-learning-space strong{display:block;font-size:13px;font-weight:500}.stgw-learning-space small{display:block;overflow-wrap:anywhere;font-size:11px;color:var(--stgw-faint);margin-top:5px}.stgw-library-footnote{font-size:11px;color:var(--stgw-faint);line-height:1.9;margin-top:28px}.stgw-space-title{font-size:12px;min-width:0;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stgw-start-guide{margin:15px 28px 0;padding:17px 20px;border:1px solid var(--stgw-line);border-radius:10px;background:var(--stgw-active);font-size:12px;line-height:1.85}.stgw-start-guide strong{display:block;margin-bottom:5px;font-weight:550}.stgw-start-guide p{margin:0 0 10px;color:var(--stgw-muted)}.stgw-start-guide button{border:1px solid var(--stgw-line)}
@media(max-width:650px){.stgw-library-inner{padding:28px 20px}.stgw-library h1{font-size:25px}.stgw-library-options{grid-template-columns:1fr}.stgw-library-card{padding:21px;gap:12px}.stgw-space-title{max-width:120px}.stgw-start-guide{margin:12px 14px 0;padding:14px}.stgw-library-top{flex-wrap:wrap}}
`;

/** Only server-recognized learning roots appear here. No generic workspace picker. */
export function LearningLibrary({ api, items = [], loading, error, onReload, onOpen, onReady, onBack }) {
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(''), [notice, setNotice] = useState(''), [failure, setFailure] = useState('');
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run(kind) {
    if (pending.current) return;
    pending.current = true; setBusy(kind); setNotice(''); setFailure('');
    try {
      const result = await api.importLearning({ operationId: operationId() });
      if (!mounted.current) return;
      if (result.cancelled) setNotice('已取消，未创建或导入任何学习文件夹。');
      else onReady(result.workspace);
    } catch (error) {
      if (mounted.current) setFailure(`${error.message || '操作未完成，请重试。'}${error.details?.createdPath ? ` 已保留：${error.details.createdPath}` : ''}`);
    } finally { pending.current = false; if (mounted.current) setBusy(''); }
  }
  if (creating) return <NewLearningWizard api={api} onCancel={() => setCreating(false)} onReady={onReady}/>;
  return <section className="stgw-root stgw-library" aria-label="StepsToGreat 学习空间" aria-busy={!!busy}>
    <style>{workbenchCSS}{learningLibraryCSS}{experienceCSS}</style>
    <div className="stgw-library-inner">
      <div className="stgw-library-top"><div className="stgw-library-brand"><Icon name="book" size={21}/> StepsToGreat</div>{onBack && <button onClick={onBack}>返回 DSH 对话 <Icon name="back" size={14}/></button>}</div>
      <h1>从这里，开始真正学会。</h1>
      <p className="stgw-library-intro">一个学习文件夹，保存你的目标、课程、作答与成长记录。这里只呈现 StepsToGreat 学习空间，不混入其他 DSH 工作区。</p>
      <div className="stgw-library-options" aria-label="开始学习的两种方式">
        <article className="stgw-library-card"><div className="stgw-library-symbol"><Icon name="book" size={22}/></div><h2>新学习</h2><p>先准备自己的学习空间，再和导师聊清目标，从一个小问题开始。</p><button className="stgw-primary" disabled={!!busy} onClick={() => { setCreating(true); setFailure(''); setNotice(''); }}>新学习 <Icon name="arrow" size={13}/></button></article>
        <article className="stgw-library-card"><div className="stgw-library-symbol"><Icon name="history" size={22}/></div><h2>导入已有</h2><p>选择已有的 StepsToGreat 学习文件夹，接续课程和进度。不复制、不覆盖原有文档。</p><button className="stgw-outline-button" disabled={!!busy} onClick={() => run('import')}>{busy === 'import' ? '等待选择学习文件夹…' : '导入已有 StepsToGreat 文件夹'}<Icon name="arrow" size={13}/></button></article>
      </div>
      {(busy || notice || failure || error) && <div className="stgw-library-notice" data-error={!!(failure || error)} role={failure || error ? 'alert' : 'status'}>{failure || error || notice || (busy === 'create' ? '请在系统窗口选择父文件夹，随后将初始化完整学习框架。' : '请在系统窗口选择已有学习文件夹的根目录。')}</div>}
      <section className="stgw-library-recent" aria-label="我的学习空间"><div className="stgw-library-section-title"><h2>我的学习空间{items.length ? ` · ${items.length}` : ''}</h2><button disabled={loading || !!busy} onClick={onReload}><Icon name="refresh" size={13}/>刷新</button></div>
        {loading ? <p className="stgw-library-footnote" role="status">正在识别学习空间…</p> : items.length ? <div className="stgw-library-recent-list">{items.map(item => <button className="stgw-learning-space" key={item.workspaceId} disabled={!!busy} onClick={() => onOpen(item.workspaceId)}><Icon name="book" size={18}/><span><strong>{item.title}</strong><small>{item.path}</small></span><Icon name="arrow" size={14}/></button>)}</div> : <p className="stgw-library-footnote">还没有学习空间。新建一段学习，或导入你已有的 StepsToGreat 文件夹。</p>}
      </section>
      <p className="stgw-library-footnote">学习事实保存在本地文件夹，不依赖聊天记录。初始化只建立框架；目标、摸底和第一课由你确认后与导师共同完成，不会自动发送消息。</p>
    </div>
  </section>;
}
