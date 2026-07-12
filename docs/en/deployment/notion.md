# Notion setup

[繁體中文](../../deployment/notion.md) · [Deployment overview](../deployment-guide.md)

Novae writes an operational copy to Notion. It is not the primary database and is not a disaster-recovery backup.

1. Create a [Notion](https://www.notion.so/signup) workspace owned by an account the school can retain.
2. Create a full-page table database named `Novae operations`. Keep its default title property; Novae adds required date and select properties during synchronization. Do not use a linked or wiki database.
3. Open [Notion integrations](https://www.notion.so/profile/integrations), create an internal `Novae production` integration in the same workspace, and grant only content read/insert/update capabilities.
4. Copy its internal integration secret to `NOTION_TOKEN`.
5. Open the original database, choose **Share / Connections / Add connections**, and add the integration. Creating an integration alone does not grant page access.
6. From the original database URL, copy the 32 hexadecimal characters after the page name and before `?` into `NOTION_DATABASE_ID`. Do not paste the full URL, a view ID, or a normal page ID.

See [Notion authentication](https://developers.notion.com/reference/authentication) and [working with databases](https://developers.notion.com/guides/data-apis/working-with-databases).

`NOTION_VERSION` is optional. Omit it so the current workflow uses its tested `2022-06-28` default; do not independently switch API versions without compatibility testing.

Next: [Upstash](upstash.md).
