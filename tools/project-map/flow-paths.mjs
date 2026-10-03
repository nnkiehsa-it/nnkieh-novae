// 不同觸發源各自起跑；重複卡片表示同模組再次被呼叫，不是拉回既有節點。
export function independentPaths(flow, separatePaths) {
  const n=flow.nodes;
  const copy=(i,title,text,layer)=>({...n[i],title:title||n[i].title,text:text||n[i].text,layer:layer||n[i].layer});
  const path=(title,nodes,labels)=>({title,nodes,labels});
  const entry=(i,title,text,layer='browser')=>copy(i,title,text,layer);
  const paths={
    'auth-login':()=>[
      path('按登入：新帳號登入與同步',[n[0],n[1],n[2],n[3]],['Turnstile 通過＋Google token → Firebase 登入','新登入的 ID token＋profile → POST auth/sync','同步完成 → bootstrap 分段讀權限、分類與未讀']),
      path('重新開啟：恢復既有登入',[entry(1,'Firebase observer：發現既有帳號','onAuthStateChanged 取得已存在的 Firebase session；不重新執行 auth/sync。'),copy(1,'Session check：驗恢復挑戰與網域'),n[3]],['既有 session＋auth_restore Turnstile → session-check','恢復驗證通過 → bootstrap；recordVisit 按需更新']),
      path('登入成功後：獨立啟動連線與裝置維護',[copy(3,'Session store：目前帳號已就緒'),n[5]],['登入 UID＋正式 runtime → realtime、Push heartbeat、頭像檢查']),
      path('按登出或換帳號：清除舊帳號狀態',[entry(4,'帳號選單：登出或切換 UID','使用者按登出，或 Firebase observer 偵測到 UID 改變。'),n[4]],['舊 UID → signOut、清 namespace／草稿並拒絕舊回應']),
    ],
    'read-path':()=>[
      path('開列表／詳情或提交搜尋',[...n.slice(0,5)],['URL 條件＋UID → 查目前帳號的快取','分類、query、cursor → 讀取 action','SQL 結果＋cursor＋domain version → hook','正式 entity＋作者 UID＋圖片 ID → 呈現']),
      path('按返回：恢復剛才的列表',[entry(5,'Router：收到返回或關閉詳情','使用者按返回、關閉 sheet 或切回列表；此事件不刪內容。'),n[5],n[1]],['目前 route＋列表位置 → navigation／view memory','query＋已載頁＋scroll → 恢復目前 UID 的畫面快照']),
    ],
    'draft-submit':()=>[
      path('輸入時：保存文字草稿',[n[0],n[1]],['UID＋內容類型＋分類／reply＋文字 → 草稿 key']),
      path('按送出：處理附件並建立內容',[n[0],n[2],n[3],n[4]],['選圖＋target／scope → 檢查張數並預覽','WebP 圖片 → session、Cloudinary、finalize → create action','正式成功／錯誤 → 清本次草稿或保留並清未附著附件']),
      path('請求失敗時：自動安全重試',[entry(5,'SafeFetch：收到可重試錯誤','本次 request 遇 timeout 或可重試 HTTP 錯誤；未滿政策重試上限才繼續。'),copy(5,'SafeFetch：等待退避並沿用 UUID',undefined,'browser'),copy(5,'PostgreSQL：重播已完成操作','claim_operation 比對同 operationId／actor／action。若已完成就回原 response；若未完成，依交易去重規則處理。','database')],['timeout／status／Retry-After＋attempt → 決定退避','同 action＋payload＋operationId → Worker；已完成回原 response']),
    ],
    'local-settings':()=>n.map((node,i)=>path(['選語言或佈景','按安裝 App','按分享內容','按導覽、詳情或返回'][i],[entry(i,['設定頁：選擇語言或佈景','安裝入口：要求安裝此 App','內容選單：要求分享網址','導覽元件：要求切頁或返回'][i],['本機設定選項改變；此選擇不寫全校設定。','使用者按安裝，先判斷瀏覽器與 OS 的安裝能力。','使用者按分享目前提案、回報或公告。','使用者切分頁、開詳情、返回或提交搜尋。'][i]),node],[['語言／亮暗色選擇 → store 與 localStorage','安裝要求＋瀏覽器能力 → beforeinstallprompt／步驟提示','目標 route → Web Share API 或 clipboard','URL／history／位置 → Next Router 與 navigation memory'][i]])),
    'image-lifecycle':()=>[
      path('建立內容：上傳並附著圖片',n.slice(0,4),['WebP 尺寸／KB／張數＋scope → session action','簽名＋public_id＋WebP → Cloudinary 直傳','供應商 signature／尺寸 → finalize；圖片 ID → 內容 attach']),
      path('看內容：取得並載入可見圖片',[entry(4,'Markdown：遇到 srp-upload 圖片','正文保存 srp-upload://id；讀取時帶目前 viewer 身分解析。'),n[4],copy(2,'Cloudinary／edge：回圖片像素','媒體代理驗可見性、HMAC、expiry 與限流後，從 edge 或 Cloudinary 取得圖片。','external')],['storagePath＋viewer token → resolveUploadImageUrls','簽名媒體 URL＋variant → media Worker → 圖片 bytes']),
      path('刪除或到期：處理外部圖片責任',[entry(5,'內容刪除／附件期限：需要清圖','刪內容、取消未送出附件、過期 upload 或晚到 webhook 會走清理入口。','database'),n[5]],['public_id＋provider 識別碼 → deletion job → Queue destroy']),
    ],
    realtime:()=>[
      path('頁面需要訂閱：建立共用連線',[n[2],n[0],n[1]],['同 UID／角色的 leader → 要求 realtime ticket','UID＋topics＋短效 JWT → WebSocket 握手']),
      path('已連線：心跳、閒置與重連',[copy(1,'Realtime transport：目前連線存在'),n[3]],['活動時間＋visible／online＋心跳間隔 → 保持、停連或重連']),
      path('收到事件：更新內容或重新讀取',[copy(1,'RealtimeHub：傳送內容變更訊號'),n[4],n[5]],['event＋aggregateRevision＋domainRevision → 本機判斷','失效的 domain／entity → 合併重讀；gap 時查版本']),
    ],
    'support-clock':()=>[
      path('新提案：記錄當時規則',[entry(0,'提案表單：送出新提案','createIssue 驗證分類與內容；分類的新值只供這次建立使用。'),n[0]],['當時分類規則 → support snapshot；無審核者同時設 deadline']),
      path('管理員審核：設定附議起點',[entry(1,'管理表單：將提案改為 pending','管理員以分類 scope 提交狀態變更。'),n[1]],['pending＋snapshot deadlineDays → 現在時間＋N×24h']),
      path('按附議：判斷期限並更新人數',[entry(2,'附議按鈕：送支持者要求','前端先預覽人數；送 toggleSupport 或 removeSupport。'),n[4],n[2]],['UID＋issueId＋當下時間 → 驗狀態與 deadline','允許的支持變更 → count；首次達標寫 met_at／processing']),
      path('畫面渲染：推導逾期外觀',[entry(3,'提案元件：收到資料並重新渲染','資料讀取或畫面狀態變更造成 render；沒有獨立秒級倒數。'),n[3]],['snapshot＋deadline＋裝置 Date.now → 衍生狀態與剩餘日']),
      path('半小時維護：正式拒絕未達標提案',[entry(5,'Queue maintenance：檢查到期提案','cron 送 maintenance，consumer 執行 SQL；不是前端 render 觸發。','async'),n[5]],['pending＋未達標＋deadline≤DB now → UPDATE auto-rejected']),
    ],
    cron:()=>[
      path('定時喚醒：執行本次維護',n.slice(0,3),['maintenance 訊息 → Queue consumer','政策 snapshot＋全域執行額度 → maintenance SQL']),
      path('同次 consumer：有投遞與外部工作才執行',[copy(1,'Queue consumer：本次 sweep 已開始'),n[3],n[5]],['到期 destination／job＋batchSize → probe／claim','處理結果＋attempt UUID＋cursor → complete／fail；必要時再 drain']),
      path('已排保留工作：分批套用政策',[copy(2,'Maintenance：已排完整保留工作'),n[4],n[5]],['retention payload＋cleanupScopes＋policyBatchSize → 逐類 SQL','processed／affected／remaining → 工作狀態與下次 drain']),
    ],
    retention:()=>[
      ...[1,2,3].map(i=>path(['清理到期內容與修復通知期限','清理技術紀錄','清理符合閒置條件的個資'][i-1],[n[0],n[i],copy(5,'保留工作：記錄本範圍處理結果','保存 processed／affected／remaining 與 cursor；有剩餘回 pending。管理頁以 listPlatformJobs 讀進度。','database')],['本次 payload 中符合的 cleanupScopes＋政策快照 → SQL','已刪／已更新／仍待處理筆數 → background_jobs'])),
      path('刪除需要外部配合：另排清理',[entry(4,'DB Trigger：刪到圖片或 Notion 對映','保留 SQL 刪資料時，觸發器保留外部 provider ID 與清理責任。','database'),n[4]],['public_id／page ID → deletion 或 archive job → Queue']),
      path('畫面再次讀取：確認正式資料',[entry(5,'前景／進度事件：要求重新讀取','使用者回前景、重開內容或工作完成後，要求正式版本與內容。'),n[5]],['content version＋工作狀態 → 更新列表、詳情與進度']),
    ],
    'retry-clock':()=>[
      path('API 可重試失敗：前端退避重送',[entry(0,'SafeFetch：收到 timeout 或可重試錯誤','仍在 retryAttempts 與 Retry-After 自動等待範圍內才重試。'),n[0]],['status／timeout／attempt → 退避，再送同 operationId']),
      path('後端請求：在固定時間桶扣額',[entry(1,'Worker：要求本次操作額度','本次操作經授權後要求 burst／產品配額；每日、每小時與短時窗各自計算。','worker'),n[1]],['UID＋限額種類＋時間桶 key＋units → SQLite claim']),
      path('DO alarm 到期：清除舊時間桶',[entry(2,'Durable Object：收到自己的 alarm','Durable Object storage 的到期 alarm 觸發；不靠平台 DB cron。','async'),n[2]],['到期 bucket 的 expires_at → 刪限流桶']),
      path('Queue 傳輸失敗：重送喚醒',[entry(3,'Queue handler：本次 batch 失敗','consumer 拋錯或執行配額拒絕，handler 依錯誤選 retryAll 或 delayed message。','async'),n[3]],['錯誤／Retry-After → Queue retry 或 delayed message']),
      path('DB 待辦到期：再次 claim',[entry(4,'Consumer：新 sweep 找到可重試待辦','由新 drain、cron 或管理員重試喚醒；只 claim 時間與鎖條件已符合的列。','async'),n[4]],['next_attempt_at／locked_at／attempt_count → claim 新 UUID']),
      path('政策批次失敗：安排下次時間',[entry(5,'政策工作：本次批次執行失敗','同 scope 的保留或分類工作發生錯誤。','async'),n[5]],['錯誤＋attempt → pending／failed 與兩分鐘 next_attempt_at']),
    ],
    'client-clocks':()=>n.map((node,i)=>path(['讀快取時','讀作者或通知提示時','恢復前景／網路時','管理面板可見時','需要身分或媒體網址時','畫面 render 或恢復草稿時'][i],[entry(i,['內容 service：準備讀目前帳號資料','作者／通知元件：要求資料','瀏覽器：發生 online 或 visible','管理／setup hook：頁面可見且在線','身分／附件 service：需要有效 token','日期／草稿元件：要求現在的呈現'][i],['讀取時比較 savedAt、TTL、容量與頁數。','依本類資料的 cachedAt 與期限判斷。','事件由瀏覽器生命週期觸發。','符合前景條件才安排下一次輪詢。','即將使用 token／URL 時檢查 expiry；Push heartbeat 另按最後確認時間。','Render 或讀草稿時比較當下時間。'][i]),node],[['cachedAt＋TTL／容量 → 快取命中、丟棄或淘汰','cachedAt＋通知／profile 期限 → 重用或重新要求','online／visible → 查正式版本與公告提示','目前狀態＋nextPollDelay → 查進度，隱藏時停輪詢','expiry／lastConfirmedAt＋buffer → 刷新或重新確認','Date.now＋deadline／savedAt → 日期、狀態與草稿有效性'][i]])),
    'db-triggers':()=>n.map((node,i)=>path('獨立機制：'+node.title,[entry(i,['SQL：新增內容或回覆','SQL：修改狀態或公開資料','SQL：新增、修改或刪內容','SQL：增刪支持、讚或留言','SQL：寫正文或刪關聯內容','SQL：修改分類或平台留言設定','Worker：完成本次正式變更'][i],i===6?'Execution 在交易內明確 resolveDomainEvents，並非資料庫 outbox trigger 自動推導。':'對應資料表的 SQL 達到此 trigger 的 BEFORE／AFTER 條件才執行。',i===6?'worker':'database'),node],['NEW／OLD 或 statement context → '+node.title.split('：').at(-1)])),
    'settings-timing':()=>[
      path('管理員按儲存：由草稿變成正式值',[n[0],n[1],entry(2,'PostgreSQL：提交核對版本後的設定','Save action 在鎖與 revision 驗證通過後，原子寫設定、稽核與必要工作；失敗保留草稿。','database')],['草稿＋baseline revision → estimate／確認','確認的值＋revision → save action；交易提交正式設定']),
      ...[2,3,4,5].map(i=>path(['即時規則：下一次操作採用','快照規則：只供新提案建立','批次規則：套用既有內容','快取規則：下次版本刷新採用'][i-2],[entry(i,'PostgreSQL：新設定已正式儲存','同一次儲存後的另一種使用路徑；此欄位依其契約採當前值、快照、批次或快取。','database'),n[i]],['本欄新值＋revision／job payload → '+n[i].title.split('：').at(-1)])),
    ],
    'notion-auto':()=>[
      path('事件同步：更新外部對映',[n[0],n[1],copy(2,'Notion 同步：更新頁面與對映')],['事件 payload＋provider 配置 → Notion HTTP','HTTP page ID＋結果 → notion_pages／delivery status']),
      path('按重建：依游標分批續跑',[entry(2,'Queue：領取 notion_reconcile 工作','管理員 rebuildNotionArchive 已建立唯一重建 job；每次先讀儲存的 cursor。','async'),n[1],n[2]],['target 類型＋cursor＋request budget → Notion API','page ID＋next cursor → DB；未完下次 drain 續跑']),
      path('內容刪除或 mapping 到期：封存外部頁',[entry(3,'PostgreSQL：刪除 Notion 對映','刪內容或 maintenance 清到期 mapping，trigger 排 archive 工作。','database'),n[3]],['notion_page_id＋archive job → Queue；失敗留清理責任']),
    ],
  };
  return paths[flow.id] ? separatePaths({...flow,notes:[...flow.notes,'每段有自己的觸發源；段落間不會依序自動執行。']},paths[flow.id]()) : null;
}
