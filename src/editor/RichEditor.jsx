import React, {useEffect,useRef,useState} from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import katex from 'katex';
import {createVisualEditor} from './stg/visual-editor.js';
import {replaceMathOutsideCode,normalizeFormula} from './stg/editor-formula.mjs';
import {editorSync,shouldAttemptMount} from './editor-sync.js';
import {localDocumentPath} from '../workbench/model.js';
import './editor.css';

function localImage(source,documentPath,workspaceId){
  if(!workspaceId||typeof source!=='string'||/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\\)/i.test(source))return '';
  let decoded;try{decoded=decodeURIComponent(source.split(/[?#]/)[0]);}catch{return '';}
  const parts=String(documentPath).replace(/\\/g,'/').split('/').slice(0,-1);
  for(const part of decoded.replace(/\\/g,'/').split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return '';parts.pop();}else parts.push(part);}
  return './api/stg-learning/asset?'+new URLSearchParams({workspaceId,path:parts.join('/')});
}

function renderer(path,workspaceId){
  const md=new MarkdownIt({html:false,linkify:true,typographer:false});
  md.renderer.rules.image=(tokens,index)=>{
    const token=tokens[index],src=localImage(token.attrGet('src'),path,workspaceId);
    return src?`<img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(token.content)}" loading="lazy">`:`<span class="stgw-image-placeholder">${md.utils.escapeHtml(token.content||'本地图片')}</span>`;
  };
  const render=source=>{
    const formulas=[];
    const input=replaceMathOutsideCode(source,formula=>{
      const key=`STGFORMULA${formulas.length}RENDER`;
      let html;try{html=katex.renderToString(formula.replace(/^\${1,2}|\${1,2}$/g,''),{displayMode:formula.startsWith('$$'),throwOnError:false,trust:false,strict:'warn'});}catch{html=md.utils.escapeHtml(formula);}
      formulas.push({key,html});return key;
    });
    let html=md.render(input);
    for(const {key,html:math} of formulas)html=html.split(key).join(math);
    return DOMPurify.sanitize(html,{ADD_TAGS:['annotation','semantics'],ADD_ATTR:['encoding'],FORBID_TAGS:['script','iframe','object','embed','style']});
  };
  return {render};
}

/**
 * The document body is editable by default, like STG Desk: there is no global
 * "enter edit" switch, no rich/source mode pair and no resident formatting bar.
 * The same ported Tiptap editor keeps native keyboard editing, undo/redo and IME
 * composition, while formulas/code/special blocks keep their in-place handles.
 * A parse failure falls back to the untouched Markdown source with an explicit
 * retry, so no document bytes are dropped and editing is never disabled.
 */
export function RichEditor({content='',path='',workspaceId='',onChange,onOpenDocument,onEditorReady,readOnly=false}){
  const surface=useRef(null),current=useRef(null),change=useRef(onChange),ready=useRef(onEditorReady),failed=useRef(null),dialog=useRef(null),savedSelection=useRef(null);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0),[formula,setFormula]=useState(null);
  const [mathValue,setMathValue]=useState(''),[display,setDisplay]=useState(false);
  change.current=onChange;ready.current=onEditorReady;
  const publish=api=>{try{ready.current?.(api);}catch{/* A host observer must not break editing. */}};

  useEffect(()=>{
    const previous=current.current;
    const action=editorSync(previous,{path,workspaceId,content,readOnly});
    if(action==='none')return;
    if(action==='editable'){previous.editor.setEditable(!readOnly);previous.editable=!readOnly;return;}
    if(action==='mount'&&!shouldAttemptMount(failed.current,{path,workspaceId}))return;
    if(previous){previous.editor.destroy();current.current=null;publish(null);}
    try{
      if(!surface.current)throw Error('编辑器容器尚未就绪。');
      surface.current.replaceChildren();
      const md=renderer(path,workspaceId);
      const editor=createVisualEditor(surface.current,content,value=>{
        if(current.current)current.current.source=value;
        change.current?.(value);
      },{path,renderMD:md.render,onMath:item=>{
        savedSelection.current=current.current?.editor?.state.selection||null;
        setFormula(item);setMathValue(item.source.replace(/^\${1,2}|\${1,2}$/g,''));setDisplay(item.display);
      }});
      editor.setEditable(!readOnly);
      current.current={editor,path,workspaceId,source:content,editable:!readOnly};
      failed.current=null;setError('');
      publish({insertFormula:()=>openFormula(editor),focus:()=>editor.commands.focus()});
    }catch(e){
      failed.current={path,workspaceId};
      current.current=null;setError(e?.message||'编辑器暂时不可用。');
      publish(null);
    }
  },[content,path,workspaceId,readOnly,attempt]);
  useEffect(()=>()=>{current.current?.editor.destroy();current.current=null;publish(null);},[]);
  useEffect(()=>{if(formula&&!dialog.current?.open)dialog.current?.showModal();},[formula]);

  function command(fn){try{fn(current.current?.editor);}catch(e){setError(e.message||'操作未完成。');}}
  function openFormula(editor){
    savedSelection.current=editor?.state?.selection||null;
    setMathValue('');setDisplay(false);setFormula({insert:true});
  }
  function finishMath(){
    if(readOnly)return;
    const value=normalizeFormula(mathValue,display);
    if(formula?.apply)formula.apply(value);
    else command(editor=>{
      const selection=savedSelection.current;
      if(selection&&selection.from<=editor.state.doc.content.size)editor.commands.setTextSelection({from:selection.from,to:selection.to});
      editor?.chain().focus().insertContent({type:display?'mathBlock':'mathInline',attrs:{source:value}}).run();
    });
    dialog.current?.close();savedSelection.current=null;setFormula(null);
  }
  function retry(){
    failed.current=null;setError('');setAttempt(value=>value+1);
  }
  function followLink(event){
    const anchor=event.target.closest?.('a');
    if(!anchor||!surface.current?.contains(anchor))return;
    const href=anchor.getAttribute('href')||'';
    if(/^https?:/i.test(href)){if(event.ctrlKey||event.metaKey){event.preventDefault();window.open?.(href,'_blank','noopener,noreferrer');}return;}
    // Links stay ordinary text while typing; Ctrl/Cmd+click follows them just
    // like the read-only preview, keeping caret placement intact.
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();
    if(href.startsWith('#')){
      const target=[...surface.current.querySelectorAll('[id]')].find(node=>node.id===href.slice(1));
      target?.scrollIntoView({block:'start',behavior:'auto'});return;
    }
    const local=localDocumentPath(path,href);
    if(local&&/\.(md|markdown|txt)$/i.test(local))onOpenDocument?.(local);
  }
  let mathPreview='';try{mathPreview=katex.renderToString(mathValue,{displayMode:display,throwOnError:false,trust:false});}catch{}
  return <div className="stgw-rich" data-editor-mode={error?'recovery':'direct'}>
    {error&&<div className="stgw-editor-error" role="alert"><span>{error} 已保留下方原始 Markdown 源文，可继续编辑。</span><button type="button" onClick={retry}>重试富文本</button></div>}
    <div className="stgw-editor-surface" ref={surface} hidden={!!error} onClick={followLink}/>
    {!!error&&<textarea className="stgw-editor-source" aria-label="Markdown 源文（恢复）" value={content} readOnly={readOnly} spellCheck="false" onChange={e=>change.current?.(e.target.value)}/>}
    <dialog className="stgw-math-dialog" ref={dialog} onCancel={()=>setFormula(null)} onClose={()=>setFormula(null)}>
      <form onSubmit={e=>{e.preventDefault();finishMath();}}><h2>{formula?.apply?'编辑公式':'插入公式'}</h2><label>LaTeX<textarea autoFocus value={mathValue} onChange={e=>setMathValue(e.target.value)} rows={4}/></label><label className="stgw-math-inline"><input type="checkbox" checked={display} disabled={!!formula?.apply} onChange={e=>setDisplay(e.target.checked)}/>独立公式</label><div className="stgw-math-preview" aria-label="公式预览" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(mathPreview,{ADD_TAGS:['annotation','semantics'],ADD_ATTR:['encoding']})}}/><div className="stgw-math-actions"><button type="button" onClick={()=>dialog.current?.close()}>取消</button><button type="submit" disabled={!mathValue.trim()}>应用公式</button></div></form>
    </dialog>
  </div>;
}
