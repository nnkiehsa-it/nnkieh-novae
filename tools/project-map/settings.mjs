const A = 'cloudflare/src/backend/actions/';
const H = 'src/hooks/';
import { settingConsumer } from './setting-copy.mjs';
import { separatePaths } from './narration.mjs';
const lifecycleKeys = new Set(['operationHours','deliveryCompletedDays','deliveryFailedDays','backgroundJobCompletedDays','backgroundJobFailedDays','pushTokenConfirmationDays']);
const groupLabels = {client:'用戶端與即時連線',rates:'操作頻率與配額',jobs:'背景批次大小',logs:'紀錄與封存',content:'文字與搜尋限制',realtime:'即時連線票'};
export const retentionTitles = {
  closedIssuesEnabled:'結案提案自動清理',closedIssuesDays:'結案提案保留天數',closedFacilitiesEnabled:'結案設施自動清理',closedFacilitiesDays:'結案設施保留天數',
  announcementsEnabled:'公告自動清理',announcementsDays:'公告保留天數',notificationsEnabled:'站內通知自動到期',notificationsDays:'站內通知保留天數',
  deliveryCompletedDays:'成功投遞紀錄保留天數',deliveryFailedDays:'失敗投遞紀錄保留天數',operationHours:'操作回應可重播時數',domainEventDays:'領域事件保留天數',
  inactivePushTokensDays:'閒置推播裝置保留天數',pushTokenConfirmationDays:'推播裝置重新確認間隔',inactiveAvatarsEnabled:'閒置頭像自動清理',inactiveAvatarsDays:'閒置頭像保留天數',
  inactiveProfilePiiEnabled:'閒置個資自動清理',inactiveProfilePiiDays:'閒置個資保留天數',expiredRestrictionsEnabled:'過期限制紀錄自動清理',expiredRestrictionsDays:'過期限制紀錄保留天數',
  backgroundJobCompletedDays:'完成工作紀錄保留天數',backgroundJobFailedDays:'失敗工作紀錄保留天數',roleAssignmentAuditDays:'角色指派稽核保留天數',adminAuditDays:'管理稽核與政策歷史保留天數',
  categoryConfigurationAuditDays:'分類設定稽核保留天數',accessAssignmentAuditDays:'負責範圍稽核保留天數',pendingUploadHours:'待上傳圖片保留時數',unattachedUploadHours:'未附著圖片保留時數',failedUploadHours:'失敗上傳保留時數',
};
export function retentionBehavior(key) {
  if (key === 'pushTokenConfirmationDays') return {section:'隱私與裝置',timing:'下一次 session bootstrap 帶入 browser runtime；後續 heartbeat 判斷確認頻率。',effect:'只改裝置 token 再確認間隔，不刪既有 token，不建本欄位的清理 job。'};
  if (lifecycleKeys.has(key)) return {section:'運行紀錄',timing:'之後 operation 建立、delivery/job 完成或失敗時依當時政策設 expires_at；既有 expiry 不回寫。',effect:'這是未來生命周期 TTL。只改本欄位通常沒有既有刪除／更新估算，也不會立即建立清理 job；maintenance 仍清理原本已到期紀錄。'};
  if (key.startsWith('notifications')) return {section:'內容保留',timing:'儲存後分批更新既有通知 expires_at；讀取立即排除已到期列。新的通知用事件 occurred_at 作 created_at。',effect:'notificationsEnabled/Days 改變會重算 expiry，放寬也重算，關閉改 infinity。啟用或縮短再加刪除 scope。0055 未完成 expiry 修復會帶入下一份替代工作；不讓晚投遞通知從投遞時間重新倒數。'};
  const section = /inactive|expiredRestrictions/.test(key) ? '隱私與裝置' : /Audit/.test(key) ? '稽核紀錄' : /Upload/.test(key) ? '上傳保留' : /closed|announcements/.test(key) ? '內容保留' : '運行紀錄';
  return {section,timing:'新啟用或縮短期限，且有實際符合資料時，儲存才排本範圍批次；正常隨時間到期由 maintenance 的完整保留工作處理。',effect:'本次不變／放寬／停用不把無關已到期資料拉進設定清理。放寬不恢復已刪資料；開關關閉保留本類資料。job payload 固定本次政策快照；新的保留設定會取代舊未完成工作。'};
}

