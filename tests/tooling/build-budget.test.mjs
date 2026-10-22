import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { measureCss, measureRoute, routeClosure } from "../../scripts/build-budget-metrics.mjs";

test("font declarations are separate from UI CSS but still count toward compressed delivery", () => {
  const ui = ".card{color:black}";
  const source = '@font-face{font-family:TC;src:url(tc.woff2);unicode-range:U+4e00-9fff}' + ui;
  const measured = measureCss(source);
  assert.equal(measured.uiBytes, Buffer.byteLength(ui));
  assert.ok(measured.fontFaceBytes > 0);
  assert.ok(measured.gzipBytes > measureCss(ui).gzipBytes);
});

const manifest = {
  "index.html": { file: "assets/index.js", css: ["assets/index.css"], imports: ["_vendor.js"], dynamicImports: ["src/home.tsx", "src/admin.tsx"] },
  "_vendor.js": { file: "assets/vendor.js" },
  "src/home.tsx": { file: "assets/home.js", imports: ["_vendor.js", "_shared.js"], dynamicImports: ["src/editor.tsx"] },
  "src/admin.tsx": { file: "assets/admin.js", css: ["assets/admin.css"], imports: ["_shared.js"] },
  "_shared.js": { file: "assets/shared.js", css: ["assets/index.css"] },
  "src/editor.tsx": { file: "assets/editor.js" },
};

test("a route downloads its static imports once, and nothing it only imports on demand", () => {
  const home = routeClosure(manifest, ["index.html", "src/home.tsx"]);
  assert.deepEqual(home.js.sort(), ["assets/home.js", "assets/index.js", "assets/shared.js", "assets/vendor.js"]);
  assert.deepEqual(home.css, ["assets/index.css"]);
  assert.throws(() => routeClosure(manifest, ["src/missing.tsx"]), /no chunk/u);
});

test("route budgets count a shared asset once and exclude styles belonging to other pages", () => {
  const assets = {
    css: new Map([["assets/index.css", { uiBytes: 100, gzipBytes: 20 }], ["assets/admin.css", { uiBytes: 200, gzipBytes: 40 }]]),
    js: new Map(Object.values(manifest).map(({ file }) => [file, { rawBytes: 10, gzipBytes: 3 }])),
  };
  const home = measureRoute({ route: "/home", entries: ["index.html", "src/home.tsx"] }, manifest, assets);
  assert.equal(home.uiBytes, 100);
  assert.equal(home.gzipBytes, 20);
  assert.equal(home.jsBytes, 40);
  assert.equal(home.jsGzipBytes, 12);
  const admin = measureRoute({ route: "/admin", entries: ["index.html", "src/admin.tsx"] }, manifest, assets);
  assert.equal(admin.uiBytes, 300);
  assets.css.delete("assets/admin.css");
  assert.throws(() => measureRoute({ route: "/admin", entries: ["src/admin.tsx"] }, manifest, assets), /Missing CSS asset/u);
});
