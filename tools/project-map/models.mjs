// 所有 schema.generated.ts 模型都有用途解說；欄位型別由 build.mjs 取最新契約。
// 關聯分為 migrations 的實體 FK，及程式按 UID/target/payload 解析的邏輯關係。
const model = (group, title, purpose, key, lifecycle, related = []) => ({ group, title, purpose, key, lifecycle, related });
export const modelDescriptions = {
  user_profiles: model('身分與權限','使用者公開資料','Firebase UID 的 profile、Email、公開名稱與頭像。正式 ADMIN_EMAILS 判管理員；profile/avatar version 驅動呈現快取。','uid','bootstrap 記 last_seen_at 最多每 24 小時一次；無內容／角色關聯且符合閒置政策才匿名化 PII，未刪 Firebase 帳號。',['user_role_assignments','user_restrictions','uploads']),
  user_role_assignments: model('身分與權限','角色指派','UID 與角色的多對多關係；公告管理角色及平台管理員 reconciliation 在此。提案／設施還需要分類 scope。','uid + role_code','由登入／auth reconciliation 或管理交易寫入；0059 編輯 scope 時撤掉不在正式名單的舊 platform-admin。',['user_profiles','roles','role_assignment_audit']),
  roles: model('身分與權限','角色字典','平台管理員、提案、總務、公告等 role code；業務授權再與 permission/scope 合併。','code','由 migration 定義；不是一般使用者自行修改。',['role_permissions','user_role_assignments']),
  permissions: model('身分與權限','權限字典','proposal.manage、facility.manage、announcement.manage、role.manage、category.manage、dashboard.view 等能力代碼。','code','migration 定義；registry 與 handler 使用。',['role_permissions']),
  role_permissions: model('身分與權限','角色與能力','角色對應 permission 的關係；有管理能力仍可能需要目標分類 scope。','role_code + permission_code','角色／permission FK 變動會連帶清對應關係。',['roles','permissions']),
  user_issue_category_assignments: model('身分與權限','提案分類負責成員','UID 可以管理哪些提案分類；saveScopeMembers 一次提交該 scope 的加入／撤銷。','uid + category_id','每請求 DB 查 scope；刪分類連帶刪指派；版本來自完整名單雜湊。',['user_profiles','issue_categories','access_assignment_audit']),
  user_facility_category_assignments: model('身分與權限','設施分類負責成員','UID 的設施分類管理範圍；notify_on_created 影響新回報收件者。','uid + category_id','每請求重新授權；變更是批次交易。',['user_profiles','facility_categories','access_assignment_audit']),
  user_restrictions: model('身分與權限','帳號存取規則','uid 欄位也可裝 Email 字首，不一定是 Firebase UID。target_type 區分 uid/email_prefix；preset 是 read_only/reaction_only/blocked。UID 優先，其次最長有效字首；正式管理員排除。','target_type + uid','到期當下自然不再授權命中；稍後清理過期列。save/delete 用 row md5 revision + advisory lock；0057 以完整複合鍵清理，0058 SKIP LOCKED 避免刪掉剛續期規則。',['user_profiles']),
  user_roles: model('身分與權限','舊角色相容資料','baseline 留下的 uid/role 相容表。當前授權由 role assignments、permissions、分類 scopes 與正式 ADMIN_EMAILS 解析；不要從這張表推導完整能力。','uid','仍存在於生成 schema；地圖保留它，避免只畫有 UI 的表。',['user_role_assignments']),
  issue_categories: model('內容','提案分類政策','分類 ID、可見性、作者顯示、附議、留言、圖片與作者刪除規則。既有 read_access/author_visible 固定；owner-admin 顯示作者。','id','附議規則建立新提案時 snapshot；comments 改變排批次。圖片／作者刪除用當前值，舊圖不被降額回收。',['issues','user_issue_category_assignments','category_configuration_audit']),
  issues: model('內容','提案','正文、作者、分類、七種狀態、結果；儲存 read_access/author_visible/support 規則快照、deadline/met/closed 時間與 row revision。','id','作者基礎支持為 1；首次達標保留 met_at；逾期未達標由 maintenance 拒絕。closed_at+保留天數到期清內容及關聯。',['issue_categories','supports','comments','uploads']),
  supports: model('內容','附議紀錄','每個 UID 對提案的一筆支持；作者不另插 supports。trigger 計數是作者基礎 1 + 列數。','issue_id + uid','同提案 FK 級聯刪除；deadline 前且允許狀態才能新增／取消。',['issues','user_profiles']),
  comments: model('內容','提案留言與回覆','正文、作者、提案與 parent。只允許同提案的一層回覆；row revision 和 domain version 分別管局部更新與整體失效。','id','刪提案／父留言 cascade；附圖另排外部刪除；新增由 trigger 再驗留言政策。',['issues','comments','uploads','user_profiles']),
  facility_categories: model('內容','設施分類政策','分類名稱、排序、預設、啟用、作者刪除與圖片上限。','id','現行分類值在新增／刪除／上傳時使用；刪分類相關內容與 scope 一起處理。',['facility_reports','user_facility_category_assignments']),
  facility_reports: model('內容','設施回報','正文、位置、處理狀態、affected count、結果與 started/closed timestamp。','id','pending→processing→completed/unable-to-handle；closed_at+保留天數清理。沒有提案附議 deadline 邏輯。',['facility_categories','facility_report_affected_users','uploads']),
  facility_report_affected_users: model('內容','我也遇到紀錄','UID 與設施回報的多對多關係；新增／刪除後更新 affected_count。','facility_id + uid','刪設施 cascade；狀態事件收件者包含這些 UID。',['facility_reports','user_profiles']),
  announcements: model('內容','公告','作者、正文、published_at、留言開關、按讚／留言數與 row revision。','id','平台留言設定排批次更新舊公告；published_at+保留天數清理。',['announcement_likes','announcement_comments','uploads']),
  announcement_likes: model('內容','公告按讚','每 UID 一筆 like；setAnnouncementLike 傳期望最終 liked 狀態。','announcement_id + uid','刪公告 cascade；like 一般不建立 Push／站內通知。',['announcements','user_profiles']),
  announcement_comments: model('內容','公告留言與回覆','作者、正文、同公告 parent；一層回覆與 row revision。','id','刪公告／父留言 cascade；新留言驗平台與公告 flag、圖片及內容限制。',['announcements','announcement_comments','uploads','user_profiles']),
  uploads: model('媒體與通知','圖片所有權與關聯','srp-upload://id 對應 Cloudinary public_id、owner、pending/ready/attached/failed、visibility 及多型 target。真實圖片在 Cloudinary。','id','pending 按 created_at；ready 未附著及 failed 按 updated_at+時數。attached 隨正文生命週期；刪除排背景 job。',['issues','comments','facility_reports','announcements','announcement_comments','background_jobs']),
  notifications: model('媒體與通知','站內通知','broadcast/user/admin source，recipient/actor、目標、正文預覽與 comment。target 是邏輯關聯，可能指向已刪內容。','id：event + recipient 的 deterministic ID','created_at=事件 occurred_at；expires_at=事件時間+notificationsDays，關閉期限為 infinity；讀取已排除到期列，批次稍後刪。',['domain_events','notification_states','user_profiles']),
  notification_states: model('媒體與通知','已讀水位','每 UID 的 broadcast/user/admin/announcement opened_at，紅點由通知建立時間與水位比較。','uid','markOpened 用 greatest 只允許前進；不是逐通知 boolean。跨分頁 realtime 更新水位。',['notifications','user_profiles']),
  push_tokens: model('媒體與通知','裝置推播登記','UID+device_id、FCM token、permission、平台與 last_confirmed_at；換帳號會重新指派裝置 token。','uid + device_id','初值每 7 天確認；未確認超過 inactivePushTokensDays 或非 granted 會清理；失效 FCM token 立即刪。',['user_profiles','push_delivery_receipts']),
  push_delivery_receipts: model('媒體與通知','Push 成功去重','某 delivery 對某 token_hash 已成功；重試避開有 receipt 裝置。沒有儲存 token 本文。','delivery_id + token_hash','跟 delivery 生命周期；FCM 接受與 receipt 提交之間崩潰仍有重複窗口。',['event_deliveries','push_tokens']),
  platform_admin_notification_preferences: model('媒體與通知','管理員個人收件偏好','提案／設施／留言三個通知開關；只屬此平台管理員，不是全校總開關。','uid','提交後下一次 delivery 收件者解析採新值；不能撤回已發通知。',['user_profiles','notifications','push_tokens']),
  operations: model('交易與工作','寫入去重與回應','UUID operation_id、actor/action、processing/completed/failed、response/error。claim 與 mutation/event/audit/complete 在同交易。','operation_id','完成重播回應，處理中拒絕重複；expires_at 到期清 response。被 event/audit FK 引用的身份列保留，沒有引用才可整列刪。',['domain_events','admin_audit_log']),
  domain_events: model('交易與工作','領域事件','每次正式變更的 aggregate、event_type、actor、occurred_at、payload 與 aggregate_version；Worker 明確寫入，不靠舊 outbox trigger。','event_id','occurred_at+domainEventDays 且不存在 delivery 才可刪；operation FK 維持來源身份。',['operations','event_deliveries','domain_event_types']),
  event_deliveries: model('交易與工作','每個目的地的投遞責任','event_id+destination 對應 Notion/in_app/push/realtime；status、attempt_count、last_attempt_id、next_attempt_at、locked_at、error 與 expiry。','id；event_id + destination 去重','claim SKIP LOCKED；attempt UUID fencing；失敗退避最多 8 次。完成／失敗時依當時政策設 expires_at，之後清理。',['domain_events','event_destinations','push_delivery_receipts']),
  claimable_event_deliveries: model('交易與工作','可領取投遞 view','0033 view 篩選可執行狀態、時間與鎖期限，consumer 先 probe 再 claim，減少空掃。這是 view，不是另一份投遞資料。','來源 event_deliveries.id','每次 SQL 動態計算；沒有獨立 TTL 或寫入入口。',['event_deliveries']),
  domain_event_types: model('交易與工作','合法事件類型','事件名稱字典，約束 domain_events 的 event_type。','event_type','由 migrations 新增／改變；對應 events resolver 的明確分支。',['domain_events']),
  event_destinations: model('交易與工作','合法投遞通道','Notion、in_app、push、realtime 的通道字典。','destination','由 migration 定義；註冊 destination 不保證 consumer 對每種 event 都有訊息。',['event_deliveries']),
  background_jobs: model('交易與工作','批次與外部工作','deletion/category_policy/retention_cleanup/notion_reconcile 等；payload/scope、估算/已處理/影響列數、status、attempt 與 cursor/result。','id','policy payload 是排程快照；新設定 supersede 舊 job；批次未完回 pending。完成／失敗 TTL 用生命周期當時政策；外部清理責任不可隨意丟棄。',['uploads','external_cleanup_backlog','notion_pages']),
  external_cleanup_backlog: model('交易與工作','尚未完成的外部刪除','過期失敗 deletion job 的 provider 識別碼與 payload；保留可重試的刪除責任。','job_id','retry 還原 deletion job；clearScheduledWork 會刪 backlog 並放棄責任。DB 保留清理完成不等於外部完成。',['background_jobs']),
  notion_pages: model('交易與工作','Notion 外部頁對映','target_type+target_id 對應 notion_page_id。不是主資料；重建與封存工作依此查外部頁。','target_type + target_id','刪 mapping trigger 排 archive；非內容 mapping 按 notionArchiveDays 清理；供應商未啟用不能宣稱外部封存完成。',['background_jobs','domain_events']),
  runtime_settings: model('設定與觀測','正式 runtime 政策','key/value(text JSON) 儲存 operations_settings、image_upload_settings、data_retention_settings；不是 .env。','key','圖片／retention 讀 DB；operations isolate 最多快取 60 秒；policy revision 通知 browser 拉新值。',['operation_policy_history','background_jobs','system_setup']),
  system_setup: model('設定與觀測','全校設定 singleton','首次完成時間、功能開關、公告留言與圖片數。categoryRevision 合併分類和這張表計算。','singleton','首次設定／分類儲存鎖 row；公告留言改變 trigger 排 policy；關功能不等於刪內容。',['issue_categories','facility_categories','announcements','background_jobs']),
  content_versions: model('設定與觀測','三類內容版本','issues/facilities/announcements 的 domain 版本；statement trigger bump。配合每 row revision 防漏掉變更。','domain','getContentVersions 在前景／網路恢復／socket resync 比較，清失效 entity、list/detail/comment cache。',['issues','facility_reports','announcements']),
  operation_policy_history: model('設定與觀測','營運政策變更歷史','整數 revision、原因、before/after 與操作者；與政策儲存同交易。','id','expected revision 衝突拒絕；歷史以 adminAuditDays 到期維護。',['runtime_settings','user_profiles']),
  admin_audit_log: model('設定與觀測','管理操作稽核','action、domain、target、detail、actor 與 operation_id。管理 write 和 audit 同交易。','id','created_at+adminAuditDays；operation FK 支持來源追溯。清 operational_errors 不會刪它。',['operations','user_profiles']),
  role_assignment_audit: model('設定與觀測','角色指派稽核','角色 grant/revoke 與 actor；0059 可記舊平台管理員的 revoke。','id','created_at+roleAssignmentAuditDays；受保留批次處理。',['user_role_assignments','user_profiles']),
  access_assignment_audit: model('設定與觀測','分類範圍稽核','actor/target UID 的 before/after scopes，供管理紀錄追溯。','id','created_at+accessAssignmentAuditDays；與 scope 修改同交易。',['user_issue_category_assignments','user_facility_category_assignments']),
  category_configuration_audit: model('設定與觀測','分類與平台設定稽核','domain/category/operation、before/after；0054 加 update-platform-settings，包含圖片與保留政策。','id','created_at+categoryConfigurationAuditDays；分類刪除／設定成功留紀錄。',['issue_categories','facility_categories','runtime_settings']),
  platform_counters: model('設定與觀測','平台計數','按 key 儲存總筆數、活動時間等維護統計；trigger 同交易更新。','key','供 overview/dashboard；不是每次查看全表 count。',['issues','facility_reports','announcements']),
  platform_category_counters: model('設定與觀測','提案分類計數','每 category 的 issue/comment counters，與 row 變更同交易更新。','category','供分類統計；計數不等於 viewer 有權讀到的內容筆數。',['issue_categories','issues','comments']),
  operational_errors: model('設定與觀測','每日錯誤聚合','bucket/action/code 的 error count、first/last、status、operation/failure ID；429 配額拒絕不當成應用失敗聚合。','bucket + action + code','maintenance 按 errorRetentionDays 清舊桶；管理清錯誤只清此表，不重試工作、不清 provider logs。',['operations']),
  operational_metrics: model('設定與觀測','DB 容量日樣本','bucket、database_bytes、measured_at；maintenance 取 DB 容量快照。','bucket','metricsRetentionDays 維護；容量不是瀏覽器輪詢直接存入。',[]),
};

