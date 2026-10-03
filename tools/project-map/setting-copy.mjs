// 名稱解釋「改哪個規則」，套用卡片解釋「哪個程式採用新值」。
export const policyTitles = {
  notionArchiveDays:'Notion 非內容封存天數',readBurst:'讀取短時限額',writeBurst:'寫入短時限額',sensitiveBurst:'互動短時限額',adminBurst:'管理短時限額',uploadBurst:'上傳短時限額',resolveBurst:'圖片解析短時限額',
  viewMemoryMinutes:'畫面記憶有效分鐘',viewMemoryEntries:'畫面記憶筆數',feedPages:'列表保留頁數',mediaBrowserSeconds:'公開圖片瀏覽器快取秒數',mediaEdgeSeconds:'圖片邊緣快取秒數',avatarRevalidateHours:'Google 頭像重查間隔',
  notionBatchSize:'Notion 每批投遞數',notificationBatchSize:'通知每批投遞數',realtimeBatchSize:'即時訊息每批投遞數',jobBatchSize:'外部工作每批執行數',policyBatchSize:'政策每類套用筆數',
  clientWriteCooldownMs:'前端同操作冷卻時間',requestTimeoutMs:'寫入等待上限',readTimeoutMs:'讀取等待上限',longTimeoutMs:'長操作等待上限',retryAttempts:'前端重試嘗試數',retryAfterMaxMs:'自動等待 Retry-After 上限',
  realtimeIdleMinutes:'即時連線閒置期限',realtimeHeartbeatSeconds:'即時連線心跳間隔',realtimeTicketSeconds:'WebSocket 連線票期限',titleLength:'標題字數上限',contentLength:'內文字數上限',commentLength:'留言字數上限',resultLength:'處理結果字數上限',locationLength:'設施位置字數上限',searchLength:'搜尋字數上限',
  errorRetentionDays:'錯誤聚合保留天數',metricsRetentionDays:'容量樣本保留天數',issueCreateDaily:'每日提案建立額度',facilityCreateDaily:'每日設施回報額度',announcementCreateDaily:'每日公告發布額度',commentCreateHourly:'每小時留言額度',imageUploadDaily:'每日圖片張數額度',loginSyncHourly:'每小時登入同步額度',avatarCacheDaily:'每日頭像更新額度',supportToggleHourly:'每小時附議操作額度',facilityAffectedToggleHourly:'每小時我也遇到額度',facilityStatusUpdateHourly:'每小時設施處理額度',announcementLikeHourly:'每小時公告按讚額度',pushTokenWriteHourly:'每小時裝置註冊額度',preferenceWriteHourly:'每小時偏好與水位額度',moderationWriteHourly:'每小時審核與限制額度',roleWriteHourly:'每小時權限與設定額度',destructiveWriteHourly:'每小時刪除與維護額度',backendHealthcheckMinute:'全域每分鐘健康檢查額度',backendHealthcheckSecond:'全域每秒健康檢查額度',workerRunMinute:'全域每分鐘 Queue 執行額度',workerRunSecond:'全域每秒 Queue 執行額度',
};

