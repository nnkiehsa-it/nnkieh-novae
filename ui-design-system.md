# Novae 前端 UI 設計系統與元件復用規範

本文件是 Novae 主程式前端的實作契約。新增頁面、元件或視覺樣式前，先依本文件選用既有能力；公開網站、完整產品文件與更新紀錄仍由 `tavricccc/novae-website` 維護。

## 目標

- 新頁面以組裝既有元件為主，不重新發明按鈕、卡片、列表、Dialog 或 viewport。
- 相同互動在手機與桌面共用狀態和事件，只切換 layout。
- 顏色、圓角、陰影、間距與互動狀態由 design token 或 UI primitive 統一管理。
- 元件責任清楚，資料存取、流程、純函式與畫面分層。
- 新增共用能力時同時補文件、架構規則與驗證，避免設計系統再次分裂。

## 單一來源

| 能力 | 單一來源 |
| --- | --- |
| 色彩、圓角、動效、陰影變數 | `src/styles/base.css` |
| surface、viewport、list、dropdown、Dialog、editor、skeleton | `src/styles/primitives.css` |
| 按鈕、欄位與控制項 | `src/styles/controls.css` |
| 無業務 UI 元件 | `src/components/ui/` |
| 元件與模組位置 | `structure.md` |
| 自動防回歸規則 | `scripts/check-ui-primitives.mjs`、`tests/architecture.test.mjs` |

領域元件不得另建一套近似的卡片、按鈕、陰影或 viewport 樣式。若既有 primitive 缺少合理 variant，優先擴充原元件。

## Atomic Design 分層

依賴方向固定為：

```text
atoms → molecules → organisms → domain components / views
```

低層不得 import 高層；`molecules` 不得 import `organisms`。同層可以組合，但要避免循環依賴。

### Atoms

最小且可獨立描述的視覺或互動單位，不讀取 session、service 或業務資料。

常用元件：

- `AppButton`：所有基礎按鈕；variant 包含 primary、secondary、danger、icon、pill、toolbar、contextual。
- `AppIcon`：圖示入口。
- `IconTile`：帶 tone、size 與 control/card elevation 的圖示容器。
- `TagBadge`：狀態或分類標籤。
- `SwitchIndicator`：switch 的視覺與 ARIA 狀態。
- `InlineAlert`：有框線與背景的 info、success、warning、error 訊息。
- `InlineMessage`：表單附近的精簡 error、warning、success、muted 訊息。
- `CharacterCount`：字數與警戒狀態。
- `SkeletonBlock`：統一 shimmer、明暗底色與 `aria-hidden`。
- `ImageRemoveButton`：圖片右上角移除控制。
- `LoadingSpinner`、`BusyButtonContent`、`SelectionMark`、`UserAvatar`、`BrandMark`。

Atoms 可以接受語意、狀態與外觀 props，但不應知道「提案」、「設備」、「通知」等領域概念。

### Molecules

由 atoms 或純 HTML 組成，可在多個局部情境獨立復用。

| 情境 | 優先使用 |
| --- | --- |
| 卡片、控制框、浮動層、內嵌區、列表外殼 | `SurfacePanel` |
| 編輯器邊框、底色與陰影 | `EditorSurface` |
| 編輯模式提示與操作 | `EditorModeBar` |
| 列表列 | `ListSurfaceRow`、`IconListRow` |
| 有標題的列表區 | `LabeledListSection` |
| 頁面或區塊標題 | `SectionHeader` |
| 多步驟流程的小節標題與步驟編號 | `WorkflowStepHeader` |
| 字數限制輸入 | `CountedTextField`、`CountedTextareaField` |
| Dialog 標題與描述 | `DialogHeading` |
| Dialog 底部操作 | `DialogActionRow` |
| Dropdown | `DropdownMenu`、`DropdownPanel` |
| 選取控制 | `SelectionOptionButton`、`PillSegmentedControl` |
| 空狀態與載入失敗 | `EmptyStatePanel`、`PageLoadFailure` |
| 分頁載入 | `FeedLoadMoreControl` |
| 詳情操作 | `DetailActionButton`、`DetailActionGroup` |

