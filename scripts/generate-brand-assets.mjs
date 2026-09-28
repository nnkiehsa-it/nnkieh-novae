import { copyFile, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// A single vector source keeps installed apps, browser tabs and the UI in sync.
const source = new URL("../config/brand.svg", import.meta.url);
const publicDir = new URL("../public/", import.meta.url);
const svg = await readFile(source);
await copyFile(source, new URL("logo.svg", publicDir));
await writeFile(new URL("logo.png", publicDir), await sharp(svg).resize(512, 512, { fit: "contain", background: "transparent" }).png().toBuffer());

for (const [name, size, opaque] of [
  ["pwa-64x64.png", 64, false],
  ["pwa-192x192.png", 192, false],
  ["pwa-512x512.png", 512, false],
  ["apple-touch-icon-180x180.png", 180, true],
  ["maskable-icon-512x512.png", 512, true],
]) {
  const mark = sharp(svg).resize(size, size, { fit: "contain", background: "transparent" });
  if (opaque) mark.flatten({ background: "#ffffff" });
  await writeFile(new URL(name, publicDir), await mark.png().toBuffer());
}

const png = await sharp(svg).resize(32, 32, { fit: "contain", background: "transparent" }).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); // ICO type
header.writeUInt16LE(1, 4); // One PNG image
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(new URL("favicon.ico", publicDir), Buffer.concat([header, png]));
console.log("Generated Novae logo, favicon and install icons from config/brand.svg");