const consumers = {
  viewMemoryMinutes:['view-memory：判斷畫面快照過期','再次讀快照時採新期限'],viewMemoryEntries:['view-memory：限制快照筆數','後續快照存取時限制容量'],feedPages:['Feed hook：限制已載入頁數','後續列表分頁採新保留頁數'],
  mediaBrowserSeconds:['媒體代理：設定公開快取標頭','後續媒體回應採新快取秒數'],mediaEdgeSeconds:['媒體代理：設定 edge 快取期限','新政策版本建立新快取 key'],avatarRevalidateHours:['頭像檢查：比較來源確認時間','後續頭像檢查採新間隔'],
  notionBatchSize:['Queue：限制 Notion 投遞數','下次 sweep 採新批次數'],notificationBatchSize:['Queue：限制站內與 Push 投遞數','下次 sweep 採新批次數'],realtimeBatchSize:['Queue：限制即時訊息投遞數','下次 sweep 採新批次數'],jobBatchSize:['Queue：限制外部工作數','下次 sweep 採新批次數'],policyBatchSize:['政策工作：限制每類更新筆數','下次政策批次採新上限'],
  clientWriteCooldownMs:['backend-action：限制重複操作頻率','後續同 UID/action 採新冷卻'],requestTimeoutMs:['safeFetch：設定寫入逾時','後續寫入請求採新逾時'],readTimeoutMs:['safeFetch：設定讀取逾時','後續讀取請求採新逾時'],longTimeoutMs:['safeFetch：設定長操作逾時','後續長操作採新逾時'],retryAttempts:['safeFetch：限制自動重試次數','後續請求採新嘗試上限'],retryAfterMaxMs:['safeFetch：判斷是否自動等待','後續重試採新等待上限'],
  realtimeIdleMinutes:['Realtime transport：判斷閒置斷線','後續活動與閒置檢查採新值'],realtimeHeartbeatSeconds:['Realtime heartbeat：安排連線心跳','後續心跳排程採新間隔'],realtimeTicketSeconds:['Worker：簽短效 WebSocket 票','下一張 ticket 採新有效期'],
  titleLength:['內容 handler：驗標題長度','後續送出標題採新字數限制'],contentLength:['內容 handler：驗內文長度','後續送出內文採新字數限制'],commentLength:['留言 handler：驗留言長度','後續送出留言採新字數限制'],resultLength:['管理 handler：驗結果長度','後續儲存結果採新字數限制'],locationLength:['設施 handler：驗位置長度','後續送出位置採新字數限制'],searchLength:['搜尋 handler：驗查詢長度','後續搜尋採新字數限制'],
  notionArchiveDays:['Maintenance：清過期 Notion 對映','下次維護排外部封存工作'],errorRetentionDays:['Maintenance：刪過期錯誤聚合','下次維護採新保留天數'],metricsRetentionDays:['Maintenance：刪過期容量樣本','下次維護採新保留天數'],
};
const categoryConsumers = {
  'issuesEnabled / facilitiesEnabled':['Route guard：控制功能入口','Catalog 重新讀取後更新入口','browser'],
  announcementCommentsEnabled:['政策工作：更新舊公告留言開關','提交後分批套用公告 flag','async'],
  id:['分類與 FK：固定內容所屬分類','建立分類時固定 ID','database'],
  'label / sortOrder / isDefault':['Catalog：更新名稱、排序與預選','下次 catalog 讀取顯示新值','browser'],
  'readAccess / authorVisible':['提案建立：保存可見性快照','新提案建立時採分類規則','database'],
  'supportEnabled / supportGoal / supportDeadlineDays':['提案建立：保存附議規則快照','新篇採新規則，審核後算期限','database'],
  commentsEnabled:['政策工作：更新舊提案留言開關','提交後分批套用提案 flag','async'],
  authorDeleteEnabled:['刪除 handler：檢查作者刪除權','下一次刪除查當前分類值','worker'],
  'maxImages / commentMaxImages':['Upload handler：檢查分類圖片數','下一次上傳與附著採新上限','worker'],
  'announcementMaxImages / announcementCommentMaxImages':['Upload handler：檢查公告圖片數','下一次公告上傳採新上限','worker'],
  'maxDimension / maxUploadKilobytes / webpQuality':['圖片處理：壓縮並驗尺寸與大小','後續圖片操作採新壓縮規則','worker'],
  '角色與category scope':['Auth：重新解析成員管理範圍','下一次後端授權採新指派','worker'],
  'targetType / targetValue / preset / duration / message':['Auth：比對 UID 與最長有效字首','下一次授權採新限制與期限','worker'],
  'issueNotifications / facilityNotifications / commentNotifications':['收件者解析：套本人通知偏好','下次 delivery 解析時採新偏好','async'],
};

const retentionTargets = {
  closedIssues:'結案提案',closedFacilities:'結案設施',announcements:'公告',notifications:'站內通知',deliveryCompleted:'成功投遞',deliveryFailed:'失敗投遞',operation:'操作回應',domainEvent:'領域事件',inactivePushTokens:'閒置裝置',pushTokenConfirmation:'裝置確認',inactiveAvatars:'閒置頭像',inactiveProfilePii:'閒置個資',expiredRestrictions:'過期限制紀錄',backgroundJobCompleted:'完成工作',backgroundJobFailed:'失敗工作',roleAssignmentAudit:'角色稽核',adminAudit:'管理稽核與政策歷史',categoryConfigurationAudit:'分類稽核',accessAssignmentAudit:'範圍稽核',pendingUpload:'待上傳圖片',unattachedUpload:'未附著圖片',failedUpload:'失敗圖片',
};
export function settingConsumer(s) {
  if(s.store==='runtime_settings.operations_settings') {
    if(consumers[s.key]) return [...consumers[s.key],s.policyGroup==='jobs'||s.policyGroup==='logs'?'async':s.key.startsWith('view')||['feedPages','clientWriteCooldownMs','requestTimeoutMs','readTimeoutMs','longTimeoutMs','retryAttempts','retryAfterMaxMs','realtimeIdleMinutes','realtimeHeartbeatSeconds'].includes(s.key)?'browser':'worker'];
    if(s.policyGroup==='rates') return [s.key.startsWith('workerRun')?'Queue：檢查全域執行額度':s.key.startsWith('backendHealthcheck')?'Healthcheck：檢查全域額度':'Rate limiter：檢查'+policyTitles[s.key], '政策 snapshot 更新後採新額度','worker'];
    throw new Error('缺政策使用者解說：'+s.key);
  }
  if(s.store==='runtime_settings.data_retention_settings') {
    const target=retentionTargets[s.key.replace(/(?:Enabled|Days|Hours)$/,'')];
    if(!target) throw new Error('缺保留資料責任名稱：'+s.key);
    if(s.key==='pushTokenConfirmationDays') return ['Push heartbeat：安排裝置再確認','Bootstrap 帶入後採新確認間隔','browser'];
    if(['operationHours','deliveryCompletedDays','deliveryFailedDays','backgroundJobCompletedDays','backgroundJobFailedDays'].includes(s.key)) return ['生命週期 SQL：設定'+target+'期限','新建或狀態轉換才算新 expiry','database'];
    return [s.key.startsWith('notifications')?'政策工作：重算通知到期時間':'保留工作：清理'+target,s.key.startsWith('notifications')?'分批改 expiry；讀取排除過期':'批次依期限與關聯條件清理','async'];
  }
  const copy=categoryConsumers[s.key];
  if(!copy) throw new Error('缺設定使用者解說：'+s.key);
  return copy;
}
