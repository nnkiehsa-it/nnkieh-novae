import {
  callNotionAPI,
  fetchAllBlockChildren,
  getBlockPlainText,
  splitNotionText,
} from "./notion-api.ts";

/**
 * A moment on a page's timeline: what it says, and the marker that identifies
 * it so the same moment is never written onto the page twice.
 *
 * The images are a function rather than a list because resolving them costs
 * requests of its own, and an entry the page already carries must not pay for
 * pictures nobody will read.
 */
export interface NotionTimelineEntry {
  details?: string;
  eventId: string;
  images?: () => Promise<string[]>;
  summary: string;
}

const TIMELINE_MARKER = /\[eventId: ([^\]]+)\]/u;
/** Notion accepts a hundred children per append; everything else is a round trip. */
const APPEND_BATCH = 100;

function paragraphBlock(content: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: content.slice(0, 2000) } }] },
  };
}

async function timelineBlocks(entry: NotionTimelineEntry) {
  const images = entry.images ? await entry.images() : [];
  return [
    paragraphBlock(`[eventId: ${entry.eventId}] ${entry.summary}`),
    ...splitNotionText(entry.details ?? "").map(paragraphBlock),
    ...images.map((id) => ({
      object: "block",
      type: "image",
      image: { type: "file_upload", file_upload: { id } },
    })),
  ];
}

/**
 * Writes the entries a page is missing, in as few requests as Notion allows.
 *
 * Every entry used to be written on its own: the page's whole contents read
 * back to see whether the marker was there, the block appended, then the whole
 * contents read back again to prove it. A proposal with two hundred comments
 * therefore cost over a thousand requests, more than a Worker invocation is
 * allowed to make, so rebuilding a busy archive was refused with "Too many
 * subrequests" in the middle of a page rather than finishing it. The page is
 * read once here, and everything it is missing goes up a hundred blocks at a
 * time -- the same proposal in four requests instead of a thousand.
 */
export async function writeNotionTimeline(
  pageId: string,
  entries: NotionTimelineEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const present = new Set<string>();
  for (const block of await fetchAllBlockChildren(pageId)) {
    const found = TIMELINE_MARKER.exec(getBlockPlainText(block));
    if (found) present.add(found[1]);
  }
  const children: unknown[] = [];
  for (const entry of entries) {
    if (present.has(entry.eventId)) continue;
    children.push(...(await timelineBlocks(entry)));
  }
  for (let offset = 0; offset < children.length; offset += APPEND_BATCH) {
    await callNotionAPI(`/blocks/${pageId}/children`, "PATCH", {
      children: children.slice(offset, offset + APPEND_BATCH),
    });
  }
}
