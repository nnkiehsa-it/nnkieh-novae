---
name: Novae
description: 以 Framework7 iOS 控制項完成校園提案、設施回報與管理工作。
colors:
  # Provider 的 primary／gray、安裝版 App 的 utility colors 與生成 CSS 的 iOS 亮暗色 token。
  primary: "#007aff"
  gray: "#8e8e93"
  native-blue: "#2196f3"
  native-red: "#ff3b30"
  page-light: "#efeff4"
  page-dark: "#000"
  surface-light: "#fff"
  surface-dark: "#1c1c1d"
  ink-light: "#000"
  ink-dark: "#fff"
  secondary-text-light: "rgba(0, 0, 0, 0.45)"
  secondary-text-dark: "rgba(255, 255, 255, 0.55)"
  separator-light: "rgba(0, 0, 0, 0.22)"
  separator-dark: "rgba(255, 255, 255, 0.15)"
typography:
  # 字型與字級均擷取自 Framework7 iOS；不另建立品牌字型。
  display:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.4
  list:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
  button:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "0"
  input:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "16px"
  label:
    fontFamily: "-apple-system, SF Pro Text, SF UI Text, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
rounded:
  button: "4px"
  input-outline: "8px"
  menu-list: "16px"
  list-inset: "24px"
  card: "24px"
  toolbar-pane: "32px"
  dialog: "32px"
  sheet: "32px"
  popover: "32px"
  fab: "50px"
spacing:
  page-gutter: "clamp(1rem, 2vw, 1.5rem)"
  page-gutter-phone: "1rem"
  list-inline: "16px"
  list-block: "12px"
  list-margin: "35px"
  card-content: "16px"
  button-inline: "10px"
  block-footer-gap: "10px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-light}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0px 10px"
    height: "34px"
  button-destructive:
    backgroundColor: "{colors.native-red}"
    textColor: "{colors.surface-light}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0px 10px"
    height: "34px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0px 10px"
    height: "34px"
  button-tonal:
    backgroundColor: "rgba(var(--f7-theme-color-rgb), 0.15)"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0px 10px"
    height: "34px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0px 10px"
    height: "34px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0px 10px"
    height: "34px"
  input-list:
    backgroundColor: "transparent"
    textColor: "var(--f7-input-text-color)"
    typography: "{typography.input}"
    padding: "0px"
    height: "40px"
  tabbar:
    backgroundColor: "var(--f7-glass-bg-color)"
    textColor: "var(--f7-tabbar-link-inactive-color)"
    typography: "{typography.label}"
    rounded: "{rounded.toolbar-pane}"
    height: "80px"
  badge:
    backgroundColor: "{colors.native-blue}"
    textColor: "{colors.surface-light}"
    padding: "0 4px"
    rounded: "20px"
    height: "20px"
  card:
    backgroundColor: "var(--f7-card-bg-color)"
    textColor: "var(--f7-text-color)"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: Novae

## Overview

**Creative North Star: "Framework7 iOS"**

Novae 的視覺依據是使用者指定的 Framework7 iOS 介面。所有裝置固定使用 iOS theme；系統字型、中性色標題、藍色操作、群組列表與原生玻璃材質共同形成操作語言。學生與管理員沿用熟悉的控制項完成既有工作，介面密度依內容及裝置調整。

此文件擷取已完成實作的共用 token，供新增畫面與維護時查閱。執行期樣式仍以安裝的 Framework7／Framework7 React 9.2.0 來源為準；生成 CSS 與此文件應隨套件升級一起更新。Next.js 保留網址與路由，產品 hooks 保留權限、草稿及資料操作責任。

**Key Characteristics:**

- 使用真正的 Framework7 iOS 元件、runtime 與上游樣式。
- 原生大標題隨 PageContent 捲動收合為置中小標題。
- 手機採 ToolbarPane 膠囊導航；桌面採原生 menu List。
- 操作列呈現名稱與目前值，群組說明放在原生 BlockFooter。
- 亮暗主題、safe area、鍵盤及 reduced motion 接合於既有產品流程。

| 來源 | 責任 |
| --- | --- |
| [framework7-provider.tsx](src/components/framework7-provider.tsx) | 固定 iOS theme、primary／gray 配色、runtime modules 與亮暗同步 |
| [framework7-ios.css](src/generated/framework7-ios.css) | 字型、字級、亮暗色、控制項尺寸、圓角、材質與動畫的擷取來源 |
| [generate-framework7.mjs](scripts/generate-framework7.mjs) | 編譯安裝版本的上游 Less；生成 CSS 不手動修改 |
| [globals.css](src/app/globals.css)、[framework7.css](src/styles/framework7.css) | 產品語意 alias、頁面 gutter、viewport、safe area 與鍵盤接合 |
| [ui](src/components/ui)、[liquid-nav.tsx](src/components/liquid-nav.tsx) | React／Next 接合與實際共用元件變體 |

