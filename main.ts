// news-image-20261124 — "The World in One Image"
// A newspaper-style infographic summing up Tuesday 24 November 2026.
// Node 22, standard library only, no network, fully deterministic:
// every fact below is embedded as a constant after live research.
// Writes $MAKEFUN_OUTPUT_DIR/entry.png (default ./out/entry.png).

import * as fs from "node:fs";
import * as path from "node:path";
import { deflateSync } from "node:zlib";

// ------------------------------------------------------------------
// 5x7 bitmap font (uppercase, digits, punctuation). Each glyph is
// seven rows of five cells; '#' is ink, '.' is empty.
// ------------------------------------------------------------------
type Glyph = string[];
const FONT: Record<string, Glyph> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "—": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "·": [".....", ".....", "..#..", ".....", ".....", ".....", "....."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
};
const BLANK: Glyph = [".....", ".....", ".....", ".....", ".....", ".....", "....."];

// ------------------------------------------------------------------
// Canvas: a plain RGBA buffer we paint by hand.
// ------------------------------------------------------------------
const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 4);

type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 230];
const INK: RGB = [20, 24, 31];
const NAVY: RGB = [18, 40, 75];
const NAVY2: RGB = [28, 58, 104];
const RED: RGB = [179, 32, 44];
const GOLD: RGB = [212, 175, 90];
const GREY: RGB = [96, 100, 110];
const LIGHT: RGB = [255, 255, 255];
const CREAM: RGB = [233, 226, 208];

function setPx(x: number, y: number, c: RGB): void {
  // Round: icon geometry uses fractional units (size / 16), and a
  // fractional index into the RGBA buffer would shift bytes by
  // half a pixel and corrupt neighbouring colours.
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
  img[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  // Round first: icon coordinates are fractional (u = size / 16), and
  // Bresenham with fractional endpoints never lands on the end point.
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPx(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, thick: number): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let t = 0; t < thick; t++) {
      setPx(Math.round(cx + (r - t) * Math.cos(rad)), Math.round(cy + (r - t) * Math.sin(rad)), c);
    }
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPx(x, y, c);
    }
  }
}

// ------------------------------------------------------------------
// Text: draw one glyph, measure, draw a line, wrap a paragraph.
// ------------------------------------------------------------------
function drawGlyph(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch] ?? BLANK;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "#") fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) drawGlyph(up[i], x + i * 6 * scale, y, scale, c);
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s.toUpperCase(), scale) / 2), y, scale, c);
}

function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.toUpperCase().split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(s: string, x: number, y: number, scale: number, maxW: number, c: RGB, maxLines: number): number {
  const lines = wrapText(s, scale, maxW).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * (7 * scale + 4), scale, c);
  }
  return lines.length;
}

// ------------------------------------------------------------------
// PNG writer: raw scanlines (filter 0) + zlib deflate + CRC32.
// ------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (1 + w * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------
// Icons: small line-art pictograms, drawn in a square tile.
// Each takes the tile's top-left corner and its size.
// ------------------------------------------------------------------
function tile(x: number, y: number, s: number, bg: RGB): void {
  fillRect(x, y, s, s, bg);
  fillRect(x, y, s, 3, RED);
}

function iconChip(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  fillRect(x + 5 * u, y + 5 * u, 6 * u, 6 * u, c);
  fillRect(x + 7 * u, y + 7 * u, 2 * u, 2 * u, PAPER);
  for (let i = 0; i < 3; i++) {
    const p = (5 + i * 2) * u;
    fillRect(x + p, y + 2 * u, u, 3 * u, c);
    fillRect(x + p, y + 11 * u, u, 3 * u, c);
    fillRect(x + 2 * u, y + p, 3 * u, u, c);
    fillRect(x + 11 * u, y + p, 3 * u, u, c);
  }
}

