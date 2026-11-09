import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LearningJourney} from '../src/workbench/LearningJourney.jsx';
import {RichEditor} from '../src/editor/RichEditor.jsx';
import {createWorkbenchApi} from '../src/api.js';
import {LearningLibrary} from '../src/workbench/LearningLibrary.jsx';
import {buildMentorDraft} from '../src/native-protocol.js';
import {TeacherFrame,TeacherWelcome} from '../src/workbench/TeacherFrame.jsx';
import 'katex/dist/katex.css';
const api=createWorkbenchApi({base:'./api/stg-learning'});
function Preview(){
  const [workspaceId,setWorkspace]=useState('demo'),[visible,setVisible]=useState(false),[full,setFull]=useState(false),[draft,setDraft]=useState('');
  const [sample,setSample]=useState(false);
  const [items,setItems]=useState([{workspaceId:'demo',title:'Python 学习',path:'示例学习工作区'}]),[loading,setLoading]=useState(false),[error,setError]=useState('');
  async function reload(){setLoading(true);setError('');try{setItems((await api.library()).items);}catch(e){setError(e.message);}finally{setLoading(false);}}
  useEffect(()=>{void reload();},[]);
  const mentor={visible,onConnect:async()=>setVisible(true),onAsk:async context=>{
    // Isolated acceptance only; neither this preview nor the probe is packaged.
    if(new URLSearchParams(location.search).get('acceptance')==='interaction' && globalThis.__stgAskProbe){
      const probe=globalThis.__stgAskProbe;probe.calls++;
      await new Promise(resolve=>{probe.release=resolve;});
      if(probe.fail)throw new Error('测试夹具：暂时无法准备提问，请重试。');
    }
    setDraft(previous=>previous ? `${previous}\n\n${buildMentorDraft(context)}` : buildMentorDraft(context));if(['initialize','assess'].includes(context.intent))setFull(true);else setVisible(true);
  }};
  if(full)return <section className="fixture-native" style={{height:'100%',boxSizing:'border-box',padding:40,display:'flex',flexDirection:'column',gap:20}}><p>完整原生会话的隔离预览，不是模型回复。</p><button onClick={()=>{localStorage.setItem(`stg-learning.pane.v1:${workspaceId}`,'documents');setFull(false);}}>学习内容</button><textarea aria-label="隔离夹具原生草稿" style={{flex:1,width:'100%'}} value={draft} onChange={e=>setDraft(e.target.value)}/></section>;
  if(!workspaceId)return <LearningLibrary api={api} items={items} loading={loading} error={error} onReload={reload} onOpen={setWorkspace} onReady={workspace=>{setItems(previous=>[...previous.filter(w=>w.workspaceId!==workspace.workspaceId),workspace]);setWorkspace(workspace.workspaceId);}}/>;
  const teacher=<div className="stgt-preview-chat">{sample ? <div className="stgt-example"><div className="stgt-example-label">对话排版示例 · 以下为预设内容，非模型回复</div><p className="stgt-example-user">为什么 fruits[1:3] 只拿到两个水果？</p><p className="stgt-example-answer">因为切片<strong>从 1 开始，在 3 之前停下</strong>。右边界只标记停下的位置，本身不进入结果。</p><blockquote>索引从 <code>0</code> 开始：苹果在 0，香蕉在 1，橙子在 2，葡萄在 3。</blockquote><p className="stgt-example-answer">所以 <code>fruits[1:3]</code> 取的是索引 1 和 2，也就是香蕉和橙子；索引 3 的葡萄被右边界挡在外面。</p><p className="stgt-example-answer">如果想让葡萄也进来，需要把右边界写到 4，而不是 3。</p></div> : <TeacherWelcome/>}<button className="stgt-sample-toggle" onClick={()=>setSample(value=>!value)}>{sample ? '回到提问' : '看看对话排版'}</button><div className="stgt-composer"><textarea aria-label="隔离夹具原生草稿" placeholder="直接说说，你卡在哪一步？" value={draft} onChange={e=>setDraft(e.target.value)}/><div className="stgt-composer-tools"><span>草稿保留在这里</span><button className="stgt-send-preview" disabled aria-label="预览未连接模型，无法发送" title="预览未连接模型">↑</button></div></div></div>;
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}><div style={{padding:'7px 18px',fontSize:11,color:'var(--dsw-alias-label-secondary)',borderBottom:'1px solid var(--dsw-alias-border-l3)',display:'flex',justifyContent:'space-between'}}><span>身边的老师 · 交互预览（示例课程）</span><button style={{background:'transparent',color:'inherit',border:0,cursor:'pointer'}} onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>切换明暗</button></div><div style={{flex:1,minHeight:0}}><TeacherFrame demo open={visible} teacher={teacher} onClose={()=>setVisible(false)} onExpand={()=>setFull(true)}><LearningJourney key={workspaceId} api={api} workspace={items.find(w=>w.workspaceId===workspaceId)} workspaces={items} onOpenLibrary={()=>{setVisible(false);setWorkspace('');void reload();}} mentor={mentor} renderDocumentEditor={props=><RichEditor {...props}/>}/></TeacherFrame></div></div>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
