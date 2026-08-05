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
- `package.json` — scripts（typecheck、lint、build、check:edge、Vitest 單元測試、架構測試、Playwright 真實瀏覽器 E2E、build budget、verify:local／integration／all）；本地 `test`／`verify:local`／`verify:all` 由 `scripts/run-local-verification.mjs` 統一顯示精簡進度，成功時只保留 warning，失敗時才展開診斷；`vitest.config.ts` 提供 Vue／jsdom 測試環境，`playwright.config.ts` 定義 bootstrap、桌面 Chromium 與手機 Chromium 專案
- `index.html` / `vite.config.ts` / `vercel.json` / `firebase.json`（僅本機 Auth emulator）/ `eslint.config.js` / `tsconfig*.json` / `tailwind.config.cjs`
- `.env.example` / `.gitignore` / `skills-lock.json`

---

## Supabase

- `supabase/config.toml` — schema 暴露、Functions JWT 模式與本地 Firebase Third-Party Auth；Hosted 專案由專用同步腳本只更新 Firebase issuer，讓 private Realtime channel 可驗證 Firebase JWT／JWKS，不以全量 `config push` 連帶修改 Storage／Vector 等無關設定
- `supabase/migrations/` — 基線 + 增量 SQL（schema／RLS／RPC／Realtime Broadcast／清理／成本限流硬化／設備與 RBAC／輸入長度、附件型別、統一 feed 分頁與集合式留言回覆讀取）；`202607190001_dynamic_category_management.sql` 建立動態分類，`202607200002_atomic_user_access.sql` 將角色與分類指派改為單一交易並完整稽核，`202607200003_harden_category_deletion.sql` 統一分類永久刪除、內容／通知／圖片清理與稽核，`202607200004_facility_category_parity_and_personal_notifications.sql` 補齊設備分類篩選／分類管理範圍並將既有設備建立通知改回個人通知，`202607200005_platform_feature_switches.sql` 建立提案／設備功能開關與原子更新 RPC，`202607220001_scoped_user_access.sql` 改為鎖定目標帳號的單一權限範圍更新並保留既有設備通知退訂，`202607220002_remove_category_archiving.sql` 將舊分類全部恢復可用並以資料庫約束移除封存狀態，`202607230001_minimize_outbox_payloads.sql` 移除 outbox 的重複正文並由 Worker 依留言 ID 精準補讀，`202607230002_security_advisor_function_paths.sql` 固定剩餘 private function 的 `search_path` 並重申 private table 的 deny-by-default 授權邊界，`202607230003_unified_media_gateway.sql` 移除舊圖片 delivery URL 快取欄位與維護工作，`202607290001_atomic_category_draft_deletions.sql` 將分類新增／修改／刪除與功能開關合併為單一交易，`202607290002_retryable_push_deliveries.sql` 建立具 lease、退避與次數上限的推播 delivery ledger，`202607300001_facility_realtime_patch_events.sql` 為設備新增校園 Broadcast 單筆變更事件，`202608030001_comment_availability_integrity.sql` 統一分類、單筆、結案與公告留言開關的資料庫約束，`202608030002_comment_category_follow_mode.sql` 將分類開關改為即時限制並保留單筆／結案關閉覆寫，`202608040001_announcement_comment_global_setting.sql` 新增公告留言總開關、單筆覆寫與資料庫強制規則，較早 migration 細節見 git
- `supabase/functions/backendAction/` — 受控 action 閘道
  - `index.ts` — origin 驗證、CORS、Firebase 驗證與分派；公開限流由 Cloudflare Worker 先處理
  - `execution.ts` — 正式入口與本地整合驗證共用的權限、request ID、冪等執行核心
  - `action-registry.ts` / `response.ts` / `rate-limit.ts`（Upstash 精確業務配額）/ `types.ts` / `utils.ts` / `validation.ts` / `auth.ts`
  - domains：`users`（公開使用者資料）、`user-access`（負責人精確查找、scope 列表與單一範圍原子授權）、`session-bootstrap`（冷啟動合併 role／catalog／revisions／unread／每日一次 visit，取代獨立 visit action 並降低 Edge invocation）、`categories`（動態 catalog／初始設定／管理）、`uploads`、`issues`（read/create/moderation/support/delete/comments）、`facilities`（分類式 read/create/affected/status/delete）、`announcements`（read/write/comments）、`notifications`、`dashboard`
  - shared helpers：`issue-shared.ts`、`announcement-shared.ts`
  - 省 Edge Function 次數靠合併讀取與前端快取，不把 domain 業務搬進 Cloudflare Worker
