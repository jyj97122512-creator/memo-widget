// 테스트용 frame PNG 생성 스크립트
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function uint32BE(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n >>> 0);
  return buf;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++)
      crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : (crc >>> 1);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([t, data]));
  return Buffer.concat([uint32BE(data.length), t, data, uint32BE(crc)]);
}

function makePNG(pixels, w, h) {
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0);
    for (let x = 0; x < w; x++) {
      raw.push(...pixels[y][x]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Buffer.concat([
      uint32BE(w), uint32BE(h),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const OUT = path.join(__dirname, '../public/images');

// 공통 색상
const T   = [0, 0, 0, 0];        // 투명
const W   = [255, 255, 255, 255]; // 흰색
const G1  = [156, 175, 115, 255]; // #9caf73 (기본 초록)
const G2  = [106, 125, 74, 255];  // #6a7d4a (어두운 초록)
const G3  = [200, 213, 157, 255]; // #c8d59d (연한 초록)
const DOT = [180, 200, 140, 255]; // 점선용 중간 초록

// ── A: 단색 실선 (기준) ────────────────────────────────────
// 10×10, 2px 테두리
{
  const SZ = 10;
  const pixels = [];
  for (let y = 0; y < SZ; y++) {
    pixels[y] = [];
    for (let x = 0; x < SZ; x++) {
      const border = x < 2 || x >= SZ-2 || y < 2 || y >= SZ-2;
      pixels[y][x] = border ? G1 : T;
    }
  }
  fs.writeFileSync(path.join(OUT, 'frame-a-solid.png'), makePNG(pixels, SZ, SZ));
  console.log('A: frame-a-solid.png');
}

// ── B: Win98 bevel (바깥 밝고 안 어둡게) ──────────────────
// 10×10, 2px. 픽셀 0=하이라이트(흰), 1=그린, 9번=어두운, 8번=그린
{
  const SZ = 10;
  const pixels = [];
  for (let y = 0; y < SZ; y++) {
    pixels[y] = [];
    for (let x = 0; x < SZ; x++) {
      let c = T;
      // 바깥 라인 (0, SZ-1)
      if (x === 0 || y === 0) c = W;
      else if (x === SZ-1 || y === SZ-1) c = G2;
      // 안쪽 라인 (1, SZ-2)
      else if (x === 1 || y === 1) c = G1;
      else if (x === SZ-2 || y === SZ-2) c = G1;
      pixels[y][x] = c;
    }
  }
  fs.writeFileSync(path.join(OUT, 'frame-b-bevel.png'), makePNG(pixels, SZ, SZ));
  console.log('B: frame-b-bevel.png');
}

// ── C: 점선 패턴 ──────────────────────────────────────────
// 10×10, 2px. 짝수 픽셀만 색상 → 점선 느낌
{
  const SZ = 10;
  const pixels = [];
  for (let y = 0; y < SZ; y++) {
    pixels[y] = [];
    for (let x = 0; x < SZ; x++) {
      const onBorder = x < 2 || x >= SZ-2 || y < 2 || y >= SZ-2;
      const isOdd = (x + y) % 2 === 0;
      if (onBorder) {
        pixels[y][x] = isOdd ? G1 : G3;
      } else {
        pixels[y][x] = T;
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'frame-c-dotted.png'), makePNG(pixels, SZ, SZ));
  console.log('C: frame-c-dotted.png');
}

// ── D: 이중 테두리 (Double border) ────────────────────────
// 14×14, outer 1px G2, gap 1px T, inner 1px G1
{
  const SZ = 14;
  const pixels = [];
  for (let y = 0; y < SZ; y++) {
    pixels[y] = [];
    for (let x = 0; x < SZ; x++) {
      let c = T;
      // outer (0, SZ-1)
      if (x === 0 || x === SZ-1 || y === 0 || y === SZ-1) c = G2;
      // gap (1, SZ-2) → 투명
      // inner (2, SZ-3)
      else if (x === 2 || x === SZ-3 || y === 2 || y === SZ-3) c = G1;
      pixels[y][x] = c;
    }
  }
  fs.writeFileSync(path.join(OUT, 'frame-d-double.png'), makePNG(pixels, SZ, SZ));
  console.log('D: frame-d-double.png');
}

console.log('Done — all frames in public/images/');
