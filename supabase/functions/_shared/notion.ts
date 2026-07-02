import { requireEnv } from "./env.ts";

export async function markNotionPageDeleted(pageId: string) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${requireEnv("NOTION_TOKEN")}`,
      "Content-Type": "application/json",
      "Notion-Version": requireEnv("NOTION_VERSION"),
    },
    body: JSON.stringify({
      properties: {
        狀態: {
          select: {
            name: "已刪除",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Notion deleted mark failed: ${response.status} ${await response.text()}`);
  }
}