export function makeSettingFlows(settings, ref) {
  return settings.map(s => {
    const operation = s.store === 'runtime_settings.operations_settings';
    const retention = s.store === 'runtime_settings.data_retention_settings';
    const deploy = s.section === '部署配置';
    const category = ['saveCategoryManagement','savePlatformFeatures'].includes(s.target);
    const scope = s.target === 'saveScopeMembers';
    const rule = s.target === 'saveAccountAccessRule';
    const preference = s.target === 'updatePlatformAdminNotificationPreferences';
    const target = operation ? 'saveOperationPolicies' : retention ? 'savePlatformSettings' : s.target;
    const behavior = retention ? retentionBehavior(s.key) : null;
    const hook = operation ? 'use-operation-policies.ts' : retention || target === 'savePlatformSettings' ? 'use-platform-settings.ts' : category ? 'use-category-management.ts' : scope ? 'use-scope-access.ts' : rule ? 'use-account-access-draft.ts' : 'use-push-notifications.ts';
    const actionPath = operation ? A+'operations.ts' : scope ? A+'user-access.ts' : rule ? A+'account-access-rules.ts' : preference ? A+'notifications.ts' : A+'categories.ts';
    const make = (title,text,layer,refs=s.refs,details=[])=>({title,text,layer,refs,details});
    const consumer = deploy ? null : settingConsumer(s);
    let nodes;
    if (deploy) {
      nodes = [
        make(s.target==='auth-login'?'維護者：修改身分與 API 環境設定':'維護者：修改 Queue 與排程配置', '變更 '+s.key+'。'+s.effect+'；不是管理頁的 runtime 表單。','build'),
        make('部署流程：發布配置與 secret', '依設定變更執行生成、驗證與 Worker 部署；secret 透過平台配置。這張圖未讀 secret、未部署。','build',[ref('README.md'),ref('cloudflare/wrangler.json')]),
        make('Cloudflare：載入新執行環境',s.timing+'。已執行 request 不會切換中途設定。','worker'),
        make(s.target==='auth-login'?'Auth：按新環境驗身分與入口':'Queue／cron：按新配置執行工作',s.effect+(s.target==='auth-login'?'。ADMIN_EMAILS 使用正式設定 Email；登入 sync、授權與 scope 目標調整會讀正式管理員名單。':'。只有後續喚醒與出站工作採此部署配置；資料內容仍從 PostgreSQL 讀取。'),'worker',s.refs),
      ];
    } else {
      const draftText = '管理員在'+(operation?'運行政策':retention?'平台設定的'+behavior.section:scope?'帳號與權限 → 負責範圍':rule?'帳號與權限 → 限制規則':preference?'自己的通知設定':'內容與分類')+'修改「'+s.title+'」。'+s.key+'；'+(preference?'這是個人收件偏好。':'欄位、檔位與還原先改本機草稿；未儲存不改 DB。');
      const validation = operation ? '填原因並以整數 baseline revision 提交完整政策；所有欄位按 operations 契約範圍驗證，非只驗本欄。' : retention ? 'estimateRetentionCleanup 帶 platformRevision：只估算本次 cleanupScopes，分開刪除與 expiry 更新；需要時確認鎖定本次草稿及 baseline。' : category ? '分類草稿先 estimateCategoryPolicyChanges，帶 categoryRevision；留言既有影響與刪分類需確認。非法開關／陣列會整次拒絕。' : scope ? '加入／撤銷多名成員先成為草稿，儲存送 changes + scope 名單 revision；搜尋與選人是只讀。' : rule ? 'Email 字首可先 preview 命中數；提交 row revision（新增 null）、targetType/Value/preset/duration/message。保持期限與重設期限是不同選項。' : '此帳號必須為正式平台管理員；送出自己的通知偏好。';
      const saveText = operation ? 'saveOperationPolicies：核對 expected revision，交易寫 values + 新 revision + before/after/reason 歷史，清本 isolate 政策快取。' : retention ? 'savePlatformSettings：平台 advisory lock + revision 重比；存圖片與保留正式值。只在影響筆數>0 時建 scoped job，保留改變會 supersede 舊 job。' : category ? 'saveCategoryManagement：鎖 singleton 並比 revision；同交易存分類/功能/公告圖片政策、audit，trigger 排必要 policy job。功能舊 action savePlatformFeatures 仍保留。' : scope ? 'saveScopeMembers：scope advisory lock、比 revision、按 UID 鎖目標 profile；正式 ADMIN_EMAILS 排除管理員，整批授權／撤銷原子提交。' : rule ? 'saveAccountAccessRule：複合鍵 advisory lock + FOR UPDATE，比 row revision；保留期限用舊 deadline，新期限由 DB statement_timestamp()+時數。' : 'updatePlatformAdminNotificationPreferences：只改本人的三個布林值，不改任何別人的收件設定。';
      nodes = [
        make('設定表單：編輯'+s.title,draftText,'browser',[ref(H+hook),...s.refs], [{title:'欄位／程式初值',text:s.key+(s.initial!==undefined?' = '+String(s.initial):'')+(s.range?'；範圍 '+s.range:'')},{title:'這次要了解的影響',text:s.effect}]),
        make(scope?'成員草稿：整理整批變更與版本':rule?'限制表單：預覽命中並鎖定版本':preference?'通知設定：提交本人的開關':operation?'政策表單：驗範圍、原因與版本':retention?'保留表單：估刪除與期限更新':'分類表單：估留言影響並確認草稿',validation+' 衝突不覆蓋他人正式值，草稿保留待重讀與重新確認。','browser',[ref(H+'use-draft.ts'),ref(actionPath)]),
        make(actionPath.split('/').at(-1).replace('.ts','')+'：驗版本並保存'+s.title,saveText+' 共用安全、配額、operation 去重；變更與此 action 的稽核／事件同交易。','worker',[ref(actionPath),ref(A+'execution.ts')]),
        make('PostgreSQL：保存'+s.title,s.store+'。'+(behavior?behavior.effect:s.effect),'database',s.refs,[{title:'儲存位置',text:s.store},{title:'相關欄位',text:s.key}]),
        make(consumer[0],s.effect+(behavior?' '+behavior.effect:operation?' Worker snapshot 更新後由使用本欄位的程式採新值；不強制重啟所有頁面。':''),consumer[2],s.refs),
        make(consumer[1],behavior?behavior.timing:s.timing,consumer[2],s.refs),
        make(operation?'政策 store：採正式值與新版本':retention?'平台編輯器：採正式值並顯示進度':scope?'成員編輯器：替換正式名單':rule?'限制編輯器：採正式規則與期限':preference?'通知設定：顯示已儲存個人偏好':'Catalog：套正式分類與功能',operation?'自己收到正式 policy response 即 setOperationPolicies；其他 browser 在成功 API response 見新 policyRevision 才拉。Worker 其他 isolate 最長快取 60 秒；進行中 request 保持原 snapshot。':retention?'自己採正式設定與 revision、更新圖片 store、標 bootstrap stale；有 job 才通知進度讀取。背景 DB 套用與外部刪除要分別追蹤；其他開啟編輯器不會自動重寫草稿。':scope||rule?'自己按正式 canonical 回應更新；其他人下一次後端授權讀新規則，但既有 session 按鈕未必立即更新。':preference?'自己顯示正式三個開關。下一次 delivery 收件者解析用新偏好；已傳送站內／Push 無法撤回。':'自己種入正式 catalog；目前 category/platform/user 的部分 realtime destination 不產出訊息，其他人可能需重新讀 session/catalog。','browser',[ref('src/services/backend-action.ts'),ref('cloudflare/src/backend/jobs/realtime-deliveries.ts')]),
      ];
    }
    const labels = deploy
      ? ['配置檔／secret 的變更 → 生成、驗證與部署','新的 build／環境配置 → 執行環境','新的管理員名單／供應商／平台設定 → 後續請求']
      : ['欄位草稿＋baseline revision → 估算／驗證','確認的設定 JSON＋revision＋必要原因 → save action','正式設定、revision、audit、必要 job → 同交易儲存','已儲存的新值／cleanupScopes → 判斷影響與套用','當前值／快照／批次狀態 → 依本設定時機生效','正式值、revision、catalog、job 結果 → 自己更新／他人再讀'];
    const flow={id:'setting:'+s.key,title:'修改'+s.title,group:'管理員改設定',section:operation?'運行政策 · '+groupLabels[s.policyGroup]:retention?'平台保留 · '+behavior.section:s.section,kind:'sequence',setting:s.key,relatedAction:target,summary:s.effect,notes:[s.timing, '儲存回應與後續規則採用是不同路徑；畫面不用等背景工作完成。','程式初值不代表正式 DB 目前值；這份地圖不執行任何設定寫入。']};
    return separatePaths(flow,deploy?[{title:'維護者改配置並部署',nodes,labels}]:[
      {title:'按儲存：提交草稿並更新自己的畫面',nodes:[...nodes.slice(0,4),nodes[6]],labels:[...labels.slice(0,3),'正式值＋revision／catalog／jobId → 回應與編輯器']},
      {title:'另一路徑：後續操作或背景工作採用新值',nodes:nodes.slice(3,6),labels:[s.key+' 新值 → '+consumer[0],{label:'依條件、快照或排程時間採用 '+s.key,async:consumer[2]==='async'}]},
    ]);
  });
}
