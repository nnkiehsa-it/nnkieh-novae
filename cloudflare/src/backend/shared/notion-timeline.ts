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
  images?: () => Promise<NotionTimelineImage[]>;
  summary: string;
}

export interface NotionTimelineImage {
  key: string;
  upload: () => Promise<string>;
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

function timelineBlocks(entry: NotionTimelineEntry, marker = entry.eventId) {
  return [
    paragraphBlock(`[eventId: ${marker}] ${entry.summary}`),
    ...splitNotionText(entry.details ?? "").map(paragraphBlock),
  ];
}

function imageBlock(id: string) {
  return {
    object: "block",
    type: "image",
    image: { type: "file_upload", file_upload: { id } },
  };
}

async function appendBlocks(pageId: string, children: unknown[]) {
  for (let offset = 0; offset < children.length; offset += APPEND_BATCH) {
    await callNotionAPI(`/blocks/${pageId}/children`, "PATCH", {
      children: children.slice(offset, offset + APPEND_BATCH),
    });
  }
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
  let children: unknown[] = [];
  const flush = async () => {
    if (children.length === 0) return;
    await appendBlocks(pageId, children);
    children = [];
  };
  for (const entry of entries) {
    if (present.has(entry.eventId)) continue;
    if (!entry.images) {
      children.push(...timelineBlocks(entry));
      continue;
    }

    // A file upload costs several outgoing requests. Checkpoint the text and
    // every image separately so a budget boundary can resume inside one record
    // instead of re-uploading its first images forever.
    await flush();
    const images = await entry.images();
    const textMarker = `${entry.eventId}:text`;
    if (!present.has(textMarker)) {
      await appendBlocks(pageId, timelineBlocks(entry, textMarker));
      present.add(textMarker);
    }
    for (const image of images) {
      const imageMarker = `${entry.eventId}:image:${image.key}`;
      if (present.has(imageMarker)) continue;
      const id = await image.upload();
      await appendBlocks(pageId, [
        paragraphBlock(`[eventId: ${imageMarker}] ${entry.summary} · 圖片`),
        imageBlock(id),
      ]);
      present.add(imageMarker);
    }
  }
  await flush();
}
