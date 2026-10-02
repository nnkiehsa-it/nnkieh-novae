---
name: Novae 程式流程地圖
description: 層級清楚、文字好讀、流程容易追蹤的離線維護工具
colors:
  ink: "#1c2c3b"
  muted: "#526273"
  line: "#d6dfe8"
  paper: "#fcfdff"
  nav: "#f7f9fc"
  ground: "#edf1f5"
  accent: "#2359c4"
  wash: "#e8effc"
  database: "#77551e"
  async: "#336752"
  external: "#695184"
  grid: "#c5d0dc"
  connector: "#788d9f"
  dark-ink: "#e3ebf3"
  dark-muted: "#a7b7c7"
  dark-line: "#334554"
  dark-paper: "#192a37"
  dark-nav: "#142430"
  dark-ground: "#101d27"
  dark-accent: "#a0bfff"
  dark-wash: "#233c59"
  dark-database: "#dfbd80"
  dark-async: "#9fcfb8"
  dark-external: "#c9b1e2"
  dark-grid: "#2b3e4c"
  dark-connector: "#7e94a7"
typography:
  headline:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-.02em"
  title:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  summary:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "13px"
    lineHeight: 1.75
  label:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "12px"
  code:
    fontFamily: "Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1.8
rounded:
  control: "14px"
  card: "24px"
  badge: "8px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
components:
  button-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-theme:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  search-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 36px 10px 12px"
  navigation-active:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  flow-node:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
    width: "276px"
    height: "196px"
  flow-node-selected:
    backgroundColor: "{colors.wash}"
    padding: "15px"
  floating-inspector:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    width: "380px"
  source-link:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 0"
---

# Design System: Novae 程式流程地圖

## Overview

**Creative North Star: "可追蹤的程式閱讀桌"**

以「可追蹤的程式閱讀桌」組織維護資訊：目錄找內容，畫布讀相鄰步驟，浮動解說承載完整文字。層級清楚、文字好讀、流程容易追蹤，是這份工具的方向。

此系統只適用 tools/project-map。亮暗色共享語意與操作，使用系統繁體中文字型及純 DOM／SVG，保持單檔離線閱讀。產品 App 的字型、導覽與版面另由根目錄文件規範。

**Key Characteristics:**

- 目錄、流程與解說分工清楚。
- 選取、目前連線與來源使用產品主色。
- 桌面向右閱讀，手機向下閱讀。
- 鍵盤焦點與減少動態保留相同操作。

## Colors

閱讀藍配合灰藍中性色。一般 token 記錄亮色，`dark-` 記錄深色對應；map.css 透過 `data-theme` 切換 CSS 變數。

### Primary

`accent` 表示選取、目前連線、焦點與原碼來源；`wash` 是選取節點、目錄及控制回饋的淡底。

### Secondary

`database`、`async`、`external` 分別是資料庫褐、非同步綠與外部服務紫，辨識程式層級。

### Neutral

`ink` 與 `muted` 分別承載主要及次要文字；`paper`、`nav`、`ground` 是閱讀表面、目錄及畫布。`line`、`grid`、`connector` 分別提供邊界、空間及流程線索。

**The 層級辨識 Rule.** 主色表示選取、目前連線、焦點與來源；程式層級另有語意色，並保留文字名稱。

## Typography

**Body Font:** 系統 UI 字型，Microsoft JhengHei 為繁體中文後備；沒有外部字型與獨立展示字體。

**Label/Mono Font:** 路徑、原碼及識別碼使用 Consolas、monospace。

`headline` 是畫布流程標題；`title` 是節點標題；`body` 是一般控制與解說的基準；`summary` 是節點摘要；`label` 是短控制文字；`code` 是帶行號原碼。解說標題（22px／650／1.55）與工具名稱（18px／700／1.5）留在局部元件，不建立另一套展示字體。

節點標題最多兩行、摘要最多三行；畫布摘要最多兩行及 66ch，行高（1.8）。完整解說行高（1.85），有獨立捲動區；小型 metadata 不作為一般內文規則。

**The 完整閱讀 Rule.** 卡片顯示摘要，選取後在解說取得完整文字；摘要截斷不取代完整內容。

## Layout

滿視窗高度，目錄（280px）與畫布分工；目錄獨立捲動，流程標題在畫布左上，縮放固定左下。節點尺寸與內距使用 `flow-node` token；JS 的 cardSize 必須同步。

桌面一路向右（起點間距 456px），手機一路向下（起點間距 316px）。段落起點另留（100px）；各段落之間不連線，只接相鄰節點。

- **1200px 以下：** 目錄（250px）、解說（340px），隱藏畫布提示。
- **920px 以下：** 解說（360px、最大 75vw），盤點頁內距改用 `space-6`。
- **640px 以下：** 目錄是抽屜（最大 310px、88vw），解說在底部（57dvh）並留邊；縮放移到已開面板上方。

進入流程以（100%）從起點讀；「適合畫面」顯示整圖，「定位卡片」回到閱讀尺寸。原碼與盤點由同一目錄切換，不增加中央導覽。

## Elevation & Depth

底色與細框建立日常層級；柔和陰影只支撐浮動解說。亮暗桌面陰影來自 `--shadow`，手機底部面板使用短距陰影；精確值記在 sidecar。手機抽屜以半透明遮罩區隔後方畫布。

**The 浮動解說 Rule.** 解說覆蓋畫布，不改變畫布尺寸；逐步操作保留在面板內。

## Shapes

`control` 用於按鈕與搜尋；`card` 用於節點、縮放容器及解說；`badge` 用於步驟號碼。正常節點邊界（1px），選取邊界（2px）並補償內距；圖示使用圓端線條的 inline SVG。

## Components

- **按鈕：** 閱讀表面與細框，hover／active 使用淡底與主色；亮暗色控制採主色淡底。disabled 不透明度（0.45）；焦點框（2px、外移 2px）。
- **搜尋：** 可見用途標籤、細框與右側清除空間；清除後回到輸入焦點。
- **目錄：** 可展開分類及次分類，目前項目使用淡底、主色與較高字重；搜尋展開相符分類，空結果有文字提示。
- **節點與連線：** 步驟號碼、文字層級、標題與摘要；選取同步 aria-pressed、相鄰目前連線及解說。非同步線是虛線（6 5），箭頭與文字描述傳遞內容。
- **解說：** 關閉、完整內容、來源及底部逐步操作；計數持續可見。桌面右側浮動，手機底部浮動。
- **縮放與原碼：** 空白拖曳、滾輪與雙指操作；畫布聚焦時 `+`／`-` 縮放、`0` 全圖、左右鍵逐步；`Escape` 關閉手機目錄。原碼獨立捲動、保留行號，不依賴本機來源路徑。

允許動態時，定位平移（320ms）、解說揭露（280ms）、手機目錄（240ms），節點狀態（150ms）。減少動態取消位移與相機動畫，只留短底色及透明度回饋；精確值及 easing 在 sidecar。

## Do's and Don'ts

### Do:

- **Do** 依 map.css、map.js 與 template.html 維護本工具，修改後重新產生 HTML。
- **Do** 同時維護亮暗色語意、可見焦點與減少動態支援。
- **Do** 保留文字層級、完整解說及可換行的來源路徑。

### Don't:

- **Don't** 為離線工具增加外部字型、CDN 或產品 runtime。
- **Don't** 把這份局部系統延伸成產品 App 的全站規則。
