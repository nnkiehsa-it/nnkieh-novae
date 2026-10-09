# Framework7 前端維護

Novae 的介面使用 Framework7 9.2.0，所有裝置固定採用 iOS theme。Next.js 保留路由、分享網址、攔截式詳情面板與部署流程；Framework7 負責元件樣式、面板、提示訊息與主題呈現。資料服務、登入、權限、草稿與樂觀更新仍由原本的 domain hooks 管理。

## 修改位置

- `src/components/framework7-provider.tsx`：安裝實際使用的執行模組、建立 App／View，並同步亮暗主題。View 停用 Framework7 router，連結交由 Next.js 處理。
- `src/components/ui/`：共用控制項使用 Framework7 元件或官方 HTML 結構。原生 button／input 保留標準表單屬性、鍵盤事件與 ref，避免通用屬性在第三方 React wrapper 中遺失。
- `modal-context.tsx`：受控與非受控的開關，以及離開前的草稿／分享 guard。
- `modal-surface.tsx`：Framework7 面板生命週期、關閉後卸載、焦點與來源頁面位置。
- `use-sheet-dismiss.ts`：下拉關閉也經過同一個 guard。
- `src/lib/toast.ts`：成功、錯誤與提示訊息共用 Framework7 Toast，文字先轉義再交給函式庫。
- `scripts/generate-framework7.mjs`：只編譯使用中的 iOS 核心與元件，保留亮暗色。不要直接修改生成 CSS。
- `src/styles/framework7.css`：Framework7 與 Next.js 的捲動、safe area、面板及產品 token 整合。

## 更新函式庫

```powershell
bun add framework7@版本 framework7-react@相同版本
bun run generate:all
bun run verify:local
bun run test:e2e
```

兩個 Framework7 套件保持相同版本。Less 僅作為產生樣式的開發依賴，`verify:generated` 會重新產生並確認 CSS 沒有落後。新增元件前，先確認是否需要 JavaScript 模組；靜態控制項通常只需要樣式與標準 HTML 結構。

HeroUI、Radix UI、Sonner、tw-animate-css 已移除。動畫使用 Framework7 與既有 Motion／motion token，不再保留第二套舊面板動畫。

## 控制項選擇

詳細頁與編輯工作使用 Popup，短選擇使用 Sheet Modal；手機操作選單使用 Actions，桌面錨點選單使用 Popover。不可逆操作使用 Dialog 明確確認，開關使用 Toggle，互斥檢視使用 Segmented，主要目的地使用 Tabbar。表單取消、下拉關閉與返回都保留原本的草稿及離開前檢查。

Next.js 維持文件捲動，彈出介面與遮罩固定在可見視窗；桌面 Popover 保留 Framework7 根據錨點計算的位置。樣式生成省略未使用的 Material theme、路由動畫與 Block，避免與既有 Tailwind utility 衝突。
