import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function createPNG(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const bgR = 0x3b, bgG = 0x82, bgB = 0xf6;

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 4;
      const margin = size * 0.08;
      const r = size * 0.18;
      let inside = x >= margin && x < size - margin && y >= margin && y < size - margin;
      if (inside) {
        const lx = x - margin, ly = y - margin;
        const w = size - 2 * margin;
        if ((lx < r || lx > w - r) && (ly < r || ly > w - r)) {
          const cx = lx < r ? r : w - r;
          const cy = ly < r ? r : w - r;
          if ((lx - cx) ** 2 + (ly - cy) ** 2 > r * r) inside = false;
        }
      }
      if (!inside) { raw[px + 3] = 0; continue; }

      // "C" letter in center
      const cx = size / 2, cy = size / 2;
      const outerR = size * 0.3, innerR = size * 0.2;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const isRing = dist >= innerR && dist <= outerR;
      const isOpenGap = angle > -0.7 && angle < 0.7;
      const isC = isRing && !isOpenGap;

      if (isC) {
        raw[px] = 255; raw[px + 1] = 255; raw[px + 2] = 255; raw[px + 3] = 255;
      } else {
        raw[px] = bgR; raw[px + 1] = bgG; raw[px + 2] = bgB; raw[px + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const dir = join(__dirname, '..', 'public', 'icons');
for (const s of [192, 512]) {
  const png = createPNG(s);
  writeFileSync(join(dir, `icon-${s}.png`), png);
  console.log(`icon-${s}.png (${png.length} bytes)`);
}
console.log('Done!');
