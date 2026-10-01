import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

// Generate actual PNG install icons without introducing a native image dependency.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function icon(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = x / size,
        ny = y / size;
      const left =
        ny >= 0.3 &&
        ny < 0.69 &&
        Math.abs(nx - (0.31 + (ny - 0.3) * 0.34)) < 0.055;
      const right =
        ny >= 0.3 &&
        ny < 0.69 &&
        Math.abs(nx - (0.65 - (ny - 0.3) * 0.54)) < 0.055;
      const dot = (nx - 0.69) ** 2 + (ny - 0.66) ** 2 < 0.043 ** 2;
      const color =
        left || right ? [255, 255, 255] : dot ? [185, 243, 223] : [8, 127, 121];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      pixels.set([...color, 255], offset);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await writeFile(
    new URL(`../public/icons/${name}`, import.meta.url),
    icon(size),
  );
}
console.log("Generated PWA icons.");
