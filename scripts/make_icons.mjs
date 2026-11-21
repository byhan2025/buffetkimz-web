#!/usr/bin/env node
/**
 * v7.9.0 — 확정 심볼(public/favicon.svg)에서 파비콘·앱 아이콘 PNG를 굽는다.
 *   16 · 32  : 투명 배경(기본색) — 브라우저 탭
 *   180      : 애플 터치 아이콘 — iOS는 투명을 검게 채우므로 딥네이비 바탕 + 밝은 심볼
 *   512      : 앱 아이콘 · JSON-LD 조직 로고 — 같은 바탕
 * 실행: node scripts/make_icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const paths = JSON.parse(fs.readFileSync(path.join(ROOT, "tmp/brand-assets/favicon-paths.json"), "utf8"));

const NAVY = "#0a1a3c";
const BLUE = "#1f4ffd";
const PAPER = "#f5f7ff";
const BLUE_LIGHT = "#8fa9ff";
const BG = "#0b162c";

const base = (ring, arc) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <path fill="${ring}" fill-rule="evenodd" d="${paths.navy}"/>
  <path fill="${arc}" fill-rule="evenodd" d="${paths.blue}"/>
</svg>`;

const lightSvg = base(NAVY, BLUE);
const darkSvg = base(PAPER, BLUE_LIGHT);
// 아이콘은 심볼을 78%로 줄여 가장자리 여백을 둔다(마스크·둥근 모서리에서 잘리지 않게)
const inset = (svg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><g transform="translate(110 110) scale(0.78)">${svg.replace(
    /^<svg[^>]*>|<\/svg>$/g,
    ""
  )}</g></svg>`;

const out = (name) => path.join(ROOT, "public", name);

const tasks = [
  { file: "favicon-16.png", size: 16, svg: lightSvg, bg: null },
  { file: "favicon-32.png", size: 32, svg: lightSvg, bg: null },
  { file: "apple-touch-icon.png", size: 180, svg: inset(darkSvg), bg: BG },
  { file: "icon-512.png", size: 512, svg: inset(darkSvg), bg: BG },
];

for (const t of tasks) {
  let img = sharp(Buffer.from(t.svg), { density: 600 }).resize(t.size, t.size);
  if (t.bg) {
    const symbol = await img.png().toBuffer();
    img = sharp({ create: { width: t.size, height: t.size, channels: 4, background: t.bg } }).composite([
      { input: symbol, left: 0, top: 0 },
    ]);
  }
  await img.png({ compressionLevel: 9 }).toFile(out(t.file));
  console.log("wrote", t.file, t.size);
}