function iconJet(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  fillTriangle(x + 13 * u, y + 3 * u, x + 3 * u, y + 10 * u, x + 3 * u, y + 13 * u, c);
  fillTriangle(x + 8 * u, y + 8 * u, x + 3 * u, y + 15 * u, x + 6 * u, y + 15 * u, c);
  fillTriangle(x + 8 * u, y + 8 * u, x + 13 * u, y + 13 * u, x + 13 * u, y + 10 * u, c);
  drawLine(x + 2 * u, y + 13 * u, x + 8 * u, y + 13 * u, c);
}

function iconRadar(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  circleOutline(x + 8 * u, y + 8 * u, 6 * u, c, 2);
  circleOutline(x + 8 * u, y + 8 * u, 3 * u, c, 1);
  fillCircle(x + 8 * u, y + 8 * u, u, c);
  drawLine(x + 8 * u, y + 8 * u, x + 13 * u, y + 3 * u, c);
  drawLine(x + 8 * u, y + 8 * u, x + 3 * u, y + 12 * u, c);
}

function iconShip(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  fillTriangle(x + 2 * u, y + 10 * u, x + 14 * u, y + 10 * u, x + 12 * u, y + 13 * u, c);
  fillRect(x + 2 * u, y + 10 * u, 12 * u, u, c);
  drawLine(x + 8 * u, y + 10 * u, x + 8 * u, y + 3 * u, c);
  fillTriangle(x + 8 * u, y + 3 * u, x + 8 * u, y + 7 * u, x + 12 * u, y + 7 * u, c);
  drawLine(x + 2 * u, y + 14 * u, x + 5 * u, y + 14 * u, c);
  drawLine(x + 7 * u, y + 14 * u, x + 10 * u, y + 14 * u, c);
  drawLine(x + 12 * u, y + 14 * u, x + 14 * u, y + 14 * u, c);
}

function iconGlobe(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  circleOutline(x + 8 * u, y + 8 * u, 6 * u, c, 2);
  drawLine(x + 2 * u, y + 8 * u, x + 14 * u, y + 8 * u, c);
  drawLine(x + 4 * u, y + 4 * u, x + 12 * u, y + 4 * u, c);
  drawLine(x + 4 * u, y + 12 * u, x + 12 * u, y + 12 * u, c);
  drawLine(x + 8 * u, y + 2 * u, x + 8 * u, y + 14 * u, c);
  drawLine(x + 5 * u, y + 3 * u, x + 11 * u, y + 13 * u, c);
}

function iconFlame(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  fillTriangle(x + 8 * u, y + 2 * u, x + 3 * u, y + 11 * u, x + 13 * u, y + 11 * u, c);
  fillCircle(x + 8 * u, y + 10 * u, 4 * u, c);
  fillCircle(x + 5 * u, y + 11 * u, 2 * u, PAPER);
}

function iconCuffs(x: number, y: number, s: number, c: RGB): void {
  const u = s / 16;
  circleOutline(x + 5 * u, y + 9 * u, 3 * u, c, 2);
  circleOutline(x + 11 * u, y + 9 * u, 3 * u, c, 2);
  drawLine(x + 7 * u, y + 6 * u, x + 9 * u, y + 6 * u, c);
  drawLine(x + 8 * u, y + 6 * u, x + 8 * u, y + 3 * u, c);
}

// ------------------------------------------------------------------
// The day's news — every fact verified against live reporting
// (Reuters, AP, CNN) on 24 November 2026 before being embedded.
// ------------------------------------------------------------------
type Story = {
  tag: string;
  head: string;
  sub: string;
  icon: (x: number, y: number, s: number, c: RGB) => void;
  accent: RGB;
};

const LEAD: Story = {
  tag: "BUSINESS · USA",
  head: "NVIDIA REINSTATES JENSEN HUANG",
  sub: "Shares surge 31% as the board votes unanimously to bring him back, days after his removal — after Trump urged his return.",
  icon: iconChip,
  accent: NAVY2,
};