### Organisms

可直接供 route view 或領域元件填入資料、props 與 slots 的完整區塊。

| 情境 | 優先使用 |
| --- | --- |
| 路由頁骨架 | `RoutePageFrame`、`ViewportFrame` |
| Dialog 行為外殼 | `DialogShell` |
| 卡片列表 | `ContentCardCollection`、`ContentCardShell`、`ContentListState` |
| 詳情頁 | `DetailRouteState`、`DetailPageShell` |
| 共用 skeleton | `ContentCardSkeleton`、`SkeletonDetail`、`SkeletonDashboard`、`SkeletonCommentList` |
| 建立／編輯內容 | `EntryComposerShell`、`MarkdownImageEditor`、`VisualTableEditor` |
| 狀態轉換流程 | `StatusTransitionDialog` |

Organism 可以管理完整 UI 流程，但資料存取仍放在 composable 或 service。領域差異優先透過 props、slots 與 callbacks 注入。

## Surface 與陰影規範

只使用三階 elevation：

| Token / class | 用途 |
| --- | --- |
| `--shadow-control` / `shadow-control` | 按鈕、欄位、icon tile、小型互動控制 |
| `--shadow-card` / `shadow-card` | 內容卡片、較大型穩定表面 |
| `--shadow-floating` / `shadow-floating` | Dropdown、toast、浮動導覽與最上層浮動表面 |

禁止：

- 任意 `shadow-[...]`。
- 建立 `shadow-note`、`shadow-elevated` 等第四套名稱。
- 在領域元件重複拼 `rounded + border + background + shadow` 形成卡片。
- 為了「看起來接近」而混用 control、card、floating elevation。

`SurfacePanel` 選型：

| variant | 使用時機 |
| --- | --- |
| `card` | 一般內容卡、區塊、Dialog 內容表面 |
| `control` | 欄位或小型互動容器 |
| `floating` | toast、feedback、浮動內容 |
| `inset` | 卡片內的次層資料區或 grouped content |
| `list` | 一組連續 list rows |

使用 `padding="sm|md|lg"` 取得統一內距；不要在多個頁面複製同一組 padding。

```vue
<SurfacePanel as="section" padding="lg">
  <SectionHeader
    heading-as="h2"
    :title="t('dashboard.summary')"
    :description="t('dashboard.summaryHelp')"
  />
  <!-- content -->
</SurfacePanel>
```

## 新頁面組裝順序

1. 用 `RoutePageFrame` 決定 flow/fill、padding 與 bottom safe area。
2. 先找現有 organism 是否已涵蓋列表、詳情、Dialog、Composer 或 loading state。
3. 用 molecules 組成頁面區塊，例如 `SurfacePanel`、`SectionHeader`、`LabeledListSection`。
4. 最後才用 atoms 填按鈕、標籤、訊息、icon 與 skeleton。
5. 頁面級狀態和 route 組裝留在 `views/`；流程移到 composable；資料邊界只經 service。

```vue
<template>
  <RoutePageFrame padding="responsive" bottom-safe>
    <SectionHeader
      heading-as="h2"
      :title="t('example.title')"
      :description="t('example.description')"
    >
      <template #trailing>
        <AppButton variant="primary" @click="openComposer">
          {{ t('example.create') }}
        </AppButton>
      </template>
    </SectionHeader>

    <ContentListState
      panel-key="example-list"
      :loading="loading"
      :loading-more="loadingMore"
      :loading-has-problem="loadingHasProblem"
      :empty="items.length === 0"
      :error="error"
      :has-more="hasMore"
      :empty-title="t('example.empty')"
      :error-title="t('example.loadFailed')"
      :problem-title="t('example.loadTimeout')"
      :problem-description="t('example.loadTimeoutHelp')"
      @retry="reload"
      @load-more="loadMore"
    >
      <template #loading>
        <SkeletonBlock as="div" class="h-32 rounded-xl" />
      </template>

      <SurfacePanel
        v-for="item in items"
        :key="item.id"
        as="article"
        padding="md"
      >
        <!-- domain content -->
      </SurfacePanel>
    </ContentListState>
  </RoutePageFrame>
</template>
```

