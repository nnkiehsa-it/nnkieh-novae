// 畫布讀責任；資料表／函式原名仍留在右側欄位、條件與來源。
export const modelResponsibilities = {
  user_profiles:'使用者資料：保存名稱與頭像版本',user_role_assignments:'角色指派：記錄帳號持有的角色',roles:'角色字典：定義平台角色',permissions:'權限字典：定義可執行的能力',role_permissions:'角色權限：對照角色可用的能力',user_issue_category_assignments:'提案指派：記錄可管理的分類',user_facility_category_assignments:'設施指派：記錄管理與收件範圍',user_restrictions:'限制規則：保存帳號限制與期限',user_roles:'舊角色表：保留相容資料',
  issue_categories:'提案分類：保存可見性與互動規則',issues:'提案：保存正文、狀態與規則快照',supports:'支持者：記錄誰附議哪個提案',comments:'提案留言：保存留言與一層回覆',facility_categories:'設施分類：保存回報與圖片規則',facility_reports:'設施回報：保存位置、狀態與結果',facility_report_affected_users:'受影響者：記錄誰也遇到問題',announcements:'公告：保存發布內容與留言開關',announcement_likes:'公告按讚：記錄每位帳號的讚',announcement_comments:'公告留言：保存留言與一層回覆',
  uploads:'圖片登記：保存所有權與附著目標',notifications:'站內通知：保存收件者與事件時間',notification_states:'已讀水位：保存四種最後開啟時間',push_tokens:'Push 裝置：保存 token 與確認時間',push_delivery_receipts:'Push 收據：記錄已成功的裝置',platform_admin_notification_preferences:'收件偏好：保存管理員個人開關',
  operations:'寫入操作：去重並保存重播回應',domain_events:'領域事件：保存正式變更的事實',event_deliveries:'投遞責任：追蹤各通道與重試',claimable_event_deliveries:'待投遞 view：篩選目前可領取工作',domain_event_types:'事件字典：限制合法事件名稱',event_destinations:'通道字典：限制合法投遞目的地',background_jobs:'背景工作：保存範圍、進度與重試',external_cleanup_backlog:'清理積壓：保留外部刪除責任',notion_pages:'Notion 對映：保存外部頁面 ID',
  runtime_settings:'正式政策：保存圖片與營運設定',system_setup:'平台設定：保存功能與首次啟用狀態',content_versions:'內容版本：標示三類資料是否改變',operation_policy_history:'政策歷史：保存修改原因與前後值',admin_audit_log:'管理稽核：保存操作與來源身份',role_assignment_audit:'角色稽核：保存角色授予與撤銷',access_assignment_audit:'範圍稽核：保存分類指派前後值',category_configuration_audit:'設定稽核：保存分類與平台變更',platform_counters:'平台計數：保存總量與活動時間',platform_category_counters:'分類計數：保存提案與留言數量',operational_errors:'錯誤聚合：累計每日應用失敗',operational_metrics:'容量樣本：保存每日資料庫大小',
};
export function modelTitle(name) {
  const title=modelResponsibilities[name];
  if(!title) throw new Error('缺資料模型責任標題：'+name);
  return title;
}

