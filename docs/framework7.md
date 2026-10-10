# Framework7 前端維護

Novae 使用 Framework7／Framework7 React 9.2.0，所有裝置固定採用 iOS theme。Next.js 管理網址、攔截式詳情路由與部署；Framework7 管理原生控制項、樣式、捲動標題和面板動畫。登入、權限、草稿與樂觀更新維持 domain hooks 的責任。

## 元件與用途

| 用途 | Framework7 元件 |
| --- | --- |
| 頁面與捲動 | Page、PageContent |
| 登入頁 | Page loginScreen、PageContent loginScreen、LoginScreenTitle、Block／BlockFooter |
| 一般動作、文字欄位及內容卡片 | Button／Link、ListInput、Card／CardHeader／CardContent／CardFooter |
| 大標題、捲動後置中小標題 | Navbar large，接合 Framework7 navbar scroll lifecycle |
| 固定頂部操作 | Navbar 內的 Link iconOnly、Framework7 Icon |
| 列表目的地與狀態篩選 | Subnavbar、Segmented |
| 手機主要導航 | Toolbar tabbar icons、ToolbarPane、Link tabLink；使用官方膠囊、滑動選取背景與玻璃效果 |
| 桌面主要導航 | List menuList、ListItem |
| 新增操作 | Fab；只有圖示，亮色黑底白圖示，深色白底黑圖示 |
| 列表與設定 | List inset strong dividers、ListItem、ListInput、BlockTitle、BlockFooter |
| 選擇與開關 | Smart Select、原生 radio、Toggle |
| 搜尋 | Navbar expandable Searchbar；管理資料搜尋使用 inline Searchbar |
| 詳情、編輯及短選擇 | Popup、Sheet；開關與離開 guard 由 ModalRoot 接合 |
| 手機操作選單、桌面錨點選單 | Actions、Popover |
| 確認與回饋 | Dialog、Toast、Tooltip、Badge、Preloader、Progressbar、SkeletonBlock |
| 互動式安全驗證 | Dialog；持續掛載相同 Turnstile iframe，使用原生開關 lifecycle |
| 照片檢視與縮放 | Photo Browser、Swiper zoom |
| 留言輸入 | Messagebar |
| 展開設定、紀錄內容 | ListItem accordion、AccordionContent |
| 提案處理時間軸 | Framework7 Timeline 的官方 HTML 結構與 iOS 樣式 |

