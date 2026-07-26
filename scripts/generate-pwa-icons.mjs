import {deflateSync} from 'node:zlib';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'public', 'icons');
mkdirSync(outputDir, {recursive: true});

const crcTable = Array.from({length: 256}, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i += 1) {
    value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createPng(size, maskable = false) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const inset = maskable ? 0.1 : 0.03;
  const radius = size * (maskable ? 0.18 : 0.22);
  const outerMin = size * inset;
  const outerMax = size * (1 - inset);

  const insideRoundedRect = (x, y) => {
    const cx = Math.max(outerMin + radius, Math.min(x, outerMax - radius));
    const cy = Math.max(outerMin + radius, Math.min(y, outerMax - radius));
    return ((x - cx) ** 2 + (y - cy) ** 2) <= radius ** 2;
  };

  const bolt = [
    [0.56, 0.15], [0.30, 0.55], [0.47, 0.55],
    [0.43, 0.84], [0.70, 0.43], [0.52, 0.43],
  ];
  const inPolygon = (x, y) => {
    let inside = false;
    for (let i = 0, j = bolt.length - 1; i < bolt.length; j = i++) {
      const [xi, yi] = bolt[i];
      const [xj, yj] = bolt[j];
      const intersects = ((yi > y) !== (yj > y))
        && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      const offset = row + 1 + x * 4;
      let color = maskable || insideRoundedRect(x, y)
        ? [10, 10, 11, 255]
        : [0, 0, 0, 0];
      if (inPolygon(x / size, y / size)) color = [16, 185, 129, 255];
      pixels.set(color, offset);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]) {
  writeFileSync(resolve(outputDir, name), createPng(size, maskable));
}

console.log('Generated PWA icons.');