- 獨立 Functions：`syncUser`、`cloudinaryWebhook`、`outboxWorker`、`processDeletionJobs`、`maintenanceCleanup`
- `_shared/` — `env`、`http`、`api-errors`（公開錯誤契約 codegen）、`origin`（Worker／內部 origin secret 與動態 Function URL）、`firebase-auth`（Redis 15 分鐘絕對期限與 warm isolate 5 分鐘記憶體快取）、`cloudinary`（只負責上傳、驗證與刪除）、`media-delivery`（公開固定／私人 15 分鐘簽名 Worker 媒體網址）、`database`、`database-client`（Edge 專用精簡 PostgREST client）、`google-oauth`、`fcm`、`notion`（提案狀態變更時以完整正文／原因／結果／留言快照更新受控 blocks 與最新附議數；設備正文同步地點與處理結果；圖片匯入同樣經 Media Gateway）、`rate-limits`、`upstash-rate-limit`、`webhook`

---

## Cloudflare

- `cloudflare/wrangler.toml` — production/development `workers.dev` 部署與 observability；production traces 以 10% head sampling 控制 log 用量，development 保留完整取樣
- `cloudflare/src/` — 公開 API 與 Media Gateway；CORS、Firebase JWT、Cloudinary webhook／authenticated delivery 簽章、Cloudflare 原生 Rate Limiting bindings 與 Supabase origin 轉發；可變內容列表一律 `no-store`，避免狀態與留言開關寫入後殘留舊 POP 回應；所有附件與 Cloudinary 頭像由 `/v1/media/<token>/<variant>` 統一傳送，私人 token 先驗證再讀共享 edge cache，縮圖固定 320×240、頭像固定 96×96，前端不接觸 Cloudinary delivery URL
- `cloudflare/generated/` — API error 與 backend action policy codegen
- `scripts/prepare-edge-functions.mjs` — CI 依私密 namespace 暫時產生六個隨機 Supabase Function 部署目錄

---

## src 入口與路由

