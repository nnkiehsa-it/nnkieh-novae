import { describe, expect, it } from "vitest";

import { readNdjson } from "@/lib/ndjson";

function streamOf(chunks: Array<string | Uint8Array>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function collect(chunks: Array<string | Uint8Array>) {
  const lines: unknown[] = [];
  for await (const line of readNdjson(streamOf(chunks))) lines.push(line);
  return lines;
}

describe("newline-delimited JSON", () => {
  it("reads one object per line", async () => {
    expect(await collect(['{"a":1}\n{"a":2}\n'])).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("holds back a line split across chunks until it is complete", async () => {
    expect(await collect(['{"a":', '1}\n{"b":2', '}\n'])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("reads several lines out of one chunk and a last line without a newline", async () => {
    expect(await collect(['{"a":1}\n{"b":2}\n{"c":3}'])).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it("keeps multi-byte characters that straddle a chunk boundary", async () => {
    const encoded = new TextEncoder().encode('{"a":"陳述"}\n');
    const decoder = new TextDecoder();
    const first = decoder.decode(encoded.slice(0, 9), { stream: true });
    const rest = decoder.decode(encoded.slice(9));
    expect(await collect([first, rest])).toEqual([{ a: "陳述" }]);
  });
});
