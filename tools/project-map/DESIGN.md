---
name: Novae 程式流程地圖
description: 單一離線 HTML 的極簡程式閱讀工具
colors:
  ink: "#1e2934"
  muted: "#596570"
  line: "#d9dfe5"
  paper: "#fff"
  ground: "#f5f7f9"
  accent: "#2359c4"
  wash: "#edf3ff"
typography:
  body: {fontFamily: 'system-ui, "Microsoft JhengHei", sans-serif', fontSize: "14px"}
  code: {fontFamily: "Consolas, monospace"}
rounded: {control: "14px", card: "24px"}
spacing: {card: "14px", panel: "20px"}
---
# Design System: Novae 程式流程地圖
## Overview
以 Read 為方向：白底、中性文字、藍色選取、基本卡片與 SVG 連線。此文件只描述 `template.html` 的離線工具，不規範 Novae 產品介面；產生方式與快照範圍見 `README.md`。
## Colors
主色 accent 表示選取與可開啟來源；wash 用於選取底色。paper 是面板，ground 是介面底色；ink、muted 與 line 分別承載主要文字、次要文字與邊界。圖例另以褐色和綠色辨識資料庫與背景工作。
## Typography
使用系統繁體中文字型，原碼與路徑使用等寬字。桌面主標題（20px）、流程標題（19px）、卡片標題（15px），次要文字（12px）；段落行高（1.75）。
## Layout
滿視窗高度；桌面為目錄（280px）與可縮放畫布。解說是右側浮動面板（380px），不佔 flex 寬度；1200px 以下目錄為 250px、解說為 340px。640px 以下目錄是抽屜，解說浮在底部，四周有留白，高度 57dvh。所有卡片桌面一路向右、手機一路向下，不採蛇形排列。
## Elevation & Depth
卡片以細框與底色分區；浮動解說有柔和下落陰影與 24px 圓角，叉叉可關閉。側欄選項、縮放與來源保持簡單控制。
## Shapes
卡片使用 24px 圓角與固定尺寸（276 × 176px），一般按鈕與輸入使用 14px 圓角。連線有箭頭，非同步連線用虛線，跨節點關係繞過卡片。
## Components
- 卡片：內距使用 card；選取時藍色雙像素框與淡藍底，同步更新解說和步驟計數。
- 縮放：進入流程以 100% 顯示起點；「適合畫面」依畫布大小縮放置中，「定位卡片」恢復閱讀大小。空白拖曳、滾輪、雙指與加減按鈕共用畫布變換。
- 導覽：所有分類／事件從左側選；上／下一步僅在浮動解說，來源按鈕在解說內開啟原碼。
- 動態：選取／定位時畫布以 320ms 平滑平移；面板以 280ms 淡入揭露。減少動態時保留輕微顏色與透明度回饋。
- 鍵盤：畫布聚焦時 `+`／`-` 縮放、`0` 全圖、左右鍵切換步驟；`Escape` 關閉手機目錄。互動元素保留清晰焦點框；動態僅在允許 motion 時啟用。
## Do's and Don'ts
- Do：以 `template.html` 為視覺來源，保留閱讀大小、固定操作位置及響應式分區；修改後重跑產生器。
- Don't：不要為此工具增加外部字型、CDN 或服務依賴，也不要將其樣式當成 Novae 全站設計規則。