- `main.ts` — 掛載 app、resume、PWA、session
- `i18n/` — `messages/<locale>/<domain>.ts` 依語系與領域拆分的 catalog（含 API error code 對應文案）、系統語言首次偵測、localStorage 語言偏好、日期 locale 與共用 `t()`；所有前端可見字串只放語系目錄，key 使用短而穩定的語意命名
- `App.vue` — startup gate + AppShell；全域以 MotionConfig 尊重 reduced motion，LazyMotion 延後載入 DOM layout 功能；route stage 使用固定 Grid 疊放新舊頁，依 navigation depth 以 smooth opacity／短距位移表達前進、返回與同層切換
- `sw.ts` — PWA SW、快取策略、FCM 背景通知
- `style.css` — 全域樣式載入入口；依序載入 base、primitives 與領域樣式
- `styles/base.css` — design tokens、全域基礎與頁面骨架；所有捲動容器全域隱藏原生捲動條但保留滾輪／觸控／鍵盤操作，route frame 維持同一 Grid 疊放，實際轉場由 App 的 Motion 層負責
- `styles/primitives.css` — viewport、control／card／floating 表面與陰影、list、dropdown、control frame、GPU progress fill 的單一可復用視覺契約；Tailwind 陰影名稱同樣只使用 `shadow-control`、`shadow-card`、`shadow-floating`
- `styles/components.css` / `controls.css` — 共用表面、互動狀態、按鈕與欄位；全域點擊回饋使用無位移的輕微放大與 spring-like 回彈，大型表面降低幅度；Pill 指示器的連續位移交給 Motion spring
- `styles/navigation.css` — 桌面側欄與手機底部導覽；浮入與 scrim 使用 opacity／局部 transform，窄桌面側欄展開不再推動整個內容 viewport
- `styles/content.css` / `responsive.css` — 列表、設定、統計、Dialog 與跨裝置覆寫；手機詳情 feed 為 fixed 留言 Composer 預留 Bottom Tab／safe-area 捲動空間，dock 水平位置沿用 viewport primitive；Dialog 根節點保留 Vue transition 生命週期，surface 與獨立全畫面 backdrop 延後分層進場，blur 維持固定值只動畫 opacity
- `assets/fonts/` — JetBrains Mono 與 Material Symbols 子集
- `router/index.ts` / `router/default-route.ts` / `router/route-components.ts` / `router/navigation-hierarchy.ts` — 組合 modules、依啟用功能選擇登入預設頁並阻擋已關閉入口、abort 上一頁、session guard、主要頁面與三領域新增頁 chunk 預載，以及 root／新增／子頁／巢狀詳情深度與通知來源返回
- `router/authRoutes.ts` / `issueRoutes.ts` / `facilityRoutes.ts` / `announcementRoutes.ts` / `adminRoutes.ts` / `notificationRoutes.ts` / `settingsRoutes.ts`
- `views/LoginView.vue` — 登入
- `views/IssueBoardView.vue` — 提案看板
- `views/IssueDetailView.vue` — 提案詳情
- `views/FacilitiesView.vue` / `views/FacilityDetailView.vue` — 依動態設備分類瀏覽、建立與詳情／分類範圍狀態管理，分類選擇同步於 URL query
- `views/AnnouncementsView.vue` — 公告列表
- `views/AnnouncementDetailView.vue` — 公告詳情
- `views/NotificationsView.vue` — 通知頁
- `views/SettingsView.vue` — 設定頁（手機）
- `views/DashboardView.vue` — 管理員統計
- `views/AdministrationView.vue` — 單一系統設定中心，以頁面層級文字 Tabs 切換分類／流程與人員／權限，避免和內容選擇控制混淆；舊 `/admin/access`、`/admin/categories` 會導向對應區段
- `components/admin/CategoryWorkflowPanel.vue` / `MemberAccessPanel.vue` / `MemberAccessRow.vue` / `MemberAccessListSkeleton.vue` / `CategoryWizardDialog.vue` — 以等寬膠囊 Tabs 切換提案／設備／公告；提案與設備管理分類，公告管理所有公告共用的留言總開關，並由單一按鈕原子儲存；草稿關閉功能時鎖定該功能的分類編輯，尚未儲存前不影響前台；人員權限先選分類／功能、只列出現有負責人，再以完整 Email／UID 查找並以共用成員列與載入骨架呈現／指派；平台總管理員只由 `ADMIN_EMAILS` 同步，不混入分類負責人名單，也不提供 UI 或一般權限 API 修改入口
- `components/categories/CategoryManagementSection.vue` / `SetupCategorySection.vue` / `CategorySelectorList.vue` / `CategoryEditorCard.vue` / `PlatformFeatureToggle.vue` — 初始設定與後續管理共用可橫向捲動的手機分類選擇清單、單一分類規則表單、目前分類的唯一預設 Switch，以及提案與設備功能開關；分類不提供封存或停止接案狀態，後續管理只允許永久刪除並明示會清除其所有關聯資料
- `views/SetupView.vue` / `components/LanguageSelector.vue` / `components/categories/SetupCategorySection.vue` — ADMIN_EMAILS 首次設定依序確認系統語言，再以與系統設定相同的提案／設備介面調整功能與分類；只驗證啟用功能的必填資料，完成前以確認 Dialog 說明先略過尚未註冊的負責人，未完成時停用送出，相同語言選擇器亦供設定頁覆用

---

## components/ui（Atomic Design，無業務）