以 [官方 Kitchen Sink](https://framework7.io/kitchen-sink/core/?theme=ios) 和安裝版本的元件來源為準，選用 iOS 26 的圓形控制項：所有 Button 使用 round，Segmented 的容器與子按鈕也必須使用 round；不要混用示範頁中的 4px 方角變體。Toolbar 的操作群組使用 ToolbarPane。不要另寫一套邊框、圓角、陰影、按壓或面板動畫來模仿 iOS。操作列只呈現名稱及目前值；整組說明放在 BlockFooter。資料紀錄的作者、時間與狀態可以使用原生 media list 呈現。

Markdown 編輯器保留 Vditor，因為業務需要 Markdown 原始內容；Framework7 的 Rich Text Editor 不提供相同資料格式。圖表、內容排版與反應回饋保留產品本身的呈現。Motion 處理這些內容狀態，面板、Tabbar、選單與控制項則交給 Framework7。

一般表單以 `ListSection` 配合 `ListInputRow`／`ListNumberRow`／`ListNoteRow` 組成，分類選擇使用 `ListPicker`。初始設定、提案與設備表單共用這些列；不要再加入獨立 Input 外框或在外面包一張 Card。字數提示使用 ListInput 的 info slot，群組說明用 ListSection 的 footer，不能直接把段落放入列表的 ul。

`SheetBody` 使用 PageContent，預設提供原生 Block gutter 與底部 safe area。含自身 Navbar／內容留白的詳情路由傳入 `padded={false}`。Dialog 的關閉或取消放在原生底部 buttons，不能另外疊一顆絕對定位的叉號。按鈕使用 Framework7 大、小及圓形變體，不以頁面層的固定 height／padding 重新繪製。

## 修改位置

- `src/components/framework7-provider.tsx`：安裝使用中的模組、建立 iOS App／View，同步亮暗主題。View 的 router 停用，正常網址交給 Next.js；hash 控件交給 Framework7。
- `src/components/motion/route-surface.tsx`：原生 Page／PageContent 與固定 Navbar host；登入使用原生 loginScreen 旗標。
- `src/components/turnstile-dialog.tsx`：原生 Dialog 開關、不可中斷的驗證流程與持續掛載的 widget host；只為第三方 iframe 調整寬度和隱藏時的掛載幾何。
- `src/components/ui/use-native-navbar.ts`：掛接上游 Navbar 的尺寸、捲動收合與內容高度更新；不自行計算標題動畫。
- `src/components/ui/use-framework7-control.ts`：第三方 React ref、表單屬性與無障礙屬性的 DOM 接合。Framework7 9.2 的一般 ListItem 不提供 ref，使用實際 li 的 id 對應 anchor。
- `src/components/ui/modal-context.tsx`、`modal-surface.tsx`、`native-modal-layers.tsx`：受控開關、原生關閉動畫、焦點、來源頁捲動與草稿／分享 guard。原生下拉關閉也必須走相同 guard。
- `native-modal-lifecycle.ts`：Framework7 9.2 的卸載接合，移除尚未結束的 transition callback，並送出其 Popup swipe teardown 實際監聽的 `popupDestroy` 事件，避免 Strict Mode、路由交接或 HMR 留下已銷毀的物件。
- `native-modal-isolation.ts`：面板開啟時以 `inert`／`aria-hidden` 隔離保留的背景頁面及下層面板，關閉或提早卸載後還原原有屬性；鍵盤與讀屏器只操作最上層面板。
- `src/lib/app-scroll.ts`：PageContent 的位置讀寫；尚未掛載頁面的啟動狀態使用文件捲動。
- `src/styles/framework7.css`：Next 整合、safe area、viewport 與鍵盤可及性。元件外觀來自生成的上游 iOS CSS。
- `scripts/generate-framework7.mjs`：只編譯使用中的 iOS 模組，保留亮暗主題；包含 Login Screen 與提供文字／對齊 class 的 Typography。Swiper 只收 core／zoom／virtual，Skeleton 不帶未使用的文字字型。不要直接改生成 CSS。

HeroUI、Radix UI、Sonner、tw-animate-css、HarmonyOS 字型套件及未使用的 Typography 外掛已移除。介面與編輯器統一使用 Framework7 的系統字型，舊字型分片、產生器和未使用的 Tailwind 3 設定也已刪除。舊 press feedback、header backdrop、搜尋彈窗與自訂下拉關閉程式已移除。新增控制項前先檢查 Framework7 是否提供相同用途，並確認是否需要加入 runtime plugin 及 Less 模組。

## 檢查與更新

```powershell
bun add framework7@版本 framework7-react@相同版本
bun run generate:all
bun run verify:local
bun run test:e2e
```

兩個 Framework7 套件版本必須一致。檢查手機與桌面、亮暗主題、長列表標題收合、搜尋展開／取消、選取／取消、面板關閉、草稿離開 guard 與返回後捲動位置。主要捲動容器是 `.novae-page-content`，測試不要再用 `window.scrollTo` 模擬這些頁面。

完整原生 Searchbar、Smart Select、Photo Browser／Swiper、Login Screen、Typography 與其他控制項需要對應樣式和執行模組。刪除舊介面、插圖、動畫與未用模組後，UI CSS 上限為 360 KiB，總 JS 為 3.4 MiB；單一 CSS chunk gzip 維持 128 KiB，路由壓縮 CSS 維持 160 KiB。原生 Typography 模組約增加 6 KiB，故從 352 KiB 小幅調整；不要以手寫 class 替代上游模組來規避上限。

2026-10-10 正式 PWA 建置量測：最大路由 UI CSS 358.0 KiB、路由 CSS gzip 61.5 KiB、單一 CSS gzip 51.5 KiB、7 個字型共 236.2 KiB、JS 共 3.32 MiB。以 `.next-verify/build-budget-report.json` 的最新結果為準；本機驗證輸出固定使用 4 個 Next 建置 worker，避免與持續運行的預覽同時耗盡記憶體。

即時手機預覽使用獨立的開發輸出目錄和 Tailscale Serve。開發模式會在 hydration 前移除同來源的 PWA worker，避免正式版快取攔截 HMR；不自動重載正式環境。只有 Tailnet 開發預覽停用 Webpack pack cache，降低背景預覽的記憶體峰值。Framework7 CSS 產生器只寫入有變更的檔案，避免驗證時觸發無意義的 HMR。