Route view 不得自行加入另一套頁面級 `px-*`、`left-*`、`right-*`、safe-area 計算或 max-width。這些由 `AppShell`、`ViewportFrame` 與 `RoutePageFrame` 負責。

## Dialog 規範

所有 Dialog 都使用：

- `DialogShell`：overlay、surface、focus trap、body scroll lock、ARIA、dismiss 與 persistent 行為。
- `DialogHeading`：eyebrow、title、description、heading level 與 ID。
- `DialogActionRow`：底部操作排列。
- `AppButton`：操作按鈕。

```vue
<DialogShell
  :open="open"
  :busy="saving"
  labelled-by="example-dialog-title"
  described-by="example-dialog-description"
  @close="emit('close')"
>
  <DialogHeading
    heading-as="h2"
    title-id="example-dialog-title"
    description-id="example-dialog-description"
    :title="t('example.dialogTitle')"
    :description="t('example.dialogDescription')"
  />

  <!-- dialog body -->

  <DialogActionRow>
    <AppButton variant="secondary" :disabled="saving" @click="emit('close')">
      {{ t('common.cancel') }}
    </AppButton>
    <AppButton variant="primary" :disabled="saving" @click="submit">
      <BusyButtonContent :busy="saving" :label="t('common.confirm')" />
    </AppButton>
  </DialogActionRow>
</DialogShell>
```

不要直接組 `DialogOverlay`、手動鎖 body scroll、另寫 focus trap，或在領域 Dialog 使用 `dialog-title`、`dialog-description`、`dialog-actions` class。

## 表單與回饋

- 有最大字數的單行／多行輸入使用 `CountedTextField` 或 `CountedTextareaField`。
- 有框線背景、需要被注意的訊息使用 `InlineAlert`。
- 欄位附近的簡短錯誤或狀態使用 `InlineMessage`。
- 非同步按鈕內容使用 `BusyButtonContent`，避免各頁自行排列 spinner 與文字。
- 可見文字全部使用 i18n key；不要在 template 寫固定使用者文案。
- 邊界資料先視為 `unknown` 並正規化，不讓 `any` 穿透 UI props。

## 列表、卡片與狀態

- grouped list 使用 `SurfacePanel variant="list"` 搭配 `ListSurfaceRow`。
- 帶 icon 的設定列優先 `IconListRow`；帶小節標題時使用 `LabeledListSection`。
- 提案、公告、設備類內容列表先檢查 `ContentCardCollection` 與 `ContentCardShell` 的 slots。
- loading 使用現有 skeleton organism 或 `SkeletonBlock`，不可自行指定 shimmer 底色。
- empty/error/loading 分支優先 `ContentListState`、`EmptyStatePanel`、`PageLoadFailure`。
- 相同資料在手機與桌面只切 layout，不建立第二份 fetching、permission 或 mutation 流程。

## 響應式與互動規範

- viewport 左右留白只由 `AppShell`／`ViewportFrame` 管理。
- route page 只透過 `RoutePageFrame` 設定 layout、padding、bottom safe。
- 手機與桌面共用同一份互動狀態；避免各自維護 selected、open、loading 或 error。
- 互動元件必須保留適當的 label、`aria-label`、`aria-expanded`、`aria-live`、alt 與鍵盤行為。
- 互動狀態只有一個 source of truth，不以 CSS 狀態和 Vue state 各維護一份。

## 何時抽共用

應抽共用：

