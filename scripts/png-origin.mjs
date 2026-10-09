import { crc32 } from "node:zlib";

/** Add origin metadata without decoding or changing the generated PNG pixels. */
export function withPngOrigin(png, origin) {
  const type = Buffer.from("tEXt");
  const text = Buffer.from(`impeccable:prompt\0${origin}`, "latin1");
  const chunk = Buffer.alloc(text.length + 12);
  chunk.writeUInt32BE(text.length, 0);
  type.copy(chunk, 4);
  text.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, text])), text.length + 8);
  // Sharp encodes IEND as the final 12-byte chunk.
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}
