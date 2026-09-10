import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

/**
 * Renders untrusted Markdown to sanitized HTML. Inline images are forbidden so
 * that attachments render only through the reviewed DecodedImage presentation.
 */
export function renderMarkdown(content: string) {
  const raw = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ["loading", "fetchpriority", "decoding"],
    FORBID_TAGS: ["img"],
  });
}
