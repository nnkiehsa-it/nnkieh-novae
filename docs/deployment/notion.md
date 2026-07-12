# Notion：建立營運副本

[English](../en/deployment/notion.md) · [回到部署總覽](../deployment-guide.md)

Novae 把提案、公告與處理狀態同步到 Notion，方便校方瀏覽。Notion 是營運副本，不是唯一資料庫，也不能代替 Supabase 備份。

## 1. 註冊與準備 workspace

1. 到 [Notion](https://www.notion.so/signup) 建立帳號與 workspace。
2. 建議使用由學校可接手的帳號，不要只綁即將畢業學生的私人信箱。
3. 在 workspace 建立一個新的完整頁面，輸入 `/database`，選擇 **Table – Full page**，命名 `Novae 營運副本`。
4. 保留預設 title 欄即可；Novae 會在同步時建立需要的日期／選項欄位。不要使用 linked database 或 wiki database。

## 2. 建立 internal integration

1. 開啟 [Notion integrations](https://www.notion.so/profile/integrations)；若介面導向 Developer portal，選相同 workspace。
2. 按 **New integration / New connection**，名稱填 `Novae production`。
3. Type 選 Internal，只給需要的 content read、insert、update 能力，不需要公開 OAuth。
4. 建立後複製 Internal Integration Secret／token 到 `NOTION_TOKEN`。token 儲存後可能不再完整顯示。

官方參考：[Notion authentication](https://developers.notion.com/reference/authentication)。

## 3. 把原始 database 分享給 integration

1. 回到 `Novae 營運副本` 的「原始 database」頁面。
2. 右上角 **Share** 或 `•••` → **Connections / Add connections**。
3. 搜尋並選 `Novae production`，確認授權。

只建立 integration 不代表它能讀任何頁面；漏掉這步通常會得到 `object_not_found`。若你看到的是 linked view，先開啟它指向的原始 database 再分享。官方參考：[Working with databases](https://developers.notion.com/guides/data-apis/working-with-databases)。

## 4. 找到 database ID

1. 在瀏覽器開啟原始 database，複製網址。
2. URL 中資料庫名稱後、`?` 前會有 32 個十六進位字元，例如：

```text
https://www.notion.so/workspace/Novae-0123456789abcdef0123456789abcdef?v=...
                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

3. 將這 32 字元（有沒有連字號都可）填 `NOTION_DATABASE_ID`。不要填 view ID、整個 URL 或一般頁面 ID。

## 5. Notion-Version

目前 workflow 在未建立 `NOTION_VERSION` secret 時使用 `2022-06-28`，最穩妥做法是先不要建立這個 optional secret。版本升級需要配合程式相容性測試，不要因官方文件顯示較新日期就單獨改值。

## 完成檢查

- token 與 database 位於同一 workspace。
- 原始 database 已明確加入 connection。
- database ID 是 32 字元 ID，不是整個 URL。
- 了解刪除 Notion 資料不會刪除 Supabase 主資料，反之 Notion 也不是備份。

下一步：[設定 Upstash](upstash.md)。
