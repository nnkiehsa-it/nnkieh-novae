import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/render-markdown";

describe("untrusted Markdown rendering", () => {
  it("strips inline images so attachments render only through reviewed presentation", () => {
    const html = renderMarkdown("![alt](https://cdn.example/photo.png)");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("cdn.example");
  });

  it("strips raw HTML image and script injection", () => {
    const html = renderMarkdown(
      '<img src=x onerror="alert(1)"><script>alert(2)</script>Body',
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("Body");
  });

  it("keeps ordinary Markdown structure and links intact", () => {
    const html = renderMarkdown("# Title\n\nA [link](https://example.org) and **bold**.");
    expect(html).toContain("<h1");
    expect(html).toContain('href="https://example.org"');
    expect(html).toContain("<strong>bold</strong>");
  });
});
