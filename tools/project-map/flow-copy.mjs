// 共用流程也以具體的程式責任命名；序號由 narration 組成獨立觸發路徑。
const titles = {
  'auth-login':['登入頁：驗挑戰並取得 Google 身分','Session observer：驗 Firebase 登入狀態','Auth sync：同步帳號與管理員角色','Session store：載啟動快照並進首頁','Session store：登出並清目前帳號資料','App shell：啟動即時連線與裝置檢查'],
  'read-path':['Router：整理分類與搜尋條件','內容快取：讀目前 UID 的資料','Worker：驗可見性並查正式內容','Feed hook：驗回應版本並套分頁','內容元件：解析作者、圖片與正文','View memory：保存返回位置與條件'],
  'draft-submit':['Composer：接文字、分類與回覆目標','草稿儲存：保存此分頁的文字','附件 hook：驗張數並建立預覽','提交流程：上傳圖片再建立內容','Composer：依成功或失敗整理草稿','SafeFetch：同 UUID 重試寫入'],
  'local-settings':['外觀 store：保存語言與佈景選擇','PWA 安裝：呼叫瀏覽器安裝流程','分享 hook：送網址到分享或剪貼簿','Router：切頁、開詳情與返回'],
  'image-lifecycle':['圖片處理：縮尺寸並壓成 WebP','Worker：驗上傳規則並簽 session','Cloudinary：接收瀏覽器直傳圖片','PostgreSQL：驗上傳並附著到內容','媒體 Worker：驗權限並交付圖片','Queue：執行失敗附件與刪圖清理'],
  'notification-delivery':['PostgreSQL：保存事件與投遞責任','Queue：領取到期通知投遞','收件者解析：選作者、成員與管理員','通知寫入：按事件時間建立站內通知','Push consumer：送未成功裝置到 FCM','瀏覽器／SW：顯示通知並開目標','投遞 SQL：記完成或排下次重試'],
  realtime:['Ticket Worker：簽 UID 與可訂閱 topics','RealtimeHub：驗 ticket 並接 WebSocket','分頁協調器：選一個分頁維持連線','心跳排程：維持連線或因閒置停連','Realtime event：更新計數或標快取失效','刷新排程器：合併並重讀正式內容'],
  'support-clock':['提案建立：保存附議規則與期限','提案審核：通過後開始附議倒數','支持計數：首次達標改為處理中','Issue status：渲染時推導逾期狀態','Support handler：拒絕截止後操作','Maintenance SQL：拒絕逾期未達標提案'],
  cron:['Cloudflare cron：每半小時送維護訊息','Queue consumer：合併喚醒並驗執行額度','Maintenance：處理到期資料與統計','Queue consumer：依通道領取待辦','政策 SQL：按範圍分批清理資料','工作 SQL：保存進度與續跑狀態'],
  retention:['保留排程：保存本次政策與清理範圍','內容清理：比結案、發布與事件時間','技術清理：比 expiry 與事件關聯','隱私清理：比閒置時間及內容關聯','刪除工作：保留圖片與外部頁責任','內容 hook：再讀版本與工作進度'],
  'retry-clock':['SafeFetch：按逾時與退避重試請求','Rate limiter：以固定時間桶扣額','DO alarm：刪已過期的限流桶','Queue transport：重送失敗喚醒訊息','Claim SQL：依下次時間重新領取待辦','政策工作：失敗後排兩分鐘重試'],
  'client-clocks':['內容快取：讀取時檢查年齡與容量','作者與通知快取：讀取時檢查期限','Session store：恢復前景時確認版本','前景輪詢：查設定進度與首次完成','Token cache：到期前刷新身分與網址','日期元件：渲染時算狀態與草稿期限'],
  update:['Update gate：定期或恢復時查版本','Update gate：比較目前與新 build','更新守門：等待草稿與提交結束','SW 準備：更新並啟用 waiting worker','Update gate：重載目前網址','Serwist：按新版規則快取靜態資源'],
  'db-triggers':['DB Trigger：驗輸入、回覆與初始快照','DB Trigger：派生狀態與修改時間','DB Trigger：提升內容與單筆版本','DB Trigger：重算反應與留言計數','DB Trigger：附著圖片或排外部刪除','DB Trigger：排分類與公告政策工作','Execution：明確寫入領域事件'],
  'settings-timing':['設定草稿：保存欄位與預設檔位','確認流程：估影響並鎖定草稿版本','當前規則：下一次操作查正式設定','新篇快照：建立時保存分類規則','政策工作：分批套既有留言與期限','政策快取：遇新版本後重新讀取'],
  healthcheck:['部署檢查：帶 secret 請求健康入口','Healthcheck：驗配置、額度與 DB','Telemetry：聚合 action 的應用失敗','管理面板：讀錯誤、工作與容量'],
  'notion-auto':['Notion consumer：驗啟用再領投遞','Notion API：節流並重試出站 HTTP','Notion 同步：保存對映與重建游標','封存工作：刪外部頁並保留失敗責任'],
};
export function clarifyFlow(flow) {
  const copy=titles[flow.id];
  if(!copy) throw new Error('缺共用流程責任標題：'+flow.id);
  if(copy.length!==flow.nodes.length) throw new Error('共用流程標題數量不符：'+flow.id);
  return {...flow,nodes:flow.nodes.map((node,i)=>({...node,title:copy[i]}))};
}
