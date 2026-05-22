/**
 * generate-screenshots.js
 * Generates minimal valid PNG screenshots for PWA manifest.
 * Uses ONLY built-in Node.js modules — no native deps required.
 *
 * Run: node generate-screenshots.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'public');

// ── Pure-JS PNG encoder ───────────────────────────────────────────────────

function crc32(buf) {
  // CRC table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row by row

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB (we'll convert RGBA -> RGB)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build raw scanlines (RGB, filter byte 0 prepended)
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const pi = (y * width + x) * 4;
      const ri = y * (1 + width * 3) + 1 + x * 3;
      raw[ri]     = pixels[pi];     // R
      raw[ri + 1] = pixels[pi + 1]; // G
      raw[ri + 2] = pixels[pi + 2]; // B
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing primitives on a pixel buffer ─────────────────────────────────

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 4); // RGBA
    // Fill black
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 4 + 3] = 255;
    }
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    // Alpha blend onto existing
    const fa = a / 255;
    this.buf[i]     = Math.round(this.buf[i]     * (1 - fa) + r * fa);
    this.buf[i + 1] = Math.round(this.buf[i + 1] * (1 - fa) + g * fa);
    this.buf[i + 2] = Math.round(this.buf[i + 2] * (1 - fa) + b * fa);
    this.buf[i + 3] = 255;
  }

  fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        this.setPixel(col, row, r, g, b, a);
      }
    }
  }

  // Draw a horizontal line of pixels
  hline(x1, x2, y, r, g, b, a = 255) {
    for (let x = x1; x <= x2; x++) this.setPixel(x, y, r, g, b, a);
  }

  // Filled rounded rectangle
  fillRounded(x, y, w, h, radius, r, g, b, a = 255) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        // Check corners
        let inCorner = false;
        if (col < x + radius && row < y + radius) {
          const dx = col - (x + radius), dy = row - (y + radius);
          inCorner = dx * dx + dy * dy > radius * radius;
        } else if (col >= x + w - radius && row < y + radius) {
          const dx = col - (x + w - radius - 1), dy = row - (y + radius);
          inCorner = dx * dx + dy * dy > radius * radius;
        } else if (col < x + radius && row >= y + h - radius) {
          const dx = col - (x + radius), dy = row - (y + h - radius - 1);
          inCorner = dx * dx + dy * dy > radius * radius;
        } else if (col >= x + w - radius && row >= y + h - radius) {
          const dx = col - (x + w - radius - 1), dy = row - (y + h - radius - 1);
          inCorner = dx * dx + dy * dy > radius * radius;
        }
        if (!inCorner) this.setPixel(col, row, r, g, b, a);
      }
    }
  }

  // Horizontal gradient fill
  gradientRect(x, y, w, h, r1, g1, b1, r2, g2, b2, a = 255) {
    for (let col = x; col < x + w; col++) {
      const t = (col - x) / (w - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const bv = Math.round(b1 + (b2 - b1) * t);
      for (let row = y; row < y + h; row++) {
        this.setPixel(col, row, r, g, bv, a);
      }
    }
  }

  toPNG() {
    return makePNG(this.w, this.h, this.buf);
  }
}

// ── Brand colours ─────────────────────────────────────────────────────────
const GOLD   = [250, 204, 21];  // #facc15
const GOLD2  = [202, 138,  4];  // #ca8a04
const BG     = [ 10,  10, 20];  // #0a0a14
const CARD   = [ 20,  20, 34];  // card bg
const WHITE  = [255, 255, 255];
const GRAY   = [120, 120, 140];
const RED    = [239,  68,  68];
const ORANGE = [249, 115,  22];
const GREEN  = [ 34, 197,  94];
const BLUE   = [ 59, 130, 246];

// ── Helper to draw a "pill" label (filled rounded rect) ───────────────────
function pill(c, x, y, w, h, col) {
  c.fillRounded(x, y, w, h, Math.floor(h / 2), ...col);
}

// ── WIDE screenshot (1280 × 720) ──────────────────────────────────────────
function buildWide() {
  const W = 1280, H = 720;
  const c = new Canvas(W, H);

  // Background
  c.fillRect(0, 0, W, H, ...BG);

  // Subtle vertical grid lines (low opacity)
  for (let x = 0; x < W; x += 60) {
    for (let y = 0; y < H; y++) c.setPixel(x, y, 250, 204, 21, 12);
  }

  // ── Gold hero glow gradient (top-left quadrant) ──
  for (let y = 56; y < 380; y++) {
    for (let x = 0; x < 800; x++) {
      const t = 1 - x / 800;
      const yt = 1 - (y - 56) / 324;
      const a = Math.round(18 * t * yt);
      c.setPixel(x, y, 250, 204, 21, a);
    }
  }

  // ── Navbar ──────────────────────────────────────────────────────────────
  c.fillRect(0, 0, W, 56, 8, 8, 18);

  // Logo pill
  c.gradientRect(20, 14, 160, 28, ...GOLD, ...GOLD2);
  // (no font rendering — use a block pattern for "logo")
  c.fillRounded(24, 18, 152, 20, 10, ...GOLD, 180);

  // Nav link underline dots (represent active links visually)
  const linkXs = [240, 360, 480, 600, 720];
  linkXs.forEach((x, i) => {
    const alpha = i === 0 ? 255 : 140;
    c.fillRect(x, 20, 80, 16, ...WHITE, alpha);
    if (i === 0) c.fillRect(x, 38, 80, 2, ...GOLD);
  });

  // Login button
  c.fillRounded(W - 130, 14, 110, 28, 14, ...GOLD, 30);
  for (let x = W - 130; x < W - 20; x++) {
    c.setPixel(x, 14, ...GOLD, 180);
    c.setPixel(x, 41, ...GOLD, 180);
  }
  for (let y = 14; y < 42; y++) {
    c.setPixel(W - 130, y, ...GOLD, 180);
    c.setPixel(W - 20, y, ...GOLD, 180);
  }

  // ── Hero text area ───────────────────────────────────────────────────────
  // "DOMINATE" — drawn as thick yellow blocks
  const heroBlocks = [
    { x: 60, y: 90,  w: 440, h: 64, col: GOLD },
    { x: 60, y: 168, w: 360, h: 64, col: WHITE },
    { x: 60, y: 246, w: 500, h: 18, col: GRAY },
  ];
  heroBlocks.forEach(b => c.fillRect(b.x, b.y, b.w, b.h, ...b.col));

  // CTA Buttons
  c.gradientRect(60, 284, 200, 48, ...GOLD, ...GOLD2);
  c.fillRounded(60, 284, 200, 48, 24, ...GOLD, 0); // transparent fill just for clip
  c.gradientRect(60, 284, 200, 48, ...GOLD, ...GOLD2);

  c.fillRounded(278, 284, 176, 48, 24, ...GOLD, 20);
  for (let x = 278; x < 454; x++) { c.setPixel(x, 284, ...GOLD, 160); c.setPixel(x, 331, ...GOLD, 160); }
  for (let y = 284; y < 332; y++) { c.setPixel(278, y, ...GOLD, 160); c.setPixel(453, y, ...GOLD, 160); }

  // Stats row
  [0, 1, 2].forEach(i => {
    const sx = 60 + i * 180;
    c.fillRect(sx, 350, 60, 26, ...GOLD);
    c.fillRect(sx, 382, 120, 14, ...GRAY, 180);
  });

  // ── Tournament Cards ─────────────────────────────────────────────────────
  c.fillRect(60, 420, 220, 18, ...GOLD);
  c.fillRect(60, 444, 60, 3, ...GOLD, 120);

  const cardColors = [ORANGE, GREEN, BLUE, GOLD];
  const cardXStart = [60, 340, 620, 900];

  cardXStart.forEach((cx, i) => {
    const col = cardColors[i];
    // Card background
    c.fillRounded(cx, 468, 250, 220, 12, ...CARD);
    // Card border
    for (let y = 468; y < 688; y++) {
      c.setPixel(cx, y, ...GOLD, 50);
      c.setPixel(cx + 249, y, ...GOLD, 50);
    }
    for (let x = cx; x < cx + 250; x++) {
      c.setPixel(x, 468, ...GOLD, 50);
      c.setPixel(x, 687, ...GOLD, 50);
    }
    // Header strip
    c.fillRect(cx, 468, 250, 50, ...col, 50);
    // Game name block
    c.fillRect(cx + 14, 490, 100, 18, ...WHITE);
    // LIVE badge
    c.fillRounded(cx + 182, 478, 54, 20, 10, ...RED);
    // Prize block
    c.fillRect(cx + 14, 540, 50, 12, ...GRAY, 180);
    c.fillRect(cx + 14, 558, 100, 24, ...GOLD);
    c.fillRect(cx + 14, 588, 70, 12, ...GRAY, 160);
    // Register button
    c.gradientRect(cx + 14, 618, 222, 34, ...GOLD, ...GOLD2);
    c.fillRounded(cx + 14, 618, 222, 34, 17, ...GOLD, 0);
    c.gradientRect(cx + 14, 618, 222, 34, ...GOLD, ...GOLD2);
  });

  // ── Footer line ──────────────────────────────────────────────────────────
  c.fillRect(0, H - 1, W, 1, ...GOLD, 60);

  return c.toPNG();
}

// ── NARROW screenshot (390 × 844) ─────────────────────────────────────────
function buildNarrow() {
  const W = 390, H = 844;
  const c = new Canvas(W, H);

  // Background
  c.fillRect(0, 0, W, H, ...BG);

  // Grid
  for (let x = 0; x < W; x += 40) {
    for (let y = 0; y < H; y++) c.setPixel(x, y, 250, 204, 21, 10);
  }

  // Hero glow
  for (let y = 44; y < 320; y++) {
    for (let x = 0; x < W; x++) {
      const t = 1 - Math.abs(x - W / 2) / (W / 2);
      const yt = 1 - (y - 44) / 276;
      c.setPixel(x, y, 250, 204, 21, Math.round(16 * t * yt));
    }
  }

  // ── Status bar ──────────────────────────────────────────────────────────
  c.fillRect(0, 0, W, 44, 8, 8, 18);
  c.fillRect(10, 16, 40, 12, ...WHITE);     // time block
  c.fillRect(W - 60, 16, 12, 12, ...WHITE); // signal
  c.fillRect(W - 42, 16, 12, 12, ...WHITE);
  c.fillRect(W - 24, 16, 12, 12, ...WHITE);

  // ── Navbar ──────────────────────────────────────────────────────────────
  c.fillRect(0, 44, W, 52, 8, 8, 18);
  c.fillRect(0, 95, W, 1, ...GOLD, 60);

  // Logo
  c.gradientRect(16, 56, 140, 28, ...GOLD, ...GOLD2);
  c.fillRounded(16, 56, 140, 28, 14, ...GOLD, 0);
  c.gradientRect(16, 56, 140, 28, ...GOLD, ...GOLD2);

  // Hamburger
  [66, 73, 80].forEach(y => c.fillRect(W - 46, y, 26, 2, ...GOLD));

  // ── Hero ────────────────────────────────────────────────────────────────
  c.fillRect(40, 108, 310, 56, ...GOLD);       // DOMINATE
  c.fillRect(40, 174, 280, 56, ...WHITE);      // THE ARENA
  c.fillRect(60, 244, 270, 14, ...GRAY, 180);  // subtitle

  // CTA
  c.gradientRect(20, 272, W - 40, 46, ...GOLD, ...GOLD2);
  c.fillRounded(20, 272, W - 40, 46, 23, ...GOLD, 0);
  c.gradientRect(20, 272, W - 40, 46, ...GOLD, ...GOLD2);

  // Stats
  [0, 1, 2].forEach(i => {
    const sx = 20 + i * 118;
    c.fillRounded(sx, 332, 110, 56, 10, ...CARD);
    c.fillRect(sx + 10, 348, 60, 20, ...GOLD);
    c.fillRect(sx + 10, 374, 80, 10, ...GRAY, 160);
  });

  // ── Live Tournaments ────────────────────────────────────────────────────
  c.fillRect(20, 406, 180, 16, ...GOLD);
  c.fillRect(20, 426, 50, 2, ...GOLD, 120);

  const mcolors = [ORANGE, GREEN, BLUE];
  mcolors.forEach((col, i) => {
    const cy = 436 + i * 120;
    c.fillRounded(20, cy, W - 40, 112, 12, ...CARD);
    for (let y = cy; y < cy + 112; y++) {
      c.setPixel(20,       y, ...GOLD, 50);
      c.setPixel(W - 21,   y, ...GOLD, 50);
    }
    for (let x = 20; x < W - 20; x++) {
      c.setPixel(x, cy,        ...GOLD, 50);
      c.setPixel(x, cy + 111,  ...GOLD, 50);
    }
    // Left color accent bar
    c.fillRect(20, cy, 4, 112, ...col);

    // LIVE badge
    c.fillRounded(W - 74, cy + 14, 54, 20, 10, ...RED);

    // Game name, prize, button
    c.fillRect(36, cy + 22, 90, 16, ...WHITE);
    c.fillRect(36, cy + 46, 50, 11, ...GRAY, 160);
    c.fillRect(36, cy + 63, 80, 22, ...GOLD);
    c.fillRect(36, cy + 92, 60, 10, ...GRAY, 140);

    // Register button
    c.gradientRect(W - 110, cy + 58, 90, 30, ...GOLD, ...GOLD2);
    c.fillRounded(W - 110, cy + 58, 90, 30, 15, ...GOLD, 0);
    c.gradientRect(W - 110, cy + 58, 90, 30, ...GOLD, ...GOLD2);
  });

  // ── Bottom nav ──────────────────────────────────────────────────────────
  c.fillRect(0, H - 70, W, 70, 8, 8, 18);
  c.fillRect(0, H - 70, W, 1, ...GOLD, 60);

  [0, 1, 2, 3, 4].forEach(i => {
    const nx = 20 + i * 72;
    c.fillRect(nx + 10, H - 56, 30, 24, ...WHITE, i === 0 ? 255 : 80);
    if (i === 0) c.fillRect(nx + 10, H - 26, 30, 3, ...GOLD);
    else c.fillRect(nx + 10, H - 26, 30, 8, ...GRAY, 100);
  });

  return c.toPNG();
}

// ── Write files ─────────────────────────────────────────────────────────────
try {
  fs.writeFileSync(path.join(OUT, 'screenshot-wide.png'), buildWide());
  console.log('✅ public/screenshot-wide.png   (1280×720)');
  fs.writeFileSync(path.join(OUT, 'screenshot-narrow.png'), buildNarrow());
  console.log('✅ public/screenshot-narrow.png  (390×844)');
  console.log('\nAll screenshots generated! Update manifest.json and commit.');
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
}