- `atoms/` — 不依賴其他 UI 組裝層的最小視覺與互動單位：`AppButton.vue`、`AppIcon.vue`、`ImageRemoveButton.vue`、`IconTile.vue`、`TagBadge.vue`、`SwitchIndicator.vue`、`CharacterCount.vue`、`InlineAlert.vue`、`InlineMessage.vue`、`SkeletonBlock.vue`、`BrandMark.vue`、`BusyButtonContent.vue`、`DecorativeGlow.vue`、`LoadingSpinner.vue`、`DecodedImage.vue`（下載與 decode 完成前隱藏漸進繪製並顯示 spinner）、`SelectionMark.vue`、`UserAvatar.vue`；列表計數操作統一套用 `button-card-count` 緊湊高度；新頁面不得自行複製按鈕、圖片移除鍵、圖示容器、徽章、switch、字數顯示、alert／inline message、skeleton、品牌、avatar、圖片載入或 loading 樣式
- `molecules/` — 由 atoms 組成、可獨立重用的局部控制與狀態：`SurfacePanel`／`ContentNoticePanel`（列表補充列與詳情結果／地點共用的 neutral、success、error 表面）／`EditorSurface`／dropdown、`EditorModeBar`、`ListSurfaceRow`、`IconListRow`、`LabeledListSection`、`SectionHeader`、`WorkflowStepHeader`、`CountedTextField`、`CountedTextareaField`、`NumberField`、`DialogHeading`、`DialogActionRow`、選取控制、詳情操作、空狀態／錯誤、Markdown 工具列與圖片預覽；molecule 不得依賴 organism
- `organisms/` — 可直接供 route view 或領域元件填入資料／slots 的完整區塊：內容卡集合與 skeleton、列表狀態、詳情殼與 route 狀態、`DialogShell`、Composer、Markdown／表格編輯器、狀態 Dialog、`ViewportFrame` 與 `RoutePageFrame`
- 依賴方向固定為 `atoms → molecules → organisms`；同層可組合，低層不得反向 import 高層，`check:ui` 會阻止 flat path 與逆向依賴
- `organisms/ViewportFrame.vue` / `organisms/RoutePageFrame.vue` — AppShell 只用 safe-area-aware padding 提供唯一 viewport gutter，route page 只負責 max-width、全高 flex、垂直 padding與底部導覽安全距離；不以負 margin、bleed 或頁面級 `overflow-x-hidden` 推出／裁切內容。手機 `bottom-safe` 共用 Bottom Tab 實際螢幕底距，使 Detail 的時間／操作列到 Tab 與 Tab 到螢幕底部保持相同留白
- `organisms/ContentCardCollection.vue` / `ContentCardShell.vue` / `ContentCardSkeleton.vue` — 提案、公告、設備共用的列表狀態、卡片表面、作者／標題／時間／狀態與一般互動操作；列表卡片只負責開啟 detail 與內容互動，不再承載管理員長按／右鍵入口；鍵盤 focus 可立即預抓，mouse 停留 180ms 且非省流／2G／背景頁才轉發 intent，手機 pointer 不做 hover 預抓；列表與 load-more 骨架共用無陰影內層的 opacity 進場（`skeleton-card`／`skeleton-enter`），保留卡片陰影並避免 iOS WebKit 卸載殘影，領域元件只填資料及差異 slots
- `organisms/DetailRouteState.vue` / `DetailPageShell.vue` / `SkeletonDetail.vue` — 三領域詳情共用的完整高度鏈、狀態與操作；桌面詳情採無外層卡片的平面雙欄，沿用父層可用高度與 `min-h-0` 捲動鏈以釋放正文／留言空間，不自行推算 `100dvh`；手機移除內容／留言 segmented tabs，以單一 scroll root 依序呈現正文、actions 與討論，使用分隔線而不重複顯示討論標題／留言數／空留言卡，留言 query 深連結先定位討論 anchor，再由留言串定位指定留言
- `organisms/EntryComposerShell.vue` / `MarkdownImageEditor.vue` / `VisualTableEditor.vue` — 三領域共用的路由新增頁、鍵盤可視高度、未儲存離頁攔截與 Markdown／表格編輯流程；較小控制留在 molecules
- `organisms/DialogShell.vue` / `AdaptiveActionMenu.vue` — Dialog overlay、獨立全螢幕 backdrop、ARIA、返回鍵堆疊與 dismiss/persistent 行為的唯一完整外殼；底層以 Reka Dialog／Drawer 提供 focus trap、scroll lock、鍵盤與下拉手勢，外層以共用 `dialog-surface--panel` 維持新擬態高光／內陰影與進退場 token；一般浮層在手機自適應為含標題與分組 action 的 iOS 式 Sheet，桌面使用 Reka Popover 定位；管理員與內容操作入口共用 `action-menu-trigger`、`dropdown-panel` 與圓角 action row，領域元件只填內容與 actions

---

## components（應用）

