# Project Structure Map

變更檔案結構時同步更新本檔。先讀此地圖再搜程式，避免盲目掃全庫。

---

## 根目錄

- `README.md` — 中英文專案摘要與快速入口
- `LICENSE` / `CONTRIBUTING.md` / `SECURITY.md` / `CODE_OF_CONDUCT.md` — MIT 授權與社群政策入口
- 官方網站、完整文件與更新紀錄由 [`tavricccc/novae-website`](https://github.com/tavricccc/novae-website) 獨立維護與發布；分類改由安裝後的程式內初始設定與管理頁維護
- `config/api-errors.config.json` — 公開 API 錯誤碼、HTTP status 與前端 i18n key 的單一契約；由 `scripts/generate-api-errors.mjs` 產生三端型別
- `config/rate-limits.config.json` — Supabase 精確業務配額、對應 API error code 與圖片壓縮設定入口
- `config/backend-actions.config.json` — Cloudflare 原生防刷群組與 Supabase 細部業務配額映射
- `config/data-retention.config.json` — 已結案內容、通知、事件、log、暫存與維護紀錄保留期的單一設定入口
- `structure.md` / `AGENTS.md` / `ui-design-system.md` / `design-qa.md` — 結構地圖 / 代理人規則 / 前端 UI 復用與新增設計規範 / 最近一次視覺比對紀錄
- `package.json` — scripts（typecheck、lint、build、check:edge、test:architecture、verify:local…）
- `index.html` / `vite.config.ts` / `vercel.json` / `eslint.config.js` / `tsconfig*.json` / `tailwind.config.cjs`
- `.env.example` / `.gitignore` / `skills-lock.json`

---

## Supabase

- `supabase/config.toml` — schema 暴露與 Functions JWT 模式
- `supabase/migrations/` — 基線 + 增量 SQL（schema／RLS／RPC／Realtime Broadcast／清理／成本限流硬化／設備與 RBAC／輸入長度、附件型別、圖片網址快取、統一 feed 分頁與集合式留言回覆讀取）；`202607190001_dynamic_category_management.sql` 建立動態提案／設備分類、初始設定、分類指派、規則快照、舊資料自動遷移與稽核，較早 migration 細節見 git
- `supabase/functions/backendAction/` — 受控 action 閘道
  - `index.ts` — origin 驗證、CORS、Firebase 驗證與分派；公開限流由 Cloudflare Worker 先處理
  - `execution.ts` — 正式入口與本地整合驗證共用的權限、request ID、冪等執行核心
  - `action-registry.ts` / `response.ts` / `rate-limit.ts`（Upstash 精確業務配額）/ `types.ts` / `utils.ts` / `validation.ts` / `auth.ts`
  - domains：`users`（session access／角色與分類指派）、`categories`（動態 catalog／初始設定／管理）、`uploads`、`issues`（read/create/moderation/support/delete/comments）、`facilities`（分類式 read/create/affected/status/delete）、`announcements`（read/write/comments）、`notifications`、`dashboard`
  - shared helpers：`issue-shared.ts`、`announcement-shared.ts`
- 獨立 Functions：`syncUser`、`cloudinaryWebhook`、`outboxWorker`、`processDeletionJobs`、`maintenanceCleanup`
- `_shared/` — `env`、`http`、`api-errors`（公開錯誤契約 codegen）、`origin`（Worker／內部 origin secret 與動態 Function URL）、`firebase-auth`、`cloudinary`、`database`、`database-client`（Edge 專用精簡 PostgREST client）、`google-oauth`、`fcm`、`notion`、`rate-limits`、`upstash-rate-limit`、`webhook`

---

## Cloudflare

- `cloudflare/wrangler.toml` — production/development `workers.dev` 部署與 observability
- `cloudflare/src/` — 公開 API gateway；CORS、Firebase JWT、Cloudinary 簽章、Cloudflare 原生 Rate Limiting bindings 與 Supabase origin 轉發
- `cloudflare/generated/` — API error 與 backend action policy codegen
- `scripts/prepare-edge-functions.mjs` — CI 依私密 namespace 暫時產生六個隨機 Supabase Function 部署目錄

---

## src 入口與路由

- `main.ts` — 掛載 app、resume、PWA、session
- `i18n/` — `messages/<locale>/<domain>.ts` 依語系與領域拆分的 catalog（含 API error code 對應文案）、系統語言首次偵測、localStorage 語言偏好、日期 locale 與共用 `t()`；所有前端可見字串只放語系目錄，key 使用短而穩定的語意命名
- `App.vue` — startup gate + AppShell；route stage 依導覽深度套用手機 push／pop、同層 fade，桌面維持輕量網頁轉場
- `sw.ts` — PWA SW、快取策略、FCM 背景通知
- `style.css` — 全域樣式載入入口；依序載入 base、primitives 與領域樣式
- `styles/base.css` — design tokens、全域基礎與頁面骨架
- `styles/primitives.css` — viewport、control／card／floating 表面與陰影、list、dropdown、control frame 的單一可復用視覺契約；Tailwind 陰影名稱同樣只使用 `shadow-control`、`shadow-card`、`shadow-floating`
- `styles/components.css` / `controls.css` — 共用表面、互動狀態、按鈕與欄位
- `styles/navigation.css` — 桌面側欄與手機底部導覽
- `styles/content.css` / `responsive.css` — 列表、設定、統計、Dialog 與跨裝置覆寫
- `assets/fonts/` — JetBrains Mono 與 Material Symbols 子集
- `router/index.ts` / `router/route-components.ts` / `router/navigation-hierarchy.ts` — 組合 modules、abort 上一頁、session guard、主要頁面 chunk 預載，以及 root／子頁／巢狀詳情深度、轉場方向與通知來源返回
- `router/authRoutes.ts` / `issueRoutes.ts` / `facilityRoutes.ts` / `announcementRoutes.ts` / `adminRoutes.ts` / `notificationRoutes.ts` / `settingsRoutes.ts`
- `views/LoginView.vue` — 登入
- `views/IssueBoardView.vue` — 提案看板
- `views/IssueDetailView.vue` — 提案詳情
- `views/FacilitiesView.vue` / `views/FacilityDetailView.vue` — 設備列表、建立與詳情／狀態管理
- `views/AnnouncementsView.vue` — 公告列表
- `views/AnnouncementDetailView.vue` — 公告詳情
- `views/NotificationsView.vue` — 通知頁
- `views/SettingsView.vue` — 設定頁（手機）
- `views/DashboardView.vue` — 管理員統計
- `views/AccessManagementView.vue` — `role.manage` 角色指派、動態提案／設備分類權限、平台最高權限與最後一位平台管理員保護
- `views/SetupView.vue` / `views/CategoryManagementView.vue` — ADMIN_EMAILS 首次分類設定與後續程式內分類／流程管理

---

## components/ui（Atomic Design，無業務）

- `atoms/` — 不依賴其他 UI 組裝層的最小視覺與互動單位：`AppButton.vue`、`AppIcon.vue`、`ImageRemoveButton.vue`、`IconTile.vue`、`TagBadge.vue`、`SwitchIndicator.vue`、`CharacterCount.vue`、`InlineAlert.vue`、`InlineMessage.vue`、`SkeletonBlock.vue`、`BrandMark.vue`、`BusyButtonContent.vue`、`DecorativeGlow.vue`、`LoadingSpinner.vue`、`SelectionMark.vue`、`UserAvatar.vue`；新頁面不得自行複製按鈕、圖片移除鍵、圖示容器、徽章、switch、字數顯示、alert／inline message、skeleton、品牌、avatar 或 loading 樣式
- `molecules/` — 由 atoms 組成、可獨立重用的局部控制與狀態：`SurfacePanel`／`EditorSurface`／dropdown、`EditorModeBar`、`ListSurfaceRow`、`IconListRow`、`LabeledListSection`、`SectionHeader`、`CountedTextField`、`CountedTextareaField`、`NumberField`、`DialogHeading`、`DialogActionRow`、選取控制、詳情操作、空狀態／錯誤、Markdown 工具列與圖片預覽；molecule 不得依賴 organism
- `organisms/` — 可直接供 route view 或領域元件填入資料／slots 的完整區塊：內容卡集合與 skeleton、列表狀態、詳情殼與 route 狀態、`DialogShell`、Composer、Markdown／表格編輯器、狀態 Dialog、`ViewportFrame` 與 `RoutePageFrame`
- 依賴方向固定為 `atoms → molecules → organisms`；同層可組合，低層不得反向 import 高層，`check:ui` 會阻止 flat path 與逆向依賴
- `organisms/ViewportFrame.vue` / `organisms/RoutePageFrame.vue` — AppShell 的 viewport gutter／safe-area 寬度與 route page 的 max-width、全高 flex、垂直 padding、底部導覽安全距離入口；route view 不自行計算 viewport 或拼裝頁面骨架
- `organisms/ContentCardCollection.vue` / `ContentCardShell.vue` / `ContentCardSkeleton.vue` — 提案、公告、設備共用的列表狀態、卡片表面、作者／標題／時間／狀態與操作區；領域元件只填資料及差異 slots
- `organisms/DetailRouteState.vue` / `DetailPageShell.vue` / `SkeletonDetail.vue` — 三領域詳情共用的完整高度鏈、狀態、操作與 responsive panel
- `organisms/EntryComposerShell.vue` / `MarkdownImageEditor.vue` / `VisualTableEditor.vue` — 三領域 Composer 與 Markdown／表格編輯流程；較小控制留在 molecules
- `organisms/DialogShell.vue` — Dialog overlay、card surface、scroll lock、focus trap、ARIA 與 dismiss/persistent 行為的唯一完整外殼；領域 Dialog 只填內容與 actions

---

## components（應用）

- Shell：`AppShell.vue`（共用導覽狀態、返回與捲動記憶）、`app-shell/AppDesktopSidebar.vue`、`app-shell/AppMobileHeader.vue`、`app-shell/AppMobileBottomNav.vue`、`app-shell/types.ts`、`AppStartupScreen.vue`、`LoginPanel.vue`、`ActionFeedbackBar.vue`
- 設定／通知：`SettingsPanelContent.vue`；通知與設定使用獨立路由頁
- Dialog：`ConfirmDialog`、`AppInstallPromptDialog`、`AppUpdatePromptDialog`、`PushPermissionPromptDialog`、`IssueComposer`、`FacilityComposer`、`FacilityStatusDialog`、`AnnouncementComposerDialog`、`IssueReviewDialog`、`IssueStatusDialog`
- 留言：`CommentThreadPanel`、`CommentItem`、`CommentComposer`、`IssueComments`、`AnnouncementComments`
- 內容：`MarkdownRenderer`、`MarkdownMediaContent`、`AuthorAvatar`、`VoteButtons`
- 詳情內容：`ContentDetailPagePanel` / `ContentDetailBody` — 提案、公告、設備共用完整 DetailPageShell、標題、作者、補充訊息與 Markdown 內容排版；留言、操作與領域標籤以 slots 注入
- 看板：`IssueBoard`、`BoardControls`、`IssueCategorySelector`、`IssueBoardTable`、`IssueTableRow`、`IssueAdminMenu`、`IssueDetailPagePanel`、`IssueDetailSupportFooter`
- 公告：`AnnouncementTable`、`AnnouncementTableRow`、`AnnouncementDetailPagePanel`、`AnnouncementDetailActions`、`CompactActionMenu`
- 設備：`FacilityComposer`、`FacilityStatusDialog`、`FacilityAdminMenu`、`FacilityTable`、`FacilityTableRow`、`FacilityDetailPagePanel`、`FacilityDetailActions`；三領域共用 Composer、詳情內容、loading／錯誤、Skeleton、操作列與確認 Dialog，僅保留地點及設備狀態等領域差異
- 分類：`categories/CategoryEditorCard.vue` / `CategoryManagementSection.vue` — 初始設定與後續管理共用的分類表單與狀態控制

---

## composables

- Session：`useSession` + `sessionTypes` / `sessionDebug` / `sessionValidation` / `sessionAuthActions` / `sessionEffects`
- 分類：`useCategories` — 動態 catalog、預設分類與標籤查找的前端單一狀態來源
- 看板：`useIssueBoardData`、`useIssueBuckets`、`useIssueBoardPagination`、`useIssueSearch`、`useUserIssuesData`、`useIssueRouteFilter`、`useDocumentTitle`、`useFilter`
- 詳情／列：`useIssueRouteDetail`、`useIssueDisplay`、`useIssueSupport`、`useIssueItemController`、`useIssueComposerForm`、`useVoteSupport`、`useDeleteIssue`、`useStatusStyling`
- 留言：`useIssueComments`、`useAnnouncementComments`、`useDiscussionComments`（共用 core，依提案／公告領域權限判斷管理操作）
- 公告：`useAnnouncements`、`useAnnouncementManagement`、`useAnnouncementDetail`（詳情讀取、快取、Realtime、按讚與刪除流程）
- 設備：`useFacilities`、`useFacilityDetail`、`useFacilityComposerForm`
- 通知／推播：`useNotificationBadge`、`useNotifications`、`useNotificationNavigation`（開啟內容時保留通知 root 來源，詳情返回會 pop 回通知）、`useNotificationDisplay`（依目前語系組合通知標題、狀態與舊資料內容）、`usePushNotifications`、`usePushPermissionPrompt`
- UI 流程：`useActionFeedback`、`useActiveNavigationRefresh`、`useAuthenticatedDetailState`、`useDetailRouteQuery`、`useContentListRuntime`（三領域共用最短載入、逾時／斷線、重試、無限捲動與導覽重新整理）、`useBodyScrollLock`、`useDialogFocus`、`useDialogThemeColor`、`useDropdownPosition`、`useClickOutside`、`useInfiniteScroll`、`useMinimumLoading`、`useLoadingTimeout`、`useTimedMessage`、`useNetworkStatus`、`useCompactTableLayout`
- App：`useAppResume`、`useAppStartupGate`、`useAppUpdate`、`useAppInstallPrompt`、`useShareUrl`、`useAuthorAvatar`
- Markdown／圖：`useMarkdown`、`useResolvedMarkdown`、`useImageUpload`、`useMarkdownImageUpload`、`useMarkdownImageEditor`
- Dashboard：`usePlatformDashboard`、`useDashboardMetrics`

---

## generated / constants / lib / types

- `constants/app.ts` / `constants/input-limits.ts` — Novae 品牌名稱、學校顯示設定與前端輸入長度
- `constants/categories.ts` / `statuses.ts` — 動態分類衍生規則與提案／設備狀態判斷
- `lib/` — `firebase`、`firebase-messaging`、`firebase-app-check`、`auth-token`、`supabase`、`request`、`request-id`、`route-request`、`reconnect`、`route`、`page-size`、`format`、`search`、`issue-status`、`issue-timeline`、`issue-sort`、`persistent-cache`（IndexedDB 跨 reload 快取）、`in-app-browser`、`pwa-install`、`caret`、`markdown-*`、`image-processing`
- `types/index.ts` / `types/categories.ts` / `types/pwa.d.ts` — 共通型別、動態分類契約及設備領域型別

---

## services

- `backend-action.ts` / `backend-action-contract.ts` / `supabase-auth.ts` / `session-role.ts`（roles／permissions）/ `access.ts`（角色與分類指派）/ `categories.ts`（動態 catalog／setup／管理）/ `content-read-cache.ts` / `content-revisions.ts`（三領域批次版本檢查與精準失效）/ `realtime-events.ts`
- 提案：`issues.ts` barrel + `issues-core` / `constants` / `errors` / `utils` / `normalize` / `read*` / `write` / `comment-cursor`
- 其他：`facilities.ts`（設備摘要分頁／詳情／寫入）、`announcements.ts`、`notifications.ts`、`dashboard.ts`、`uploads.ts`、`users-read.ts`、`users-write.ts`

---

## public / scripts / tests / CI

- `.nvmrc` / `.node-version` / `package.json#engines` — 本機、版本管理器與套件安裝統一使用 Node.js 24 LTS
- `public/` — favicon、PWA icons
- `scripts/generate-rate-limits.mjs` / `generate-data-retention.mjs` / `generate-backend-actions.mjs`
- `scripts/upstash-test-server.ts` — 整合驗證專用的隔離式 Upstash REST／pipeline 相容計數器
- `scripts/check-i18n.mjs` — 驗證中英文 key 完整對齊、英文無中文殘留、Vue 模板無任何語言的靜態可見文案／屬性、前端無硬編碼中文字串、無缺漏或直接顯示的 `text.*` key；納入 `verify:local`
- `scripts/check-ui-primitives.mjs` — 阻止舊 dropdown 類別、任意陰影、手組卡片與各頁自行設定 viewport gutter，並確認共用 primitive 與三階陰影 token 完整；納入 `verify:local`
- `scripts/verify-integration-local.mjs` / `verify-integration-local.sh` — Windows 自動轉入 WSL、Linux/CI 直接執行的本地 Supabase 全自動重設、database lint、Edge 啟動與整合驗證入口；一律注入固定隔離測試值而不載入正式 provider credentials，CI 直接使用 `setup-deno` 加入 PATH 的官方最新版 Deno
- `tests/architecture.test.mjs` — 靜態架構回歸
- `tests/integration/` — 全 backend action、管理員／一般／領域與分類權限、冪等、RLS、通知偏好、worker lifecycle 與 Edge HTTP trust boundary；`action-coverage.test.ts` 防止新增 action 未被領域測試引用，精簡 `README.md` 只保留入口，完整維護規則位於官方網站貢獻指南
- `.github/workflows/` — `verify-pr` 同時執行靜態／build、Cloudflare Worker 與完整本地 Supabase 整合測試；`deploy-backend` 在推送 migration／Edge 前再次執行相同整合驗證；所有 JavaScript Action 使用目前 Node.js 24 世代（Checkout／Setup Node v7、Cache v6、Supabase Setup CLI v3）；另有 `deploy-frontend`、`reset-db`、`reset-cloudinary`
