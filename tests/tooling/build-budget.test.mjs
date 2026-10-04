import assert from "node:assert/strict";
import test from "node:test";
import { measureCss, measureRouteCss, readClientManifest } from "../../scripts/build-budget-metrics.mjs";

test("font declarations are separate from UI CSS but still count toward compressed delivery", () => {
  const ui = ".card{color:black}";
  const source = '@font-face{font-family:TC;src:url(tc.woff2);unicode-range:U+4e00-9fff}' + ui;
  const measured = measureCss(source);
  assert.equal(measured.uiBytes, Buffer.byteLength(ui));
  assert.ok(measured.fontFaceBytes > 0);
  assert.ok(measured.gzipBytes > measureCss(ui).gzipBytes);
});

test("route budgets count a shared asset once and exclude styles belonging to other pages", () => {
  const assets = new Map([
    ["shared.css", { uiBytes: 100, gzipBytes: 20 }],
    ["admin.css", { uiBytes: 200, gzipBytes: 40 }],
  ]);
  const home = measureRouteCss({ route: "/home", entryCSSFiles: {
    layout: [{ path: "shared.css" }], page: [{ path: "shared.css" }],
  } }, assets);
  assert.equal(home.uiBytes, 100);
  assert.equal(home.gzipBytes, 20);
  assert.deepEqual(home.files, ["shared.css"]);
  assert.throws(() => measureRouteCss({ route: "/bad", entryCSSFiles: { page: [{ path: "missing.css" }] } }, assets), /Missing CSS asset/u);
});

test("generated client manifests are parsed without executing their JavaScript", () => {
  const manifest = readClientManifest('globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/home/page"]={"entryCSSFiles":{}}');
  assert.equal(manifest.route, "/home/page");
  assert.deepEqual(manifest.entryCSSFiles, {});
  assert.throws(() => readClientManifest("process.exit(1)"), /Unsupported Next.js/u);
});