- Shell：`AppShell.vue`（共用導覽狀態、返回、逐路由捲動記憶、提案／設備的手機分類切換與桌面 utility popup；換頁時重算 Header 捲動狀態，三領域詳情頁使用平面實色 Header，避免與內層固定標籤列疊加模糊／陰影；設備分類以 URL query 同步手機 Header 和桌面 BoardControls；顯示 Bottom Tab 時不再額外加 main-content 底距）、`app-shell/AppDesktopSidebar.vue`、`app-shell/AppMobileHeader.vue`（共用字串型分類選項；手機高度與 44px 點擊區一致，返回箭頭與標題同為 24px 視覺尺寸；返回鍵保留單一 DOM，槽位以寬度／opacity 收合，避免按鈕溢出壓字；標題維持單一內容實例）、`app-shell/AppMobileBottomNav.vue`（共用 Motion 選中指示器依索引平滑滑動，不量測 DOM）、`app-shell/types.ts`、`AppStartupScreen.vue`、`LoginPanel.vue`、`ActionFeedbackBar.vue`
- 設定／通知：`SettingsPanelContent.vue`、`DesktopUtilityDialog.vue`；手機與深層連結保留獨立路由頁，桌面側欄的通知與頭像分別開啟各自尺寸與內容的獨立大型 popup
- 新增頁：`IssueComposer`、`FacilityComposer`、`AnnouncementComposer` 搭配 `views/IssueComposerView.vue`、`FacilityComposerView.vue`、`AnnouncementComposerView.vue`；手機隱藏 Bottom Nav，手機與桌面皆填滿 AppShell padding 內的可用內容區，不另做 full-bleed 補償；共用 Composer 以內側 padding 預留按鈕陰影繪製空間，手機沿用 AppShell 的 iOS 式側距並只保留扣除多餘安全區後的緊湊底距，送出後 replace 至新內容詳情
- Dialog：`ConfirmDialog`、`AppInstallPromptDialog`、`AppUpdatePromptDialog`、`PushPermissionPromptDialog`、`FacilityStatusDialog`、`IssueReviewDialog`、`IssueStatusDialog`
- 留言：`CommentThreadPanel`、`CommentItem`、`CommentComposer`、`IssueComments`、`AnnouncementComments`、`UnavailableCommentDiscussion`；embedded 模式讓留言串沿用詳情外層捲動與 infinite-scroll root，手機 Composer 可由獨立 prop 固定在 Bottom Tab 上方並採低高度全圓角 control；留言不開放時沿用同一 Composer 外觀並停用輸入、圖片、送出與自動 focus，設施只掛載無資料／無 service 的 unavailable presentation
- 內容：`MarkdownRenderer`、`MarkdownMediaContent`、`AuthorAvatar`、`VoteButtons`；附議在卡片維持緊湊 icon-pill，在詳情頁則組合共用 `DetailActionButton`，與設備「我也遇到」共用尺寸、表面及選中狀態
- 詳情內容：`ContentDetailPagePanel` / `ContentDetailBody` — 提案、公告、設備共用完整 DetailPageShell、標題、作者、補充訊息與 Markdown 內容排版；可組合 context notice（設備地點）及 result notice（處理結果），留言、操作與領域標籤以 slots 注入，comments slot 同時傳遞 desktop panel 或 mobile embedded layout scope；提案與設備以共用 inset summary 整合進度／actions／響應式時間軸，公告維持精簡 actions
- 看板：`IssueBoard`、`BoardControls`、`BoardCategorySelector`、`IssueBoardTable`、`IssueTableRow`、`IssueDetailPagePanel`、`IssueDetailSupportFooter`；提案與設備共用分類選擇器，管理員審核、狀態與刪除操作集中在 detail
- 公告：`AnnouncementTable`、`AnnouncementTableRow`、`AnnouncementDetailPagePanel`、`AnnouncementDetailActions`、`CompactActionMenu`；公告留言只受系統全域開關與既有留言可讀規則約束，既有留言保持可讀；`CompactActionMenu` 僅供 detail 內留言操作使用，公告列表不再顯示管理入口
- 設備：`FacilityComposer`、`FacilityStatusDialog`、`FacilityTable`、`FacilityTableRow`、`FacilityDetailPagePanel`、`FacilityDetailActions`；列表補充列只顯示地點與遇到人數，分類由 AppShell／BoardControls 顯示；詳情以共用 notice 表面呈現地點，並保留分類徽章，手機 feed 額外顯示 disabled discussion shell 但不建立設備留言讀取、Realtime 或提交流程。新增時標題與地點必填，詳細說明與圖片為選填；管理員狀態與刪除操作集中在 detail，三領域共用 Composer、詳情內容、loading／錯誤、Skeleton、操作列與確認 Dialog
- 分類：`categories/CategorySelectorList.vue` / `CategoryEditorCard.vue` / `CategoryManagementSection.vue` / `SetupCategorySection.vue` / `PlatformFeatureToggle.vue` — 初始設定與後續管理共用的分類選擇、表單、功能開關、唯一預設控制與永久刪除入口