維護操作與元件對照見 [Framework7 維護說明](docs/framework7.md)。外部視覺參考為 [官方 Kitchen Sink](https://framework7.io/kitchen-sink/core/?theme=ios)，數值以安裝版本為準。

## Colors

主要操作使用 iOS 藍，配合亮暗中性色；原生 utility 色與內容狀態各自保留語意。

### Primary

- **iOS 藍**（`primary`）：主要按鈕、選取控制項及目前的導航目的地。

### Secondary

- **原生徽章藍**（`native-blue`）：Badge 的預設 color-blue；它是 Framework7 utility 色，並未取代主要操作色。

### Tertiary

- **原生錯誤紅**（`native-red`）：破壞性操作及欄位錯誤。

### Neutral

- **系統灰**（`gray`）：一般 Badge 與次要原生元素。
- **頁面底色**（`page-light`／`page-dark`）：亮色淺灰與暗色黑色的主畫面。
- **群組底色**（`surface-light`／`surface-dark`）：List strong 與 Card 的內容承載面。
- **主要文字**（`ink-light`／`ink-dark`）：標題、內文與頂部圖示。
- **次要文字與分隔線**（`secondary-text-*`／`separator-*`）：目前值、紀錄 metadata、群組 footer 及原生列表分隔線。

**The Native Color Rule.** 標題繼承中性色，操作與選取使用原生主題色；不要把 domain 狀態色套成新的控制項主題。

配色來源：primary／gray 在 Provider；native-blue／native-red 來自安裝版 `framework7/components/app/app-class.js` 的預設 colors；頁面、文字、列表與 Card 的亮暗色在生成 CSS。`globals.css` 將 background、foreground、card 等產品 alias 指向對應的 Framework7 token。此文件未把每個 domain 狀態色升格成全站 palette。

## Typography

**Display Font / Body Font:** Framework7 iOS 系統字型堆疊，實際字型依作業系統解析。

標題與控制項共用系統字型，層級由原生字級、字重與結構建立。英文與繁體中文沿用同一系統，不載入獨立品牌字型。

### Hierarchy

- **Display**（`typography.display`）：Navbar large 的頁面大標題。
- **Title**（`typography.title`）：收合後的 Navbar 置中標題。
- **Body**（`typography.body`）：Framework7 基本文字；BlockFooter 沿用相同字級。
- **List**（`typography.list`）：一般列表名稱與目前值；資料紀錄可使用原生 media list 層級。
- **Button / Input**（`typography.button`／`typography.input`）：標準按鈕及 ListInput。大／小按鈕使用上游對應變體。
- **Label**（`typography.label`）：手機 Tabbar 的短標籤；Badge 與表單 label 各自保留上游字重。

來源為生成 CSS 的 Fonts & Bars、Navbar、List、Button、Input 與 Toolbar 區段。Markdown 原始編輯器保留 Vditor；內容閱讀的標題、表格及程式碼由 `globals.css` 的 markdown-body 規則負責。

## Layout

主畫面以 Framework7 Page／PageContent 承載，主要捲動容器是 PageContent。固定 Navbar host 位於捲動容器之外；Navbar 與大標題的高度由上游 token 決定，safe area 納入原生 offset。不要以文件捲動或另一套 header 計算取代這個結構。

桌面斷點為（48rem），使用固定側欄（15rem）與可縮放內容欄。手機內容 gutter 使用 `page-gutter-phone`，桌面沿用 `page-gutter`。底部導航依 route 顯示，頁面保留原生 Tabbar 高度及 safe area；手機輸入欄位取得焦點時隱藏底部導航。

列表以 inset strong dividers 組成群組，表單沿用原生列與目前值。ListSection 含 sibling BlockFooter 時，保留 List 的上游 bottom margin；BlockFooter 的負 margin 依賴這段幾何。沒有 footer 的緊密群組可由共用 wrapper 移除外距。

調整 viewport、safe area 與內容排版時保留上游控制項的尺寸、margin 關係與捲動生命週期。

## Elevation & Depth

一般列表與 Card 依底色和分隔線建立層次。Navbar／ToolbarPane 使用上游玻璃底色、blur 及 inset shadow；面板、遮罩、Smart Select 與 Photo Browser 的材質和動畫也由 Framework7 提供。原生 Card 的 raised 變體、Segmented 選取層及玻璃 shadow 都屬上游用途，不另加共用懸浮陰影。

Shadow 與 motion 擷取在 `.impeccable/design.json` 的 extensions，沒有轉成新的產品 CSS。native 控制項的按壓、標題收合與面板動畫不套用產品自訂動畫；Motion 留給圖表、反應及內容狀態。既有 reduced-motion 規則停用不必要的持續動畫及位移。

Sidecar 的八階色帶是設計面板用的 OKLCH 預覽推導，沒有新增應用程式色階。元件片段擷取上游外觀並保留 CSS variable 接合；完整互動仍由應用程式中的 Framework7 runtime 提供。

**The Native Material Rule.** 使用上游控制項的材質與動畫，保留 library runtime 對其狀態及生命週期的控制。

## Shapes

形狀由各控制項原生 token 決定：標準 Button、outline Input、menu List、inset List、Card、ToolbarPane、Dialog／Sheet／Popover 與 Fab 各保留自己的圓角。round Button 以該按鈕高度形成膠囊；Badge 以原生尺寸形成圓形或短膠囊。不要用單一產品 radius 覆蓋所有元件。

## Components

### Buttons

`Button` 的 default、destructive、outline、secondary、ghost、link 分別接到原生 fill、red fill、outline、tonal、一般 Button 與 Link。標準、大、小、round 及 icon 尺寸使用上游變體；disabled、busy、表單屬性與可及名稱由共用 wrapper 接合。Dialog 內的按鈕沿用原生 dialog-button 結構。

### Lists / Cards / Badges

設定與操作以 List、ListItem、BlockTitle、BlockFooter 組成；只在資料紀錄需要作者、時間、狀態或預覽時使用 media list。操作列不加 description subtitle，整組說明放 footer。Card、Badge 保留 Framework7 形狀與顏色；domain 狀態徽章繼續表達既有業務狀態。

### Inputs / Selection / Search

一般欄位使用 Input／ListInput，長內容保留 Textarea；開關使用 Toggle，短選擇使用 Smart Select 或原生 radio。搜尋以 Navbar expandable Searchbar 提供展開與取消，管理資料查找使用 inline Searchbar。焦點、錯誤、disabled、選取與取消保留原生狀態及產品回呼。

### Navigation

Navbar large 依原生 scroll lifecycle 收合成置中小標題；頂部操作使用固定原生 icon-only Link。feed 目的地與篩選使用 Subnavbar／Segmented。手機主導航使用 Toolbar、ToolbarPane、tabLink 與官方滑動選取背景；桌面使用 menu List。新增操作是只有圖示的 Fab，亮色黑底白圖示、暗色白底黑圖示。

### Overlays / Feedback / Content

手機操作選單使用 Actions，桌面錨點選單使用 Popover；詳情、編輯與短選擇使用 Popup／Sheet，確認與即時回饋使用 Dialog／Toast。Preloader、Progressbar、SkeletonBlock 表達真實載入狀態。關閉按鈕、Escape、遮罩與原生手勢經過同一個離開 guard；面板開啟時保留最上層焦點與背景隔離。

圖片使用 Photo Browser／Swiper zoom，留言輸入使用 Messagebar，處理紀錄使用上游 Timeline 結構。Markdown 原始內容維持 Vditor；產品圖表、reactions 與內容排版保留其領域用途。

## Do's and Don'ts

### Do:

- **Do** 優先使用 Framework7 對應元件、runtime plugin 與上游 iOS 樣式。
- **Do** 保留 Next 網址、權限、草稿、資料操作及返回後的來源列表位置。
- **Do** 將群組說明放在 BlockFooter，並保留它依賴的 List bottom margin。
- **Do** 同時確認亮暗色、手機／桌面、長文字、safe area、鍵盤及 reduced motion。
- **Do** 隨 Framework7 升級重新生成 CSS，並核對本文件與 sidecar 的擷取值。

### Don't:

- **Don't** 自寫一套原生控制項的邊框、圓角、玻璃材質、按壓或面板動畫。
- **Don't** 把頁面標題改成藍色，或在設定操作列加入 description subtitle。
- **Don't** 在原生 Fab 加文字標籤，或以自訂 Tabbar／header 取代原生結構。
- **Don't** 直接修改生成 CSS，或讓這份 token 擷取成為另一套執行期樣式來源。
- **Don't** 重新加入已移除的 HeroUI、Radix UI、Sonner、tw-animate-css、HarmonyOS 字型或未使用的 Typography plugin。