- 相同 UI 或流程出現至少兩次，差異只在字串、icon、狀態、slot 或 callback。
- 元件同時處理讀取、權限、流程與大型 template；流程先進 composable，再拆展示。
- 相同 `rounded + border + background + shadow` 或 Dialog/list/control 結構再次出現。
- 某個行為包含 ARIA、focus、scroll lock、loading 等容易漏掉的契約。

不應抽共用：

- 只有一個呼叫點、數行即可讀懂的簡單片段。
- 兩個畫面只有視覺相近，但資料語意、互動或生命週期不同。
- 需要大量布林 props 才能勉強共用；這通常表示責任邊界不對。
- 為了繞過 `check:ui` 而包一層沒有清楚 API 的元件。

檔案接近 250 行時檢查責任；超過 400 行必須能說明保留單檔的理由。拆分後刪除舊 props、CSS、transition 與相容殘留。

## 新增或擴充 UI primitive

新增前依序確認：

1. 是否已有元件能用 props、slots 或 callback 擴充。
2. 是否有至少兩個合理使用點。
3. 它應屬於 atom、molecule 或 organism 哪一層。
4. props 是否描述語意，而不是把一串 class 搬到呼叫端。
5. 是否涵蓋 light/dark、disabled、loading、focus、hover、keyboard 與 ARIA。
6. 是否只使用既有 color、radius、motion 與三階 shadow token。

完成時必須：

- 將元件放進正確的 `src/components/ui/<tier>/`。
- 將通用視覺契約放進 `primitives.css` 或既有共用樣式，不放在領域 scoped CSS。
- 至少遷移兩個使用點，刪除舊實作。
- 更新本文件及 `structure.md`。
- 在 `scripts/check-ui-primitives.mjs` 加入能阻止手刻回歸的規則。
- 在 `tests/architecture.test.mjs` 驗證元件契約與代表性使用點。
- 執行 unused 與完整本機驗證。

## 禁止事項

- 不在 `components/ui/` 使用 service、session 或業務資料。
- 不讓 view 或 domain component 直接查 Supabase table 或自組 backend action。
- 不從 `@/components/ui/Component.vue` flat path import；必須包含 atomic tier。
- 不手刻基礎 button、dropdown、badge、card、list、switch、Dialog 或 skeleton。
- 不在 route view 自行管理 viewport gutter。
- 不建立任意陰影或第四階 elevation。
- 不複製只差 props／slots／callback 的近似元件。
- 不用例外或忽略規則繞過 `check:ui`。
- 不因 UI 重構改路由名、table、RPC、RLS、Edge action、Storage path 或部署設定。

## 命名與型別

- Vue 元件使用 PascalCase；composable 使用 `useXxx`。
- Props、emits、request、response 都要有明確型別。
- 共用 union、label 與狀態移到 `types/` 或 constants。
- 魔法數字使用具名常數。
- 元件 API 優先用 `variant`、`tone`、`size`、`padding`、`interactive` 等穩定語意，不暴露內部 class 名稱。

## 新 UI 交付檢查清單

- [ ] 已先搜尋 `src/components/ui/`，沒有重複既有元件。
- [ ] Atomic tier 與依賴方向正確。
- [ ] 頁面使用 `RoutePageFrame`，沒有自行建立 viewport gutter。
- [ ] Surface、按鈕、列表、Dropdown、Dialog、表單與 skeleton 使用既有元件。
- [ ] 陰影只使用 control、card、floating。
- [ ] 手機與桌面共用資料流與互動狀態。
- [ ] 可見文字已進 i18n。
- [ ] ARIA、label、alt、focus 與 keyboard 行為完整。
- [ ] 新 primitive 有至少兩個使用點，文件與架構規則已同步。
- [ ] 搬移、新增或刪除檔案已更新 `structure.md`。
- [ ] 已清除舊 API、CSS、未使用宣告與相容殘留。
- [ ] `npm run verify:local` 通過。

後端 action、權限、RPC、RLS、migration、worker 也有變更時，另跑 `npm run verify:integration`；大型交付前使用 `npm run verify:all`。
