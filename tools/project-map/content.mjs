// 人工解說與自動盤點分開；build.mjs 會拒絕沒有解說的新增 action。
const A = 'cloudflare/src/backend/actions/';
const S = 'src/services/';
const H = 'src/hooks/';
export const groups = ['程式架構', '資料模型', '使用者操作', '管理員操作', '管理員改設定', '自動化與時間', '原碼與盤點'];
export const actions = {};
function add(group, handler, entries) {
  for (const [id, title, entry, logic, db, effect = '', timing = '每次操作當下執行'] of entries)
    actions[id] = { group, title, entry, logic, db, effect, timing, refs: [A + handler] };
}
add('登入與個人', 'session-bootstrap.ts', [
  ['getSessionBootstrap','啟動：取得登入後的整包資料','session-store → session-bootstrap','分段回傳 access、catalog、versions、未讀提示與 runtimePolicies；頁面收到一段便可呈現一段。可要求 recordVisit。','user_profiles、角色／scope、system_setup、分類、content_versions、notification_states、runtime_settings','種入 session、分類、版本、通知與政策 store。last_seen_at 最多每 24 小時更新。','新登入、恢復登入、強制更新 session 時；前端短快取 10 分鐘，啟動 force=true'],
]);
add('登入與個人', 'user-access.ts', [
  ['getCurrentUserRole','重新確認我的角色與範圍','session-role → users','後端重新查平台管理員、permission 與分類 scope；按鈕顯示依此結果。','user_role_assignments、user_issue_category_assignments、user_facility_category_assignments、system_setup','更新 SessionAccess。既有畫面角色不等於每次請求的後端權限。'],
  ['listRoleAssignments','檢視／搜尋負責範圍成員','scope-access-editor → use-scope-access → access','要求 role.manage；按公告／提案分類／設施分類讀完整名單及成員 revision，沒有 100 人截斷。查人時以 UID 或正規化 Email 精確查詢；正式 ADMIN_EMAILS 決定管理員身分。','user_role_assignments、分類 scope assignments、user_profiles；access-user-profiles 用單一 SQL 讀個人資料與所有範圍','名單建立 browser 草稿 baseline；搜尋只讀，不會授權。'],
  ['setUserAccessScope','指派或撤銷分類管理範圍','use-access-management → access','要求 role.manage。提案 scope、設施 scope、公告管理各自處理；platform-admin 由 ADMIN_EMAILS 決定。','user_role_assignments、分類 assignments、access_assignment_audit','user.access_scoped → realtime delivery；管理寫入另記 admin.audit_recorded。','DB 提交後，下一個後端請求使用新範圍；其他已開啟畫面的 session 需重新讀取'],
  ['saveScopeMembers','儲存整批負責範圍成員','scope-access-editor → use-scope-access → access','點加入／撤銷先改本機草稿，儲存才送 changes + baseline revision。後端按 scope 取得 advisory lock、比對完整成員 revision，再依 UID 排序鎖住變更帳號，整批授予／撤銷；任一非法目標或衝突整筆 rollback。正式管理員不能被指派；已移出 ADMIN_EMAILS 的舊管理員在此交易撤銷舊角色。','user_profiles、user_role_assignments、user_issue_category_assignments、user_facility_category_assignments、role_assignment_audit、access_assignment_audit','回傳正式完整名單、新 revision、changedUids。只對實際改變成員記 user.access_scoped；自己草稿以正式回應重建。','DB 提交後下一次授權採新 scope；舊頁面需重新讀 session。0059 只鎖被編輯帳號，不鎖全體角色'],
  ['getUserPublicProfiles','解析作者名稱與頭像','use-public-profiles → users-read','批次讀取 UID 對應的公開 profile；頭像簽發媒體 URL。是否提供 UID 已先在內容可見性層決定。','user_profiles','以 profile_version／avatar_version 更新作者呈現。','前端 profile cache 24 小時；可強制重新整理'],
  ['cacheUserAvatar','重新快取 Google 頭像','session-store → users-write','比對來源與 checked_at；必要時 Worker 取得 Google 頭像，寫入 Cloudinary authenticated asset，再提交 profile；舊資產排刪除工作。','user_profiles、background_jobs','user.avatar_updated → realtime；此事件目前沒有對應 content message。','avatarRevalidateHours 預設 24 小時；每日配額初值 30'],
]);
add('管理觀測', 'user-admin.ts', [
  ['listAdminUsers','搜尋／分頁檢視使用者','use-admin-console → admin-console','role.manage；查詢目前 profile、角色、統計與有效限制，並解析頭像。','user_profiles、user_restrictions、角色／scope','每頁 80 人；查詢及頁碼影響讀取。'],
  ['listAdminAudit','檢視管理稽核','use-admin-console → admin-console','role.manage；搜尋管理、角色、分類與存取稽核；每頁 100 筆。','admin_audit_log、role_assignment_audit、category_configuration_audit、access_assignment_audit','只讀取；不重做原操作。'],
  ['listAdminActivity','檢視近期活動明細','use-admin-overview → admin-console','dashboard.view；時間窗選 24h、7d、30d，帶 occurredAt/key 遊標。','管理活動／domain events 與稽核聚合','活動明細與下一頁。','以查詢當下 now() 計算回溯時間窗'],
  ['getAdminOverview','檢視活動總覽','use-admin-overview → admin-console','dashboard.view；取得時間窗的統計、活動與健康狀態。','平台 counters、活動與運維資料','總覽圖表與數字。','24 小時／7 天／30 天，以後端時間計算'],
]);
add('管理設定', 'account-access-rules.ts', [
  ['listAccountAccessRules','檢視帳號限制規則','account-access-rules／account-access-editor → admin-console','role.manage；回傳 UID／Email 字首規則、active、截止時間、訊息、排除正式管理員的命中數及每列 revision。列表包含已過期紀錄，授權只取仍有效規則。','user_restrictions、user_profiles','規則 revision 是 md5(to_jsonb(row)::text)，新規則 baseline revision=null。'],
  ['previewAccountAccessRule','預覽 Email 字首限制會命中誰','account-access-rule-fields → admin-console','只接受 email_prefix；驗字首、預設、期限與訊息，並比對現存規則 revision。計算符合字首且不在 ADMIN_EMAILS 的人數；不取得寫入鎖、不改規則。','user_restrictions、user_profiles','供管理員檢視本次限制範圍；估算後仍可能有新帳號或別人改規則。'],
  ['saveAccountAccessRule','新增／更新唯讀、僅反應、封鎖規則','account-access-editor → use-account-access-editor → admin-console','UID 優先，Email 字首取最長有效命中。按 targetType+targetValue 上鎖、檢查 row revision，衝突回 configuration-changed。可保持原期限、7 天、30 天、自訂 1–87600 小時或永久；不能限制正式管理員，UID 不能是自己。','user_restrictions：複合鍵 (target_type, uid)；同交易回讀 rule、effectiveRule 與新 revision','UID → user.restricted；字首 → platform.settings_updated。成功畫面使用正式回應，保留期限不會延長舊截止時間。','新期限 = PostgreSQL statement_timestamp() + 時數；永久為 null。到期後下一個後端請求不再命中，無須等待 cron'],
  ['deleteAccountAccessRule','確認並移除精確帳號限制','account-access-editor／user-details-sheet → admin-console','確認後送 targetType+targetValue+revision；同規則 advisory lock 與 FOR UPDATE，衝突拒絕。只刪此複合鍵；移除 UID 規則後 Email 字首規則仍可能限制該人。','user_restrictions；回傳 deleted、正式 rule/effectiveRule/revision','自己畫面按 canonical effectiveRule 更新；DB 提交後下一次授權重新解析。'],
]);
add('提案', 'issue-read.ts', [
  ['listIssues','瀏覽、排序、篩選提案','use-issue-feed → issues-read-pages','分類、active/closed、狀態、latest/most-supported/ending-soon 與 cursor；套用 owner-admin、reviewed-school 的資料可見性。','issues、supports、content_versions','回傳列表、分頁、version 與分類層級 statusCounts；狀態件數不受內容可見性限制。'],
  ['searchIssues','搜尋提案與作者','use-issue-feed → issues-read-pages','searchLength 驗證；使用索引與權限範圍搜尋標題、內容或可見作者，不能藉搜尋取得原本不可讀內容。','issues 的搜尋索引、user_profiles、supports','搜尋結果進同一個列表快取與 entity store。'],
  ['listUserIssues','檢視／搜尋我的提案','use-issue-feed → issues-read-user','只查 actor UID；支援狀態、排序、自己提案的標題與內容搜尋、遊標分頁。','issues where author_uid = actor.uid','我的提案頁；查詢條件寫入網址。'],
  ['getIssue','開啟提案詳情','use-issue-detail → issues-read','先讀提案與 category，再由 RPC 檢查作者／scope／狀態可見性；回傳真實 policy snapshot。','issues、supports、content_versions','共用 entity store；補讀作者、留言與 signed media。'],
  ['listIssueSupporters','檢視附議者','use-issue-detail → issues-read','先驗證提案可見性，再讀支持者 profile；不讓 support 名單繞過 private issue 規則。','supports、user_profiles','支持者清單。'],
]);
add('提案', 'issue-create.ts', [
  ['createIssue','新增提案','issue-composer → use-entry-composer → issues-write','驗證字數／圖片 ownership 與分類；reviewed-school 為 under-review，其餘 pending。啟用附議時作者的基礎支持數為 1，作者不另插 supports。','issues；trigger 儲存 read_access、author_visible、support_deadline_days 等分類快照；圖片 attach 到內容','issue.created → Notion、站內通知、Push、Realtime。建立失敗保留草稿並清理未附著圖片。','不用審核：建立當下 + N×24 小時；需審核：建立時尚無附議截止時間'],
]);
add('提案', 'issue-support.ts', [
  ['toggleSupport','附議提案','issue-support-panel → use-optimistic-reaction → issues-write','前端先 +1，後端鎖住提案；pending/processing 才可、必須啟用附議且未截止，作者不能自己點附議。此 action 是確保支持紀錄存在；取消由 removeSupport 處理。','supports；trigger 重算「作者 1 + supports 筆數」；達標首次寫 support_met_at，pending → processing','未達標 support.toggled → Notion/Realtime；首次達標 support.goal_met → 四個 destination；失敗 rollback optimistic。','是否截止用絕對 timestamp 比較；達標後截止前仍可繼續附議'],
  ['removeSupport','取消附議','issue-support-panel → use-optimistic-reaction → issues-write','同樣檢查狀態、啟用與截止時間；只刪 actor 自己的支持紀錄。達標後減少人數不會清除 support_met_at，也不會自動退回 pending。','supports、issues.support_count','support.toggled → Notion、Realtime；失敗復原畫面。','截止後也不能取消；前端顯示與 Worker 比較可能有短暫差異'],
]);
add('提案', 'issue-comments.ts', [
  ['listComments','讀取／排序提案留言與回覆','discussion → use-comment-feed → issues-read-comments','驗證提案可見性與留言讀取政策；按 newest/oldest 遊標分頁，最多 30 筆。','comments、issues、content_versions','共用討論列表；回覆與作者、圖片另外解析。'],
  ['createComment','送出提案留言或回覆','comment-composer → use-discussion-composer → issues-write','可純文字／圖片；檢查留言開關、提案狀態、回覆 parent 同一提案與一層回覆、圖片政策。結案／不可行／審核拒絕／自動拒絕不得留言。','comments、uploads；更新 counter/revision','issue.comment_created → 四個 destination。優先通知被回覆者，否則提案作者；排除操作者，平台管理員按偏好加入。','已選附件不存草稿；IME 組字不觸發快捷送出；慢回應不能清掉之後新編輯'],
  ['deleteComment','刪除提案留言／回覆','comment-thread → use-comment-feed → issues-write','留言作者或具此分類管理 scope 者；連帶處理回覆、圖片與計數。不存在時回成功。','comments、uploads、background_jobs','issue.comment_deleted → Notion、Realtime；Cloudinary 實際刪除在背景。'],
]);
add('提案', 'issue-moderation.ts', [
  ['moderateIssueStatus','審核、改狀態、結案或重新處理','use-issue-moderation → issues-write','proposal.manage + 目標分類 scope。鎖 row；completed/infeasible 必須帶 resultContent，狀態與結果一起提交；processing 清除舊結果。允許的七種狀態由後端集合驗證。','issues、closed_at、review_approved_at、support_deadline_at、result_content','狀態改變 → issue.status_changed 四 destination；結果改變 → issue.result_updated Notion/Realtime。相同狀態不再送狀態事件。','改 pending 且啟用附議：從當下重新算 N 天；回 under-review/review-rejected 清掉審核／截止時間；結案設 closed_at'],
  ['updateIssueResult','修改處理結果','use-issue-moderation → issues-write','proposal.manage + category scope；completed/infeasible 不可存空結果；其他狀態可清空。此 action 不改狀態。','issues.result_content','issue.result_updated → Notion、Realtime。'],
]);
add('提案', 'issue-delete.ts', [
  ['deleteIssue','刪除提案','use-issue-detail → issues-write','分類管理員，或作者且當前 category.authorDeleteEnabled；後端提供刪除前作者、支持者及標題供通知使用。','issues、關聯 comments/supports/uploads、background_jobs','issue.deleted → 四 destination；關聯附件排刪除，Notion 封存。','是否能自行刪除讀當前分類規則，與舊提案 policy snapshot 不同'],
]);
add('設施', 'facilities.ts', [
  ['listFacilities','瀏覽／搜尋／排序設施回報','use-facility-feed → facilities','category、active/closed、status、query、latest/most-affected、cursor；查範圍與 snapshot。','facility_reports、affected users、content_versions','回傳列表、statusCounts、分頁與管理能力。'],
  ['getFacility','開啟設施詳情','use-facility-detail → facilities','讀 category；判斷 canManageFacility、是否作者與當前 authorDeleteEnabled。','facility_reports、facility_report_affected_users','詳情、位置、內容、圖片與處理結果。'],
  ['createFacility','新增設施回報','use-entry-composer → facilities','標題、位置必填，內容可空；驗證 category 存在與圖片 ownership／數量。','facility_reports 初始 pending；uploads attach','facility.created → 四 destination；分類管理者要 notify_on_created 才加入建立通知。'],
  ['toggleFacilityAffected','標記／取消「我也遇到」','use-facility-detail → use-optimistic-reaction → facilities','按 actor UID 新增或刪除 affected 列，回傳人數及個人狀態；前端先預覽結果，失敗還原。','facility_report_affected_users、facility_reports.affected_count','facility.affected_toggled → Notion、Realtime。'],
  ['updateFacilityStatus','更新設施處理狀態','use-facility-status → facilities','requireFacilityCategoryPermission；只接受 processing/completed/unable-to-handle；處理結果在 SQL 層驗證結案要求。','facility_reports.status、result_content、closed_at','facility.status_changed → 四 destination；通知作者與受影響者，平台管理員按偏好加入。','completed/unable-to-handle 每次提交都以 now 設 closed_at；processing 首次設 started_at、清結案時間，但未提供新結果時保留舊 result_content'],
  ['deleteFacility','刪除設施回報','use-facility-detail → facilities','具此 category scope，或作者且當前 authorDeleteEnabled；DB cascade + 圖片背景清理。','facility_reports、affected users、uploads、background_jobs','facility.deleted → Notion、Realtime。'],
]);
add('公告', 'announcement-read.ts', [
  ['listAnnouncements','瀏覽公告','use-announcement-feed → announcements','已登入可讀；publishedAt/id 遊標分頁，附 version。','announcements、announcement_likes、content_versions','公告列表及共用 entity store。'],
  ['getAnnouncement','開啟公告詳情','use-announcement-detail → announcements','查公告與自己的 liked 狀態；以當前公告 comment flag 呈現留言。','announcements、announcement_likes','詳情、作者、signed media 與討論。'],
  ['getAnnouncementUnreadHint','計算公告新訊息提示','use-announcement-notice → announcement-notice','比較公告 published_at 與 actor announcement_opened_at。','announcements、notification_states','導覽新公告提示。','回到前景、恢復網路會重新檢查'],
  ['markAnnouncementsOpened','把公告標記為已看過','use-announcement-feed → announcement-notice','後端將 announcement_opened_at 往後推；更新影響 badge。','notification_states.announcement_opened_at','notification.marked_opened → Realtime 的 notification-state:{uid}。'],
]);
add('公告', 'announcement-write.ts', [
  ['createAnnouncement','發布公告','use-entry-composer → announcements','announcement.manage；驗證標題、本文、公告圖片政策；初始留言開關讀平台設定。','announcements、uploads','announcement.created → 四 destination；站內 broadcast，全校適用 Push devices。'],
  ['deleteAnnouncement','刪除公告','use-announcement-detail → announcements','announcement.manage；刪留言、like、附件與外部對映清理。','announcements、announcement_comments、announcement_likes、uploads、background_jobs','announcement.deleted → Notion、Realtime。'],
  ['setAnnouncementLike','按讚／取消公告讚','use-announcement-detail → use-optimistic-reaction → announcements','liked 是想要的最終狀態；insert/delete 自己的 like，重算計數；失敗回復。','announcement_likes、announcements.like_count','announcement.liked → Notion、Realtime。'],
]);
add('公告', 'announcement-comments.ts', [
  ['listAnnouncementComments','讀取公告留言／回覆','use-comment-feed → announcements','newest/oldest 遊標分頁、parent/replies；驗證公告存在。','announcement_comments、content_versions','討論列表；作者與圖片經共用解析。'],
  ['createAnnouncementComment','送出公告留言／回覆','use-discussion-composer → announcements','平台和公告留言開關、文字／圖片限制、parent 同公告與一層回覆檢查。','announcement_comments、uploads、comment_count','announcement.comment_created → 四 destination；通知回覆物件或公告作者。'],
  ['deleteAnnouncementComment','刪除公告留言／回覆','use-comment-feed → announcements','留言作者或 announcement.manage；刪除關聯回覆與圖片、更新計數。','announcement_comments、uploads、background_jobs','announcement.comment_deleted → Notion、Realtime。'],
]);
add('通知', 'notifications.ts', [
  ['getNotificationSnapshot','開啟通知頁：初始快照','use-notifications-page → notifications','平行讀 broadcast/user/admin 各首頁與已讀 state，分段傳出；admin source 僅具管理身分者。','notifications、notification_states','合併排序，呈現通知後再標已讀。','SQL 排除 expires_at 已到的通知'],
  ['listNotificationPages','載入下一批通知','use-notifications-page → notifications','每次最多三個 source；各自 cursor createdAt/id，保留 PostgreSQL 微秒精度避免漏列。','notifications','合併去重；feedPages 限制保留頁數。'],
  ['getNotificationReadState','讀取通知已讀時間','use-notification-badge → notifications','取得 broadcast/user/admin/announcement 四種水位。','notification_states','判斷 badge 與未讀樣式。'],
  ['getNotificationUnreadHint','檢視是否有未讀通知','use-notification-badge → notifications','根據來源、權限、水位與 expires_at 查存在性。','notifications、notification_states','頁面小紅點；realtime insert/read event 使 cache 失效。','前端 hint cache 2 分鐘'],
  ['markNotificationsOpened','將目前通知標為已讀','use-notifications-page → notifications','Worker 以自己的現在時間寫水位；SQL 用 greatest 讓水位只能前進。','notification_states','notification.marked_opened → Realtime；其他分頁收到水位更新。','延遲抵達的早期請求不能把已讀退回'],
  ['getPushNotificationPreference','查詢這臺裝置的 Push 狀態','use-push-notifications → push-notifications','合併 browser Notification.permission 與 deviceId 已註冊狀態。','push_tokens','設定頁顯示可啟用／已啟用／瀏覽器封鎖。'],
  ['getPlatformAdminNotificationPreferences','讀取我的管理員通知偏好','settings → push-notifications','限平台管理員，查提案／設施／留言三種個人通知偏好。','platform_admin_notification_preferences','三種開關，初值皆 false。'],
  ['updatePlatformAdminNotificationPreferences','修改我的管理員通知偏好','settings → push-notifications','限平台管理員；這是此管理員的收件偏好，並非全校通知開關。','platform_admin_notification_preferences','push_token.updated 記事件但 destinations=[]；收件者解析在真正 delivery 時讀新偏好。','提交後尚未解析收件者的站內與 Push delivery 用新值；已傳送通知無法撤回'],
  ['registerPushToken','允許通知並註冊裝置','use-push-notifications／heartbeat → push-token-registration','browser permission → Firebase Messaging getToken → Worker；token/deviceId 驗證，換帳號重新指派 token。','push_tokens，last_confirmed_at','push_token.updated，無外部 delivery。登入 shell 也更新 SW 的目前 UID。','一般帳號啟用後 App 沒有停用入口；browser/OS 可撤銷；確認頻率預設 7 天'],
  ['unregisterPushToken','移除裝置 Push 註冊','push-notifications → backend-action','只刪 actor UID + deviceId 的 token；用於 session／裝置生命週期，不是一般使用者的偏好開關。','push_tokens','push_token.updated，destinations=[]。'],
]);
add('圖片', 'uploads.ts', [
  ['createImageUploadSessions','建立圖片上傳工作','use-image-attachments → uploads','前端壓 WebP；Worker 讀實際 targetType/scopeId 的圖片上限和共用尺寸／KB；imageUploadDaily 按張數扣額。','uploads pending，ownership/target scope','回 signed Cloudinary upload session；接下來 browser 直接傳 Cloudinary。'],
  ['finalizeImageUploads','完成並驗證圖片上傳','uploads → backend-action','驗 Cloudinary 回傳 signature、public ID、尺寸與大小；整批 settle 後才離開 transaction。','uploads pending → ready','內容送出時 Markdown srp-upload://id 才 attach；upload.mutated 無外部 destination。'],
  ['deleteUploadedImages','清理未送出的圖片','uploads → backend-action','最多 50 個去重 storagePaths；僅本人、未附著圖片可清；同 transaction 刪 upload + 建 deletion job。','uploads、background_jobs','Queue → Cloudinary destroy；失敗進管理觀測可重試。'],
  ['resolveUploadImageUrls','取得可顯示的圖片網址','use-resolved-markdown → uploads','依 attached target 的提案／留言可見性檢查 viewer；簽 HMAC full/thumbnail URL。不開寫入 transaction。','uploads、內容／category 存取資料','回 /v1/media token URL；Markdown 經 Marked + DOMPurify 後呈現。','私有 URL 約 15–20 分鐘；前端提早 60 秒停用 cache。公開 URL token expiresAt=0，並非短效'],
]);
add('管理設定', 'categories.ts', [
  ['getCategoryCatalog','讀取分類、功能與圖片規則','use-categories → categories','分段回傳 setup、issueCategories、facilityCategories、features、imageUploads；目前 state.loaded 會阻止自動重讀。','system_setup、issue_categories、facility_categories、runtime_settings','導覽、路由守門、發文與圖片欄位依這份 browser catalog。'],
  ['getCategoryManagement','開啟分類／平台設定','use-category-management／use-platform-settings → categories','category.manage；取完整 catalog、image/retention settings 與 categoryRevision/platformRevision 雜湊。','分類、system_setup、runtime_settings','正式 baseline 建立草稿；修改中的草稿不被晚到的刷新覆蓋。'],
  ['estimateCategoryPolicyChanges','預覽留言政策的影響筆數','use-category-management → categories','檢查 baseline categoryRevision，儲存前估算既有提案／公告 comments_enabled 的影響；只讀。','issues、announcements、category policy','確認畫面顯示批次數；草稿在估算期間又改了就捨棄此估算。'],
  ['saveCategoryManagement','儲存分類、預設、圖片上限與功能','use-category-management → categories','category.manage；鎖 system_setup singleton、核對 categoryRevision。嚴格驗 booleans/陣列；啟用附議時 goal 與 deadlineDays 必須為正整數；既有 readAccess/authorVisible 固定，owner-admin 強制顯示作者。支援 label、排序、預設、留言、作者刪除、0–20 圖片；刪分類連帶刪內容及 scope。','issue_categories、facility_categories、system_setup、category_configuration_audit；comments 觸發 category_policy job','回傳正式完整 catalog 與新 revision；自己 browser 更新 catalog，其他開啟畫面目前沒有完整 platform realtime 訊息。衝突保留草稿待重讀。','新提案 snapshot 新附議規則，舊篇不變；留言舊篇分批；圖片與刪除权在下一次操作查當前值'],
  ['savePlatformFeatures','儲存提案／設施／公告留言開關','use-category-management → categories','category.manage；system_setup 更新；關閉功能影響 route guard；公告留言觸發 policy job。','system_setup、category_configuration_audit、background_jobs','system.features_updated 註冊 realtime；其他已開頁面無完整自動 catalog 同步。','DB 提交先改設定；自己的 catalog refresh；舊公告 flag 等背景批次；他人畫面可能要重新載入'],
  ['savePlatformSettings','儲存圖片壓縮與資料保留','use-platform-settings → categories','先帶 platformRevision 估算，再確認本次值；交易取得平台 advisory lock、重比 revision。0054 只為縮短／新啟用的規則選 cleanupScopes；通知放寬／關閉也重算 expires_at。只改圖片不觸發無關清理；operation/delivery/job 生命周期 TTL 用於未來的建立或狀態轉換。','runtime_settings(image_upload_settings/data_retention_settings)、background_jobs、category_configuration_audit；保留值改變時 supersede 舊未完成 retention job','有實際待刪／待更新筆數才建 job，回傳正式 settings、revision、jobId 及刪除/更新統計；自己種入圖片政策並標 session bootstrap stale。','圖片下一次操作生效；通知 expiry 與收緊規則靠批次。job 完成不等於 Cloudinary／Notion 外部刪除完成'],
  ['estimateRetentionCleanup','預覽本次保留變更的刪除與更新','use-platform-settings → categories','核對 platformRevision；只估算本次變更 cleanupScopes。分開 totalDeletedRows、totalUpdatedRows、updatedDetails 與 totalEstimatedRows；不是掃所有已過期技術資料。','各內容表、技術表、user_profiles；0054 retention_change_scopes / retention_cleanup_estimate','只讀並供確認；TTL 未來規則可以零既有影響。估算和儲存之間資料仍可能增加。'],
  ['listPlatformJobs','追蹤設定套用進度','use-platform-jobs → categories','category.manage；讀 pending/processing/failed 與近期 job，回 estimated/processed/affected/status。','background_jobs','完成後重新整理設定或內容，失敗保留錯誤與 retry。','1、2、3、5、8、15 秒梯度；隱藏／離線暫停，恢復立即讀取'],
  ['completeInitialSetup','完成全校首次設定','use-initial-setup → categories','僅平台管理員；開啟的功能至少一個分類，後端鎖 singleton，重複完成不重新建立。','system_setup、issue_categories、facility_categories、category_configuration_audit','system.setup_completed 註冊 realtime；管理員自己強制重新整理 session/catalog；等待者靠輪詢。','一般等待者 3 秒開始、倍增至 30 秒；設定完成後匯入主程式'],
]);
add('管理觀測', 'operations.ts', [
  ['getRuntimePolicies','取得目前營運政策','backend-action → getRuntimePolicies','直接讀 operations_settings 最新 revision + values，回給前端。','runtime_settings','setOperationPolicies；一般 API 回應帶 policyRevision，有差異才自動要求重新整理。'],
  ['getProviderDiagnostics','檢視供應商診斷','use-provider-diagnostics → operations-console','dashboard.view + 平台管理員；provider 只接受 cloudinary/cloudflare/logs，Worker 用 secret 查實際供應商。','外部供應商 API 與 logs','前端分頁／搜尋顯示當次 sampledAt；無設定不可視為健康。'],
  ['getOperationsConsole','檢視系統、政策歷史與工作','use-system-console／use-operation-policies → operations-console','dashboard.view + 平台管理員；policiesOnly 只讀政策和歷史、progressOnly 只讀 jobs、queueOnly 只讀工作/投遞/清理/錯誤，不重讀容量；三者互斥。systemOnly 讀容量與診斷但不帶政策。其他片段依 NDJSON 先出現。','background_jobs、event_deliveries、domain_events、external_cleanup_backlog、operational_errors、metrics、policy_history、pg_stat','分頁及 hasMore 分開；重新開容量頁會完整刷新，不把舊 queueOnly 快取當作完整狀態。寫成功後刷新失敗不改稱寫失敗。'],
  ['saveOperationPolicies','儲存營運政策與原因','use-operation-policies → operations-console','category.manage + 平台管理員；驗 values 範圍及 expected revision，過期 revision 拒絕；寫設定、歷史、清自己 isolate 快取。','runtime_settings.operations_settings、operation_policy_history','自己 browser 立即 setOperationPolicies；其他成功 API 回應發現新 revision 才重新整理。','其他 Worker isolate 最長 60 秒快取；進行中的 request 保持原 snapshot；不是背景每分鐘 polling'],
  ['retryOperationalWork','重試失敗的工作／delivery／外部清理','use-system-console → operations-console','role.manage + 平台管理員；kind job/delivery/cleanup/all；重設 attempt、pending、next_attempt_at，cleanup backlog 還原 deletion job。','background_jobs、event_deliveries、external_cleanup_backlog','成功 write 發 drain，從 Queue 再做實際工作；不用在管理按鈕裡執行外部 API。'],
  ['clearOperationalErrors','清除錯誤聚合紀錄','use-system-console → operations-console','role.manage + 平台管理員；只刪 operational_errors。','operational_errors','清空聚合畫面；不重試失敗、不改內容，也不清外部 Cloudflare logs。'],
  ['clearScheduledWork','清除待執行與失敗工作','use-system-console → operations-console','role.manage + 平台管理員；pending/processing/failed background jobs → superseded；external_cleanup_backlog 刪除；不清 event deliveries。','background_jobs、external_cleanup_backlog','in-flight 舊 attempt 無法完成 superseded job。此動作會放棄尚未完成的外部清理責任。'],
  ['rebuildNotionArchive','重建 Notion 封存','use-system-console → operations-console','role.manage + 平台管理員；須 NOTION_ENABLED。advisory lock 防重複；清舊 Notion delivery/mapping，supersede 舊重建／Notion-only 刪除，再建新 reconcile job。','notion_pages、event_deliveries、background_jobs、external_cleanup_backlog','Queue 遍歷提案、設施、公告與 operation，分批 cursor 續跑；重建期間該 invocation 由重建獨佔。','供應商未啟用不能重建；repo wrangler 初值 NOTION_ENABLED=false，未查正式環境'],
]);
add('管理觀測', 'dashboard.ts', [
  ['getPlatformDashboard','檢視資料與系統健康快照','dashboard → backend-action','dashboard.view；並行取分類統計、平台統計與待處理 backlog snapshot。','平台 counters、domain events、deliveries、jobs、uploads、notion_pages','待處理、失敗 Push、stuck uploads、最近錯誤、maintenance 狀況；讀取本身不修復。'],
]);
add('登入與個人', 'content-versions.ts', [
  ['getContentVersions','確認三類內容是否變更','session-store／realtime resync → content-versions','讀 issues/facilities/announcements 的 domain version；與 UID 分區 localStorage 比較。','content_versions','改變的 domain 清 entity + list/detail/comment cache，再通知相關 hook 重新整理。','online、前景恢復、socket 重連、發現 revision gap 觸發；不是持續定時全量讀取'],
]);