---

## composables

- Session：`useSession` + `sessionTypes` / `sessionDebug` / `sessionValidation` / `sessionAuthActions`（production：GIS Token Client → `signInWithCredential`；emulator：`signInWithPopup`）/ `sessionEffects`（登入 bootstrap 的 visit 最多每日寫入一次）
- 分類：`useCategories` — 動態 catalog、平台功能開關、預設分類與標籤查找的前端單一狀態來源
- 權限：`useMemberAccessManagement` — 分類／公告 scope 的負責人載入、精確查找、競態防護與單一範圍授權流程
- 看板：`useIssueBoardData`、`useIssueBuckets`（進行中／已結案各自持有請求，切換不互相中止）、`useIssueBoardPagination`、`useIssueSearch`、`useUserIssuesData`、`useIssueRouteFilter`、`useDocumentTitle`、`useFilter`
- 詳情／列：`useIssueRouteDetail`、`useIssueDetailCacheScope`（列表 intent 預抓與詳情讀取共用的權限範圍 key）、`useIssueDisplay`、`useIssueSupport`、`useIssueItemController`、`useIssueComposerForm`、`useVoteSupport`、`useDeleteIssue`、`useStatusStyling`
- 留言：`useIssueComments`、`useAnnouncementComments`、`useDiscussionComments`（共用 core，依提案／公告領域權限判斷管理操作）
- 公告：`useAnnouncements`、`useAnnouncementManagement`、`useAnnouncementDetail`（詳情讀取、快取、Realtime、按讚與刪除流程）
- 設備：`useFacilities`、`useFacilityDetail`、`useFacilityComposerForm`
- 通知／推播：`useNotificationBadge`、`useNotifications`、`useNotificationNavigation`（開啟內容時保留通知 root 來源，詳情返回會 pop 回通知）、`useNotificationDisplay`（依目前語系組合通知標題、狀態與舊資料內容）、`usePushNotifications`、`usePushPermissionPrompt`
- UI 流程：`useActionFeedback`、`useActiveNavigationRefresh`（目前導覽項重按以 20 秒 cooldown 合併重抓）、`useAuthenticatedDetailState`、`useDetailRouteQuery`、`useContentListRuntime`（三領域共用最短載入、逾時／斷線、重試、無限捲動與導覽重新整理）、`useOverlayBack`（LIFO 系統返回）、`useLongPress`（移動容差與 click 抑制）、`useVisualViewport`（手機鍵盤可視高度）、`useDialogThemeColor`、`useClickOutside`（僅供非浮層的既有局部點擊邊界）、`useInfiniteScroll`（自動解析實際 scroll root；載入更多時以三筆領域骨架形成底部邊界，只阻止向下越過邊界的 wheel／touch overscroll，保留向上捲動）、`useMinimumLoading`、`useLoadingTimeout`、`useTimedMessage`、`useNetworkStatus`、`useCompactTableLayout`（以 VueUse ResizeObserver 維持表格斷點）；媒體查詢與 observer 優先 VueUse，Dialog／Drawer／Popover 的 focus、scroll lock、手勢與碰撞定位統一由 Reka UI 負責
- App：`useAppResume`、`useAppStartupGate`、`useAppUpdate`、`useAppInstallPrompt`、`useShareUrl`、`useAuthorProfile`
- Markdown／圖：`useMarkdown` 只允許 Media Gateway 圖片路徑；`useResolvedMarkdown` 批次取得 320×240 thumbnail 與 full 兩種網址，小圖列只載縮圖、燈箱與正文才載完整圖；另有 `useImageUpload`、`useMarkdownImageUpload`、`useMarkdownImageEditor`
- Dashboard：`usePlatformDashboard`、`useDashboardMetrics`

---

## generated / constants / lib / types

