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

export function measureJs(source) {
  return { rawBytes: Buffer.byteLength(source), gzipBytes: gzipSync(source, { level: 9 }).length };
}

/**
 * What a screen downloads before it draws: the page entry, the screen's own
 * lazy chunks, and every chunk they import statically, each counted once.
 * Dynamic imports inside them (an editor, a dialog) are left out, since they
 * load only when used.
 */
export function routeClosure(manifest, entries) {
  const js = new Set();
  const css = new Set();
  const walk = (key) => {
    const chunk = manifest[key];
    if (!chunk) throw new Error(`The build has no chunk for ${key}.`);
    if (js.has(chunk.file)) return;
    js.add(chunk.file);
    for (const file of chunk.css ?? []) css.add(file);
    for (const imported of chunk.imports ?? []) walk(imported);
  };
  for (const entry of entries) walk(entry);
  return { css: [...css], js: [...js] };
}

export function measureRoute({ route, entries }, manifest, assets) {
  const { css, js } = routeClosure(manifest, entries);
  const total = { cssGzipBytes: 0, jsBytes: 0, jsGzipBytes: 0, uiBytes: 0, gzipBytes: 0 };
  for (const file of css) {
    const asset = assets.css.get(file);
    if (!asset) throw new Error(`Missing CSS asset for ${route}: ${file}`);
    total.uiBytes += asset.uiBytes;
    total.gzipBytes += asset.gzipBytes;
  }
  for (const file of js) {
    const asset = assets.js.get(file);
    if (!asset) throw new Error(`Missing JS asset for ${route}: ${file}`);
    total.jsBytes += asset.rawBytes;
    total.jsGzipBytes += asset.gzipBytes;
  }
  return { route, files: css, scripts: js, ...total };
}
