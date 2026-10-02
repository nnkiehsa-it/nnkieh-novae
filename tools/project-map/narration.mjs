// 一張卡片只屬於一段路徑；並行分支重複入口，不把線拉回已出現的節點。
export function separatePaths(flow, paths) {
  const nodes=[], edges=[];
  for (const path of paths) {
    const start=nodes.length;
    nodes.push(...path.nodes.map((node,i)=>({...node,pathTitle:path.title,pathStart:i===0})));
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
  'auth-login':['Firebase 登入狀態＋ID token','新登入時：ID token＋profile → auth/sync','取得 access、catalog、versions、unread、runtime','換帳號／登出時：清除 UID 分區狀態','登入 shell 另外啟動 socket、Push heartbeat、頭像檢查'],
  'read-path':['URL 條件＋UID → 查畫面與內容快取','以分類、搜尋、cursor 呼叫讀取 action','SQL 結果＋cursor＋domain version → hook','內容 entity＋作者 UID＋圖片 ID → 呈現','query、已載入頁、捲動位置 → 導覽記憶'],
  'draft-submit':['UID、內容型別、目標、文字 → 草稿 key','選圖時：檢查張數、建立本機 preview','WebP 圖片→上傳 session→Cloudinary→正式內容','提交結果：清草稿／導頁，或保留文字與清理附件','失敗重試時：沿用同一 operationId'],
  'local-settings':['選擇安裝：檢查 PWA 與瀏覽器能力','點分享：內容網址 → Web Share／剪貼簿','點導覽／返回：路由、history、位置記憶'],
  'image-lifecycle':['WebP 尺寸、KB、張數、scope → 申請 session','簽名、public_id、上傳參數＋圖片 → Cloudinary','回傳 signature／尺寸 → finalize；圖片 ID → attach','srp-upload ID＋viewer 權限 → 簽名媒體 URL','刪除或到期時：public_id → deletion job → destroy'],
  'realtime':['UID、允許 topics、短效 ticket → DO','socket 事件 → 同 UID 的 leader transport','心跳／活動時間 → 維持或重建連線','content event、aggregate／domain revision → 快取處理','失效的 domain／entity → 合併刷新請求'],
  'support-clock':['新篇 support snapshot → 審核／倒數狀態','審核通過：deadline、goal → 附議操作判斷','count、met_at、deadline → 畫面推導狀態','到期 timestamp → 後端拒絕支持／取消','maintenance 查 pending、deadline、count → 更新 auto-rejected'],
  'cron':['maintenance 訊息 → Queue consumer','政策 snapshot＋全域執行額度 → maintenance','DB 到期紀錄與待辦 → 各通道 claim','retention policy＋batchSize → 分批 SQL','processed／affected／attempt／error → DB；有剩餘再送 drain'],
  'retention':['保留政策＋cleanupScopes → 內容到期判斷','closed_at／published_at／created_at → 到期範圍','技術紀錄 expiry＋最後活動時間 → 身份清理條件','被刪媒體／Notion 識別碼 → 外部清理 job','完成狀態、content version → 畫面再讀與進度'],
  'retry-clock':['重試 request → Worker 按固定時間窗查配額','已到期 bucket key → DO alarm 清理','Queue 傳輸失敗時：Retry-After → delayed message','下一次 consumer → DB claim 到期工作／投遞','policy job 失敗 → next_attempt_at；後續 sweep 再接手'],
  'client-clocks':['讀取 cache age → 通知／profile 的各自期限','online／visible 事件 → 版本與提示重新讀取','可見／在線狀態 → 啟動設定進度與 setup 輪詢','token expiry／最後確認時間 → 更新 token 或媒體 URL','畫面 render 時：當下時間 → 日期、狀態與草稿有效性'],
  'update':['version.json 的 build version → 與本機比較','發現新版本 → 檢查草稿、sending、驗證等延後條件','可以更新 → SW update／SKIP_WAITING','SW 準備結果＋目前網址 → reload','新版 document → production SW 的快取規則'],
  'db-triggers':['INSERT／UPDATE 的 row → 欄位派生與驗證','本次內容寫入 → aggregate／domain revision','反應、留言變更 → 重算內容與平台計數','刪除內容／圖片 ID → cascade 與 deletion job','分類／平台政策變更 → enqueue policy job','事件由 Worker 明確寫入 domain_events／deliveries'],
  'settings-timing':['草稿＋baseline revision → 估算與確認','提交設定 → 更新後端當前操作規則','新建提案時：分類規則 → 寫入 policy snapshot','既有內容適用變更 → scoped policy job','正式 revision、catalog、job 狀態 → 自己更新／他人再讀'],
  'notion-auto':['event payload＋Notion 配置 → 出站 HTTP','HTTP 結果＋mapping／cursor → 更新或續跑','內容刪除／mapping 到期 → archive job 與失敗責任'],
};

export function narrateFlow(flow) {
  if(flow.id==='notification-delivery') return separatePaths(flow,[
    {title:'獨立通道一：站內通知',nodes:[...flow.nodes.slice(0,4),flow.nodes[6]],labels:['event_id＋in_app destination → claim attempt','event payload → 收件者 UID','正文、收件者 UID、occurred_at → INSERT','寫入／publish 結果＋attempt UUID → complete／fail']},
    {title:'獨立通道二：FCM Push 的投遞責任',nodes:[...flow.nodes.slice(0,3),flow.nodes[4],flow.nodes[6]],labels:['event_id＋Push destination → claim attempt','event payload → 收件者 UID','通知正文＋裝置 token／receipt → FCM','FCM 結果、receipt、attempt UUID → complete／fail']},
    {title:'裝置接收分支：FCM 已接受的訊息',nodes:[{...flow.nodes[4],title:'FCM：送訊息到裝置',text:'供應商已接受通知正文、UID 與目標 route；後續交付到裝置由 FCM 處理。'},flow.nodes[5]],labels:['FCM 訊息：正文、UID、目標 route → 前景 handler／SW']},
  ]);
  if(flow.id==='healthcheck') return separatePaths(flow,[
    {title:'入口一：部署健康檢查',nodes:flow.nodes.slice(0,2),labels:['healthcheck＋secret → 驗配置、配額、SELECT roles']},
    {title:'入口二：應用錯誤觀測',nodes:flow.nodes.slice(2),labels:['status、code、operationId、failureId → 錯誤聚合／管理查詢']},
  ]);
  if(flow.id.startsWith('trigger:')) return {...flow,edges:flow.edges.map((edge,i)=>({...edge,label:['本次 SQL 的 row／statement → 判斷觸發條件','NEW／OLD row 或 statement context → 觸發函式','驗證／派生／更新／排程，與原 SQL 同交易提交'][i]}))};
  if (flow.rateGroup) {
    const paths=[{title:'主流程：請求到畫面結果',nodes:flow.nodes.slice(0,7),labels:actionLabels}];
    if (flow.nodes.length===8) paths.push({
      title:'並行分支：同一次 DB 提交後的背景工作',
      nodes:[
        {...flow.nodes[5],title:'同一次交易已提交',text:'資料變更、audit、domain_events、event_deliveries 已提交。這是另一個分支的入口；與原畫面的 response 並行。'},
        {title:'Worker 喚醒 Queue',text:'寫入成功後送 drain 訊息。訊息負責喚醒；實際待辦的事件、payload 與工作狀態從 DB 讀取。',layer:'worker',refs:[{path:'cloudflare/src/index.ts',line:1}]},
        flow.nodes[7],
      ],
      labels:['交易提交成功 → Worker 啟動背景處理',{label:'drain 訊息 → consumer；待辦與 payload 另讀 DB',async:true}],
    });
    return separatePaths(flow,paths);
  }
  if (flow.kind==='topology') {
    if (!flow.edges.length) return {...flow,kind:'sequence'};
    return separatePaths({...flow,notes:[...flow.notes,'每一段各自解釋一條資料關係；相同模型會重複出現，段落之間沒有接續執行的箭頭。']},flow.edges.map((edge,i)=>({
      title:'資料關係 '+(i+1)+'：'+flow.nodes[edge.from].title+' → '+flow.nodes[edge.to].title,
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