// [trigger 負責的工作, 同一交易成功後成立的結果]
export const triggerResponsibilities = {
  initialize_announcement_notice_state:['建立新帳號公告已讀水位','新帳號：既有公告視為已看'],
  apply_announcement_comment_setting:['排公告留言政策批次','工作表：留下舊公告套用責任'],
  close_issue_comments_with_category:['排提案留言政策批次','工作表：留下分類留言套用責任'],
  attach_markdown_uploads_from_content:['驗圖片所有權並附著到內容','圖片登記：建立正式內容關聯'],
  queue_deleted_content_uploads:['留下被刪內容的圖片清理工作','工作表：保留 Cloudinary 刪除責任'],
  bump_content_version:['提升本類內容版本','內容版本：標示列表快取已失效'],
  bump_aggregate_revision:['提升這筆內容的資料版本','內容紀錄：取得新的 row revision'],
  snapshot_issue_category_defaults:['保存新提案的分類規則快照','新提案：固定當時的附議與隱私規則'],
  prevent_issue_policy_snapshot_change:['拒絕修改既有提案規則快照','既有提案：維持原建立規則'],
  prevent_issue_category_identity_change:['拒絕改分類 ID 與固定隱私欄位','既有分類：維持身份與隱私契約'],
  set_issue_closed_at:['依關閉狀態設定或清除結案時間','提案：保留計算用正式結案時間'],
  set_issue_derived_fields:['整理搜尋與附議派生欄位','提案：保存一致的搜尋與附議欄位'],
  refresh_issue_support_count:['重算作者基礎一票與支持者數','提案：更新附議總數與達標狀態'],
  refresh_announcement_like_count:['重算公告按讚總數','公告：更新正式按讚人數'],
  refresh_announcement_comment_count:['重算公告留言總數','公告：更新正式留言人數'],
  enforce_entry_input_limits:['驗資料庫文字儲存上限','內容：只接受未超 DB 上限的文字'],
  enforce_issue_comment_availability:['依提案狀態套用留言可用性','提案：同步可留言狀態'],
  enforce_announcement_comment_availability:['依平台政策套公告留言開關','公告：同步可留言狀態'],
  prevent_comment_when_disabled:['拒絕不可留言提案的新留言','留言：只在提案允許時建立'],
  prevent_announcement_comment_when_disabled:['拒絕已關閉留言公告的新留言','留言：只在公告允許時建立'],
  validate_comment_parent:['驗同提案回覆與一層限制','提案回覆：只接受合法父留言'],
  validate_announcement_comment_parent:['驗同公告回覆與一層限制','公告回覆：只接受合法父留言'],
  track_platform_row_change:['隨新增刪除更新平台筆數','平台計數：與內容變更同步'],
  track_issue_category_counter:['更新分類內提案件數','分類計數：保存正式提案件數'],
  track_comment_category_counter:['更新分類內留言件數','分類計數：保存正式留言件數'],
  touch_platform_activity:['記錄平台最新活動時間','平台活動：保存本次寫入時間'],
  track_user_seen_counter:['記錄新使用者的計數','使用者統計：與新增 profile 同步'],
  touch_facility_category:['更新設施分類修改時間','設施分類：保存最新修改時間'],
  touch_updated_at:['自動填入修改時間','資料紀錄：保存正式更新時間'],
  version_user_public_profile:['依名稱或頭像變更提升版本','作者資訊：標示公開資料快取已失效'],
  protect_consistency_identity:['拒絕改操作與工作追溯身份','交易紀錄：維持事件與工作的來源'],
  preserve_external_cleanup:['轉存過期失敗工作的外部識別碼','清理積壓：保留可重試刪除責任'],
  archive_expired_notion_mapping:['刪對映時建立 Notion 封存工作','工作表：保留外部頁面封存責任'],
};

export function makeTriggerFlow(t, node) {
  const copy=triggerResponsibilities[t.func.split('.').at(-1)];
  if(!copy) throw new Error('缺 Trigger 責任標題：'+t.func);
  const table=t.table.split('.').at(-1), subject=modelTitle(table).split('：')[0];
  const condition=t.definition.match(/\b(?:BEFORE|AFTER|INSTEAD OF)\b[\s\S]*?\bON\b/i)[0].replace(/\s+/g,' ').replace(/ ON$/i,'');
  const when=condition.match(/^(BEFORE|AFTER|INSTEAD OF)/i)[0],operations=[...new Set(condition.match(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/gi))].join('／');
  return {id:'trigger:'+t.table+'.'+t.name,title:subject+'：'+copy[0],group:'自動化與時間',section:'資料庫 Trigger · '+subject,kind:'sequence',summary:t.description,notes:['依 migration CREATE/DROP 重建現存觸發器；各圖是一個 SQL 條件，並非依次執行的全部觸發器。'],nodes:[
    {...node('SQL：寫入'+subject,'Action、Queue 工作或 migration 執行 '+table+' 的 SQL；符合 '+condition+' 才觸發。','database',t.refs),details:[{title:'觸發器與原始條件',text:t.name+'；'+t.definition}],code:t.definition},
    {...node('DB Trigger：'+copy[0],t.description+'。'+t.func+' 在原 SQL 同一交易內執行；拒絕驗證會使原寫入回滾。','database',t.refs),details:[{title:'負責的函式',text:t.func}]},
    node(copy[1],t.description+'。交易提交後其他查詢可見；若產生 job，Queue 另外執行外部或分批套用。','database',t.refs),
  ],edges:[{from:0,to:1,label:when+' '+operations+' → NEW／OLD 或 statement'},{from:1,to:2,label:'驗證／派生／計數／job → 與原 SQL 同交易保存'}]};
}