const n = (title, text, layer, refs = []) => ({ title, text, layer, refs });
const flow = (id, title, group, summary, nodes, notes = []) => ({ id, title, group, summary, nodes, notes });
export const flows = [
  flow('auth-login','登入、恢復登入、換帳號與登出','登入與個人','新登入與恢復既有 Firebase session 是兩條不同的路。',[
    n('登入入口','先選語言，Turnstile Managed challenge → login-check；Google Identity token → Firebase credential 登入。','browser',[S+'session-auth.ts','src/lib/google-identity.ts']),
    n('Firebase auth observer','onAuthStateChanged；驗學校網域／token。恢復舊 session 改走 auth_restore Turnstile + session-check。','browser',[H+'session-store.ts',S+'session-validation.ts']),
    n('新登入才 sync profile','POST /v1/auth/sync；先檢查 blocked 規則；同步 profile 並按 ADMIN_EMAILS reconcile platform-admin。','worker',['cloudflare/src/backend/sync-user.ts','cloudflare/src/backend/shared/platform-admin.ts']),
    n('取得 bootstrap','強制讀 access/catalog/versions/unread/runtime；session-store 分段種入各 store，導向 /setup 或 /home。','browser',[H+'session-store.ts',A+'session-bootstrap.ts']),
    n('個人身份生命週期','登出／換 UID 清 session、namespace cache、文字草稿；Firebase signOut。舊帳號回應不得再寫入新帳號狀態。','browser',[H+'session-state.ts',H+'session-store.ts',S+'session-auth.ts']),
    n('Push 與頭像順帶啟動','shell 建 realtime 訂閱、推播 token heartbeat、avatar check；它們不阻塞每一份內容讀取。','browser',['src/components/app-shell.tsx',H+'use-push-token-heartbeat.ts']),
  ],['登入按鈕 2 秒冷卻；10 分鐘嘗試上限見 session-auth；Google SDK 10 秒載入、取 token 30 秒逾時。','恢復 session 不重新做 auth/sync，但 bootstrap recordVisit 可更新 last_seen_at。']),
  flow('read-path','讀取、搜尋、分頁、返回與詳情面板','先看全貌','任何讀取都先確認目前帳號；可以先用自己的快取，但後端仍決定可見資料。',[
    n('路由與條件','ProtectedApp／FeatureRouteGuard；搜尋、排序、狀態、分類同步 URL；提交搜尋才寫 history。詳情有獨立頁與 @sheet 攔截頁。','browser',['src/components/protected-app.tsx',H+'use-feed-url-state.ts']),
    n('UID 分區快取','畫面 memory snapshot、content cache、normalized entity 分責；service 合併相同 in-flight request。','browser',[S+'content-read-cache.ts','src/lib/content-entity-store.ts']),
    n('API 查授權與 SQL','讀 action 不 claim operation、不開 mutation transaction；RPC 依 category、scope、owner、status 篩資料。','worker',[A+'execution.ts',A+'issue-read.ts']),
    n('回傳資料與 cursor','每頁 snapshot 帶 domain version；cursor 由最後一筆建立；hooks 忽略過期頁碼／舊搜尋回應。','browser',[H+'use-paged-request-guard.ts',S+'issues-read-pages.ts']),
    n('共用內容與附件呈現','同筆列表／詳情 entity；public profile 批次解析；srp-upload → signed URL；Markdown 清理後呈現。','browser',['src/lib/render-markdown.ts',H+'use-resolved-markdown.ts']),
    n('返回保持瀏覽狀態','view memory 儲存 query/pagination/捲動與 navigation memory；最多保留 feedPages 頁；重新開詳情仍讀權限。','browser',['src/lib/view-memory-cache.ts','src/lib/navigation-memory.ts']),
  ]),
  flow('draft-submit','編輯、儲存草稿、附件與提交失敗','登入與個人','文字留在目前分頁，圖片在真正送出前處理；成功與失敗的清理路徑不同。',[
    n('輸入文字與回覆物件','提案／設施／公告／留言共用 composer；分類、位置、reply target 影響草稿 key。','browser',[H+'use-composer-draft.ts',H+'use-discussion-composer.ts']),
    n('sessionStorage 存文字','key 含 UID、內容型別、分類／目標／reply；savedAt 儲存 24 小時，儲存不可用顯示提示；附件不持久化。','browser',['src/lib/composer-draft.ts']),
    n('選圖與確認','本機 preview；按實際分類檢查張數；切 reply 清附件；送出期間欄位鎖定，IME 不誤送。','browser',[H+'use-image-attachments.ts',H+'use-entry-composer.ts']),
    n('上傳 → 正式寫內容','WebP → create sessions → Cloudinary → finalize → srp-upload Markdown → createIssue/createFacility/createAnnouncement/createComment。','worker',[S+'uploads.ts',H+'use-entry-composer.ts']),
    n('成功與失敗分開','成功清文字草稿、標記附件已用、再導頁；失敗保留原文／選圖並刪未 attach 上傳。慢留言成功只清當次提交那份文字。','browser',[H+'use-discussion-composer.ts',H+'use-entry-composer.ts']),
    n('安全重試','同一 write 的自動 retry 沿用 operationId；DB 重播成功 response。使用者重新發起是新的 action，不把圖片／草稿狀態隨意覆蓋。','database',[S+'backend-action.ts',A+'execution.ts']),
  ]),
  flow('local-settings','語言、亮暗色、安裝、分享與導覽','登入與個人','這些操作主要在瀏覽器或作業系統，沒有必要繞資料庫。',[
    n('語言與外觀','i18n reactive store + localStorage；next-themes 儲存亮／暗／系統。更新當前畫面，跟裝置儲存，不改全校設定。','browser',['src/i18n/index.ts','src/components/settings/appearance-section.tsx']),
    n('安裝 PWA','beforeinstallprompt / standalone 判斷；支援瀏覽器原生安裝，iOS／特定手機顯示步驟，安裝結果由 OS 決定。','browser',[H+'use-pwa-install.ts','src/lib/pwa-install.ts']),
    n('分享目前內容','Web Share API 或 clipboard；產生 issue/facility/announcement 路由，對方開啟仍要登入與透過權限。','browser',['src/lib/share.ts',H+'use-share-entry.tsx']),
    n('頁籤、返回、詳情與搜尋','surface-route、history 與 Next Router 儲存位置；返回／關閉 sheet 不等於刪內容。開啟外部指南只導航。','browser',[H+'use-surface-route.ts','src/lib/route-hierarchy.ts']),
  ]),
  flow('image-lifecycle','圖片全流程：選圖到刪除','圖片','內容只存 srp-upload://id；Cloudinary 圖片實體與 Novae 內容生命週期一起管理。',[
    n('壓縮','decode → 縮最長邊 → WebP quality；必要時 1/0.7/0.5/0.4 比例重試；數量按實際內容規則。','browser',['src/lib/image-processing.ts']),
    n('申請簽名 session','createImageUploadSessions；身份、配額、scope；DB 留 pending upload + signed request。','worker',[A+'upload-sessions.ts',A+'upload-policy.ts']),
    n('browser 直傳 Cloudinary','authenticated asset；取得 public_id/version/signature；Webhook 可獨立晚到。','async',[S+'uploads.ts','cloudflare/src/backend/cloudinary-webhook.ts']),
    n('finalize 並正式 attach','finalize 驗 signature → ready；內容 insert trigger 驗 ownership/status/target → attached。','database',[A+'upload-markdown.ts','database/migrations/0016_system_data_consistency.sql']),
    n('顯示透過 Worker','resolveUploadImageUrls 檢查 viewer；GET /v1/media 驗 HMAC/expiry/native limit → edge cache/Cloudinary。私有 private,no-store，SW NetworkOnly。','worker',[A+'upload-delivery.ts','cloudflare/src/media.ts','cloudflare/src/backend/shared/media-delivery.ts']),
    n('失敗、刪內容或到期','刪 upload／內容 trigger 排 deletion job → Queue destroy；晚 webhook 找不到列再排清理；外部不存在視完成；失敗保留 backlog。','async',['cloudflare/src/backend/jobs/background-jobs.ts','cloudflare/src/backend/cloudinary-webhook.ts','database/migrations/0026_external_cleanup_backlog.sql']),
  ],['公開媒體 token expiresAt=0；私有約 15–20 分鐘，按 5 分鐘 bucket 上捨入。公開與私有 URL 不能一概稱短效。']),
  flow('notification-delivery','一次事件如何變成站內通知與 Push','通知','寫入成功只代表主要交易完成；通知是另一次 Queue 工作。',[
    n('domain event 記在交易內','event + 每種 destination 的 delivery 狀態一起儲存；一般 support/like 沒有 in_app/push。','database',['cloudflare/src/backend/events/domain-events.ts']),
    n('claim delivery','Queue 查到期 pending/failed，SKIP LOCKED + 新 attempt UUID；過期 processing 可接手；最多 8 次 DB attempt。','async',['database/migrations/0033_pending_delivery_probe.sql','database/migrations/0025_consumer_fencing.sql']),
    n('動態解析收件者','建立→category managers；狀態→作者/支持者/affected；reply→parent 作者。排除操作者（goal_met 除外）；平台管理員按偏好加入。','database',['cloudflare/src/backend/jobs/delivery-recipients.ts']),
    n('站內通知與事件時間','eventId + recipient 建 deterministic ID，ON CONFLICT DO NOTHING；公告建立 broadcast。created_at 用事件 occurred_at，expires_at=事件時間+當時 notificationsDays；延遲投遞不延長保存。停用保留時用 infinity；存通知後 publish notification_insert。','database',['cloudflare/src/backend/jobs/notification-deliveries.ts','database/migrations/0055_notification_expiry_event_time.sql']),
    n('FCM Push','取 devices，token hash receipt 去重成功裝置；失效 token 刪除；Provider 成功後 receipt 儲存。','async',['cloudflare/src/backend/jobs/notification-deliveries.ts']),
    n('裝置顯示與點選','前景 messaging／SW 背景 showNotification；UID session gate 避免換帳號顯示舊 Push；點選 route 再讀權威內容。','browser',['src/app/sw.ts','src/lib/push-session.ts','src/lib/notification-target.ts']),
    n('完成／失敗','complete/fail 必須匹配 attempt_id；失敗設 next_attempt_at，cron／新 drain 再試。FCM 接受後若 receipt 前崩潰仍可能重複推播。','async',['database/migrations/0025_consumer_fencing.sql']),
  ]),
  flow('realtime','即時更新、重連、心跳與多分頁','時間與自動','socket 傳失效訊號，畫面再回 Worker 讀資料。',[
    n('取得短效 ticket','POST realtime/ticket；DB 授權後簽 UID/topics JWT，初值 45 秒。這是連線票期限，不代表已連 socket 45 秒後必關。','worker',['cloudflare/src/backend/realtime-ticket.ts']),
    n('建立 WebSocket','RealtimeHub DO 驗 ticket、Origin、topic；notifications 全域訂閱，content 在對應 route family 訂閱。','async',['cloudflare/src/durable/realtime-hub.ts',S+'realtime-transport.ts']),
    n('多分頁接手','Web Locks + BroadcastChannel 相同 UID/角色共用 leader transport；隱藏／離線／關閉交棒，只廣播 event/resync，不廣播 token/ticket。','browser',[S+'realtime-tab-coordinator.ts']),
    n('心跳、閒置與重連','初值 heartbeat 30 秒；idle 30 分鐘停連線；使用者活動／前景恢復再接；斷線延後重試與 resync。','browser',[S+'realtime-heartbeat.ts',S+'realtime-transport.ts']),
    n('收到 content event','依 aggregateRevision 安全 patch count；標 list/detail/comments stale；domainRevision gap → getContentVersions。','browser',[S+'realtime-events.ts']),
    n('合併重新整理','失效合併 200ms，持續事件最多等 1 秒；慢請求只排一個後續重新整理；hidden/offline 暫停，online/visible 恢復。','browser',['src/lib/refresh-scheduler.ts',H+'use-content-invalidation-refresh.ts']),
  ],['目前 platform.settings_updated、category.managed、system.features_updated、user.access_scoped 等雖註冊 realtime destination，realtime-deliveries 對它們回空陣列。不能宣稱他人的 catalog／角色自動立刻重新整理。']),
  flow('support-clock','附議時間：建立、審核、達標、截止','時間與自動','把「畫面推導」、「後端拒絕操作」與「cron 寫入狀態」分開看。',[
    n('建立規則快照','新提案儲存 support_enabled/goal/deadline_days；無審核者 deadline=現在+N天，reviewed-school 先 under-review。作者基礎支持 1。','database',[A+'issue-create.ts','database/migrations/0041_remove_response_deadlines.sql']),
    n('審核通過開始倒數','管理改 pending + supportEnabled，從當下重新算 deadline；審核中／拒絕清期限；每次改 pending 都可能重設倒數。','worker',[A+'issue-moderation.ts']),
    n('期限前支持達標','pending/processing + deadline 未到才可附議；第一次 support_count>=goal 寫 support_met_at，pending→processing；後續仍可附議。','database',[A+'issue-support.ts','database/migrations/0041_remove_response_deadlines.sql']),
    n('browser 提前顯示逾期','getDerivedIssueStatus 在 render 依 Date.now 推導 auto-rejected；剩餘「日」用裝置本地午夜計算，非精確剩餘 24h。','browser',['src/lib/issue-status.ts']),
    n('後端操作當下拒絕','deadline<=Date.now 時支持／取消不可用，即使 DB 尚 pending。畫面日期只是呈現，Worker 決定操作。','worker',[A+'issue-support.ts']),
    n('每半小時 maintenance 真改 DB','reject_expired_support_issues：pending+supportEnabled+無met_at+有deadline<=now+有goal+count<goal → auto-rejected；closed_at/comments/version triggers 隨更新。','database',['cloudflare/src/backend/jobs/maintenance.ts','database/migrations/0001_baseline.sql']),
  ],['目前此 SQL 自動拒絕只 UPDATE，沒有 record_domain_event；舊事件 trigger 已在 0016 移除，不能保證自動拒絕會有 Push／Realtime。前景版本確認／再讀才會看到權威變更。','沒有回覆期限自動結案：0041 已移除 response_deadline_at/days。無 supportGoal 或無 deadline 的提案不會按上述條件自動拒絕。']),
  flow('cron','每 30 分鐘的後端維護','時間與自動','cron 是喚醒點，符合時間條件的資料才會被處理；不會每半小時刪光資料。',[
    n('Cloudflare cron','wrangler */30 * * * *；scheduled 只送 maintenance Queue。部署平台按 UTC 排程，臺灣也是每小時 :00/:30。','async',['cloudflare/wrangler.json','cloudflare/src/index.ts']),
    n('一次有上限 sweep','同 batch 有 maintenance 優先，先載 runtime policy、claim worker second/minute 限額；避免多訊息重複掃。','async',['cloudflare/src/backend/jobs/consumer.ts']),
    n('maintenance 資料維護','清到期 Notion mapping、policy history、error/metrics；記 DB 日容量；拒絕逾期未達標提案；沒有活動 retention job 就排新的。','database',['cloudflare/src/backend/jobs/maintenance.ts','database/migrations/0016_system_data_consistency.sql']),
    n('有工作才投遞','pending destinations 一次查；按 Notion→in_app→push→realtime→background 順序處理。active Notion rebuild 則單獨進行。','async',['cloudflare/src/backend/jobs/consumer.ts']),
    n('retention 分批','policyBatchSize（初值100，max500）逐類清理，payload 是排程時政策快照；尚有資料回 pending 續排。','database',['database/migrations/0023_policy_batch_state.sql']),
    n('結果可查','processed_rows、affected_rows、狀態、attempt、result/errors 進 DB；管理頁讀取進度；剩更多工作送 drain。','async',['cloudflare/src/backend/jobs/background-jobs.ts']),
  ]),
  flow('retention','保留期限與自動資料清理','時間與自動','保留政策不是倒數計時器；到期資料由 Queue 的批次工作刪除／匿名化。',[
    n('政策來源與兩種排程','data_retention_settings；管理儲存只為本次收緊規則選 cleanupScopes，通知改期限／停用也重算 expiry；maintenance 排完整政策，清理正常隨時間到期的資料。各欄位在左側「管理員改設定」。','database',[A+'categories.ts','database/migrations/0054_scoped_retention_policy_changes.sql','cloudflare/src/backend/jobs/maintenance.ts']),
    n('內容期限與通知修復','closed issue/facility 按 closed_at；公告按 published_at；通知按事件時間 created_at 更新 expires_at。enable=false 保留對應內容；通知改 infinity。0055 修復既有通知期限，未完成修復會接到下一份替代 job。','database',['database/migrations/0054_scoped_retention_policy_changes.sql','database/migrations/0055_notification_expiry_event_time.sql']),
    n('技術資料期限','delivery/job 按 expires_at；domain_event 到期且無 delivery 才刪；operation response 到期清空，受 FK 引用身份列保留。','database',['database/migrations/0021_event_retention.sql','database/migrations/0027_extended_runtime_policies.sql']),
    n('身份資料條件','inactive profile/avatar 除最後活動截止外，必須沒有相關內容才清 PII/avatar；不等於刪 Firebase Auth 帳號。','database',['database/migrations/0016_system_data_consistency.sql','database/migrations/0015_retention_runtime_authority.sql']),
    n('外部刪除責任','刪內容／upload→deletion job；刪 Notion mapping→archive job；到期失敗 deletion 轉 cleanup backlog，識別碼留下供重試。','async',['database/migrations/0026_external_cleanup_backlog.sql','database/migrations/0029_archive_and_backup_policies.sql']),
    n('UI 與真正完成','expired 通知讀取已排除；content version 讓再讀畫面更新。DB 清理完成與 Cloudinary/Notion 完成是不同狀態。','browser',[S+'content-versions.ts','cloudflare/src/backend/jobs/background-jobs.ts']),
  ]),
  flow('retry-clock','工作重試、鎖過期、配額與 DO alarm','時間與自動','Queue transport 的重試次數與資料庫工作的 attempt_count 是兩層。',[
    n('write 自動 retry','safeFetch 依 timeout、retryAttempts、retryAfterMaxMs；退避從300ms到2s + jitter，寫入沿同 UUID。','browser',['src/lib/request.ts',S+'backend-action.ts']),
    n('固定配額視窗','每日按臺北午夜；每小時 UTC 固定桶（臺灣也是整點）；burst 10秒；UID Durable Object 用 SQLite 原子 claim，多額度任何一個超額就拒絕。','worker',[A+'rate-limit.ts','cloudflare/src/durable/business-rate-limiter.ts']),
    n('DO 自己清限流桶','alarm 清 expires_at<=now 的 bucket；配額到期後自然換 key，不用 DB cron 重設每人額度。','async',['cloudflare/src/durable/business-rate-limiter.ts']),
    n('Queue 傳輸失敗','batch ackAll/retryAll；RateLimitError 的 Retry-After 另送 delayed message（最多43200秒）再 ack；max_retries=5。','async',['cloudflare/src/index.ts','cloudflare/wrangler.json']),
    n('delivery/job 失敗','最多8次DB claim；next_attempt_at=now+min(60,max(1,attempt_count×2))分鐘；processing lock 超過10分鐘可接手，新 UUID 防舊 worker 完成。','database',['database/migrations/0025_consumer_fencing.sql','database/migrations/0020_operational_job_execution.sql']),
    n('政策批次失敗','retention/category job 失敗下次2分鐘、最多8 attempt；到期後要下一次 sweep/maintenance 或管理員手動 retry 才執行，時間到了不代表立即執行。','database',['database/migrations/0023_policy_batch_state.sql']),
  ]),
  flow('client-clocks','瀏覽器快取與自動重新整理時間表','時間與自動','快取過期多數是在讀取時檢查，並非背景一直跑計時器。',[
    n('短期與畫面快取','content-short 10分鐘；viewMemory 初值30分鐘/100 entries；feed 初值5頁；persistent 最長30天/500筆/16MiB。','browser',[S+'content-read-cache.ts','src/lib/view-memory-cache.ts','src/lib/persistent-cache.ts']),
    n('通知與 profile','notification hint 2分鐘；public profile 24小時；avatarRevalidate 初值24小時；讀到過期才丟棄／更新。','browser',[S+'notifications.ts',S+'users-read.ts','src/lib/avatar-cache.ts']),
    n('回前景與恢復網路','online/visible → getContentVersions；socket resync → 版本確認；公告提示也 refresh；分類 catalog 沒有全域定期輪詢。','browser',[H+'session-store.ts',H+'use-announcement-notice.ts']),
    n('工作與等待輪詢','setup 3秒倍增到30秒；settings job nextPollDelay 1/2/3/5/8/15秒；system console useForegroundPoll 的初始值見來源，倍增到30秒；隱藏／離線都停止。','browser',[H+'use-initial-setup.ts',H+'use-platform-jobs.ts',H+'use-system-console.ts']),
    n('token 和 URL 到期','Firebase ID token 在 expires-60秒前重取；私有圖片URL buffer60秒；Push token heartbeat 7天確認，未確認60天清理。','browser',['src/lib/auth-token.ts',S+'uploads.ts',S+'push-token-registration.ts']),
    n('不是每秒重新整理倒數','issue-status 與相對日期依 render 時間計算；沒有單獨的秒級倒數 timer。文字草稿24小時在恢復讀取時檢查。','browser',['src/lib/issue-status.ts','src/lib/format.ts','src/lib/composer-draft.ts']),
  ]),
  flow('update','前端新版檢查、SW 與延後更新','時間與自動','發文、留言、未存設定、詳情與驗證尚未結束時，不強制重新載入。',[
    n('每30分鐘檢版本','初次／可見時interval、online/pageshow/visible；localStorage 合併跨頁檢查時間；GET /version.json no-store，2秒timeout。','browser',['src/components/app-update-gate.tsx']),
    n('比較 build version','與 NEXT_PUBLIC_APP_VERSION 比；新版才設 availableVersion。失敗清上次成功時間，不鎖住下一次online重試。','browser',['src/app/version.json/route.ts','src/components/app-update-gate.tsx']),
    n('等安全更新時機','useUpdateDeferral：發文/留言草稿、sending、未存管理設定、開啟詳情、hidden/offline與Turnstile驗證會延後。','browser',[H+'use-update-deferral.ts',H+'unsaved-changes-store.ts']),
    n('準備 service worker','register/update /sw.js，2秒預算，waiting post SKIP_WAITING；SW失敗不阻止document更新。','browser',['src/components/app-update-gate.tsx','src/app/sw.ts']),
    n('重新導向同網址','同版本最多2次自動reload；4秒再嘗試reload，10秒顯示恢復入口；保持當前URL以便恢復草稿／頁面。','browser',['src/components/app-update-gate.tsx']),
    n('PWA 快取邊界','production 才 Serwist；WOFF2不install-time precache；/v1 API與signed media NetworkOnly；不是離線寫入佇列。','browser',['src/app/sw.ts','next.config.mjs']),
  ]),
  flow('db-triggers','資料庫自動觸發：欄位、計數、媒體與版本','時間與自動','trigger 隨 SQL statement 或 row 寫入在同一交易執行；不是另一個定時服務。完整現存清單在「盤點」。',[
    n('INSERT 前驗證與快照','snapshot_issue_category_defaults、parent comment 驗證、input hard ceilings、留言開關保護；policy snapshot 禁改。','database',['database/migrations/0001_baseline.sql','database/migrations/0041_remove_response_deadlines.sql']),
    n('UPDATE 時派生欄位','closed_at、support goal 派生值、title/search、updated_at、profile/avatar version。','database',['database/migrations/0001_baseline.sql','database/migrations/0016_system_data_consistency.sql']),
    n('content/aggregate revision','statement bump_content_version；row bump_aggregate_revision；後續cache gap檢查用這兩層版本。','database',['database/migrations/0016_system_data_consistency.sql']),
    n('反應／留言計數','support 重算作者基礎1+supports；announcement likes/comments 重算；平台與分類 counters/activity 同步。','database',['database/migrations/0001_baseline.sql']),
    n('媒體關聯與刪除','Markdown upload trigger attach；刪內容 cascade 與 queue_deleted_content_uploads；Notion mapping刪除排archive；失敗delete到期儲存backlog。','database',['database/migrations/0016_system_data_consistency.sql','database/migrations/0026_external_cleanup_backlog.sql','database/migrations/0029_archive_and_backup_policies.sql']),
    n('設定變更觸發批次','system_setup announcement_comments / issue_categories comments/is_active 變更 enqueue policy job；新的同scope政策取代舊待套用工作。','database',['database/migrations/0013_observable_policy_jobs.sql','database/migrations/0016_system_data_consistency.sql']),
    n('domain event 由Worker 明確記錄','0016 移除舊 outbox/realtime/audit projection triggers；一般寫入事件在 execution.ts resolveDomainEvents 記錄；不能看到舊 baseline trigger就當現在存在。','worker',[A+'execution.ts','database/migrations/0016_system_data_consistency.sql']),
  ]),
  flow('settings-timing','編輯、預覽、確認、衝突與草稿保留','管理設定','開關、檔位、還原都是草稿操作；正式寫入、背景套用與其他人重新讀取有各自時點。',[
    n('編輯與檔位只改草稿','摘要→選區域→編輯；欄位、檔位、區域還原都改 browser draft。同管理頁切分類／回摘要保留，未存數量可辨識；關編輯器或返回檢查草稿。儲存中禁止丟棄與切換，程式更新等待完成。','browser',[H+'use-draft.ts',H+'use-unsaved-changes.tsx','src/components/admin/admin-sections.tsx']),
    n('估算鎖定本次值','分类留言／保留先 estimate；草稿在估算中改了就不套舊結果。確認保存 review.value + review.baseline；取消只關確認。版本衝突保留草稿，需重讀正式值並重新確認。','worker',[H+'use-draft.ts',H+'use-category-management.ts',H+'use-platform-settings.ts']),
    n('立即讀當前設定','作者刪除、圖片數/尺寸、scope、限制：後端下一次請求讀DB；既有附著圖片不被降低上限回收。','database',[A+'upload-policy.ts',A+'auth.ts']),
    n('新提案才儲存快照','supportEnabled/Goal/DeadlineDays 只改新提案；舊篇snapshot不回寫；readAccess/authorVisible已有分類不可改。','database',['database/migrations/0053_category_image_policies.sql','database/migrations/0041_remove_response_deadlines.sql']),
    n('既有內容靠具範圍的批次','留言 flag 由 category_policy；保留只處理 cleanupScopes。收緊／啟用才立即排既有清理，放寬不恢復已刪內容；通知 expiry 例外會重新算。operation/job/delivery TTL 留給未來生命周期。','async',['database/migrations/0054_scoped_retention_policy_changes.sql','database/migrations/0055_notification_expiry_event_time.sql']),
    n('政策快取與browser','operations Worker isolate ≤60秒；client發現成功回應新revision才拉。其他人的catalog/角色目前沒有完整platform realtime message；必要時重新載入。','browser',['cloudflare/src/backend/shared/operation-policies.ts',S+'backend-action.ts','cloudflare/src/backend/jobs/realtime-deliveries.ts']),
  ]),
];