const STORIES: Story[] = [
  {
    tag: "SECURITY · ASIA",
    head: "RUSSIAN JETS ENTER S. KOREA ZONE",
    sub: "Seoul scrambles fighters; island alert lifted in minutes. No violation.",
    icon: iconJet,
    accent: NAVY2,
  },
  {
    tag: "EUROPE · NATO",
    head: "NATO SENDS AWACS JET TO POLAND",
    sub: "After three Russian missiles land, the alliance boosts early-warning patrols.",
    icon: iconRadar,
    accent: NAVY2,
  },
  {
    tag: "WAR · LIBYA",
    head: "UKRAINE SINKS RUSSIAN WARSHIP",
    sub: "Sea drones strike a corvette in Benghazi port, widening the war beyond Europe.",
    icon: iconShip,
    accent: NAVY2,
  },
  {
    tag: "CLIMATE · ANTALYA",
    head: "COP31 CLIMATE TALKS COLLAPSE",
    sub: "No deal as nations split over fossil fuels; called the 'worst COP ever'.",
    icon: iconGlobe,
    accent: NAVY2,
  },
  {
    tag: "DISASTER · INDONESIA",
    head: "24 DEAD IN INDONESIA FACTORY FIRE",
    sub: "Candy plant blaze confirmed; search goes on for about 30 missing.",
    icon: iconFlame,
    accent: NAVY2,
  },
  {
    tag: "CRIME · MEXICO",
    head: "MEXICO CAPTURES 'CHAPO ISIDRO'",
    sub: "Top cartel suspect nabbed with US intelligence help.",
    icon: iconCuffs,
    accent: NAVY2,
  },
];

const TICKER =
  "MARKETS: NASDAQ +6% · S&P 500 +5% · GOLD $3,645 · JAPAN FACTORY PMI 53.7";
const FOOTER = "SOURCES: REUTERS · AP · CNN · 24 NOVEMBER 2026";

// ------------------------------------------------------------------
// Layout — 1024 x 1024 newspaper front page.
// ------------------------------------------------------------------
function drawMasthead(): void {
  fillRect(0, 0, W, 148, NAVY);
  fillRect(0, 148, W, 6, RED);
  drawText("WORLD NEWS", 36, 26, 6, LIGHT);
  drawText("TUESDAY", W - 36 - textWidth("TUESDAY", 4), 30, 4, GOLD);
  drawTextCentered("24 NOVEMBER 2026", W / 2, 92, 5, LIGHT);
  drawLine(36, 112, 36 + 150, 112, RED);
  drawLine(W - 36 - 150, 112, W - 36, 112, RED);
}

function drawLead(st: Story): void {
  const y = 178;
  const box = 132;
  tile(36, y, box, CREAM);
  st.icon(36 + 14, y + 14, box - 28, st.accent);
  const tx = 36 + box + 24;
  const tw = W - 36 - tx;
  drawText(st.tag, tx, y + 2, 2, RED);
  drawPara(st.head, tx, y + 26, 4, tw, INK, 2);
  drawPara(st.sub, tx, y + 26 + 2 * (7 * 4 + 4) + 8, 2, tw, GREY, 3);
  fillRect(36, y + box + 18, W - 72, 2, CREAM);
}

function drawStory(st: Story, x: number, y: number, w: number): void {
  const box = 88;
  tile(x, y, box, CREAM);
  st.icon(x + 10, y + 10, box - 20, st.accent);
  const tx = x + box + 14;
  const tw = w - box - 14;
  drawText(st.tag, tx, y + 2, 2, RED);
  drawPara(st.head, tx, y + 24, 3, tw, INK, 2);
  drawPara(st.sub, tx, y + 24 + 2 * (7 * 3 + 4) + 6, 2, tw, GREY, 3);
}

function drawTicker(): void {
  const y = 898;
  fillRect(0, y, W, 58, NAVY);
  drawTextCentered(TICKER, W / 2, y + 19, 2, LIGHT);
  drawTextCentered(FOOTER, W / 2, 972, 2, GREY);
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead(LEAD);
  const colW = Math.floor((W - 72 - 28) / 2);
  const rowH = 168;
  const top = 366;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawStory(STORIES[i], 36 + col * (colW + 28), top + row * rowH, colW);
  }
  drawTicker();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "entry.png");
  fs.writeFileSync(out, encodePng(W, H, img));
}

main();
