import { copyFile, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// A single vector source keeps installed apps, browser tabs and the UI in sync.
const source = new URL("../config/brand.svg", import.meta.url);
const publicDir = new URL("../public/", import.meta.url);
const svg = await readFile(source);
await copyFile(source, new URL("logo.svg", publicDir));
await writeFile(new URL("logo.png", publicDir), await sharp(svg).resize(512, 512).png().toBuffer());

for (const [name, size, inset] of [
  ["pwa-64x64.png", 64, 4],
  ["pwa-192x192.png", 192, 12],
  ["pwa-512x512.png", 512, 32],
  ["apple-touch-icon-180x180.png", 180, 16],
  ["maskable-icon-512x512.png", 512, 80],
]) {
  const mark = await sharp(svg).resize(size - inset * 2).png().toBuffer();
  const png = await sharp({ create: { width: size, height: size, channels: 4, background: "#f5f7fb" } })
    .composite([{ input: mark, left: inset, top: inset }]).png().toBuffer();
  await writeFile(new URL(name, publicDir), png);
}

const png = await sharp(svg).resize(32, 32).png().toBuffer();
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