export const categorySettings = [
  ['issuesEnabled / facilitiesEnabled','功能開關','system_setup','自己的導覽/route guard重新整理；其他已開畫面可能需重新載入；DB不刪內容','提交；前端 catalog 重新整理後呈現','savePlatformFeatures'],
  ['announcementCommentsEnabled','公告留言','system_setup → announcements.comments_enabled','新公告讀當前值；舊公告分批改flag；新增留言還有trigger保護','提交設定+背景policy job；以job完成確認','savePlatformFeatures'],
  ['id','分類固定ID','issue/facility_categories','scope、route、內容FK、快取key；既有ID不可隨意改名','建立分類時固定','saveCategoryManagement'],
  ['label / sortOrder / isDefault','名稱、順序、預設','issue/facility_categories','導覽/列表/發文預選；既有內容維持category ID','下一次catalog讀取','saveCategoryManagement'],
  ['readAccess / authorVisible','內容可見性與作者顯示','issue_categories → issues snapshot','school/reviewed-school/owner-admin；UID仍儲存於DB；既有分類這兩欄不可改','建立時決定；新提案snapshot','saveCategoryManagement'],
  ['supportEnabled / supportGoal / supportDeadlineDays','附議規則','issue_categories → issues snapshot','只影響新提案；達標processing；截止未達標cron拒絕；無門檻/期限不自動拒絕','新建當下儲存；審核通過/改pending才重算deadline','saveCategoryManagement'],
  ['commentsEnabled','提案留言','issue_categories → issues.comments_enabled','新提案設定；既有提案policy batch；狀態仍限制留言，不能開結案留言','設定提交與分批套用','saveCategoryManagement'],
  ['authorDeleteEnabled','作者可自行刪除','issue/facility_categories','下一次後端刪除請求讀當前值，適用既有內容','DB提交後下一次刪除','saveCategoryManagement'],
  ['maxImages / commentMaxImages','分類內文／留言圖片上限','issue_categories / facility_categories','0–20，0關閉新上傳；建立session、finalize、內容attach三段驗證；舊圖仍可讀','下一次後端操作；前端需catalog更新','saveCategoryManagement'],
  ['announcementMaxImages / announcementCommentMaxImages','公告內文／留言圖片上限','system_setup','0–20；獨立於提案/設施，舊圖不受降低上限清理','下一次後端圖片／內容請求','saveCategoryManagement'],
  ['maxDimension / maxUploadKilobytes / webpQuality','共用圖片壓縮','runtime_settings.image_upload_settings','初值2000px/800KB/.82；上限8000px/5000KB、quality .4–.95；browser 壓縮與Worker驗証','新請求讀DB；已開他人編輯器可能要refresh','savePlatformSettings'],
  ['角色與category scope','成員權限','user_role_assignments / assignments','加入／撤銷先成為草稿，儲存 saveScopeMembers 整批交易；platform-admin來自正式 ADMIN_EMAILS，0059 同交易調整被編輯帳號的舊管理員角色','DB提交後下一次授權；browser session重新讀才改按鈕','saveScopeMembers'],
  ['targetType / targetValue / preset / duration / message','帳號存取限制','user_restrictions','UID先、最長字首；read_only/reaction_only/blocked；到期自然解除（紀錄稍後清）','下一次授權檢查；永久無deadline','saveAccountAccessRule'],
  ['issueNotifications / facilityNotifications / commentNotifications','我的管理員通知偏好','platform_admin_notification_preferences','平台管理員個人的站內+Push偏好，初值false；不改一般成員','下一次delivery收件者解析','updatePlatformAdminNotificationPreferences'],
  ['ADMIN_EMAILS / ALLOWED_ORIGINS / SCHOOL_DOMAIN / secrets','部署環境','Worker secret / env','平台管理員、學校網域、Origin、供應商憑證；不是runtime表單','部署環境更新；ADMIN_EMAILS於登入sync/auth reconciliation使用','auth-login'],
  ['NOTION_ENABLED / Queue / cron / native bindings','平台部署配置','cloudflare/wrangler.json','repo初值NOTION_ENABLED=false；30分鐘cron；Queue batch10/timeout5s/retry5；native breaker硬上限','修改配置後重新部署；沒有在這份地圖查正式值','cron'],
];
export const policyDescriptions = {
  notionArchiveDays:'非內容 Notion mapping 儲存天數；maintenance 刪除 mapping 後排真實archive',
  readBurst:'一般讀取每UID/10秒',writeBurst:'一般寫入每UID/10秒',sensitiveBurst:'互動寫入每UID/10秒',adminBurst:'管理寫入每UID/10秒',uploadBurst:'上傳建立/完成每UID/10秒',resolveBurst:'圖片解析每UID/10秒',
  viewMemoryMinutes:'畫面snapshot在讀取時的有效分鐘數',viewMemoryEntries:'畫面memory最大筆數',feedPages:'列表與DOM保留頁數',mediaBrowserSeconds:'公開媒體browser cache秒數；私有仍no-store',mediaEdgeSeconds:'媒體edge cache秒數；政策revision納入key',avatarRevalidateHours:'頭像來源需重新確認的間隔小時',
  notionBatchSize:'每批Notion delivery數',notificationBatchSize:'每批站內/Push delivery數',realtimeBatchSize:'每批realtime delivery數',jobBatchSize:'外部background job批次',policyBatchSize:'每類retention/category批次上限',clientWriteCooldownMs:'相同UID+action前端寫入冷卻毫秒',requestTimeoutMs:'一般寫入timeout毫秒',readTimeoutMs:'讀取timeout毫秒',longTimeoutMs:'長操作timeout毫秒',retryAttempts:'client安全重試嘗試數',retryAfterMaxMs:'client最多自動等待Retry-After毫秒',
  realtimeIdleMinutes:'browser閒置斷線分鐘',realtimeHeartbeatSeconds:'socket heartbeat秒數',realtimeTicketSeconds:'建立WebSocket的JWT有效秒數',titleLength:'產品標題字數上限',contentLength:'產品本文可見文字上限',commentLength:'留言可見文字上限',resultLength:'處理結果字數上限',locationLength:'設施位置字數上限',searchLength:'搜尋字數上限',errorRetentionDays:'每日錯誤聚合儲存天數',metricsRetentionDays:'DB容量日樣本儲存天數',
  issueCreateDaily:'建立提案每日配額',facilityCreateDaily:'建立設施每日配額',announcementCreateDaily:'發布公告每日配額',commentCreateHourly:'提案與公告留言共用每小時配額',imageUploadDaily:'按圖片張數的每日配額',loginSyncHourly:'登入profile同步每小時配額',avatarCacheDaily:'avatar更新每日配額',supportToggleHourly:'附議／取消共用每小時配額',facilityAffectedToggleHourly:'我也遇到每小時配額',facilityStatusUpdateHourly:'設施狀態更新每小時配額',announcementLikeHourly:'公告讚每小時配額',pushTokenWriteHourly:'Push裝置註冊每小時配額',preferenceWriteHourly:'個人偏好／通知水位共用每小時配額',moderationWriteHourly:'提案審核／限制規則每小時配額',roleWriteHourly:'scope／分類／平台設定每小時配額',destructiveWriteHourly:'內容刪除／運維retry共用每小時配額',backendHealthcheckMinute:'全域healthcheck每分鐘',backendHealthcheckSecond:'全域healthcheck每秒',workerRunMinute:'Queue sweep全域每分鐘',workerRunSecond:'Queue sweep全域每秒',
};
export const retentionDescriptions = {
  closedIssuesEnabled:'是否清理已結案提案',closedIssuesDays:'issue.closed_at + 天數；四種關閉狀態才清',closedFacilitiesEnabled:'是否清理已結案設施',closedFacilitiesDays:'facility.closed_at + 天數；completed/unable-to-handle',announcementsEnabled:'是否清理公告',announcementsDays:'published_at + 天數',notificationsEnabled:'是否讓站內通知到期；關閉改infinity',notificationsDays:'created_at + 天數；批次改expires_at，讀取排除到期專案',
  deliveryCompletedDays:'delivery完成時設expires_at',deliveryFailedDays:'delivery失敗時設expires_at',operationHours:'可重播response時數；過期清空response，引用身份仍保留',domainEventDays:'事件occurred_at + 天數，且無delivery才刪',inactivePushTokensDays:'last_confirmed_at + 天數；非granted也清',pushTokenConfirmationDays:'browser裝置token再確認間隔，bootstrap種runtime值',
  inactiveAvatarsEnabled:'是否清理無內容關聯的閒置頭像',inactiveAvatarsDays:'last_seen_at/created_at + 天數；沒有任何內容才清並排Cloudinary刪除',inactiveProfilePiiEnabled:'是否清理無內容關聯的閒置個資',inactiveProfilePiiDays:'last_seen_at/created_at + 天數；沒有角色指派、任何內容關聯，並符合 SQL 其餘清理條件才清 PII',expiredRestrictionsEnabled:'是否刪除已失效限制紀錄；不影響到期自然解除',expiredRestrictionsDays:'restricted_until + 天數才刪紀錄',backgroundJobCompletedDays:'job完成時expires_at',backgroundJobFailedDays:'job失敗時expires_at；deletion責任轉cleanup_backlog',
  roleAssignmentAuditDays:'角色指派稽核created_at + 天數',adminAuditDays:'管理稽核與operation policy歷史created_at + 天數',categoryConfigurationAuditDays:'分類設定稽核created_at + 天數',accessAssignmentAuditDays:'分類scope稽核created_at + 天數',pendingUploadHours:'pending upload.created_at + 時數',unattachedUploadHours:'ready且未attach，updated_at + 時數',failedUploadHours:'failed upload.updated_at + 時數',
};
export const triggerDescriptions = {
  apply_announcement_comment_setting:'公告留言設定改變→enqueue category_policy',close_issue_comments_with_category:'分類留言/啟用改變→enqueue category_policy',attach_markdown_uploads_from_content:'正式內容attach已驗證upload；未授權圖片拒絕',queue_deleted_content_uploads:'刪內容→排Cloudinary deletion job',bump_content_version:'statement提升domain version',bump_aggregate_revision:'row提升aggregate revision',snapshot_issue_category_defaults:'建立提案儲存分類policy snapshot',prevent_issue_policy_snapshot_change:'阻止舊提案snapshot被更改',prevent_issue_category_identity_change:'固定既有分類id/readAccess/authorVisible',set_issue_closed_at:'關閉狀態設定closed_at，重新開啟清除',set_issue_derived_fields:'title搜尋字、support派生欄位',refresh_issue_support_count:'作者基礎1+支持紀錄數',refresh_announcement_like_count:'重算公告like_count',refresh_announcement_comment_count:'重算公告comment_count',enforce_entry_input_limits:'DB storage安全上限，Worker另有較小產品上限',enforce_issue_comment_availability:'提案status/category套留言規則',enforce_announcement_comment_availability:'公告套用平台留言flag',prevent_comment_when_disabled:'留言新增前再次拒絕不可留言內容',prevent_announcement_comment_when_disabled:'公告留言新增前再次檢查flag',validate_comment_parent:'回覆同提案、父留言存在、限制一層',validate_announcement_comment_parent:'回覆同公告、父留言存在、限制一層',track_platform_row_change:'平台新增/刪除counter',track_issue_category_counter:'提案分類數量counter',track_comment_category_counter:'分類留言counter',touch_platform_activity:'平台活動時間',track_user_seen_counter:'新profile使用者counter',touch_facility_category:'設施分類updated_at',touch_updated_at:'updated_at自動更新',version_user_public_profile:'profile/avatar version',protect_consistency_identity:'event/operation/delivery/job身份不可改',preserve_external_cleanup:'到期失敗deletion儲存外部識別碼',archive_expired_notion_mapping:'刪Notion mapping→實際archive job',
};
