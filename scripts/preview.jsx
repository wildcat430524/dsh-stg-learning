import React from 'react';
import { createRoot } from 'react-dom/client';
import { LearningPanel } from '../src/client.jsx';
import { css } from '../src/style.js';
const source = value => ({ getSnapshot:()=>value, subscribe:()=>()=>{} });
const fixture={phase:'ready',ids:['s1','s2','sub'],byId:{
  s1:{id:'s1',title:'Python · 认识变量',displayTitle:'Python · 认识变量',cwd:'E:/学习/Python',retainedBy:{mainView:1},updatedAt:Date.now()},
  s2:{id:'s2',title:'函数与返回值',displayTitle:'函数与返回值',cwd:'E:/学习/Python',updatedAt:Date.now()-86400000},
  sub:{id:'sub',title:'后台任务',origin:'subagent',parentId:'s1',cwd:'E:/学习/Python',updatedAt:Date.now()}
}};
window.actions=[];
const services={sessions:{list:source(fixture),create:async()=>{window.actions.push('create');return 'new-session';}},
  workspaces:{list:source({phase:'ready',items:[{workspaceId:'w1',title:'Python 学习',path:'E:/学习/Python',sessionIds:['s1','s2','sub']}],archivedSessionIds:[]})},
  uiWorkspace:{openSession:id=>window.actions.push({open:id})},layout:{selectPanel:id=>window.actions.push({panel:id})},
  remote:{session:{openWorkspacePath:async req=>{if(req.action!==undefined&&req.action!=='reveal')throw Error('Invalid native action');window.actions.push({launch:req.path});return {ok:true,value:{opened:true}};}}}};
const style=document.createElement('style');style.textContent=css+'html,body,#root{height:100%;margin:0;font-family:"Segoe UI","Microsoft YaHei",sans-serif}';document.head.append(style);
createRoot(document.querySelector('#root')).render(<LearningPanel services={services}/>);
