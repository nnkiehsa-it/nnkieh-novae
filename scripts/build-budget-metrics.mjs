import { gzipSync } from "node:zlib";
import postcss from "postcss";

export function measureCss(source) {
  const parsed = postcss.parse(source);
  let fontFaceBytes = 0;
  parsed.walkAtRules("font-face", (rule) => {
    fontFaceBytes += Buffer.byteLength(rule.toString());
    rule.remove();
  });
  return {
    rawBytes: Buffer.byteLength(source),
    gzipBytes: gzipSync(source, { level: 9 }).length,
    uiBytes: Buffer.byteLength(parsed.toString()),
    fontFaceBytes,
  };
}

// Read the generated Next.js assignment as JSON; never execute build output.
export function readClientManifest(source) {
  const assignment = source.match(/globalThis\.__RSC_MANIFEST\[(".*?")\]\s*=\s*(\{[\s\S]*\})\s*;?\s*$/u);
  if (!assignment) throw new Error("Unsupported Next.js client reference manifest format.");
  return { route: JSON.parse(assignment[1]), ...JSON.parse(assignment[2]) };
}

export function measureRouteCss({ route, entryCSSFiles }, assets) {
  const files = [...new Set(Object.values(entryCSSFiles).flat().map((entry) => entry.path))];
  let uiBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const asset = assets.get(file);
    if (!asset) throw new Error(`Missing CSS asset for ${route}: ${file}`);
    uiBytes += asset.uiBytes;
    gzipBytes += asset.gzipBytes;
  }
  return { route, files, uiBytes, gzipBytes };
}