- `constants/app.ts` / `constants/input-limits.ts` — Novae 品牌名稱、學校顯示設定與前端輸入長度
- `constants/categories.ts` / `statuses.ts` — 動態分類衍生規則與提案／設備狀態判斷
- `lib/` — `firebase`、`google-identity`（lazy GIS Token Client）、`firebase-messaging`、`firebase-app-check`、`auth-token`、`supabase`（REST client 與 private Realtime 共用的 Firebase token 授權閘門）、`browser-storage`（local/session storage 的受限瀏覽器與 quota-safe 單一邊界）、`session-access`（role／permission／提案與設備分類 scope 的純權限判斷）、`feature-access`（提案／設備開關對預設頁與路由可用性的純矩陣）、`request`、`request-id`、`route-request`、`reconnect`、`route`、`page-size`、`feed-loading`（所有 infinite feed 共用三筆載入更多 placeholder 數量）、`format`、`search`、`issue-status`、`issue-timeline`、`issue-notice`（列表與詳情共用的結案內容／標題／tone 正規化）、`issue-sort`、`issue-detail-preview`（列表到詳情的一次性同步摘要 seed）、`persistent-cache`（IndexedDB 跨 reload 快取）、`press-feedback`（共用 pointer 按壓狀態、12px 捲動取消與放開後固定 160ms 可見時間）、`ui-motion`（smooth spring／tween／stagger 單一參數來源）、`motion-features`（LazyMotion 的 DOM layout feature 邊界）、`touch-zoom`（以 capture touchend 座標與 dblclick 雙層攔截雙擊放大，仍保留 pinch zoom）、`in-app-browser`、`pwa-install`、`caret`、`markdown-*`、`image-processing`
- `types/index.ts` / `types/categories.ts` / `types/pwa.d.ts` / `types/google-identity.d.ts` — 共通型別、動態分類契約、設備領域型別與 GIS Token Client 型別

---

## services

- `backend-action.ts` / `backend-action-contract.ts` / `supabase-auth.ts` / `session-role.ts`（roles／permissions）/ `session-bootstrap.ts`（冷啟動合併 session 讀取）/ `access.ts`（負責人查找與單一 scope 授權）/ `categories.ts`（動態 catalog／setup／整體原子管理）/ `content-read-cache.ts` / `content-revisions.ts`（三領域批次版本檢查與精準失效）/ `realtime-events.ts`（提案／公告／設備依 UID／角色共用 Broadcast 連線、單筆 patch 事件、斷線重連與成功後 resync）
- 提案：`issues.ts` barrel + `issues-core` / `constants` / `errors` / `utils` / `normalize` / `read*` / `write` / `comment-cursor`
- 其他：`facilities.ts`（設備分類摘要分頁／詳情／寫入）、`announcements.ts`、`notifications.ts`（公告廣播與提案／設備分類負責人的個人通知讀取）、`dashboard.ts`、`uploads.ts`、`users-read.ts`（50 筆批次、request coalescing 與 24 小時 IndexedDB 個別 profile cache）、`users-write.ts`

---

## public / scripts / tests / CI

