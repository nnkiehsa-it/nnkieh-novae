// 一張卡片只屬於一段路徑；並行分支重複入口，不把線拉回已出現的節點。
import { independentPaths } from './flow-paths.mjs';
export function separatePaths(flow, paths) {
  const nodes=[], edges=[];
  for (const path of paths) {
    const start=nodes.length;
    nodes.push(...path.nodes.map((node,i)=>({...node,pathTitle:path.title,pathStart:i===0,pathStep:i+1,pathLength:path.nodes.length})));
    for (let i=1;i<path.nodes.length;i++) {
      const connector=path.labels[i-1];
      if (!connector) throw new Error('缺連線說明：'+flow.id+' / '+path.title+' / '+i);
      edges.push({from:start+i-1,to:start+i,label:typeof connector==='string'?connector:connector.label,async:typeof connector==='object'&&connector.async===true});
    }
  }
  return {...flow,kind:'sequence',nodes,edges};
}

const actionLabels = ['操作名稱＋使用者輸入','POST：action、payload、身分 token','UID、角色、scope、有效限制','通過授權、去重與配額，執行業務','SQL／RPC：查詢或修改目標紀錄','NDJSON：結果、正式資料與版本'];
// 與各圖節點的順序對照；線描述資料／動作，條件分支明確寫出條件。
const flowLabels = {
  'update':['version.json 的 build version → 與本機比較','發現新版本 → 檢查草稿、sending、驗證等延後條件','可以更新 → SW update／SKIP_WAITING','SW 準備結果＋目前網址 → reload','新版 document → production SW 的快取規則'],
};

export function narrateFlow(flow) {
  const independent=independentPaths(flow,separatePaths);
  if(independent) return independent;
  if(flow.id==='notification-delivery') return separatePaths(flow,[
    {title:'獨立通道一：站內通知',nodes:[...flow.nodes.slice(0,4),flow.nodes[6]],labels:['event_id＋in_app destination → claim attempt','event payload → 收件者 UID','正文、收件者 UID、occurred_at → INSERT','寫入／publish 結果＋attempt UUID → complete／fail']},
    {title:'獨立通道二：FCM Push 的投遞責任',nodes:[...flow.nodes.slice(0,3),flow.nodes[4],flow.nodes[6]],labels:['event_id＋Push destination → claim attempt','event payload → 收件者 UID','通知正文＋裝置 token／receipt → FCM','FCM 結果、receipt、attempt UUID → complete／fail']},
    {title:'裝置接收分支：FCM 已接受的訊息',nodes:[{...flow.nodes[4],title:'FCM：送訊息到裝置',text:'供應商已接受通知正文、UID 與目標 route；後續交付到裝置由 FCM 處理。'},flow.nodes[5]],labels:['FCM 訊息：正文、UID、目標 route → 前景 handler／SW']},
  ]);
  if(flow.id==='healthcheck') return separatePaths(flow,[
    {title:'入口一：部署健康檢查',nodes:flow.nodes.slice(0,2),labels:['healthcheck＋secret → 驗配置、配額、SELECT roles']},
    {title:'入口二：應用錯誤觀測',nodes:flow.nodes.slice(2),labels:['status、code、operationId、failureId → 錯誤聚合／管理查詢']},
  ]);
  if (flow.rateGroup) {
    const labels=[...actionLabels];
    labels[0]=flow.id+'：輸入欄位／查詢條件';
    labels[3]=['read','upload-resolve'].includes(flow.rateGroup)?'授權＋讀取頻率通過 → 執行查詢':'授權＋新 operation＋配額通過 → 執行變更';
    labels[4]='SQL／API：'+flow.nodes[5].title.split('：').at(-1);
    labels[5]='NDJSON：'+flow.db.split(/[、；： ]/)[0]+' 的正式結果＋版本／錯誤';
    const paths=[{title:'主流程：'+flow.title,nodes:flow.nodes.slice(0,7),labels}];
    if (flow.nodes.length===8) paths.push({
      title:'並行分支：同一次 DB 提交後的背景工作',
      nodes:[
        {...flow.nodes[5],title:'PostgreSQL：本次寫入已提交',text:flow.db+' 已正式保存。這是同次提交的背景分支入口；僅此 action 產生的事件、投遞與工作會被保存，與畫面 response 並行。'},
        {title:'Worker：送 drain 喚醒 Queue',text:'寫入成功後送 drain 訊息。訊息負責喚醒；實際待辦的事件、payload 與工作狀態從 DB 讀取。',layer:'worker',refs:[{path:'cloudflare/src/index.ts',line:1}]},
        flow.nodes[7],
      ],
      labels:['交易提交成功 → Worker 啟動背景處理',{label:'drain 訊息 → consumer；待辦與 payload 另讀 DB',async:true}],
    });
    return separatePaths(flow,paths);
  }
  if (flow.kind==='topology') {
    if (!flow.edges.length) return {...flow,kind:'sequence'};
    return separatePaths({...flow,notes:[...flow.notes,'每一段各自解釋一條資料關係；相同模型會重複出現，段落之間沒有接續執行的箭頭。']},flow.edges.map((edge,i)=>({
      title:'資料關係 '+(i+1)+'：'+flow.nodes[edge.from].title.split('：')[0]+' → '+flow.nodes[edge.to].title.split('：')[0],
      nodes:[flow.nodes[edge.from],flow.nodes[edge.to]],labels:[edge],
    })));
  }
  const labels=flowLabels[flow.id];
  if(labels) {
    if(labels.length!==flow.edges.length) throw new Error('流程連線說明數量不符：'+flow.id);
    return {...flow,edges:flow.edges.map((edge,i)=>({...edge,label:labels[i]}))};
  }
  return flow;
}