export function makeModelFlows(models) {
  return models.map(m => ({
    id: 'model:'+m.name, title: m.title+' · '+m.name, group: '資料模型', section: m.group,
    kind: 'topology', summary: m.purpose, notes: ['欄位型別來自完整 migration 生成契約；圖上「程式關聯」未必是 FK。', m.lifecycle],
    nodes: [
      {title:m.name, text:m.purpose, layer:'database', x:360,y:0,refs:m.refs,model:m.name},
      ...m.related.map((related,i)=>({title:related,text:models.find(x=>x.name===related).purpose,layer:'database',x:(i%3)*360,y:260+Math.floor(i/3)*240,refs:models.find(x=>x.name===related).refs,model:related})),
    ],
    edges: m.related.map((related,i)=>({from:0,to:i+1,label:m.foreignKeys.find(k=>k.target===related)?.label || '程式關聯',relation:true})),
  }));
}

export function makeModelOverview(models) {
  const sections = [
    ['身分與權限','user_profiles / roles / scope / restrictions','誰登入、誰能讀寫、可管理哪個分類；帳號限制到期與保留紀錄分開。'],
    ['內容','issues / facilities / announcements','分類政策、內容、反應與留言；當前設定和建立時快照有不同生效範圍。'],
    ['媒體與通知','uploads / notifications / push','內容存媒體 ID、實體在 Cloudinary；通知用事件時間與已讀水位，Push 有裝置 token 與 receipt。'],
    ['交易與工作','operations / events / deliveries / jobs','主交易的去重和事件 outbox；Queue 逐通道／逐批執行，外部刪除失敗責任留在 backlog。'],
    ['設定與觀測','runtime_settings / setup / audit / counters','正式配置、版本、稽核、聚合與日樣本；提供管理員檢視與 policy revision。'],
  ];
  return {id:'data-models',title:'資料模型：整體關係',group:'資料模型',kind:'topology',summary:'左側可逐張檢視所有表與 view 的完整欄位；此圖先顯示五類資料的責任。',notes:['實體 FK 與邏輯關聯會分開標示；Firebase Auth、Cloudinary 與 DO 儲存不在 PostgreSQL schema 中。'],
    nodes:sections.map(([section,title,text],i)=>({title,text,layer:'database',x:(i%3)*370,y:Math.floor(i/3)*270,refs:[{path:'cloudflare/src/backend/database/schema.generated.ts',line:4}],details:[{title:'所含資料模型',text:models.filter(m=>m.group===section).map(m=>m.name).join('、')},{title:'閱讀方式',text:'在左側「資料模型」選表；點中央卡片後，右側列出用途、身份鍵、完整欄位與時間條件。'}]})),
    edges:[edge(0,1,'UID / scope'),edge(1,2,'target / recipient'),edge(1,3,'寫入 → event'),edge(3,2,'delivery / deletion'),edge(4,1,'policy / revision'),edge(4,3,'retention / audit')]};
}
const edge = (from,to,label)=>({from,to,label,relation:true});