- `.nvmrc` / `.node-version` / `package.json#engines` — 本機、版本管理器與套件安裝統一使用 Node.js 24 LTS
- `public/` — favicon、PWA icons
- `scripts/generate-rate-limits.mjs` / `generate-data-retention.mjs` / `generate-backend-actions.mjs`
- `scripts/sync-supabase-firebase-auth.mjs` — 後端部署透過 Management API 冪等同步唯一 Firebase Third-Party Auth issuer，建立後再移除同專案的過期 Firebase issuer 並重新讀取驗證；不觸碰一般 Auth、Storage 或付費 Vector Bucket 設定
- `scripts/upstash-test-server.ts` / `external-provider-test-server.ts` — 整合驗證專用的隔離式 Upstash REST／pipeline 相容計數器與外部服務收件器；後者記錄 FCM topic／token／payload／深層連結及 Cloudinary 刪除請求，並可注入暫時性 FCM 失敗以驗證持久重試，避免測試連到正式服務
- `scripts/check-build-budget.mjs` — build 後限制字型檔數／總容量與 JS／CSS 總量，防止未使用字重或 bundle 膨脹回歸
- `scripts/check-i18n.mjs` — 驗證中英文 key 完整對齊、英文無中文殘留、Vue 模板無任何語言的靜態可見文案／屬性、前端無硬編碼中文字串、無缺漏或直接顯示的 `text.*` key；納入 `verify:local`
- `scripts/check-ui-primitives.mjs` — 阻止舊 dropdown 類別、任意陰影、手組卡片與各頁自行設定 viewport gutter，並確認共用 primitive 與三階陰影 token 完整；納入 `verify:local`
- `scripts/verify-integration-local.mjs` / `verify-integration-local.sh` — Windows 自動轉入 WSL、Linux/CI 直接執行的本地 Supabase 全自動重設、database lint、Edge 啟動與整合驗證入口；各階段將完整輸出留在暫存 log，終端只顯示進度與 warning，失敗時才輸出相關尾端診斷；`npm run test:env` 會以相同基礎再啟動 Firebase Auth emulator、Cloudflare gateway 與 Vite，並以 `scripts/check-local-auth-emulator.mjs` 驗證登入、custom claim、僅由 `ADMIN_EMAILS` 決定的平台總管理員與 Setup 路由前置狀態後才回報 Ready；`npm run test:e2e` 以同一隔離環境執行 Playwright，結束後統一清理服務；Google 登入模擬器可快速建立任意 `@integration.invalid` 新使用者，一律使用隔離測試值，不載入正式 provider credentials；自動驗證模式另啟動 FCM 收件器，實際驗證站外 topic／個人推播與通知偏好；本機 Firebase debug log、E2E auth state、trace、影片與報告由 `.gitignore` 排除
- 動態壓測：`npm run verify:stress` 以目前資料庫分類展開 `tests/integration/stress-workflows.test.ts`；規模可用 `--stress-scale 2..20` 調整，涵蓋多人多權限、各分類內容、巢狀留言、通知、圖片與分類刪除
- `tests/architecture.test.mjs` / `tests/architecture/` — 薄入口加依 backend contract、data access、runtime、frontend UI、delivery tooling 分組的靜態架構回歸；共用檔案列舉／讀取集中在 `helpers.mjs`
- `tests/unit/` — Vitest + Vue Test Utils 行為測試；除受限 browser storage、安裝提示 i18n 與分類 draft 外，`access-control-matrix.test.ts` 完整跑 role／category scope 與四種功能開關路由矩陣，`permission-actions-matrix.test.ts` 驗證提案／設備詳情與 compact menu、設定入口的顯示／隱藏／點擊，`category-access-workflows.test.ts` 驗證分類單次原子儲存失敗重試及提案／設備／公告權限 grant/revoke 按鈕，`issue-sort.test.ts` 保證進行中／已結案 bucket 不會保留跨狀態資料，`issue-notice.test.ts` 驗證已結案提案各種狀態對應之結果／未通過原因與顏色樣式
- `tests/integration/` — 全 backend action、管理員／一般／領域與分類權限、冪等、RLS、站內通知、FCM topic／個人站外通知、分類收件人、worker lifecycle 與 Edge HTTP trust boundary；原本大型 `access-uploads` 與 `notifications-workers-security` 改為薄入口，案例依 scope revoke、分類管理／刪除、推播重試、分類／公告路由、worker lifecycle、RLS 與 Edge trust 拆入 `access/`、`notifications/`，共享測試工具集中在各自 support；權限整合矩陣另驗證提案、設備、公告 scope 撤銷後立即失去讀取／寫入能力且不再出現在負責人列表；session bootstrap 直接 assertion 合併後的每日 visit，不保留舊獨立 visit action；`retention-cleanup.test.ts` 逐表驗證過期刪除、未過期保留、Cloudinary 清理、Notion 營運副本保留與無聲保留期刪除，`action-coverage.test.ts` 防止新增 action 未被領域測試引用，精簡 `README.md` 只保留入口，完整維護規則位於官方網站貢獻指南
- `tests/e2e/` — Playwright 真實瀏覽器權限契約：bootstrap 透過 UI 完成 Setup、建立多帳號／兩組提案與設備分類及 scoped managers；桌面與手機案例驗證角色應見／不應見的按鈕、所有主要按鈕行為、跨分類隔離、權限撤銷／恢復、分類新增／改名／刪除、四種功能開關組合與直接路由拒絕；page objects 在 `pages/`、帳號／session／內容狀態工具在 `support/`。`src/testing/e2e-auth.ts` 僅在 DEV、loopback Auth emulator 與 `@integration.invalid` 三重條件下提供測試登入橋接，production 不可達
- `.github/workflows/` — `verify-pr` 同時執行靜態／build、Cloudflare Worker、完整本地 Supabase 整合測試與安裝 Chromium 後的真實瀏覽器 E2E；`deploy-backend` 在推送 migration／Edge 前再次執行相同整合驗證；所有 JavaScript Action 使用目前 Node.js 24 世代（Checkout／Setup Node v7、Cache v6、Supabase Setup CLI v3）；另有 `deploy-frontend`、`reset-db`、`reset-cloudinary`
